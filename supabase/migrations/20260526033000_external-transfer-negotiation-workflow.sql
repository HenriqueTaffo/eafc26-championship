-- v94 - External market negotiation workflow.
-- External market signings now open a negotiation first. The transfer ledger is
-- written only when the buying manager accepts the seller response.

begin;

alter table if exists public.internal_transfer_proposals
  add column if not exists proposal_type text not null default 'internal',
  add column if not exists reference_value numeric not null default 0,
  add column if not exists buyer_offer_value numeric not null default 0,
  add column if not exists cash_offer_value numeric not null default 0,
  add column if not exists weekly_salary_eur numeric not null default 0,
  add column if not exists salary_source_name text,
  add column if not exists salary_source_url text,
  add column if not exists salary_reference_type text,
  add column if not exists trade_in_player text,
  add column if not exists trade_in_credit numeric not null default 0,
  add column if not exists negotiation_round integer not null default 0,
  add column if not exists expires_at timestamptz;

create index if not exists internal_transfer_proposals_external_idx
  on public.internal_transfer_proposals (proposal_type, buyer, status, created_at desc);

create or replace function public.app_external_transfer_seller_response(
  p_reference_value numeric,
  p_offer_value numeric,
  p_overall integer,
  p_round integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference numeric := greatest(100000, coalesce(p_reference_value, 0));
  v_offer numeric := greatest(100000, coalesce(p_offer_value, 0));
  v_multiplier numeric := 1.04;
  v_floor numeric := 0;
  v_counter numeric := 0;
begin
  v_reference := round(v_reference / 100000, 0) * 100000;
  v_offer := round(v_offer / 100000, 0) * 100000;

  v_multiplier := case
    when coalesce(p_overall, 0) >= 88 then 1.24
    when coalesce(p_overall, 0) >= 84 then 1.20
    when coalesce(p_overall, 0) >= 80 then 1.15
    when coalesce(p_overall, 0) >= 76 then 1.10
    when coalesce(p_overall, 0) >= 72 then 1.06
    else 1.03
  end;

  v_floor := round((v_reference * v_multiplier) / 100000, 0) * 100000;
  v_floor := greatest(v_floor, 100000);

  if v_offer >= v_floor then
    return jsonb_build_object(
      'status', 'buyer_review',
      'sellerDecision', 'accepted',
      'sellerValue', v_offer,
      'sellerFloor', v_floor,
      'message', 'Clube vendedor aceitou a base financeira. Confirme o contrato para registrar a transferencia.'
    );
  end if;

  if coalesce(p_round, 0) >= 2 or v_offer < (v_floor * 0.78) then
    return jsonb_build_object(
      'status', 'rejected',
      'sellerDecision', 'rejected',
      'sellerValue', v_offer,
      'sellerFloor', v_floor,
      'message', 'Clube vendedor recusou a proposta. A diferenca para a avaliacao interna ficou grande demais.'
    );
  end if;

  v_counter := greatest(v_floor, round((v_offer * 1.08) / 100000, 0) * 100000);

  return jsonb_build_object(
    'status', 'buyer_review',
    'sellerDecision', 'counter',
    'sellerValue', v_counter,
    'sellerFloor', v_floor,
    'message', 'Clube vendedor respondeu com contraoferta. Revise no hub antes de confirmar.'
  );
end;
$$;

create or replace function public.app_create_external_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_reference_value numeric,
  p_offer_value numeric,
  p_weekly_salary_eur numeric,
  p_salary_source_name text,
  p_salary_source_url text,
  p_trade_in_player text default '',
  p_trade_in_credit numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_manager_name text;
  v_buyer_id text;
  v_rate numeric := 0;
  v_reference_value numeric := 0;
  v_offer_value numeric := 0;
  v_cash_offer_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_weekly_salary numeric := 0;
  v_salary_source_name text := '';
  v_salary_source_url text := '';
  v_salary_reference_type text := 'regulatory_estimate';
  v_salary_quote jsonb;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
  v_trade record;
  v_trade_value numeric := 0;
  v_trade_credit numeric := 0;
  v_response jsonb;
  v_status text;
  v_seller_value numeric := 0;
  v_proposal_id bigint;
begin
  if public.app_transfer_window_is_locked() then
    return jsonb_build_object('ok', false, 'message', 'Janela de transferencias fechada enquanto consolidamos o app.');
  end if;

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  if v_is_commissioner then
    return jsonb_build_object('ok', false, 'message', 'O comissario nao pode abrir proposta de mercado por um tecnico.');
  end if;

  if lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A proposta precisa ser enviada pelo comprador logado.');
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(trim(p_buyer))
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', p_buyer));
  end if;

  v_rate := case
    when coalesce(p_overall, 0) >= 89 then 0.25
    when coalesce(p_overall, 0) >= 84 then 0.15
    when coalesce(p_overall, 0) >= 80 then 0.10
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end;

  v_reference_value := greatest(0, coalesce(p_reference_value, 0));
  if v_reference_value <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe a referencia publica de valor antes de negociar.');
  end if;

  v_offer_value := coalesce(nullif(p_offer_value, 0), v_reference_value + (v_reference_value * v_rate));
  v_offer_value := greatest(100000, round(v_offer_value / 100000, 0) * 100000);

  v_salary_quote := public.app_resolve_transfer_salary(
    p_player,
    p_from_club,
    '',
    '',
    p_overall,
    v_reference_value,
    null,
    p_weekly_salary_eur,
    p_salary_source_name,
    p_salary_source_url
  );

  if coalesce((v_salary_quote ->> 'ok')::boolean, false) is false then
    return v_salary_quote;
  end if;

  v_weekly_salary := coalesce((v_salary_quote ->> 'weeklySalary')::numeric, 0);
  v_salary_source_name := coalesce(v_salary_quote ->> 'salarySourceName', 'Estimativa regulatoria da liga');
  v_salary_source_url := coalesce(v_salary_quote ->> 'salarySourceUrl', public.app_salary_regulatory_model_url());
  v_salary_reference_type := coalesce(v_salary_quote ->> 'referenceType', 'regulatory_estimate');

  if exists (
    select 1
    from public.internal_transfer_proposals p
    where lower(p.buyer) = lower(trim(p_buyer))
      and lower(p.player) = lower(trim(p_player))
      and p.proposal_type = 'external_market'
      and p.status in ('pending', 'buyer_review')
  ) then
    return jsonb_build_object('ok', false, 'message', 'Ja existe uma negociacao aberta por este jogador.');
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
        and lower(trim(coalesce(t.player_key, t.player_name, ''))) = lower(trim(p_player))
    )
    select 1
    from latest
    where rn = 1
      and lower(coalesce(transfer_type, 'market')) <> 'cpu_sale'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Jogador ja possui contrato ativo na liga.');
  end if;

  if coalesce(trim(p_trade_in_player), '') <> '' then
    if lower(trim(p_trade_in_player)) = lower(trim(p_player)) then
      return jsonb_build_object('ok', false, 'message', 'O jogador oferecido na troca precisa ser diferente do alvo.');
    end if;

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
      and lower(t.player_name) = lower(trim(p_trade_in_player))
    order by t.created_at desc nulls last, t.id desc
    limit 1;

    if v_trade.id is null then
      return jsonb_build_object('ok', false, 'message', 'Jogador de troca nao encontrado no elenco atual.');
    end if;

    if v_trade.transfer_type = 'cpu_sale' or lower(v_trade.current_owner) <> lower(trim(p_buyer)) then
      return jsonb_build_object('ok', false, 'message', format('%s nao pertence atualmente a %s.', p_trade_in_player, p_buyer));
    end if;

    v_trade_value := greatest(
      coalesce(v_trade.negotiated_value, 0),
      coalesce(v_trade.final_value, 0),
      coalesce(v_trade.market_value, 0),
      0
    );
    v_trade_credit := round(
      least(
        v_offer_value * 0.70,
        v_trade_value * 0.85,
        greatest(coalesce(p_trade_in_credit, v_trade_value * 0.85), 0)
      ) / 100000,
      0
    ) * 100000;
  end if;

  v_cash_offer_value := greatest(0, v_offer_value - coalesce(v_trade_credit, 0));
  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 22000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(
    p_buyer,
    case when v_trade_credit > 0 then v_trade.player_name else '' end
  );

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object('ok', false, 'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo.', p_buyer));
  end if;

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', p_buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', p_buyer));
  end if;

  if v_cash_offer_value > v_remaining then
    return jsonb_build_object('ok', false, 'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_cash_offer_value - v_remaining, 'FM999G999G999G999G990'))));
  end if;

  if (v_current_payroll + v_weekly_salary) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. O salario de folha do jogador inviabiliza a contratacao.');
  end if;

  v_response := public.app_external_transfer_seller_response(v_reference_value, v_offer_value, p_overall, 0);
  v_status := coalesce(v_response ->> 'status', 'buyer_review');
  v_seller_value := coalesce((v_response ->> 'sellerValue')::numeric, v_offer_value);

  insert into public.internal_transfer_proposals (
    buyer,
    seller,
    player,
    from_club,
    overall,
    proposed_value,
    status,
    answered_at,
    answered_by,
    response_message,
    is_cpu_offer,
    offer_source,
    proposal_type,
    reference_value,
    buyer_offer_value,
    cash_offer_value,
    weekly_salary_eur,
    salary_source_name,
    salary_source_url,
    salary_reference_type,
    trade_in_player,
    trade_in_credit,
    negotiation_round,
    expires_at
  ) values (
    trim(p_buyer),
    coalesce(nullif(trim(p_from_club), ''), 'Clube vendedor'),
    trim(p_player),
    nullif(trim(p_from_club), ''),
    coalesce(p_overall, 0),
    v_seller_value,
    v_status,
    now(),
    coalesce(nullif(trim(p_from_club), ''), 'Clube vendedor'),
    coalesce(v_response ->> 'message', 'Clube vendedor respondeu a proposta.'),
    false,
    'external_market',
    'external_market',
    v_reference_value,
    v_offer_value,
    greatest(0, v_seller_value - coalesce(v_trade_credit, 0)),
    v_weekly_salary,
    v_salary_source_name,
    v_salary_source_url,
    v_salary_reference_type,
    nullif(trim(coalesce(p_trade_in_player, '')), ''),
    v_trade_credit,
    0,
    now() + interval '48 hours'
  )
  returning id into v_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'proposalId', v_proposal_id,
    'status', v_status,
    'sellerDecision', v_response ->> 'sellerDecision',
    'message', coalesce(v_response ->> 'message', 'Proposta enviada ao clube vendedor.'),
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'referenceValue', v_reference_value,
    'buyerOfferValue', v_offer_value,
    'sellerValue', v_seller_value,
    'cashValue', greatest(0, v_seller_value - coalesce(v_trade_credit, 0)),
    'tradeInPlayer', nullif(trim(coalesce(p_trade_in_player, '')), ''),
    'tradeInCredit', v_trade_credit,
    'weeklySalary', v_weekly_salary,
    'salarySourceName', v_salary_source_name,
    'salarySourceUrl', v_salary_source_url,
    'salaryReferenceType', v_salary_reference_type
  );
