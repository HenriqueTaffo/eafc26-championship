begin;

create unique index if not exists internal_transfer_external_signature_player_uniq
  on public.internal_transfer_proposals (lower(trim(coalesce(player, ''))))
  where coalesce(proposal_type, '') = 'external_market'
    and coalesce(status, '') = 'signature_pending';

create or replace function public.app_answer_external_transfer_proposal_v1(
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
  v_login jsonb;
  v_manager_name text;
  v_proposal public.internal_transfer_proposals%rowtype;
  v_decision text;
  v_buyer_id text;
  v_rate numeric := 0;
  v_offer_value numeric := 0;
  v_cash_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
  v_response jsonb;
  v_status text;
  v_seller_value numeric := 0;
  v_purchase_id bigint;
  v_trade record;
  v_trade_sale_id bigint;
  v_signature_delay_seconds integer;
  v_signature_delay interval;
begin
  select
    null::bigint as id,
    ''::text as player_name,
    ''::text as from_club,
    0::integer as overall,
    0::numeric as market_value,
    0::numeric as final_value,
    0::numeric as negotiated_value,
    ''::text as transfer_type,
    ''::text as current_owner
    into v_trade;

  if public.app_transfer_window_is_locked() then
    return jsonb_build_object('ok', false, 'message', 'Janela de transferencias fechada enquanto consolidamos o app.');
  end if;

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  v_manager_name := coalesce(v_login ->> 'managerName', '');

  select *
    into v_proposal
  from public.internal_transfer_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Proposta nao encontrada.');
  end if;

  if coalesce(v_proposal.proposal_type, '') <> 'external_market' then
    return jsonb_build_object('ok', false, 'message', 'Esta resposta nao pertence a uma proposta de mercado externo.');
  end if;

  if lower(v_proposal.buyer) <> lower(v_manager_name) then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comprador pode responder esta proposta.');
  end if;

  if v_proposal.status not in ('pending', 'buyer_review') then
    return jsonb_build_object('ok', false, 'message', 'Esta proposta ja foi encerrada.');
  end if;

  v_decision := lower(coalesce(trim(p_decision), ''));
  v_decision := case
    when v_decision in ('accepted', 'accept', 'aceitar', 'aprovado') then 'accepted'
    when v_decision in ('counter', 'contraoferta', 'contra oferta') then 'counter'
    when v_decision in ('rejected', 'reject', 'recusar', 'desistir', 'cancel') then 'rejected'
    else 'rejected'
  end;

  if v_decision = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Comprador desistiu da negociacao antes da assinatura.'
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'status', 'rejected', 'message', 'Negociacao encerrada sem contratacao.');
  end if;

  if v_decision = 'counter' then
    v_offer_value := coalesce(p_counter_value, 0);
    if v_offer_value <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Informe uma contraoferta maior que zero.');
    end if;

    v_offer_value := greatest(100000, round(v_offer_value / 100000, 0) * 100000);
    v_cash_value := greatest(0, v_offer_value - coalesce(v_proposal.trade_in_credit, 0));

    v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> v_proposal.buyer, '{}'::jsonb);
    v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
    if v_cash_value > v_remaining then
      return jsonb_build_object('ok', false, 'message', format('Contraoferta acima do saldo: faltam %s.', trim(to_char(v_cash_value - v_remaining, 'FM999G999G999G999G990'))));
    end if;

    v_response := public.app_external_transfer_seller_response(
      coalesce(v_proposal.reference_value, 0),
      v_offer_value,
      coalesce(v_proposal.overall, 0),
      coalesce(v_proposal.negotiation_round, 0) + 1
    );
    v_status := coalesce(v_response ->> 'status', 'buyer_review');
    v_seller_value := coalesce((v_response ->> 'sellerValue')::numeric, v_offer_value);

    update public.internal_transfer_proposals
       set status = v_status,
           proposed_value = v_seller_value,
           buyer_offer_value = v_offer_value,
           cash_offer_value = greatest(0, v_seller_value - coalesce(v_proposal.trade_in_credit, 0)),
           negotiation_round = coalesce(negotiation_round, 0) + 1,
           answered_at = now(),
           answered_by = coalesce(nullif(trim(v_proposal.from_club), ''), 'Clube vendedor'),
           response_message = coalesce(v_response ->> 'message', 'Clube vendedor respondeu a contraoferta.')
     where id = p_proposal_id;

    return jsonb_build_object(
      'ok', true,
      'status', v_status,
      'sellerDecision', v_response ->> 'sellerDecision',
      'message', coalesce(v_response ->> 'message', 'Contraoferta respondida.'),
      'sellerValue', v_seller_value,
      'cashValue', greatest(0, v_seller_value - coalesce(v_proposal.trade_in_credit, 0))
    );
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(trim(v_proposal.buyer))
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', v_proposal.buyer));
  end if;

  v_rate := case
    when coalesce(v_proposal.overall, 0) >= 89 then 0.25
    when coalesce(v_proposal.overall, 0) >= 84 then 0.15
    when coalesce(v_proposal.overall, 0) >= 80 then 0.10
    when coalesce(v_proposal.overall, 0) >= 75 then 0.05
    else 0
  end;

  v_offer_value := greatest(100000, coalesce(v_proposal.proposed_value, v_proposal.buyer_offer_value, 0));
  v_cash_value := greatest(0, v_offer_value - coalesce(v_proposal.trade_in_credit, 0));

  if coalesce(trim(v_proposal.trade_in_player), '') <> '' then
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      t.market_value,
      t.final_value,
      t.negotiated_value,
      t.transfer_type,
      m.display_name as current_owner
      into v_trade
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.status = 'approved'
      and lower(t.player_name) = lower(trim(v_proposal.trade_in_player))
    order by t.created_at desc nulls last, t.id desc
    limit 1;

    if v_trade.id is null then
      return jsonb_build_object('ok', false, 'message', 'Jogador de troca nao encontrado no elenco atual.');
    end if;

    if v_trade.transfer_type = 'cpu_sale' or lower(v_trade.current_owner) <> lower(trim(v_proposal.buyer)) then
      return jsonb_build_object('ok', false, 'message', format('%s nao pertence atualmente a %s.', v_proposal.trade_in_player, v_proposal.buyer));
    end if;
  end if;

  if exists (
    with latest as (
      select
        t.*,
        row_number() over (
          partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
          order by t.created_at desc nulls last, t.id desc
        ) as rn
      from public.transfers t
      where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
        and lower(trim(coalesce(t.player_key, t.player_name, ''))) = lower(trim(v_proposal.player))
    )
    select 1
    from latest
    where rn = 1
      and lower(coalesce(transfer_type, 'market')) <> 'cpu_sale'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Jogador ja possui contrato ativo na liga.');
  end if;

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> v_proposal.buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 22000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(v_proposal.buyer);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(
    v_proposal.buyer,
    case when coalesce(v_proposal.trade_in_credit, 0) > 0 then coalesce(v_trade.player_name, '') else '' end
  );

  if exists (
    select 1
    from public.internal_transfer_proposals conflict
    where conflict.id <> p_proposal_id
      and coalesce(conflict.proposal_type, '') = 'external_market'
      and coalesce(conflict.status, '') = 'signature_pending'
      and lower(trim(coalesce(conflict.player, ''))) = lower(trim(v_proposal.player))
  ) then
    return jsonb_build_object(
      'ok', false,
      'status', coalesce(v_proposal.status, 'buyer_review'),
      'message', 'Jogador ja esta em assinatura com outro comprador. Aguarde a definicao da mesa anterior.'
    );
  end if;

  if exists (
    select 1
    from public.internal_transfer_proposals
    where id = p_proposal_id and status = 'signature_pending'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Proposta com assinatura pendente encontrada para este contrato.');
  end if;

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object('ok', false, 'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo.', v_proposal.buyer));
  end if;

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', v_proposal.buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', v_proposal.buyer));
  end if;

  if v_cash_value > v_remaining then
    return jsonb_build_object('ok', false, 'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_cash_value - v_remaining, 'FM999G999G999G999G990'))));
  end if;

  if (v_current_payroll + coalesce(v_proposal.weekly_salary_eur, 0)) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. O salario de folha do jogador inviabiliza a contratacao.');
  end if;

  v_signature_delay_seconds := 3600 * (24 + floor(random() * 25)::int);
  v_signature_delay := make_interval(secs => v_signature_delay_seconds);

  update public.internal_transfer_proposals
     set status = 'signature_pending',
         signature_status = 'requested',
         signature_requested_at = now(),
         signature_expires_at = now() + v_signature_delay,
         expires_at = now() + v_signature_delay,
         answered_at = now(),
         answered_by = v_manager_name,
         response_message = 'Comprador aceitou base comercial. Aguardando assinatura no escritorio.'
   where id = p_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'signature_pending',
    'message', 'Proposta aceita. Aguarde a conclusao da assinatura do contrato.'
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'status', coalesce(v_proposal.status, 'buyer_review'),
      'message', 'Jogador ja esta em assinatura com outro comprador. Aguarde a definicao da mesa anterior.'
    );
  when others then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', sqlerrm);
end;
$$;

notify pgrst, 'reload schema';

commit;
