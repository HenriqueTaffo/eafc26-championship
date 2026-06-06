begin;

alter table if exists public.internal_transfer_proposals
  add column if not exists club_decision_score numeric not null default 0,
  add column if not exists club_floor_value numeric not null default 0,
  add column if not exists club_effective_offer numeric not null default 0,
  add column if not exists club_trade_utility numeric not null default 0,
  add column if not exists club_trade_penalty numeric not null default 0,
  add column if not exists club_response jsonb not null default '{}'::jsonb,
  add column if not exists player_terms_round integer not null default 0,
  add column if not exists player_salary_offer numeric not null default 0,
  add column if not exists player_salary_request numeric not null default 0,
  add column if not exists player_terms_message text,
  add column if not exists player_terms_response jsonb not null default '{}'::jsonb;

create or replace function public.app_round_transfer_money(
  p_value numeric,
  p_minimum numeric default 100000
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(
    coalesce(p_minimum, 0),
    round(greatest(coalesce(p_value, 0), coalesce(p_minimum, 0)) / 100000, 0) * 100000
  );
$$;

create or replace function public.app_external_transfer_club_response(
  p_reference_value numeric,
  p_offer_value numeric,
  p_overall integer,
  p_round integer default 0,
  p_from_club text default '',
  p_trade_in_player text default '',
  p_trade_in_credit numeric default 0,
  p_trade_in_value numeric default 0,
  p_trade_in_overall integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference numeric := public.app_round_transfer_money(p_reference_value, 100000);
  v_offer numeric := public.app_round_transfer_money(p_offer_value, 100000);
  v_round integer := greatest(0, coalesce(p_round, 0));
  v_overall integer := coalesce(p_overall, 0);
  v_seed bigint := abs(pg_catalog.hashtext(lower(coalesce(nullif(trim(p_from_club), ''), 'clube vendedor')))::bigint);
  v_personality numeric := 1;
  v_multiplier numeric := 1.04;
  v_floor numeric := 0;
  v_trade_credit numeric := greatest(0, coalesce(p_trade_in_credit, 0));
  v_trade_value numeric := greatest(0, coalesce(p_trade_in_value, 0));
  v_trade_overall integer := coalesce(p_trade_in_overall, 0);
  v_trade_gap integer := 0;
  v_trade_factor numeric := 0;
  v_trade_cap numeric := 0;
  v_trade_utility numeric := 0;
  v_trade_penalty numeric := 0;
  v_cash_offer numeric := 0;
  v_effective_offer numeric := 0;
  v_required_gross numeric := 0;
  v_counter numeric := 0;
  v_score numeric := 0;
  v_reject_band numeric := 0.68;
  v_message text;
  v_trade_message text := '';
begin
  v_personality := 1 + (((v_seed % 17)::numeric - 8) / 100);

  v_multiplier := case
    when v_overall >= 90 then 1.38
    when v_overall >= 87 then 1.31
    when v_overall >= 84 then 1.24
    when v_overall >= 81 then 1.18
    when v_overall >= 78 then 1.13
    when v_overall >= 74 then 1.08
    else 1.04
  end;

  v_floor := public.app_round_transfer_money(v_reference * v_multiplier * v_personality, 100000);

  if coalesce(trim(p_trade_in_player), '') <> '' and v_trade_credit > 0 then
    v_trade_gap := v_trade_overall - v_overall;
    v_trade_factor := case
      when v_trade_overall <= 0 then 0.25
      when v_trade_gap >= 2 then 0.90
      when v_trade_gap >= -1 then 0.78
      when v_trade_gap >= -4 then 0.60
      when v_trade_gap >= -8 then 0.40
      else 0.22
    end;

    if v_overall >= 86 and v_trade_gap < -3 then
      v_trade_factor := v_trade_factor * 0.72;
    elsif v_overall >= 82 and v_trade_gap < -5 then
      v_trade_factor := v_trade_factor * 0.82;
    end if;

    v_trade_cap := v_floor * case
      when v_overall >= 86 and v_trade_gap < -3 then 0.18
      when v_trade_gap < -6 then 0.24
      when v_trade_gap < -3 then 0.32
      else 0.45
    end;

    v_trade_utility := public.app_round_transfer_money(
      least(v_trade_credit, v_trade_value * v_trade_factor, v_trade_cap),
      0
    );
    v_trade_penalty := greatest(0, v_trade_credit - v_trade_utility);

    v_trade_message := case
      when v_trade_utility <= 0 then ' O jogador oferecido nao resolve a avaliacao esportiva do vendedor.'
      when v_trade_utility < v_trade_credit * 0.55 then ' O vendedor aceita parte pequena da troca; precisa compensacao em dinheiro.'
      when v_trade_utility < v_trade_credit * 0.80 then ' A troca ajuda, mas nao tem valor integral para o vendedor.'
      else ' A troca tem encaixe esportivo razoavel para o vendedor.'
    end;
  end if;

  v_cash_offer := greatest(0, v_offer - v_trade_credit);
  v_effective_offer := v_cash_offer + v_trade_utility;
  v_required_gross := public.app_round_transfer_money(v_floor + v_trade_credit - v_trade_utility, 100000);
  v_score := round((v_effective_offer / nullif(v_floor, 0)) * 100, 0);
  v_reject_band := 0.68 + least(v_round, 3) * 0.04;

  if v_effective_offer >= v_floor then
    v_message := 'Clube vendedor aprovou a venda. A negociacao avanca para os termos do jogador.' || v_trade_message;
    return jsonb_build_object(
      'status', 'player_terms',
      'sellerDecision', 'accepted',
      'sellerValue', greatest(v_offer, v_required_gross),
      'sellerFloor', v_floor,
      'effectiveOffer', v_effective_offer,
      'tradeUtility', v_trade_utility,
      'tradePenalty', v_trade_penalty,
      'clubScore', v_score,
      'message', v_message
    );
  end if;

  if v_round >= 3 or v_effective_offer < (v_floor * v_reject_band) then
    v_message := 'Clube vendedor recusou: pacote distante da avaliacao interna.' || v_trade_message;
    return jsonb_build_object(
      'status', 'rejected',
      'sellerDecision', 'rejected',
      'sellerValue', v_offer,
      'sellerFloor', v_floor,
      'effectiveOffer', v_effective_offer,
      'tradeUtility', v_trade_utility,
      'tradePenalty', v_trade_penalty,
      'clubScore', v_score,
      'message', v_message
    );
  end if;

  v_counter := public.app_round_transfer_money(
    greatest(v_offer * 1.04, v_required_gross * (1 - least(v_round, 3) * 0.025)),
    100000
  );
  v_message := 'Clube vendedor respondeu com contraproposta baseada no pacote completo.' || v_trade_message;

  return jsonb_build_object(
    'status', 'buyer_review',
    'sellerDecision', 'counter',
    'sellerValue', v_counter,
    'sellerFloor', v_floor,
    'effectiveOffer', v_effective_offer,
    'tradeUtility', v_trade_utility,
    'tradePenalty', v_trade_penalty,
    'clubScore', v_score,
    'message', v_message
  );
end;
$$;

create or replace function public.app_external_transfer_seller_response(
  p_reference_value numeric,
  p_offer_value numeric,
  p_overall integer,
  p_round integer default 0
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.app_external_transfer_club_response(
    p_reference_value,
    p_offer_value,
    p_overall,
    p_round,
    '',
    '',
    0,
    0,
    0
  );
$$;

create or replace function public.app_external_transfer_player_salary_floor(
  p_player text,
  p_overall integer,
  p_reference_value numeric,
  p_current_weekly_salary numeric default 0
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_overall integer := coalesce(p_overall, 0);
  v_reference numeric := greatest(0, coalesce(p_reference_value, 0));
  v_current numeric := greatest(0, coalesce(p_current_weekly_salary, 0));
  v_model numeric := 0;
  v_premium numeric := 1.05;
  v_floor numeric := 0;
begin
  v_model := greatest(
    case
      when v_overall >= 90 then 220000
      when v_overall >= 87 then 150000
      when v_overall >= 84 then 95000
      when v_overall >= 81 then 62000
      when v_overall >= 78 then 38000
      when v_overall >= 75 then 24000
      when v_overall >= 72 then 15000
      else 8000
    end,
    v_reference * case
      when v_overall >= 88 then 0.0016
      when v_overall >= 84 then 0.0012
      when v_overall >= 80 then 0.0009
      else 0.00065
    end
  );

  v_premium := case
    when v_overall >= 88 then 1.18
    when v_overall >= 84 then 1.14
    when v_overall >= 80 then 1.10
    when v_overall >= 76 then 1.06
    else 1.03
  end;

  v_floor := greatest(v_current * v_premium, v_model);
  return greatest(1500, round(v_floor / 500, 0) * 500);
end;
$$;

create or replace function public.app_external_transfer_player_terms_response(
  p_player text,
  p_overall integer,
  p_reference_value numeric,
  p_current_weekly_salary numeric,
  p_weekly_salary_offer numeric,
  p_round integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer numeric := greatest(0, coalesce(p_weekly_salary_offer, 0));
  v_round integer := greatest(0, coalesce(p_round, 0));
  v_floor numeric;
  v_counter numeric;
  v_message text;
begin
  v_floor := public.app_external_transfer_player_salary_floor(
    p_player,
    p_overall,
    p_reference_value,
    p_current_weekly_salary
  );

  if v_offer >= v_floor then
    return jsonb_build_object(
      'status', 'signature_pending',
      'playerDecision', 'accepted',
      'weeklySalary', round(v_offer / 500, 0) * 500,
      'salaryFloor', v_floor,
      'message', 'Jogador aceitou os termos salariais. Contrato segue para assinatura.'
    );
  end if;

  if v_round >= 2 and v_offer < v_floor * 0.88 then
    return jsonb_build_object(
      'status', 'rejected',
      'playerDecision', 'rejected',
      'weeklySalary', v_offer,
      'salaryFloor', v_floor,
      'message', 'Jogador recusou o projeto depois de nova oferta salarial abaixo do pedido.'
    );
  end if;

  v_counter := greatest(v_floor, round(greatest(v_offer * 1.12, v_floor) / 500, 0) * 500);
  v_message := case
    when v_offer <= 0 then 'Agente do jogador apresentou pedido salarial para abrir a etapa pessoal.'
    when v_offer < v_floor * 0.75 then 'Agente considerou a oferta baixa e respondeu com pedido firme.'
    else 'Agente respondeu com ajuste salarial negociavel.'
  end;

  return jsonb_build_object(
    'status', 'player_terms',
    'playerDecision', 'counter',
    'weeklySalary', v_counter,
    'salaryFloor', v_floor,
    'message', v_message
  );
end;
$$;

create or replace function public.app_request_external_transfer_signature(
  p_proposal_id bigint,
  p_weekly_salary_eur numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.internal_transfer_proposals%rowtype;
  v_buyer_id text;
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
  v_trade record;
  v_signature_delay interval;
  v_weekly_salary numeric := 0;
begin
  select *
    into v_proposal
  from public.internal_transfer_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', 'Proposta nao encontrada.');
  end if;

  if coalesce(v_proposal.proposal_type, '') <> 'external_market' then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', 'Esta proposta nao pertence ao mercado externo.');
  end if;

  select id
    into v_buyer_id
  from public.managers
  where lower(display_name) = lower(trim(v_proposal.buyer))
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', v_proposal.buyer));
  end if;

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

  v_offer_value := greatest(100000, coalesce(v_proposal.proposed_value, v_proposal.buyer_offer_value, 0));
  v_cash_value := greatest(0, v_offer_value - coalesce(v_proposal.trade_in_credit, 0));
  v_weekly_salary := greatest(0, coalesce(p_weekly_salary_eur, v_proposal.weekly_salary_eur, 0));

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
      'status', coalesce(v_proposal.status, 'player_terms'),
      'message', 'Jogador ja esta em assinatura com outro comprador. Aguarde a definicao da mesa anterior.'
    );
  end if;

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> v_proposal.buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);

  if coalesce(v_proposal.status, '') = 'signature_pending'
     and coalesce(v_proposal.signature_status, '') = 'requested' then
    v_remaining := v_remaining + v_cash_value;
  end if;

  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 22000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(v_proposal.buyer);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(
    v_proposal.buyer,
    case when coalesce(v_proposal.trade_in_credit, 0) > 0 then coalesce(v_trade.player_name, '') else '' end
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

  if (v_current_payroll + v_weekly_salary) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. Ajuste os termos do jogador antes de assinar.');
  end if;

  v_signature_delay := make_interval(secs => 3600 * (24 + floor(random() * 25)::int));

  update public.internal_transfer_proposals
     set status = 'signature_pending',
         signature_status = 'requested',
         signature_requested_at = now(),
         signature_expires_at = now() + v_signature_delay,
         signature_message = 'Jogador aceitou os termos. Assinatura em andamento no escritorio da liga.',
         weekly_salary_eur = v_weekly_salary,
         player_salary_offer = v_weekly_salary,
         player_salary_request = v_weekly_salary,
         player_terms_message = 'Termos pessoais aceitos pelo jogador.',
         response_message = 'Clube e jogador aprovaram. Aguarde assinatura final.',
         answered_at = now(),
         answered_by = v_proposal.buyer
   where id = p_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'signature_pending',
    'message', 'Clube e jogador aceitaram. Proposta enviada para assinatura.',
    'cashValue', v_cash_value,
    'weeklySalary', v_weekly_salary
  );
end;
$$;

create or replace function public.app_create_external_transfer_proposal_v1(
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
  v_reference_value numeric := 0;
  v_offer_value numeric := 0;
  v_cash_offer_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_market_embargo boolean := false;
  v_trade record;
  v_trade_value numeric := 0;
  v_trade_credit numeric := 0;
  v_response jsonb;
  v_status text;
  v_seller_value numeric := 0;
  v_proposal_id bigint;
  v_weekly_salary numeric := 0;
  v_salary_source_name text := '';
  v_salary_source_url text := '';
  v_salary_reference_type text := 'player_terms_pending';
  v_salary_quote jsonb;
  v_player_salary_request numeric := 0;
  v_player_terms_message text := '';
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

  v_reference_value := greatest(0, coalesce(p_reference_value, 0));
  if v_reference_value <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe a referencia publica de valor antes de negociar.');
  end if;

  v_offer_value := coalesce(nullif(p_offer_value, 0), v_reference_value);
  v_offer_value := public.app_round_transfer_money(v_offer_value, 100000);

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

  if coalesce((v_salary_quote ->> 'ok')::boolean, false) is true then
    v_weekly_salary := coalesce((v_salary_quote ->> 'weeklySalary')::numeric, 0);
    v_salary_source_name := coalesce(v_salary_quote ->> 'salarySourceName', 'Oferta salarial inicial');
    v_salary_source_url := coalesce(v_salary_quote ->> 'salarySourceUrl', public.app_salary_regulatory_model_url());
    v_salary_reference_type := coalesce(v_salary_quote ->> 'referenceType', 'player_terms_pending');
  else
    v_weekly_salary := greatest(0, coalesce(p_weekly_salary_eur, 0));
    v_salary_source_name := coalesce(nullif(trim(p_salary_source_name), ''), 'A negociar com jogador');
    v_salary_source_url := coalesce(nullif(trim(p_salary_source_url), ''), public.app_salary_regulatory_model_url());
    v_salary_reference_type := 'player_terms_pending';
  end if;

  if exists (
    select 1
    from public.internal_transfer_proposals p
    where lower(p.buyer) = lower(trim(p_buyer))
      and lower(p.player) = lower(trim(p_player))
      and p.proposal_type = 'external_market'
      and p.status in ('pending', 'buyer_review', 'player_terms', 'signature_pending')
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
    v_trade_credit := public.app_round_transfer_money(
      least(
        v_offer_value * 0.70,
        v_trade_value * 0.85,
        greatest(coalesce(p_trade_in_credit, v_trade_value * 0.85), 0)
      ),
      0
    );
  end if;

  v_cash_offer_value := greatest(0, v_offer_value - coalesce(v_trade_credit, 0));
  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);

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

  v_response := public.app_external_transfer_club_response(
    v_reference_value,
    v_offer_value,
    p_overall,
    0,
    p_from_club,
    p_trade_in_player,
    v_trade_credit,
    v_trade_value,
    coalesce(v_trade.overall, 0)
  );
  v_status := coalesce(v_response ->> 'status', 'buyer_review');
  v_seller_value := coalesce((v_response ->> 'sellerValue')::numeric, v_offer_value);

  if v_status = 'player_terms' then
    v_player_salary_request := greatest(
      v_weekly_salary,
      public.app_external_transfer_player_salary_floor(
        p_player,
        p_overall,
        v_reference_value,
        v_weekly_salary
      )
    );
    v_player_terms_message := format('Clube aceitou. Agente pede salario semanal de %s para seguir.', trim(to_char(v_player_salary_request, 'FM999G999G999G990')));
  end if;

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
    expires_at,
    club_decision_score,
    club_floor_value,
    club_effective_offer,
    club_trade_utility,
    club_trade_penalty,
    club_response,
    player_terms_round,
    player_salary_offer,
    player_salary_request,
    player_terms_message,
    player_terms_response
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
    case
      when v_status = 'player_terms' then v_player_terms_message
      else coalesce(v_response ->> 'message', 'Clube vendedor respondeu a proposta.')
    end,
    false,
    'external_market',
    'external_market',
    v_reference_value,
    v_offer_value,
    greatest(0, v_seller_value - coalesce(v_trade_credit, 0)),
    case when v_status = 'player_terms' then v_player_salary_request else v_weekly_salary end,
    v_salary_source_name,
    v_salary_source_url,
    v_salary_reference_type,
    nullif(trim(coalesce(p_trade_in_player, '')), ''),
    v_trade_credit,
    0,
    now() + interval '48 hours',
    coalesce((v_response ->> 'clubScore')::numeric, 0),
    coalesce((v_response ->> 'sellerFloor')::numeric, 0),
    coalesce((v_response ->> 'effectiveOffer')::numeric, 0),
    coalesce((v_response ->> 'tradeUtility')::numeric, 0),
    coalesce((v_response ->> 'tradePenalty')::numeric, 0),
    v_response,
    0,
    v_weekly_salary,
    case when v_status = 'player_terms' then v_player_salary_request else 0 end,
    v_player_terms_message,
    case
      when v_status = 'player_terms' then jsonb_build_object(
        'status', 'player_terms',
        'playerDecision', 'counter',
        'weeklySalary', v_player_salary_request,
        'salaryFloor', v_player_salary_request,
        'message', v_player_terms_message
      )
      else '{}'::jsonb
    end
  )
  returning id into v_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'proposalId', v_proposal_id,
    'status', v_status,
    'sellerDecision', v_response ->> 'sellerDecision',
    'message', case
      when v_status = 'player_terms' then v_player_terms_message
      else coalesce(v_response ->> 'message', 'Proposta enviada ao clube vendedor.')
    end,
    'buyer', p_buyer,
    'seller', coalesce(nullif(trim(p_from_club), ''), 'Clube vendedor'),
    'player', p_player,
    'sellerValue', v_seller_value,
    'cashValue', greatest(0, v_seller_value - coalesce(v_trade_credit, 0)),
    'weeklySalary', case when v_status = 'player_terms' then v_player_salary_request else v_weekly_salary end,
    'tradeInPlayer', nullif(trim(coalesce(p_trade_in_player, '')), ''),
    'tradeInCredit', v_trade_credit,
    'clubResponse', v_response
  );
end;
$$;

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
  v_offer_value numeric := 0;
  v_cash_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_response jsonb;
  v_status text;
  v_seller_value numeric := 0;
  v_trade record;
  v_trade_value numeric := 0;
  v_signature jsonb;
  v_weekly_offer numeric := 0;
  v_weekly_request numeric := 0;
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

  if v_proposal.status not in ('pending', 'buyer_review', 'player_terms') then
    return jsonb_build_object('ok', false, 'message', 'Esta proposta ja foi encerrada ou esta em assinatura.');
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
           response_message = case
             when v_proposal.status = 'player_terms' then 'Comprador recusou os termos do jogador.'
             else 'Comprador desistiu da negociacao antes da assinatura.'
           end
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'status', 'rejected', 'message', 'Negociacao encerrada sem contratacao.');
  end if;

  if v_proposal.status = 'player_terms' then
    if v_decision = 'accepted' then
      v_signature := public.app_request_external_transfer_signature(
        p_proposal_id,
        greatest(0, coalesce(v_proposal.weekly_salary_eur, v_proposal.player_salary_request, 0))
      );
      return v_signature;
    end if;

    v_weekly_offer := coalesce(p_counter_value, 0);
    if v_weekly_offer <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Informe uma oferta salarial semanal maior que zero.');
    end if;
    v_weekly_offer := greatest(1500, round(v_weekly_offer / 500, 0) * 500);

    v_response := public.app_external_transfer_player_terms_response(
      v_proposal.player,
      coalesce(v_proposal.overall, 0),
      coalesce(v_proposal.reference_value, 0),
      coalesce(v_proposal.player_salary_request, v_proposal.weekly_salary_eur, 0),
      v_weekly_offer,
      coalesce(v_proposal.player_terms_round, 0) + 1
    );

    v_status := coalesce(v_response ->> 'status', 'player_terms');
    v_weekly_request := coalesce((v_response ->> 'weeklySalary')::numeric, v_weekly_offer);

    if v_status = 'rejected' then
      update public.internal_transfer_proposals
         set status = 'rejected',
             answered_at = now(),
             answered_by = 'Agente do jogador',
             player_salary_offer = v_weekly_offer,
             player_terms_round = coalesce(player_terms_round, 0) + 1,
             player_terms_response = v_response,
             player_terms_message = coalesce(v_response ->> 'message', 'Jogador recusou os termos.'),
             response_message = coalesce(v_response ->> 'message', 'Jogador recusou os termos.')
       where id = p_proposal_id;

      return jsonb_build_object('ok', true, 'status', 'rejected', 'message', coalesce(v_response ->> 'message', 'Jogador recusou os termos.'));
    end if;

    if v_status = 'signature_pending' then
      update public.internal_transfer_proposals
         set weekly_salary_eur = v_weekly_request,
             player_salary_offer = v_weekly_offer,
             player_salary_request = v_weekly_request,
             player_terms_round = coalesce(player_terms_round, 0) + 1,
             player_terms_response = v_response,
             player_terms_message = coalesce(v_response ->> 'message', 'Jogador aceitou os termos.'),
             response_message = coalesce(v_response ->> 'message', 'Jogador aceitou os termos.')
       where id = p_proposal_id;

      v_signature := public.app_request_external_transfer_signature(p_proposal_id, v_weekly_request);
      return v_signature;
    end if;

    update public.internal_transfer_proposals
       set status = 'player_terms',
           weekly_salary_eur = v_weekly_request,
           player_salary_offer = v_weekly_offer,
           player_salary_request = v_weekly_request,
           player_terms_round = coalesce(player_terms_round, 0) + 1,
           player_terms_response = v_response,
           player_terms_message = coalesce(v_response ->> 'message', 'Agente respondeu com novo pedido salarial.'),
           answered_at = now(),
           answered_by = 'Agente do jogador',
           response_message = coalesce(v_response ->> 'message', 'Agente respondeu com novo pedido salarial.')
     where id = p_proposal_id;

    return jsonb_build_object(
      'ok', true,
      'status', 'player_terms',
      'message', coalesce(v_response ->> 'message', 'Agente respondeu com novo pedido salarial.'),
      'weeklySalary', v_weekly_request,
      'playerResponse', v_response
    );
  end if;

  if v_decision = 'accepted' then
    v_weekly_request := greatest(
      coalesce(v_proposal.weekly_salary_eur, 0),
      public.app_external_transfer_player_salary_floor(
        v_proposal.player,
        coalesce(v_proposal.overall, 0),
        coalesce(v_proposal.reference_value, 0),
        coalesce(v_proposal.weekly_salary_eur, 0)
      )
    );

    update public.internal_transfer_proposals
       set status = 'player_terms',
           weekly_salary_eur = v_weekly_request,
           player_salary_offer = coalesce(v_proposal.weekly_salary_eur, 0),
           player_salary_request = v_weekly_request,
           player_terms_round = 0,
           player_terms_message = format('Clube aceitou. Agente pede salario semanal de %s para seguir.', trim(to_char(v_weekly_request, 'FM999G999G999G990'))),
           player_terms_response = jsonb_build_object(
             'status', 'player_terms',
             'playerDecision', 'counter',
             'weeklySalary', v_weekly_request,
             'salaryFloor', v_weekly_request,
             'message', 'Agente apresentou os termos pessoais do jogador.'
           ),
           answered_at = now(),
           answered_by = 'Agente do jogador',
           response_message = format('Clube aceitou. Agente pede salario semanal de %s para seguir.', trim(to_char(v_weekly_request, 'FM999G999G999G990')))
     where id = p_proposal_id;

    return jsonb_build_object(
      'ok', true,
      'status', 'player_terms',
      'message', format('Clube aceitou a venda. Agora negocie os termos do jogador: salario semanal de %s.', trim(to_char(v_weekly_request, 'FM999G999G999G990'))),
      'weeklySalary', v_weekly_request
    );
  end if;

  v_offer_value := coalesce(p_counter_value, 0);
  if v_offer_value <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe uma contraoferta maior que zero.');
  end if;

  v_offer_value := public.app_round_transfer_money(v_offer_value, 100000);
  v_cash_value := greatest(0, v_offer_value - coalesce(v_proposal.trade_in_credit, 0));

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> v_proposal.buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  if v_cash_value > v_remaining then
    return jsonb_build_object('ok', false, 'message', format('Contraoferta acima do saldo: faltam %s.', trim(to_char(v_cash_value - v_remaining, 'FM999G999G999G999G990'))));
  end if;

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

    v_trade_value := greatest(
      coalesce(v_trade.negotiated_value, 0),
      coalesce(v_trade.final_value, 0),
      coalesce(v_trade.market_value, 0),
      0
    );
  end if;

  v_response := public.app_external_transfer_club_response(
    coalesce(v_proposal.reference_value, 0),
    v_offer_value,
    coalesce(v_proposal.overall, 0),
    coalesce(v_proposal.negotiation_round, 0) + 1,
    coalesce(v_proposal.from_club, v_proposal.seller, ''),
    coalesce(v_proposal.trade_in_player, ''),
    coalesce(v_proposal.trade_in_credit, 0),
    v_trade_value,
    coalesce(v_trade.overall, 0)
  );
  v_status := coalesce(v_response ->> 'status', 'buyer_review');
  v_seller_value := coalesce((v_response ->> 'sellerValue')::numeric, v_offer_value);

  if v_status = 'player_terms' then
    v_weekly_request := greatest(
      coalesce(v_proposal.weekly_salary_eur, 0),
      public.app_external_transfer_player_salary_floor(
        v_proposal.player,
        coalesce(v_proposal.overall, 0),
        coalesce(v_proposal.reference_value, 0),
        coalesce(v_proposal.weekly_salary_eur, 0)
      )
    );
  end if;

  update public.internal_transfer_proposals
     set status = v_status,
         proposed_value = v_seller_value,
         buyer_offer_value = v_offer_value,
         cash_offer_value = greatest(0, v_seller_value - coalesce(v_proposal.trade_in_credit, 0)),
         negotiation_round = coalesce(negotiation_round, 0) + 1,
         answered_at = now(),
         answered_by = case when v_status = 'player_terms' then 'Agente do jogador' else coalesce(nullif(trim(v_proposal.from_club), ''), 'Clube vendedor') end,
         response_message = case
           when v_status = 'player_terms' then format('Clube aceitou. Agente pede salario semanal de %s para seguir.', trim(to_char(v_weekly_request, 'FM999G999G999G990')))
           else coalesce(v_response ->> 'message', 'Clube vendedor respondeu a contraoferta.')
         end,
         club_decision_score = coalesce((v_response ->> 'clubScore')::numeric, 0),
         club_floor_value = coalesce((v_response ->> 'sellerFloor')::numeric, 0),
         club_effective_offer = coalesce((v_response ->> 'effectiveOffer')::numeric, 0),
         club_trade_utility = coalesce((v_response ->> 'tradeUtility')::numeric, 0),
         club_trade_penalty = coalesce((v_response ->> 'tradePenalty')::numeric, 0),
         club_response = v_response,
         weekly_salary_eur = case when v_status = 'player_terms' then v_weekly_request else weekly_salary_eur end,
         player_salary_request = case when v_status = 'player_terms' then v_weekly_request else player_salary_request end,
         player_terms_message = case when v_status = 'player_terms' then format('Clube aceitou. Agente pede salario semanal de %s para seguir.', trim(to_char(v_weekly_request, 'FM999G999G999G990'))) else player_terms_message end,
         player_terms_response = case
           when v_status = 'player_terms' then jsonb_build_object(
             'status', 'player_terms',
             'playerDecision', 'counter',
             'weeklySalary', v_weekly_request,
             'salaryFloor', v_weekly_request,
             'message', 'Agente apresentou os termos pessoais do jogador.'
           )
           else player_terms_response
         end
   where id = p_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'sellerDecision', v_response ->> 'sellerDecision',
    'message', case
      when v_status = 'player_terms' then format('Clube aceitou a venda. Agora negocie os termos do jogador: salario semanal de %s.', trim(to_char(v_weekly_request, 'FM999G999G999G990')))
      else coalesce(v_response ->> 'message', 'Contraoferta respondida.')
    end,
    'sellerValue', v_seller_value,
    'cashValue', greatest(0, v_seller_value - coalesce(v_proposal.trade_in_credit, 0)),
    'weeklySalary', v_weekly_request,
    'clubResponse', v_response
  );
end;
$$;

revoke execute on function public.app_create_external_transfer_proposal_v1(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric)
  from public, anon, authenticated;
revoke execute on function public.app_answer_external_transfer_proposal_v1(text, text, bigint, text, numeric)
  from public, anon, authenticated;
revoke execute on function public.app_request_external_transfer_signature(bigint, numeric)
  from public, anon, authenticated;

grant execute on function public.app_external_transfer_seller_response(numeric, numeric, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
