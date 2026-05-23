-- CPU transfer offers - 23/05/2026.
--
-- Adds a commissioner action that generates CPU offers for players owned by
-- coaches. Coaches answer the offer in the existing private proposal panel.
-- Accepting a CPU offer pays the seller and records a zero-cost ownership
-- marker so the player leaves the coach roster without refunding the original
-- purchase.

begin;

create table if not exists public.internal_transfer_proposals (
  id bigserial primary key,
  buyer text not null,
  seller text not null,
  player text not null,
  from_club text,
  overall integer,
  proposed_value numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by text,
  response_message text
);

alter table public.internal_transfer_proposals
  add column if not exists is_cpu_offer boolean not null default false,
  add column if not exists offer_source text not null default 'coach';

create index if not exists internal_transfer_proposals_seller_status_idx
  on public.internal_transfer_proposals (seller, status, created_at desc);

create index if not exists internal_transfer_proposals_buyer_status_idx
  on public.internal_transfer_proposals (buyer, status, created_at desc);

create index if not exists internal_transfer_proposals_source_status_idx
  on public.internal_transfer_proposals (offer_source, status, created_at desc);

alter table public.transfers
  drop constraint if exists transfers_transfer_type_check;

alter table public.transfers
  add constraint transfers_transfer_type_check
  check (transfer_type in ('market', 'internal', 'auction', 'manual', 'cpu_sale'));

drop index if exists public.uq_approved_transfer_player;

create index if not exists idx_transfers_player_status_created
  on public.transfers (player_key, status, created_at desc, id desc);

