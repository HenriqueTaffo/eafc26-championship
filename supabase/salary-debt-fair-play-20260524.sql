-- Regras de fair play por folha salarial.
-- Aplica folha no fechamento semanal, cria divida salarial quando o caixa
-- nao cobre a folha e bloqueia mercado enquanto o saldo estiver negativo.

alter table public.league_finance_rules
  add column if not exists salary_debt_grace_weeks integer not null default 1,
  add column if not exists salary_debt_penalty numeric not null default 1000000;

create table if not exists public.manager_salary_debts (
  id bigserial primary key,
  manager_id text references public.managers(id),
  manager_name text not null,
  status text not null default 'active',
  debt_amount numeric not null default 0,
  payroll_weekly numeric not null default 0,
  missed_weeks integer not null default 0,
  last_period_key text,
  last_processed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manager_salary_debts_status_check
    check (status in ('active', 'resolved'))
);

create unique index if not exists manager_salary_debts_one_active
  on public.manager_salary_debts (manager_id)
  where status = 'active';

create index if not exists manager_salary_debts_status_idx
  on public.manager_salary_debts (status, manager_id);

create or replace function public.app_get_budget_reconciliation()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with data as (
    select public.app_get_data()::jsonb as j
  ),
  config as (
    select
      coalesce((j ->> 'budget')::numeric, 65000000) as base_budget_default,
      coalesce((j ->> 'homeMatchBonus')::numeric, 1250000) as home_match_bonus,
      coalesce((j ->> 'winBonus')::numeric, 500000) as win_bonus
    from data
  ),
  teams(manager_name, club_name) as (
    values
      ('Henrique', 'Coventry City'),
      ('Willian', 'Birmingham City'),
      ('Rafael', 'Middlesbrough'),
      ('Renato', 'Southampton'),
      ('Bruno Silva', 'Wrexham')
  ),
  results as (
    select *
    from jsonb_to_recordset(coalesce((select j -> 'results' from data), '[]'::jsonb)) as r(
      "Mandante" text,
      "Visitante" text,
      "GolsMandante" integer,
      "GolsVisitante" integer,
      "Status" text,
      "Competicao" text
    )
    where lower(coalesce("Status", '')) = 'aprovado'
      and lower(coalesce("Competicao", '')) = 'championship'
  ),
  stats as (
    select
      t.manager_name,
      count(*) filter (where lower(r."Mandante") = lower(t.club_name))::integer as home_matches,
      count(*) filter (
        where (
          lower(r."Mandante") = lower(t.club_name)
          and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0)
        ) or (
          lower(r."Visitante") = lower(t.club_name)
          and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0)
        )
      )::integer as wins,
      count(*)::integer as matches_played,
      sum(
        case
          when lower(r."Mandante") = lower(t.club_name) and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0) then 3
          when lower(r."Visitante") = lower(t.club_name) and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0) then 3
          when coalesce(r."GolsMandante", -1) = coalesce(r."GolsVisitante", -2) then 1
          else 0
        end
      )::integer as points
    from teams t
    left join results r
      on lower(r."Mandante") = lower(t.club_name)
      or lower(r."Visitante") = lower(t.club_name)
    group by t.manager_name
  ),
  reward_totals as (
    select
      manager_name,
      sum(reward_value)::numeric as reward_total
    from public.sponsorship_rewards
    group by manager_name
  ),
  sponsorship_payout_events as (
    select
      "Jogador" as manager_name,
      sum(coalesce("ImpactoFinanceiro", 0))::numeric as event_reward_total
    from jsonb_to_recordset(coalesce((select j -> 'events' from data), '[]'::jsonb)) as e(
      "Jogador" text,
      "Titulo" text,
      "Tipo" text,
      "ImpactoFinanceiro" numeric
    )
    where coalesce("ImpactoFinanceiro", 0) > 0
      and (
        lower(coalesce("Tipo", '')) = 'patrocinio'
        or lower(coalesce("Titulo", '')) like '%patrocinio%'
      )
    group by "Jogador"
  ),
  raw_budgets as (
    select key as manager_name, value as budget
    from jsonb_each(coalesce((select j -> 'budgets' from data), '{}'::jsonb))
  ),
  transfer_spend as (
    select public.app_get_transfer_spend_breakdown() as totals
  ),
  active_debts as (
    select distinct on (manager_name)
      manager_name,
      debt_amount,
      missed_weeks,
      payroll_weekly,
      last_period_key
    from public.manager_salary_debts
    where status = 'active'
    order by manager_name, updated_at desc
  ),
  reconciled as (
    select
      t.manager_name,
      coalesce((rb.budget ->> 'baseBudget')::numeric, config.base_budget_default) as base_budget,
      coalesce(s.matches_played, 0) as matches_played,
      coalesce(s.points, 0) as points,
      coalesce(s.home_matches, 0) as home_matches,
      coalesce(s.wins, 0) as wins,
      coalesce((rb.budget ->> 'weeklyIncome')::numeric, 0) as weekly_income_value,
      coalesce(s.home_matches, 0) * config.home_match_bonus as home_bonus,
      coalesce(s.wins, 0) * config.win_bonus as win_bonus_value,
      coalesce((rb.budget ->> 'formBonus')::numeric, 0) as form_bonus,
      coalesce((rb.budget ->> 'cupRebalanceBonus')::numeric, 0) as cup_rebalance_bonus,
      coalesce((rb.budget ->> 'eventTotal')::numeric, 0)
        - coalesce(spe.event_reward_total, 0)
        + coalesce(rt.reward_total, 0) as event_total,
      coalesce(rt.reward_total, 0) as sponsorship_rewards,
      coalesce((rb.budget ->> 'spentTotal')::numeric, 0) as legacy_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'marketTotal')::numeric, 0) as secure_market_total,
      coalesce((ts.totals -> t.manager_name ->> 'finalTotal')::numeric, 0) as secure_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'deltaTotal')::numeric, 0) as secure_delta_total,
      coalesce((ts.totals -> t.manager_name ->> 'nonApprovedMarketTotal')::numeric, 0) as non_approved_market_total,
      greatest(0, coalesce((rb.budget ->> 'spentTotal')::numeric, 0)) as spent_total,
      coalesce((rb.budget ->> 'transferModifier')::integer, 0) as transfer_modifier,
      coalesce((rb.budget ->> 'transferLimit')::integer, 3) as raw_transfer_limit,
      ad.debt_amount as salary_debt_amount,
      ad.missed_weeks as salary_debt_weeks,
      ad.payroll_weekly as salary_debt_payroll,
      ad.last_period_key as salary_debt_period
    from teams t
    cross join config
    cross join transfer_spend ts
    left join raw_budgets rb on rb.manager_name = t.manager_name
    left join stats s on s.manager_name = t.manager_name
    left join reward_totals rt on rt.manager_name = t.manager_name
    left join sponsorship_payout_events spe on spe.manager_name = t.manager_name
    left join active_debts ad on lower(ad.manager_name) = lower(t.manager_name)
  ),
  final_rows as (
    select
      *,
      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total as total_budget,
      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total as remaining_budget
    from reconciled
  )
  select coalesce(jsonb_object_agg(
    manager_name,
    jsonb_build_object(
      'baseBudget', base_budget,
      'matchesPlayed', matches_played,
      'homeMatches', home_matches,
      'wins', wins,
      'points', points,
      'weeklyIncome', weekly_income_value,
      'homeBonus', home_bonus,
      'winBonusValue', win_bonus_value,
      'formBonus', form_bonus,
      'cupRebalanceBonus', cup_rebalance_bonus,
      'eventTotal', event_total,
      'sponsorshipRewards', sponsorship_rewards,
      'totalBudget', total_budget,
      'legacySpentTotal', legacy_spent_total,
      'secureMarketTotal', secure_market_total,
      'secureSpentTotal', secure_spent_total,
      'secureDeltaTotal', secure_delta_total,
      'nonApprovedMarketTotal', non_approved_market_total,
      'spentTotal', spent_total,
      'remainingBudget', remaining_budget,
      'transferModifier', transfer_modifier,
      'salaryDebtActive', salary_debt_amount is not null,
      'salaryDebtAmount', coalesce(salary_debt_amount, case when remaining_budget < 0 then abs(remaining_budget) else 0 end),
      'salaryDebtWeeks', coalesce(salary_debt_weeks, 0),
      'salaryDebtPayroll', coalesce(salary_debt_payroll, 0),
      'salaryDebtPeriod', coalesce(salary_debt_period, ''),
      'marketEmbargo', remaining_budget < 0 or salary_debt_amount is not null,
      'transferLimit', case when remaining_budget < 0 or salary_debt_amount is not null then 0 else raw_transfer_limit end,
      'transfersToday', public.app_get_external_transfer_today_count(manager_name)
    )
  ), '{}'::jsonb)
  from final_rows;
