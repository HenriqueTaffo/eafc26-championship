-- Corrige app_get_manager_finance_forecast.
-- O CTE budgets existia, mas nao entrava no FROM da query rows.

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
      and lower(coalesce("TipoTransferencia", 'market')) <> 'internal'
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
      coalesce(p.player_count, 0) as player_count,
      coalesce(p.payroll_weekly, 0) as payroll_weekly,
      coalesce(p.payroll_weekly, 0) * 4 as payroll_monthly,
      case
        when coalesce(p.payroll_weekly, 0) <= 0 then null
        else floor(greatest(coalesce((budgets.j -> m.manager_name ->> 'remainingBudget')::numeric, 0), 0) / coalesce(p.payroll_weekly, 1))::integer
      end as runway_weeks,
      case
        when coalesce((budgets.j -> m.manager_name ->> 'remainingBudget')::numeric, 0) < 0 then 'Crítico'
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

grant execute on function public.app_get_manager_finance_forecast() to anon, authenticated;

select public.app_get_manager_finance_forecast();