create or replace function public.app_get_external_transfer_today_count(p_buyer text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.transfers t
  join public.managers m on m.id = t.buyer_id
  where t.status = 'approved'
    and t.transfer_type not in ('internal', 'cpu_sale')
    and lower(m.display_name) = lower(p_buyer)
    and (t.created_at at time zone 'America/Sao_Paulo')::date =
        (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public.app_get_transfer_spend_totals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with approved as (
    select
      m.display_name as buyer,
      lower(t.player_name) as player_key,
      t.final_value,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.status = 'approved'
      and t.transfer_type not in ('internal', 'cpu_sale')
  ),
  totals as (
    select buyer, sum(final_value)::numeric as spent_total
    from approved
    where rn = 1
    group by buyer
  )
  select coalesce(jsonb_object_agg(buyer, spent_total), '{}'::jsonb)
  from totals;
$$;

create or replace function public.app_get_transfer_spend_breakdown()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with rows as (
    select
      m.display_name as buyer,
      lower(t.player_name) as player_key,
      coalesce(t.market_value, 0) as market_value,
      coalesce(t.final_value, 0) as final_value,
      t.status as status_key,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.transfer_type not in ('internal', 'cpu_sale')
  ),
  approved_totals as (
    select
      buyer,
      sum(market_value)::numeric as market_total,
      sum(final_value)::numeric as final_total,
      sum(greatest(final_value - market_value, 0))::numeric as delta_total
    from rows
    where status_key = 'approved'
      and rn = 1
    group by buyer
  ),
  non_approved_totals as (
    select
      buyer,
      sum(market_value)::numeric as non_approved_market_total
    from rows
    where status_key <> 'approved'
    group by buyer
  )
  select coalesce(jsonb_object_agg(
    coalesce(a.buyer, n.buyer),
    jsonb_build_object(
      'marketTotal', coalesce(a.market_total, 0),
      'finalTotal', coalesce(a.final_total, 0),
      'deltaTotal', coalesce(a.delta_total, 0),
      'nonApprovedMarketTotal', coalesce(n.non_approved_market_total, 0)
    )
  ), '{}'::jsonb)
  from approved_totals a
  full outer join non_approved_totals n on n.buyer = a.buyer;
$$;

create or replace function public.app_record_internal_transfer(
  p_buyer text,
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id text;
  v_seller_id text;
  v_current_owner text;
  v_value numeric := coalesce(p_market_value, 0);
begin
  if coalesce(trim(p_buyer), '') = '' or coalesce(trim(p_seller), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe comprador e vendedor.');
  end if;

  if lower(trim(p_buyer)) = lower(trim(p_seller)) then
    return jsonb_build_object('ok', false, 'message', 'Comprador e vendedor precisam ser tecnicos diferentes.');
  end if;

  if coalesce(trim(p_player), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o jogador negociado.');
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(p_buyer)
  limit 1;

  select id into v_seller_id
  from public.managers
  where lower(display_name) = lower(p_seller)
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', p_buyer));
  end if;

  if v_seller_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o vendedor %s.', p_seller));
  end if;

  select case when t.transfer_type = 'cpu_sale' then 'CPU' else m.display_name end
    into v_current_owner
  from public.transfers t
  join public.managers m on m.id = t.buyer_id
  where lower(t.player_name) = lower(p_player)
    and t.status = 'approved'
  order by t.created_at desc nulls last, t.id desc
  limit 1;

  if v_current_owner is null then
    return jsonb_build_object('ok', false, 'message', 'Jogador nao encontrado entre as transferencias aprovadas.');
  end if;

  if lower(trim(v_current_owner)) <> lower(trim(p_seller)) then
    return jsonb_build_object(
      'ok', false,
      'message', format('Este jogador pertence atualmente a %s, nao a %s.', v_current_owner, p_seller)
    );
  end if;

  insert into public.transfers (
    buyer_id,
    seller_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
    status,
    reason,
    transfer_type,
    negotiated_value,
    created_at,
    updated_at
  ) values (
    v_buyer_id,
    v_seller_id,
    trim(p_player),
    coalesce(nullif(trim(p_from_club), ''), 'Negociacao interna: ' || p_seller),
    coalesce(p_overall, 0),
    v_value,
    0,
    'approved',
    'OK',
    'internal',
    v_value,
    now(),
    now()
  );

  perform public.app_insert_financial_event(
    p_seller,
    'Venda interna: ' || p_player,
    p_seller || ' vendeu ' || p_player || ' para ' || p_buyer || '.',
    '+' || v_value::text || ' creditado ao orcamento.',
    'Negociacao interna',
    v_value
  );

  perform public.app_insert_financial_event(
    p_buyer,
    'Compra interna: ' || p_player,
    p_buyer || ' comprou ' || p_player || ' de ' || p_seller || '.',
    '-' || v_value::text || ' descontado do orcamento.',
    'Negociacao interna',
    -v_value
  );

  return jsonb_build_object(
    'ok', true,
    'message', format('%s negociado de %s para %s.', p_player, p_seller, p_buyer),
    'transferType', 'internal',
    'seller', p_seller,
    'buyer', p_buyer,
    'player', p_player,
    'value', v_value,
    'budgetEventsCreated', true
  );
end;
$$;

create or replace function public.app_record_cpu_transfer_sale(
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id text;
  v_current_owner text;
  v_current_overall integer := 0;
  v_value numeric := coalesce(p_value, 0);
begin
  if coalesce(trim(p_seller), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o vendedor.');
  end if;

  if coalesce(trim(p_player), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o jogador negociado.');
  end if;

  if v_value <= 0 then
    return jsonb_build_object('ok', false, 'message', 'A proposta da CPU precisa ter valor maior que zero.');
  end if;

  select id into v_seller_id
  from public.managers
  where lower(display_name) = lower(p_seller)
  limit 1;

  if v_seller_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o vendedor %s.', p_seller));
  end if;

  select
    case when t.transfer_type = 'cpu_sale' then 'CPU' else m.display_name end,
    coalesce(t.overall, 0)
    into v_current_owner, v_current_overall
  from public.transfers t
  join public.managers m on m.id = t.buyer_id
  where lower(t.player_name) = lower(p_player)
    and t.status = 'approved'
  order by t.created_at desc nulls last, t.id desc
  limit 1;

  if v_current_owner is null then
    return jsonb_build_object('ok', false, 'message', 'Jogador nao encontrado entre as transferencias aprovadas.');
  end if;

  if lower(trim(v_current_owner)) <> lower(trim(p_seller)) then
    return jsonb_build_object(
      'ok', false,
      'message', format('Este jogador pertence atualmente a %s, nao a %s.', v_current_owner, p_seller)
    );
  end if;

  insert into public.transfers (
    buyer_id,
    seller_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
    status,
    reason,
    transfer_type,
    negotiated_value,
    created_at,
    updated_at
  ) values (
    v_seller_id,
    v_seller_id,
    trim(p_player),
    coalesce(nullif(trim(p_from_club), ''), 'Venda para CPU'),
    case when coalesce(p_overall, 0) > 0 then p_overall else v_current_overall end,
    0,
    0,
    'approved',
    'Venda para CPU',
    'cpu_sale',
    v_value,
    now(),
    now()
  );

  perform public.app_insert_financial_event(
    p_seller,
    'Venda para CPU: ' || p_player,
    p_seller || ' vendeu ' || p_player || ' para a CPU.',
    '+' || v_value::text || ' creditado ao orcamento.',
    'Venda para CPU',
    v_value
  );

  return jsonb_build_object(
    'ok', true,
    'message', format('%s vendido para a CPU por %s.', p_player, trim(to_char(v_value, 'FM999G999G999G999G990'))),
    'transferType', 'cpu_sale',
    'seller', p_seller,
    'buyer', 'CPU',
    'player', p_player,
    'value', v_value,
    'budgetEventsCreated', true
  );
end;
$$;

create or replace function public.app_create_internal_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_name text;
  v_login jsonb;
  v_current_owner text;
  v_existing_id bigint;
  v_proposal_id bigint;
begin
  select display_name
    into v_manager_name
  from public.managers
  where id = p_manager_id;

  if v_manager_name is null then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  v_login := public.app_login_manager(v_manager_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  v_manager_name := coalesce(v_login #>> '{manager,name}', v_manager_name);

  if lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A proposta precisa ser enviada pelo comprador logado.');
  end if;

  if lower(trim(p_buyer)) = lower(trim(p_seller)) then
    return jsonb_build_object('ok', false, 'message', 'Comprador e vendedor precisam ser diferentes.');
  end if;

  if coalesce(p_market_value, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe um valor de proposta maior que zero.');
  end if;

  select case when t.transfer_type = 'cpu_sale' then 'CPU' else m.display_name end
    into v_current_owner
  from public.transfers t
  join public.managers m on m.id = t.buyer_id
  where lower(t.player_name) = lower(p_player)
    and t.status = 'approved'
  order by t.created_at desc nulls last, t.id desc
  limit 1;

  if lower(coalesce(v_current_owner, '')) <> lower(trim(p_seller)) then
    return jsonb_build_object(
      'ok', false,
      'message', format('Este jogador pertence atualmente a %s, nao a %s.', coalesce(v_current_owner, 'ninguem'), p_seller)
    );
  end if;

  select id
    into v_existing_id
  from public.internal_transfer_proposals
  where lower(player) = lower(p_player)
    and lower(buyer) = lower(p_buyer)
    and lower(seller) = lower(p_seller)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Ja existe uma proposta pendente para este jogador entre estes tecnicos.');
  end if;

  insert into public.internal_transfer_proposals (
    buyer,
    seller,
    player,
    from_club,
    overall,
    proposed_value,
    is_cpu_offer,
    offer_source
  ) values (
    p_buyer,
    p_seller,
    p_player,
    p_from_club,
    p_overall,
    p_market_value,
    false,
    'coach'
  )
  returning id into v_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta enviada para %s aprovar ou recusar.', p_seller),
    'proposalId', v_proposal_id
  );
end;
$$;

create or replace function public.app_get_my_internal_transfer_proposals(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return '[]'::jsonb;
  end if;

  v_manager_name := v_session ->> 'managerName';

  return coalesce((
    select jsonb_agg(
      to_jsonb(p) ||
      jsonb_build_object(
        'proposal_role',
        case
          when lower(p.seller) = lower(v_manager_name) then 'received'
          else 'sent'
        end,
        'is_cpu_offer', coalesce(p.is_cpu_offer, false),
        'offer_source', coalesce(nullif(p.offer_source, ''), case when coalesce(p.is_cpu_offer, false) then 'cpu' else 'coach' end)
      )
      order by p.created_at desc
    )
    from public.internal_transfer_proposals p
    where lower(p.seller) = lower(v_manager_name)
       or lower(p.buyer) = lower(v_manager_name)
  ), '[]'::jsonb);
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
declare
  v_session jsonb;
  v_manager_name text;
  v_proposal public.internal_transfer_proposals%rowtype;
  v_transfer_result jsonb;
  v_status text;
  v_is_cpu_offer boolean;
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

  v_status := case
    when lower(p_decision) in ('accepted', 'accept', 'aceitar', 'aprovado') then 'accepted'
    else 'rejected'
  end;
  v_is_cpu_offer := coalesce(v_proposal.is_cpu_offer, false)
    or lower(coalesce(v_proposal.offer_source, '')) = 'cpu'
    or lower(coalesce(v_proposal.buyer, '')) = 'cpu';

  if v_status = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = case
             when v_is_cpu_offer then 'Proposta da CPU recusada pelo vendedor.'
             else 'Proposta recusada pelo vendedor.'
           end
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'message', 'Proposta recusada.', 'status', 'rejected');
  end if;

  if v_is_cpu_offer then
    v_transfer_result := public.app_record_cpu_transfer_sale(
      v_proposal.seller,
      v_proposal.player,
      coalesce(v_proposal.from_club, 'Venda para CPU'),
      coalesce(v_proposal.overall, 0),
      coalesce(v_proposal.proposed_value, 0)
    );

    if coalesce((v_transfer_result ->> 'ok')::boolean, false) is not true then
      return v_transfer_result;
    end if;

    update public.internal_transfer_proposals
       set status = 'accepted',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Proposta da CPU aceita pelo vendedor.'
     where id = p_proposal_id;

    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = 'Sistema',
           response_message = 'Encerrada porque o jogador foi vendido para a CPU.'
     where id <> p_proposal_id
       and status = 'pending'
       and lower(seller) = lower(v_proposal.seller)
       and lower(player) = lower(v_proposal.player)
       and (
         coalesce(is_cpu_offer, false)
         or lower(coalesce(offer_source, '')) = 'cpu'
         or lower(coalesce(buyer, '')) = 'cpu'
       );

    return jsonb_build_object(
      'ok', true,
      'message', format('Proposta aceita. %s foi vendido para a CPU.', v_proposal.player),
      'status', 'accepted',
      'transfer', v_transfer_result
    );
  end if;

  v_transfer_result := public.app_record_internal_transfer(
    v_proposal.buyer,
    v_proposal.seller,
    v_proposal.player,
    coalesce(v_proposal.from_club, 'Negociacao interna: ' || v_proposal.seller),
    coalesce(v_proposal.overall, 0),
    coalesce(v_proposal.proposed_value, 0)
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
end;
$$;

create or replace function public.app_generate_cpu_transfer_proposals(
  p_manager_id text,
  p_access_code text,
  p_count integer default 4,
  p_target_manager text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_count integer := least(12, greatest(1, coalesce(p_count, 4)));
  v_created integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode gerar propostas da CPU.');
  end if;

  with latest as (
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      case when t.transfer_type = 'cpu_sale' then 'CPU' else buyer.display_name end as seller,
      t.transfer_type,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
  ),
  eligible as (
    select *
    from latest l
    where l.rn = 1
      and l.transfer_type <> 'cpu_sale'
      and lower(l.seller) <> 'cpu'
      and coalesce(l.base_value, 0) > 0
      and (
        coalesce(trim(p_target_manager), '') = ''
        or lower(l.seller) = lower(trim(p_target_manager))
      )
      and not exists (
        select 1
        from public.internal_transfer_proposals p
        where p.status = 'pending'
          and lower(p.seller) = lower(l.seller)
          and lower(p.player) = lower(l.player_name)
          and (
            coalesce(p.is_cpu_offer, false)
            or lower(coalesce(p.offer_source, '')) = 'cpu'
            or lower(coalesce(p.buyer, '')) = 'cpu'
          )
      )
    order by random()
    limit v_count
  ),
  prepared as (
    select
      'CPU'::text as buyer,
      seller,
      player_name as player,
      coalesce(nullif(from_club, ''), 'Elenco de ' || seller) as from_club,
      overall,
      greatest(
        1000000,
        round((
          base_value *
          case
            when coalesce(overall, 0) >= 84 then 1.18 + (random() * 0.22)
            when coalesce(overall, 0) >= 80 then 1.12 + (random() * 0.18)
            else 1.08 + (random() * 0.14)
          end
        ) / 100000) * 100000
      )::numeric as proposed_value
    from eligible
  ),
  inserted as (
    insert into public.internal_transfer_proposals (
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      is_cpu_offer,
      offer_source
    )
    select
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      true,
      'cpu'
    from prepared
    returning *
  )
  select count(*)::integer, coalesce(jsonb_agg(to_jsonb(inserted) order by created_at desc), '[]'::jsonb)
    into v_created, v_rows
  from inserted;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'offers', v_rows,
    'message', case
      when v_created = 0 then 'Nenhum jogador elegivel para nova proposta da CPU agora.'
      when v_created = 1 then '1 proposta da CPU gerada.'
      else v_created::text || ' propostas da CPU geradas.'
    end
  );
end;
$$;

revoke execute on function public.app_record_cpu_transfer_sale(text, text, text, integer, numeric)
  from public, anon, authenticated;

grant execute on function public.app_get_my_internal_transfer_proposals(text, text) to anon, authenticated;
grant execute on function public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text) to anon, authenticated;
grant execute on function public.app_generate_cpu_transfer_proposals(text, text, integer, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
