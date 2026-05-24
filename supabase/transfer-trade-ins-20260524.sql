-- Jogador como troca em transferencias externas - 24/05/2026.
-- Mantem o valor bruto da compra, grava o pagamento em dinheiro em
-- negotiated_value e usa esse valor liquido no orcamento.

alter table public.transfers
  add column if not exists trade_in_player_name text,
  add column if not exists trade_in_credit numeric not null default 0,
  add column if not exists trade_in_transfer_id bigint references public.transfers(id);

create or replace view public.v_manager_budgets as
with manager_base as (
  select
    m.id as manager_id,
    m.display_name as manager_name,
    c.id as club_id,
    c.name as club_name
  from public.managers m
  left join public.clubs c on c.owner_id = m.id
),
home_stats as (
  select
    mb.manager_id,
    count(ma.id) filter (
      where ma.status = 'approved'
        and ma.competition = 'Championship'
        and ma.home_club_id = mb.club_id
    ) as home_matches,
    count(ma.id) filter (
      where ma.status = 'approved'
        and ma.competition = 'Championship'
        and (
          (ma.home_club_id = mb.club_id and ma.home_score > ma.away_score)
          or (ma.away_club_id = mb.club_id and ma.away_score > ma.home_score)
        )
    ) as wins
  from manager_base mb
  left join public.matches ma
    on ma.home_club_id = mb.club_id
    or ma.away_club_id = mb.club_id
  group by mb.manager_id
),
event_stats as (
  select
    e.manager_id,
    coalesce(sum(e.financial_impact) filter (
      where e.status = any (array['active', 'applied', 'generated'])
    ), 0)::numeric as event_bonus,
    count(e.id) filter (
      where e.status = any (array['active', 'applied', 'generated'])
    ) as event_count,
    coalesce(sum(e.transfer_modifier) filter (
      where e.status = any (array['active', 'applied', 'generated'])
        and (e.created_at at time zone 'America/Sao_Paulo')::date =
          (now() at time zone 'America/Sao_Paulo')::date
    ), 0)::integer as transfer_modifier,
    count(e.id) filter (
      where e.status = any (array['active', 'applied', 'generated'])
        and coalesce(e.affected_player, '') <> ''
        and (
          coalesce(e.matches_remaining, 0) > 0
          or e.expires_at > now()
          or e.expires_at is null
        )
    ) as active_injuries
  from public.events e
  group by e.manager_id
),
transfer_stats as (
  select
    t.buyer_id as manager_id,
    coalesce(sum(
      case
        when t.status = 'approved' and t.transfer_type <> 'internal'
          then coalesce(t.negotiated_value, t.final_value, 0)
        else 0
      end
    ), 0)::numeric as spent_total,
    count(t.id) filter (
      where t.status = 'approved'
        and t.transfer_type not in ('internal', 'cpu_sale')
        and (t.created_at at time zone 'America/Sao_Paulo')::date =
          (now() at time zone 'America/Sao_Paulo')::date
    ) as transfers_today
  from public.transfers t
  group by t.buyer_id
)
select
  mb.manager_id,
  mb.manager_name,
  mb.club_id,
  mb.club_name,
  65000000::numeric as base_budget,
  coalesce(hs.home_matches, 0)::integer as home_matches,
  coalesce(hs.wins, 0)::integer as wins,
  (coalesce(hs.home_matches, 0) * 1250000)::numeric as home_bonus,
  (coalesce(hs.wins, 0) * 500000)::numeric as win_bonus,
  coalesce(es.event_bonus, 0)::numeric as event_bonus,
  (65000000 + coalesce(hs.home_matches, 0) * 1250000 + coalesce(hs.wins, 0) * 500000)::numeric
    + coalesce(es.event_bonus, 0)::numeric as total_budget,
  coalesce(ts.spent_total, 0)::numeric as spent_total,
  (65000000 + coalesce(hs.home_matches, 0) * 1250000 + coalesce(hs.wins, 0) * 500000)::numeric
    + coalesce(es.event_bonus, 0)::numeric
    - coalesce(ts.spent_total, 0)::numeric as remaining_budget,
  coalesce(es.event_count, 0)::integer as event_count,
  coalesce(es.active_injuries, 0)::integer as active_injuries,
  coalesce(es.transfer_modifier, 0)::integer as transfer_modifier,
  greatest(0, 3 + coalesce(es.transfer_modifier, 0)) as transfer_limit_today,
  coalesce(ts.transfers_today, 0)::integer as transfers_today
from manager_base mb
left join home_stats hs on hs.manager_id = mb.manager_id
left join event_stats es on es.manager_id = mb.manager_id
left join transfer_stats ts on ts.manager_id = mb.manager_id;

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
      coalesce(t.negotiated_value, t.final_value, 0) as final_value,
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
  v_forecast_row jsonb;
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

  select item into v_forecast_row
  from jsonb_array_elements(public.app_get_manager_finance_forecast()) as item
  where lower(item ->> 'manager_name') = lower(p_buyer)
  limit 1;

  v_current_payroll := coalesce((v_forecast_row ->> 'payroll_weekly')::numeric, 0);

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
      when v_trade_credit > 0 then 'OK · Troca: ' || v_trade.player_name
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

grant execute on function public.app_get_transfer_spend_breakdown() to anon, authenticated;
grant execute on function public.app_add_transfer_with_trade(text, text, text, text, text, integer, numeric, text, numeric) to anon, authenticated;
