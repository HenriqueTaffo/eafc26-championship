-- v73 - Supabase resource optimizations - 24/05/2026
--
-- Reduces repeated resource usage from finance forecast and common dashboard
-- reads. Keep this separate from feature migrations so it can be applied and
-- verified independently.

begin;

create index if not exists transfers_status_type_buyer_idx
  on public.transfers (status, transfer_type, buyer_id, created_at desc);

create index if not exists transfers_player_status_created_idx
  on public.transfers ((lower(player_name)), status, created_at desc);

create index if not exists matches_status_created_idx
  on public.matches (status, created_at);

create index if not exists events_status_date_slot_created_idx
  on public.events (status, event_date, slot_hour, created_at);

create index if not exists sponsorship_contracts_manager_status_idx
  on public.sponsorship_contracts (manager_id, status, created_at desc);

create index if not exists sponsorship_rewards_contract_created_idx
  on public.sponsorship_rewards (contract_id, created_at desc);

create index if not exists sponsorship_rewards_manager_created_idx
  on public.sponsorship_rewards (manager_id, created_at desc);

create or replace function public.app_get_manager_finance_forecast()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with budgets as materialized (
    select public.app_get_budget_reconciliation()::jsonb as j
  ),
  rules as materialized (
    select *
    from public.league_finance_rules
    where id = 'default'
  ),
  managers(manager_name) as (
    values ('Henrique'), ('Willian'), ('Rafael'), ('Renato'), ('Bruno Silva')
  ),
  payroll as (
    select
      buyer.display_name as manager_name,
      count(*)::integer as player_count,
      coalesce(sum(
        round(
          greatest(
            coalesce(r.base_weekly_salary, 90000),
            greatest(
              coalesce(nullif(t.final_value, 0), nullif(t.negotiated_value, 0), t.market_value, 0),
              coalesce(t.market_value, 0),
              0
            )
            * coalesce(r.market_value_salary_rate, 0.012)
            * case
                when coalesce(t.overall, 0) >= 90 then 2.55
                when coalesce(t.overall, 0) >= 88 then 2.25
                when coalesce(t.overall, 0) >= 86 then 1.95
                when coalesce(t.overall, 0) >= 84 then 1.70
                when coalesce(t.overall, 0) >= 82 then 1.45
                when coalesce(t.overall, 0) >= 80 then 1.25
                when coalesce(t.overall, 0) >= 75 then 1.05
                else 0.90
              end
          ) / 10000
        ) * 10000
      ), 0) as payroll_weekly
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    cross join rules r
    where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
      and lower(coalesce(t.transfer_type, 'market')) not in ('internal', 'cpu_sale')
    group by buyer.display_name
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
        when coalesce((budgets.j -> m.manager_name ->> 'salaryDebtActive')::boolean, false) then 'Divida salarial'
        when coalesce((budgets.j -> m.manager_name ->> 'remainingBudget')::numeric, 0) < 0 then 'Divida salarial'
        when coalesce(p.payroll_weekly, 0) * 4 > coalesce((budgets.j -> m.manager_name ->> 'totalBudget')::numeric, 65000000) * coalesce((select max_payroll_to_budget_ratio from rules), 0.22) then 'Folha acima do teto'
        when coalesce(p.payroll_weekly, 0) * 4 > coalesce((budgets.j -> m.manager_name ->> 'totalBudget')::numeric, 65000000) * coalesce((select warning_payroll_to_budget_ratio from rules), 0.18) then 'Atencao'
        else 'Saudavel'
      end as risk
    from managers m
    cross join budgets
    left join payroll p on lower(p.manager_name) = lower(m.manager_name)
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by payroll_weekly desc), '[]'::jsonb)
  from rows;
$$;

grant execute on function public.app_get_manager_finance_forecast() to anon, authenticated;

notify pgrst, 'reload schema';

commit;
