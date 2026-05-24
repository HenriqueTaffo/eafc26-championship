-- Otimiza envio de transferencias - 24/05/2026.
-- Evita chamar a previsao financeira completa dentro do clique de envio.

create or replace function public.app_get_manager_current_payroll(
  p_buyer text,
  p_exclude_player text default ''
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with manager_match as (
    select id
    from public.managers
    where lower(display_name) = lower(trim(p_buyer))
       or lower(id) = lower(trim(p_buyer))
    limit 1
  ),
  latest as (
    select
      t.*,
      row_number() over (
        partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
      and coalesce(t.player_key, t.player_name, '') <> ''
  )
  select coalesce(sum(public.app_estimate_weekly_salary(
    l.overall,
    l.market_value,
    greatest(
      coalesce(l.final_value, 0),
      coalesce(l.negotiated_value, 0),
      coalesce(l.market_value, 0)
    )
  )), 0)::numeric
  from latest l
  join manager_match m on m.id = l.buyer_id
  where l.rn = 1
    and lower(coalesce(l.transfer_type, 'market')) not in ('internal', 'cpu_sale')
    and (
      coalesce(trim(p_exclude_player), '') = ''
      or lower(trim(l.player_name)) <> lower(trim(p_exclude_player))
    );
$$;

create or replace function public.app_add_transfer(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
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
  v_login jsonb;
  v_is_commissioner boolean;
  v_manager_name text;
  v_rate numeric := 0;
  v_final_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_weekly_salary numeric := 0;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
begin
  perform public.app_get_salary_debt_status();

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  if not v_is_commissioner and lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A transferencia precisa ser enviada pelo comprador logado.');
  end if;

  v_rate := case
    when coalesce(p_overall, 0) >= 89 then 0.25
    when coalesce(p_overall, 0) >= 84 then 0.15
    when coalesce(p_overall, 0) >= 80 then 0.10
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end;
  v_final_value := coalesce(p_market_value, 0) + (coalesce(p_market_value, 0) * v_rate);

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 65000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);
  v_weekly_salary := public.app_estimate_weekly_salary(p_overall, p_market_value, v_final_value);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(p_buyer);

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object(
      'ok', false,
      'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo. Venda jogadores ou aguarde receita vencida.', p_buyer)
    );
  end if;

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', p_buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', p_buyer));
  end if;

  if v_final_value > v_remaining then
    return jsonb_build_object(
      'ok', false,
      'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_final_value - v_remaining, 'FM999G999G999G999G990')))
    );
  end if;

  if (v_current_payroll + v_weekly_salary) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object(
      'ok', false,
      'message', 'Folha projetada acima do teto financeiro da liga. Venda jogadores, aumente receita ou escolha um alvo menor.'
    );
  end if;

  return public.app_record_external_transfer(p_buyer, p_player, p_from_club, p_overall, p_market_value, v_final_value);
end;
$$;

create or replace function public.app_add_transfer_with_trade(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric,
  p_trade_in_player text default '',
  p_trade_in_credit numeric default null
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
  v_gross_value numeric := 0;
  v_cash_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_weekly_salary numeric := 0;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
  v_trade record;
  v_trade_value numeric := 0;
  v_trade_credit numeric := 0;
  v_purchase_id bigint;
  v_trade_sale_id bigint;
begin
  perform public.app_get_salary_debt_status();

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  if not v_is_commissioner and lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A transferencia precisa ser enviada pelo comprador logado.');
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(p_buyer)
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
  v_gross_value := coalesce(p_market_value, 0) + (coalesce(p_market_value, 0) * v_rate);

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
        v_gross_value * 0.70,
        v_trade_value * 0.85,
        greatest(coalesce(p_trade_in_credit, v_trade_value * 0.85), 0)
      ) / 100000
    ) * 100000;
  end if;

  v_cash_value := greatest(0, v_gross_value - coalesce(v_trade_credit, 0));

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 65000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);
  v_weekly_salary := public.app_estimate_weekly_salary(p_overall, p_market_value, v_gross_value);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(
    p_buyer,
    case when v_trade_credit > 0 then v_trade.player_name else '' end
  );

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object(
      'ok', false,
      'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo. Venda jogadores ou aguarde receita vencida.', p_buyer)
    );
  end if;

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', p_buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', p_buyer));
  end if;

  if v_cash_value > v_remaining then
    return jsonb_build_object(
      'ok', false,
      'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_cash_value - v_remaining, 'FM999G999G999G999G990')))
    );
  end if;

  if (v_current_payroll + v_weekly_salary) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object(
      'ok', false,
      'message', 'Folha projetada acima do teto financeiro da liga. Venda jogadores, aumente receita ou escolha um alvo menor.'
    );
  end if;

  insert into public.transfers (
    buyer_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
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
    trim(p_player),
    nullif(trim(p_from_club), ''),
    coalesce(p_overall, 0),
    coalesce(p_market_value, 0),
    v_rate,
    'approved',
    case
      when v_trade_credit > 0 then 'OK - Troca: ' || v_trade.player_name
      else 'OK'
    end,
    'market',
    case when v_trade_credit > 0 then v_cash_value else null end,
    case when v_trade_credit > 0 then v_trade.player_name else null end,
    coalesce(v_trade_credit, 0),
    now(),
    now()
  )
  returning id into v_purchase_id;

  if v_trade_credit > 0 then
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
      coalesce(nullif(v_trade.from_club, ''), 'Elenco de ' || p_buyer),
      coalesce(v_trade.overall, 0),
      0,
      0,
      'approved',
      'Troca usada na compra de ' || trim(p_player),
      'cpu_sale',
      0,
      coalesce(nullif(trim(p_from_club), ''), 'Clube vendedor'),
      now(),
      now()
    )
    returning id into v_trade_sale_id;

    update public.transfers
       set trade_in_transfer_id = v_trade_sale_id,
           updated_at = now()
     where id = v_purchase_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', case
      when v_trade_credit > 0 then 'Transferencia registrada com troca. O jogador oferecido saiu do elenco e o orcamento usou o valor em dinheiro.'
      else 'Transferencia registrada.'
    end,
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'marketValue', p_market_value,
    'finalValue', v_gross_value,
    'cashValue', v_cash_value,
    'tradeInPlayer', coalesce(v_trade.player_name, ''),
    'tradeInCredit', coalesce(v_trade_credit, 0)
  );
end;
$$;

grant execute on function public.app_get_manager_current_payroll(text, text) to anon, authenticated;
grant execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_add_transfer_with_trade(text, text, text, text, text, integer, numeric, text, numeric) to anon, authenticated;