$$;

create or replace function public.app_get_salary_debt_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budgets jsonb;
  v_rows jsonb;
begin
  v_budgets := public.app_get_budget_reconciliation()::jsonb;

  update public.manager_salary_debts d
     set status = 'resolved',
         debt_amount = 0,
         resolved_at = now(),
         updated_at = now()
   where d.status = 'active'
     and coalesce((v_budgets -> d.manager_name ->> 'remainingBudget')::numeric, -1) >= 0;

  v_budgets := public.app_get_budget_reconciliation()::jsonb;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'managerId', d.manager_id,
      'managerName', d.manager_name,
      'status', d.status,
      'debtAmount', d.debt_amount,
      'payrollWeekly', d.payroll_weekly,
      'missedWeeks', d.missed_weeks,
      'lastPeriodKey', coalesce(d.last_period_key, ''),
      'currentRemaining', coalesce((v_budgets -> d.manager_name ->> 'remainingBudget')::numeric, 0),
      'marketEmbargo', d.status = 'active' or coalesce((v_budgets -> d.manager_name ->> 'remainingBudget')::numeric, 0) < 0,
      'resolvedAt', d.resolved_at,
      'updatedAt', d.updated_at
    )
    order by d.status asc, d.debt_amount desc, d.updated_at desc
  ), '[]'::jsonb)
    into v_rows
  from public.manager_salary_debts d
  where d.status = 'active'
     or d.updated_at >= now() - interval '45 days';

  return v_rows;
