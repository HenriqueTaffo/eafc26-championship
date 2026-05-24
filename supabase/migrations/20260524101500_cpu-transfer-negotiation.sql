-- v72 - CPU negotiation intelligence for transfer proposals - 24/05/2026
-- 
-- Goals:
-- 1) Allow CPU transfer offers to be answered as accepted/rejected/counter.
-- 2) Keep human-vs-human proposal behavior unchanged.
-- 3) Add a lightweight counter round tracker to avoid long counter loops.

begin;

create extension if not exists pgcrypto;

alter table if exists public.internal_transfer_proposals
  add column if not exists cpu_counter_round integer not null default 0;

create or replace function public.app_answer_internal_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_proposal_id bigint,
  p_decision text,
  p_counter_value numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
  v_proposal public.internal_transfer_proposals%rowtype;
  v_transfer_result jsonb;
  v_status text;
  v_is_cpu_offer boolean;
  v_external_buyer text;
  v_offer_value numeric;
  v_counter_round integer;
  v_reference_value numeric;
  v_acceptable_value numeric;
  v_cpu_decision text;
  v_cpu_counter_value numeric;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do vendedor invalido.');
  end if;

  v_manager_name := v_session ->> 'managerName';

  select *
    into v_proposal
  from public.internal_transfer_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Proposta nao encontrada.');
  end if;

  if lower(v_proposal.seller) <> lower(v_manager_name) then
    return jsonb_build_object('ok', false, 'message', 'Apenas o vendedor pode responder esta proposta.');
  end if;

  if v_proposal.status <> 'pending' then
    return jsonb_build_object('ok', false, 'message', 'Esta proposta ja foi respondida.');
  end if;

  v_status := lower(coalesce(trim(p_decision), ''));
  v_status := case
    when v_status in ('accepted', 'accept', 'aceitar', 'aprovado') then 'accepted'
    when v_status in ('rejected', 'reject', 'recusar', 'nao') then 'rejected'
    when v_status in ('counter', 'contraoferta', 'contra oferta') then 'counter'
    else 'rejected'
  end;

  v_offer_value := coalesce(v_proposal.proposed_value, 0);
  v_counter_round := coalesce(v_proposal.cpu_counter_round, 0);

  -- Apenas CPU decide if it accepts/rejects/counters. Para propostas humanas,
  -- manter o comportamento anterior sem contraoferta.
  if v_status = 'counter' then
    v_offer_value := coalesce(p_counter_value, 0);
    if v_offer_value <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Informe o valor da contraoferta maior que zero.');
    end if;

    v_offer_value := round(v_offer_value / 100000) * 100000;
    if v_offer_value < 1000000 then
      v_offer_value := 1000000;
    end if;

    update public.internal_transfer_proposals
       set proposed_value = v_offer_value
     where id = p_proposal_id;

    v_proposal.proposed_value := v_offer_value;
  end if;

  v_is_cpu_offer := coalesce(v_proposal.is_cpu_offer, false)
    or lower(coalesce(v_proposal.offer_source, '')) = 'cpu'
    or lower(coalesce(v_proposal.buyer, '')) = 'cpu';

  if not v_is_cpu_offer then
    if v_status = 'counter' then
      v_status := 'rejected';
    end if;

    if v_status = 'rejected' then
      update public.internal_transfer_proposals
         set status = 'rejected',
             answered_at = now(),
             answered_by = v_manager_name,
             response_message = 'Proposta recusada pelo vendedor.'
       where id = p_proposal_id;

      return jsonb_build_object('ok', true, 'message', 'Proposta recusada.', 'status', 'rejected');
    end if;

    v_transfer_result := public.app_record_internal_transfer(
      v_proposal.buyer,
      v_proposal.seller,
      v_proposal.player,
      coalesce(v_proposal.from_club, 'Negociacao interna: ' || v_proposal.seller),
      coalesce(v_proposal.overall, 0),
      coalesce(v_offer_value, 0)
    );

    if coalesce((v_transfer_result ->> 'ok')::boolean, false) is not true then
      return v_transfer_result;
    end if;

    update public.internal_transfer_proposals
       set status = 'accepted',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Proposta aceita pelo vendedor.'
     where id = p_proposal_id;

    return jsonb_build_object(
      'ok', true,
      'message', format('Proposta aceita. %s foi vendido para %s.', v_proposal.player, v_proposal.buyer),
      'status', 'accepted',
      'transfer', v_transfer_result
    );
  end if;

  v_external_buyer := case
    when lower(coalesce(v_proposal.buyer, '')) = 'cpu' then public.app_pick_external_offer_buyer(v_proposal.seller)
    else coalesce(nullif(trim(v_proposal.buyer), ''), public.app_pick_external_offer_buyer(v_proposal.seller))
  end;

  if lower(coalesce(v_proposal.buyer, '')) = 'cpu' then
    update public.internal_transfer_proposals
       set buyer = v_external_buyer
     where id = p_proposal_id;
  end if;

  if v_status = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Proposta de ' || v_external_buyer || ' recusada pelo vendedor.'
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'message', 'Proposta recusada.', 'status', 'rejected');
  end if;

  -- CPU takes a value-based decision for every valid offer.
  select greatest(
    coalesce(
      (
        select greatest(
          coalesce(t.negotiated_value, 0),
          coalesce(t.final_value, 0),
          coalesce(t.market_value, 0)
        )
        from public.transfers t
        where lower(t.player_name) = lower(v_proposal.player)
          and lower(coalesce(t.status, '')) in ('aprovado', 'approved')
        order by t.created_at desc nulls last, t.id desc
        limit 1
      ),
      coalesce(v_offer_value, 0)
    ),
    1000000
  )
  into v_reference_value;

  v_acceptable_value := round(
    v_reference_value *
    case
      when coalesce(v_proposal.overall, 0) >= 84 then 1.20
      when coalesce(v_proposal.overall, 0) >= 80 then 1.15
      else 1.10
    end
    / 100000,
    0
  ) * 100000;

  if v_offer_value >= v_acceptable_value then
    v_cpu_decision := 'accepted';
  elsif v_counter_round >= 2 then
    v_cpu_decision := 'rejected';
  else
    v_cpu_decision := 'counter';
    v_cpu_counter_value := greatest(v_acceptable_value, round(v_offer_value * 1.08 / 100000, 0) * 100000);
    if v_cpu_counter_value = v_offer_value then
      v_cpu_counter_value := v_acceptable_value;
    end if;
  end if;

  if v_cpu_decision = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'CPU recusou a proposta por baixo valor.',
           cpu_counter_round = coalesce(cpu_counter_round, 0)
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'message', 'Proposta recusada pela CPU.', 'status', 'rejected');
  end if;

  if v_cpu_decision = 'counter' then
    update public.internal_transfer_proposals
       set proposed_value = v_cpu_counter_value,
           status = 'pending',
           answered_at = now(),
           answered_by = 'CPU',
           response_message = format('CPU contraoferta em %s.', v_cpu_counter_value),
           cpu_counter_round = coalesce(cpu_counter_round, 0) + 1
     where id = p_proposal_id;

    return jsonb_build_object(
      'ok', true,
      'message', format('CPU contraofertou em %s.', v_cpu_counter_value),
      'status', 'pending',
      'proposed_value', v_cpu_counter_value,
      'cpu_decision', 'counter'
    );
  end if;

  v_transfer_result := public.app_record_cpu_transfer_sale(
    v_proposal.seller,
    v_proposal.player,
    coalesce(v_proposal.from_club, 'Elenco de ' || v_proposal.seller),
    coalesce(v_proposal.overall, 0),
    coalesce(v_offer_value, 0),
    v_external_buyer
  );

  if coalesce((v_transfer_result ->> 'ok')::boolean, false) is not true then
    return v_transfer_result;
  end if;

  update public.internal_transfer_proposals
     set status = 'accepted',
         buyer = v_external_buyer,
         answered_at = now(),
         answered_by = v_manager_name,
         response_message = 'Proposta de ' || v_external_buyer || ' aceita pelo vendedor.'
   where id = p_proposal_id;

  update public.internal_transfer_proposals
     set status = 'rejected',
         answered_at = now(),
         answered_by = 'Sistema',
         response_message = 'Encerrada porque o jogador foi vendido para ' || v_external_buyer || '.'
   where id <> p_proposal_id
     and status = 'pending'
     and lower(seller) = lower(v_proposal.seller)
     and lower(player) = lower(v_proposal.player)
     and (
       coalesce(is_cpu_offer, false)
       or lower(coalesce(offer_source, '')) = 'cpu'
       or lower(coalesce(buyer, '')) = 'cpu'
     );

  if to_regclass('public.manager_transfer_listings') is not null then
    update public.manager_transfer_listings
       set status = 'sold',
           resolved_at = now(),
           updated_at = now()
     where id = v_proposal.sale_listing_id
       and status = 'active';
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta aceita. %s foi vendido para %s.', v_proposal.player, v_external_buyer),
    'status', 'accepted',
    'transfer', v_transfer_result
  );
end;
$$;

create or replace function public.app_answer_internal_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_proposal_id bigint,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.app_answer_internal_transfer_proposal(
    p_manager_id,
    p_access_code,
    p_proposal_id,
    p_decision,
    null
  );
end;
$$;

grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text, numeric) to anon, authenticated;
grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
