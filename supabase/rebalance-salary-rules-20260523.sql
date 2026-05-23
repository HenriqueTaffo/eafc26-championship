-- Salary rebalance - 23/05/2026.
--
-- Makes payroll meaningful in the economy. Salaries are weekly and scale by
-- transfer cost/value plus overall tier, with elite players carrying a premium.

begin;

update public.league_finance_rules
   set base_weekly_salary = 90000,
       market_value_salary_rate = 0.012,
       max_payroll_to_budget_ratio = 0.30,
       warning_payroll_to_budget_ratio = 0.24,
       minimum_runway_weeks = 4,
       updated_at = now()
 where id = 'default';

create or replace function public.app_estimate_weekly_salary(
  p_overall integer,
  p_market_value numeric,
  p_final_value numeric default null
)
returns numeric
language sql
stable
as $$
  with rules as (
    select *
    from public.league_finance_rules
    where id = 'default'
  ),
  base as (
    select
      coalesce(p_overall, 0) as overall,
      greatest(coalesce(p_final_value, p_market_value, 0), coalesce(p_market_value, 0), 0) as value,
      coalesce((select base_weekly_salary from rules), 90000) as floor_salary,
      coalesce((select market_value_salary_rate from rules), 0.012) as value_rate
  )
  select round(greatest(
    floor_salary,
    value * value_rate *
      case
        when overall >= 90 then 2.55
        when overall >= 88 then 2.25
        when overall >= 86 then 1.95
        when overall >= 84 then 1.70
        when overall >= 82 then 1.45
        when overall >= 80 then 1.25
        when overall >= 75 then 1.05
        else 0.90
      end
  ) / 10000) * 10000
  from base;
$$;

grant execute on function public.app_estimate_weekly_salary(integer, numeric, numeric)
  to anon, authenticated;

commit;