end;
$$;

create or replace function public.app_insert_salary_event(
  p_manager_id text,
  p_type text,
  p_title text,
  p_description text,
  p_effect text,
  p_impact numeric,
  p_unique_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id bigint;
  v_rows integer := 0;
begin
  select c.id
    into v_club_id
  from public.clubs c
  where c.owner_id = p_manager_id
  limit 1;

  insert into public.events (
    event_date,
    slot_hour,
    manager_id,
    club_id,
    type,
    title,
    description,
    effect,
    financial_impact,
    transfer_modifier,
    affected_player,
    duration_type,
    duration_value,
    matches_remaining,
    expires_at,
    status,
    unique_key,
    created_at,
    updated_at
  ) values (
    current_date,
    null,
    p_manager_id,
    v_club_id,
    p_type,
    p_title,
    coalesce(p_description, ''),
    coalesce(p_effect, ''),
    coalesce(p_impact, 0),
    0,
    null,
    null,
    null,
    null,
    null,
    'applied',
    p_unique_key,
    now(),
    now()
  )
  on conflict (unique_key) where nullif(btrim(unique_key), '') is not null
  do nothing;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.app_apply_weekly_payroll()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_key text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'IYYY-IW');
  v_budgets jsonb;
  v_forecast jsonb;
  v_item jsonb;
  v_manager_id text;
  v_manager_name text;
  v_payroll numeric;
  v_remaining_before numeric;
  v_remaining_after numeric;
  v_existing public.manager_salary_debts%rowtype;
  v_missed_weeks integer;
  v_penalty numeric;
  v_grace_weeks integer;
  v_inserted boolean;
  v_charged integer := 0;
  v_debts integer := 0;
  v_penalties integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  select
    coalesce(salary_debt_penalty, 1000000),
    coalesce(salary_debt_grace_weeks, 1)
    into v_penalty, v_grace_weeks
  from public.league_finance_rules
  where id = 'default';

  v_penalty := coalesce(v_penalty, 1000000);
  v_grace_weeks := coalesce(v_grace_weeks, 1);
  v_budgets := public.app_get_budget_reconciliation()::jsonb;
  v_forecast := public.app_get_manager_finance_forecast()::jsonb;

  for v_item in select value from jsonb_array_elements(coalesce(v_forecast, '[]'::jsonb))
  loop
    v_manager_name := v_item ->> 'manager_name';
    v_payroll := coalesce((v_item ->> 'payroll_weekly')::numeric, 0);

    select id into v_manager_id
    from public.managers
    where lower(display_name) = lower(v_manager_name)
    limit 1;

    if v_manager_id is null or v_payroll <= 0 then
      continue;
    end if;

    v_remaining_before := coalesce((v_budgets -> v_manager_name ->> 'remainingBudget')::numeric, 0);

    if v_remaining_before >= 0 then
      update public.manager_salary_debts
         set status = 'resolved',
             debt_amount = 0,
             resolved_at = now(),
             updated_at = now()
       where status = 'active'
         and lower(manager_name) = lower(v_manager_name);
    end if;

    v_inserted := public.app_insert_salary_event(
      v_manager_id,
      'Folha salarial',
      'Folha salarial: ' || v_manager_name,
      v_manager_name || ' pagou a folha semanal do elenco.',
      '-' || v_payroll::text || ' debitado como folha semanal.',
      -v_payroll,
      'weekly-payroll-' || v_period_key || '-' || v_manager_id
    );

    if not v_inserted then
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'managerName', v_manager_name,
        'status', 'skipped',
        'reason', 'Folha semanal ja processada neste periodo.',
        'periodKey', v_period_key
      ));
      continue;
    end if;

    v_charged := v_charged + 1;
    v_remaining_after := v_remaining_before - v_payroll;

    if v_remaining_after < 0 then
      select *
        into v_existing
      from public.manager_salary_debts
      where status = 'active'
        and lower(manager_name) = lower(v_manager_name)
      order by updated_at desc
      limit 1
      for update;

      v_missed_weeks := coalesce(v_existing.missed_weeks, 0) + 1;

      insert into public.manager_salary_debts (
        manager_id,
        manager_name,
        status,
        debt_amount,
        payroll_weekly,
        missed_weeks,
        last_period_key,
        last_processed_at,
        updated_at
      ) values (
        v_manager_id,
        v_manager_name,
        'active',
        abs(v_remaining_after),
        v_payroll,
        v_missed_weeks,
        v_period_key,
        now(),
        now()
      )
      on conflict (manager_id) where status = 'active'
      do update set
        debt_amount = excluded.debt_amount,
        payroll_weekly = excluded.payroll_weekly,
        missed_weeks = excluded.missed_weeks,
        last_period_key = excluded.last_period_key,
        last_processed_at = excluded.last_processed_at,
        updated_at = now();

      v_debts := v_debts + 1;

      perform public.app_insert_salary_event(
        v_manager_id,
        'Fair Play Financeiro',
        'Divida salarial: ' || v_manager_name,
        v_manager_name || ' fechou a semana sem caixa suficiente para cobrir a folha.',
        'Mercado bloqueado ate o saldo voltar ao positivo.',
        0,
        'salary-debt-' || v_period_key || '-' || v_manager_id
      );

      if v_missed_weeks > v_grace_weeks then
        v_inserted := public.app_insert_salary_event(
          v_manager_id,
          'Fair Play Financeiro',
          'Multa por divida salarial: ' || v_manager_name,
          v_manager_name || ' manteve divida salarial por ' || v_missed_weeks || ' fechamento(s).',
          '-' || v_penalty::text || ' aplicado por reincidencia financeira.',
          -v_penalty,
          'salary-debt-penalty-' || v_period_key || '-' || v_manager_id
        );

        if v_inserted then
          v_penalties := v_penalties + 1;
          v_remaining_after := v_remaining_after - v_penalty;

          update public.manager_salary_debts
             set debt_amount = abs(v_remaining_after),
                 updated_at = now()
           where status = 'active'
             and lower(manager_name) = lower(v_manager_name);
        end if;
      end if;

      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'managerName', v_manager_name,
        'status', 'debt',
        'periodKey', v_period_key,
        'payrollWeekly', v_payroll,
        'remainingBefore', v_remaining_before,
        'remainingAfter', v_remaining_after,
        'missedWeeks', v_missed_weeks
      ));
    else
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'managerName', v_manager_name,
        'status', 'paid',
        'periodKey', v_period_key,
        'payrollWeekly', v_payroll,
        'remainingBefore', v_remaining_before,
        'remainingAfter', v_remaining_after
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'periodKey', v_period_key,
    'charged', v_charged,
    'debts', v_debts,
    'penalties', v_penalties,
    'rows', v_rows
  );