end;
$$;

create or replace function public.app_answer_external_transfer_proposal(
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
begin
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
    case when coalesce(v_proposal.trade_in_credit, 0) > 0 then coalesce(v_proposal.trade_in_player, '') else '' end
  );

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

  if coalesce(v_proposal.salary_reference_type, 'regulatory_estimate') <> 'regulatory_estimate' then
    perform public.app_upsert_player_salary_reference(
      v_proposal.player,
      coalesce(v_proposal.from_club, ''),
      coalesce(v_proposal.weekly_salary_eur, 0),
      coalesce(v_proposal.salary_source_name, ''),
      coalesce(v_proposal.salary_source_url, ''),
      'Criado automaticamente a partir de transferencia aprovada por negociacao.'
    );
  end if;

  insert into public.transfers (
    buyer_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
    weekly_salary_eur,
    salary_source_name,
    salary_source_url,
    salary_reference_type,
    salary_checked_at,
    status,
    reason,
    transfer_type,
    negotiated_value,
    trade_in_player_name,
    trade_in_credit,
    created_at,
    updated_at
  ) values (
    v_buyer_id,
    trim(v_proposal.player),
    nullif(trim(coalesce(v_proposal.from_club, '')), ''),
    coalesce(v_proposal.overall, 0),
    coalesce(v_proposal.reference_value, 0),
    v_rate,
    coalesce(v_proposal.weekly_salary_eur, 0),
    coalesce(v_proposal.salary_source_name, ''),
    coalesce(v_proposal.salary_source_url, ''),
    coalesce(v_proposal.salary_reference_type, 'regulatory_estimate'),
    now(),
    'approved',
    'OK',
    'market',
    v_cash_value,
    nullif(trim(coalesce(v_proposal.trade_in_player, '')), ''),
    coalesce(v_proposal.trade_in_credit, 0),
    now(),
    now()
  )
  returning id into v_purchase_id;

  if coalesce(v_proposal.trade_in_credit, 0) > 0 and v_trade.id is not null then
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
      destination_club,
      created_at,
      updated_at
    ) values (
      v_buyer_id,
      v_buyer_id,
      v_trade.player_name,
      coalesce(nullif(v_trade.from_club, ''), 'Elenco de ' || v_proposal.buyer),
      coalesce(v_trade.overall, 0),
      0,
      0,
      'approved',
      'Troca usada na compra de ' || trim(v_proposal.player),
      'cpu_sale',
      0,
      coalesce(nullif(trim(v_proposal.from_club), ''), 'Clube vendedor'),
      now(),
      now()
    )
    returning id into v_trade_sale_id;

    update public.transfers
       set trade_in_transfer_id = v_trade_sale_id,
           updated_at = now()
     where id = v_purchase_id;
  end if;

  update public.internal_transfer_proposals
     set status = 'accepted',
         answered_at = now(),
         answered_by = v_manager_name,
         cash_offer_value = v_cash_value,
         response_message = 'Comprador aceitou a resposta do clube vendedor. Transferencia registrada na liga.'
   where id = p_proposal_id;

  update public.internal_transfer_proposals
     set status = 'rejected',
         answered_at = now(),
         answered_by = 'Sistema',
         response_message = 'Encerrada porque o jogador foi contratado em outra negociacao.'
   where id <> p_proposal_id
     and proposal_type = 'external_market'
     and status in ('pending', 'buyer_review')
     and lower(player) = lower(v_proposal.player);

  return jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'message', format('Contrato fechado. %s agora foi registrado para %s.', v_proposal.player, v_proposal.buyer),
    'transferId', v_purchase_id,
    'tradeSaleTransferId', v_trade_sale_id,
    'buyer', v_proposal.buyer,
    'player', v_proposal.player,
    'fromClub', v_proposal.from_club,
    'referenceValue', v_proposal.reference_value,
    'sellerValue', v_offer_value,
    'cashValue', v_cash_value,
    'weeklySalary', v_proposal.weekly_salary_eur,
    'salarySourceName', v_proposal.salary_source_name,
    'salarySourceUrl', v_proposal.salary_source_url
  );
end;
$$;

grant execute on function public.app_external_transfer_seller_response(numeric, numeric, integer, integer) to anon, authenticated;
grant execute on function public.app_create_external_transfer_proposal(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric) to anon, authenticated;
grant execute on function public.app_answer_external_transfer_proposal(text, text, bigint, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
