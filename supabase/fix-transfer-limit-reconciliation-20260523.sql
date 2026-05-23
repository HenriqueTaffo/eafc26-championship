-- Corrige o limite diario usado pelo backend de transferencias.
-- Problema: app_get_data ja calculava transferLimit 5 para eventos de empresario,
-- mas app_get_budget_reconciliation retornava sempre 3. app_add_transfer usa
-- app_get_budget_reconciliation, entao a compra batia no limite errado.

create or replace function public.app_get_budget_reconciliation()
returns jsonb
language sql
security definer
stable
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
  sponsorship_reward_events as (
    select
      "Jogador" as manager_name,
      sum(coalesce("ImpactoFinanceiro", 0))::numeric as event_reward_total
    from jsonb_to_recordset(coalesce((select j -> 'events' from data), '[]'::jsonb)) as e(
      "Jogador" text,
      "Titulo" text,
      "ImpactoFinanceiro" numeric
    )
    where lower(coalesce("Titulo", '')) like '%bonus de patrocinio%'
    group by "Jogador"
  ),
  raw_budgets as (
    select key as manager_name, value as budget
    from jsonb_each(coalesce((select j -> 'budgets' from data), '{}'::jsonb))
  ),
  transfer_spend as (
    select public.app_get_transfer_spend_breakdown() as totals
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
        - coalesce(sre.event_reward_total, 0)
        + coalesce(rt.reward_total, 0) as event_total,
      coalesce(rt.reward_total, 0) as sponsorship_rewards,
      coalesce((rb.budget ->> 'spentTotal')::numeric, 0) as legacy_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'marketTotal')::numeric, 0) as secure_market_total,
      coalesce((ts.totals -> t.manager_name ->> 'finalTotal')::numeric, 0) as secure_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'deltaTotal')::numeric, 0) as secure_delta_total,
      coalesce((ts.totals -> t.manager_name ->> 'nonApprovedMarketTotal')::numeric, 0) as non_approved_market_total,
      greatest(
        0,
        coalesce((rb.budget ->> 'spentTotal')::numeric, 0)
        - coalesce((ts.totals -> t.manager_name ->> 'nonApprovedMarketTotal')::numeric, 0)
      ) as spent_total,
      coalesce((rb.budget ->> 'transferModifier')::integer, 0) as transfer_modifier,
      coalesce((rb.budget ->> 'transferLimit')::integer, 3) as transfer_limit
    from teams t
    cross join config
    cross join transfer_spend ts
    left join raw_budgets rb on rb.manager_name = t.manager_name
    left join stats s on s.manager_name = t.manager_name
    left join reward_totals rt on rt.manager_name = t.manager_name
    left join sponsorship_reward_events sre on sre.manager_name = t.manager_name
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
      'totalBudget', base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total,
      'legacySpentTotal', legacy_spent_total,
      'secureMarketTotal', secure_market_total,
      'secureSpentTotal', secure_spent_total,
      'secureDeltaTotal', secure_delta_total,
      'nonApprovedMarketTotal', non_approved_market_total,
      'spentTotal', spent_total,
      'remainingBudget', base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total,
      'transferModifier', transfer_modifier,
      'transferLimit', transfer_limit,
      'transfersToday', public.app_get_external_transfer_today_count(manager_name)
    )
  ), '{}'::jsonb)
  from reconciled;
$$;

grant execute on function public.app_get_budget_reconciliation() to anon, authenticated;

select
  public.app_get_budget_reconciliation() -> 'Rafael' ->> 'transferLimit' as rafael_transfer_limit,
  public.app_get_budget_reconciliation() -> 'Rafael' ->> 'transfersToday' as rafael_transfers_today;