end;
$$;

create or replace function public.app_get_manager_finance_forecast()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with data as (
    select public.app_get_data()::jsonb as j
  ),
  budgets as (
    select public.app_get_budget_reconciliation()::jsonb as j
  ),
  rules as (
    select *
    from public.league_finance_rules
    where id = 'default'
  ),
  transfers as (
    select *
    from jsonb_to_recordset(coalesce((select j -> 'transfers' from data), '[]'::jsonb)) as t(
      "Comprador" text,
      "Jogador" text,
      "Overall" integer,
      "ValorTransfermarkt" numeric,
      "ValorFinal" numeric,
      "Status" text,
      "TipoTransferencia" text
    )
    where lower(coalesce("Status", '')) in ('aprovado', 'approved')
      and lower(coalesce("TipoTransferencia", 'market')) not in ('internal', 'cpu_sale')
  ),
  payroll as (
    select
      "Comprador" as manager_name,
      count(*)::integer as player_count,
      coalesce(sum(public.app_estimate_weekly_salary("Overall", "ValorTransfermarkt", "ValorFinal")), 0) as payroll_weekly
    from transfers
    group by "Comprador"
  ),
  managers(manager_name) as (
    values ('Henrique'), ('Willian'), ('Rafael'), ('Renato'), ('Bruno Silva')
  ),
  rows as (
    select
      m.manager_name,
      coalesce((budgets.j -> m.manager_name ->> 'totalBudget')::numeric, 65000000) as total_budget,
      coalesce((budgets.j -> m.manager_name ->> 'remainingBudget')::numeric, 65000000) as remaining_budget,
      coalesce((budgets.j -> m.manager_name ->> 'spentTotal')::numeric, 0) as spent_total,
      coalesce((budgets.j -> m.manager_name ->> 'salaryDebtActive')::boolean, false) as salary_debt_active,
      coalesce((budgets.j -> m.manager_name ->> 'salaryDebtAmount')::numeric, 0) as salary_debt_amount,
      coalesce((budgets.j -> m.manager_name ->> 'salaryDebtWeeks')::integer, 0) as salary_debt_weeks,
      coalesce((budgets.j -> m.manager_name ->> 'marketEmbargo')::boolean, false) as market_embargo,
      coalesce(p.player_count, 0) as player_count,
      coalesce(p.payroll_weekly, 0) as payroll_weekly,
      coalesce(p.payroll_weekly, 0) * 4 as payroll_monthly,
      case
        when coalesce(p.payroll_weekly, 0) <= 0 then null
        else floor(greatest(coalesce((budgets.j -> m.manager_name ->> 'remainingBudget')::numeric, 0), 0) / coalesce(p.payroll_weekly, 1))::integer
      end as runway_weeks,
      case
        when coalesce((budgets.j -> m.manager_name ->> 'salaryDebtActive')::boolean, false) then 'Dívida salarial'
        when coalesce((budgets.j -> m.manager_name ->> 'remainingBudget')::numeric, 0) < 0 then 'Dívida salarial'
        when coalesce(p.payroll_weekly, 0) * 4 > coalesce((budgets.j -> m.manager_name ->> 'totalBudget')::numeric, 65000000) * coalesce((select max_payroll_to_budget_ratio from rules), 0.22) then 'Folha acima do teto'
        when coalesce(p.payroll_weekly, 0) * 4 > coalesce((budgets.j -> m.manager_name ->> 'totalBudget')::numeric, 65000000) * coalesce((select warning_payroll_to_budget_ratio from rules), 0.18) then 'Atenção'
        else 'Saudável'
      end as risk
    from managers m
    cross join budgets
    left join payroll p on lower(p.manager_name) = lower(m.manager_name)
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by payroll_weekly desc), '[]'::jsonb)
  from rows;
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
  v_budget jsonb;
  v_remaining numeric := 0;
  v_market_embargo boolean := false;
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

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object(
      'ok', false,
      'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo.', p_buyer)
    );
  end if;

  if v_value > v_remaining then
    return jsonb_build_object(
      'ok', false,
      'message', format('Saldo insuficiente para %s concluir a compra interna.', p_buyer)
    );
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
  v_forecast jsonb;
  v_forecast_row jsonb;
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

create or replace function public.app_close_weekly_review(
  p_manager_id text,
  p_access_code text,
  p_snapshot text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_item jsonb;
  v_snapshot jsonb := coalesce(nullif(p_snapshot, '')::jsonb, '[]'::jsonb);
  v_met integer;
  v_total integer;
  v_impact numeric;
  v_verdict text;
  v_inserted integer := 0;
  v_payroll jsonb;
begin
  v_login := public.app_governance_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  for v_item in select value from jsonb_array_elements(v_snapshot)
  loop
    v_met := coalesce((v_item ->> 'ok')::integer, 0);
    v_total := greatest(coalesce((v_item ->> 'total')::integer, 4), 1);
    v_verdict := coalesce(v_item ->> 'verdict', 'Neutro');
    v_impact := case
      when v_met >= 3 then 750000
      when v_met <= 1 then -500000
      else 0
    end;

    insert into public.governance_weekly_reviews (
      manager_id,
      manager_name,
      club_name,
      objectives_met,
      objectives_total,
      verdict,
      suggested_impact
    ) values (
      nullif(v_item ->> 'managerId', ''),
      coalesce(v_item ->> 'owner', 'Tecnico'),
      coalesce(v_item ->> 'team', ''),
      v_met,
      v_total,
      v_verdict,
      v_impact
    );

    v_inserted := v_inserted + 1;

    if v_impact <> 0 then
      perform public.app_governance_insert_event(
        coalesce(nullif(v_item ->> 'managerId', ''), p_manager_id),
        case when v_impact > 0 then 'Diretoria aprovou a semana' else 'Diretoria cobrou resultado' end,
        coalesce(v_item ->> 'owner', 'Tecnico') || ' fechou a semana com ' || v_met || '/' || v_total || ' objetivos.',
        case when v_impact > 0 then 'Bonus semanal creditado.' else 'Multa semanal aplicada.' end,
        'Diretoria',
        v_impact
      );
    end if;
  end loop;

  v_payroll := public.app_apply_weekly_payroll();

  return jsonb_build_object(
    'ok', true,
    'message', 'Fechamento semanal e folha registrados.',
    'inserted', v_inserted,
    'payroll', v_payroll
  );
end;
$$;

grant execute on function public.app_get_budget_reconciliation() to anon, authenticated;
grant execute on function public.app_get_salary_debt_status() to anon, authenticated;
grant execute on function public.app_get_manager_finance_forecast() to anon, authenticated;
grant execute on function public.app_record_internal_transfer(text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_close_weekly_review(text, text, text) to anon, authenticated;
revoke execute on function public.app_apply_weekly_payroll() from public, anon, authenticated;
revoke execute on function public.app_insert_salary_event(text, text, text, text, text, numeric, text) from public, anon, authenticated;
