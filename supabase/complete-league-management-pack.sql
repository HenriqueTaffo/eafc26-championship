-- v57 - Complete league management pack.
--
-- Apply after sponsorships.sql, security-hardening.sql and economy-sponsorship-rebalance.sql.
-- Adds persistent salary/economy rules, private favorites, notifications and
-- commissioner audit actions without changing existing results or transfers.

create table if not exists public.league_finance_rules (
  id text primary key default 'default',
  base_weekly_salary numeric not null default 45000,
  market_value_salary_rate numeric not null default 0.006,
  max_payroll_to_budget_ratio numeric not null default 0.22,
  warning_payroll_to_budget_ratio numeric not null default 0.18,
  minimum_runway_weeks integer not null default 3,
  updated_at timestamptz not null default now()
);

insert into public.league_finance_rules (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.manager_favorites (
  id uuid primary key default gen_random_uuid(),
  manager_id text not null,
  manager_name text not null,
  item_type text not null,
  item_key text not null,
  title text not null,
  detail text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists manager_favorites_unique
  on public.manager_favorites (manager_id, item_type, item_key);

create table if not exists public.manager_notifications (
  id uuid primary key default gen_random_uuid(),
  manager_id text not null,
  manager_name text not null,
  title text not null,
  body text not null default '',
  tone text not null default 'info',
  unique_key text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists manager_notifications_unique
  on public.manager_notifications (manager_id, unique_key);

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
      coalesce((select base_weekly_salary from rules), 45000) as floor_salary,
      coalesce((select market_value_salary_rate from rules), 0.006) as value_rate
  )
  select round(greatest(
    floor_salary,
    value * value_rate *
      case
        when overall >= 88 then 1.85
        when overall >= 84 then 1.45
        when overall >= 80 then 1.18
        when overall >= 75 then 1.00
        else 0.82
      end
  ) / 5000) * 5000
  from base;
$$;

create or replace function public.app_get_finance_rules()
returns jsonb
language sql
stable
as $$
  select to_jsonb(r)
  from public.league_finance_rules r
  where r.id = 'default';
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
    left join payroll p on lower(p.manager_name) = lower(m.manager_name)
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by payroll_weekly desc), '[]'::jsonb)
  from rows;
$$;

create or replace function public.app_validate_manager_session(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager record;
  v_login jsonb;
begin
  select id, display_name into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'managerId', v_manager.id,
    'managerName', coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    'clubName', coalesce(v_login #>> '{manager,club}', '')
  );
end;
$$;

create or replace function public.app_upsert_manager_favorite(
  p_manager_id text,
  p_access_code text,
  p_item_type text,
  p_item_key text,
  p_title text,
  p_detail text default '',
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
begin
  v_session := public.app_validate_manager_session(p_manager_id, p_access_code);
  if coalesce((v_session ->> 'ok')::boolean, false) is false then
    return v_session;
  end if;

  insert into public.manager_favorites (
    manager_id, manager_name, item_type, item_key, title, detail, payload
  ) values (
    p_manager_id,
    v_session ->> 'managerName',
    coalesce(nullif(trim(p_item_type), ''), 'item'),
    coalesce(nullif(trim(p_item_key), ''), lower(trim(p_title))),
    coalesce(nullif(trim(p_title), ''), 'Favorito'),
    coalesce(p_detail, ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (manager_id, item_type, item_key)
  do update set
    title = excluded.title,
    detail = excluded.detail,
    payload = excluded.payload,
    created_at = now();

  return public.app_get_manager_qol(p_manager_id, p_access_code);
end;
$$;

create or replace function public.app_delete_manager_favorite(
  p_manager_id text,
  p_access_code text,
  p_item_type text,
  p_item_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
begin
  v_session := public.app_validate_manager_session(p_manager_id, p_access_code);
  if coalesce((v_session ->> 'ok')::boolean, false) is false then
    return v_session;
  end if;

  delete from public.manager_favorites
  where manager_id = p_manager_id
    and item_type = p_item_type
    and item_key = p_item_key;

  return public.app_get_manager_qol(p_manager_id, p_access_code);
end;
$$;

create or replace function public.app_generate_manager_notifications(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
  v_forecast jsonb;
  v_row jsonb;
  v_targets_count integer := 0;
begin
  v_session := public.app_validate_manager_session(p_manager_id, p_access_code);
  if coalesce((v_session ->> 'ok')::boolean, false) is false then
    return v_session;
  end if;

  v_manager_name := v_session ->> 'managerName';
  v_forecast := public.app_get_manager_finance_forecast();

  select item into v_row
  from jsonb_array_elements(v_forecast) as item
  where lower(item ->> 'manager_name') = lower(v_manager_name)
  limit 1;

  if v_row is not null and coalesce(v_row ->> 'risk', '') <> 'Saudável' then
    insert into public.manager_notifications (manager_id, manager_name, title, body, tone, unique_key)
    values (
      p_manager_id,
      v_manager_name,
      'Atenção financeira',
      'Risco atual: ' || (v_row ->> 'risk') || '. Folha semanal: ' || coalesce(v_row ->> 'payroll_weekly', '0') || '.',
      case when v_row ->> 'risk' = 'Crítico' then 'critical' else 'warn' end,
      'finance-risk-' || current_date::text
    )
    on conflict (manager_id, unique_key) do nothing;
  end if;

  select count(*)::integer into v_targets_count
  from public.private_transfer_targets
  where manager_id = p_manager_id;

  if v_targets_count >= 3 then
    insert into public.manager_notifications (manager_id, manager_name, title, body, tone, unique_key)
    values (
      p_manager_id,
      v_manager_name,
      'Shortlist carregada',
      v_targets_count::text || ' alvo(s) privados no radar. Revise prioridade antes do deadline.',
      'info',
      'targets-' || current_date::text
    )
    on conflict (manager_id, unique_key) do nothing;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_mark_manager_notifications_read(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
begin
  v_session := public.app_validate_manager_session(p_manager_id, p_access_code);
  if coalesce((v_session ->> 'ok')::boolean, false) is false then
    return v_session;
  end if;

  update public.manager_notifications
     set is_read = true
   where manager_id = p_manager_id
     and is_read = false;

  return public.app_get_manager_qol(p_manager_id, p_access_code);
end;
$$;

create or replace function public.app_get_manager_qol(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_favorites jsonb;
  v_notifications jsonb;
  v_forecast jsonb;
  v_rules jsonb;
begin
  v_session := public.app_validate_manager_session(p_manager_id, p_access_code);
  if coalesce((v_session ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'favorites', '[]'::jsonb, 'notifications', '[]'::jsonb);
  end if;

  perform public.app_generate_manager_notifications(p_manager_id, p_access_code);

  select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc), '[]'::jsonb)
    into v_favorites
  from public.manager_favorites f
  where f.manager_id = p_manager_id;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.is_read asc, n.created_at desc), '[]'::jsonb)
    into v_notifications
  from (
    select *
    from public.manager_notifications
    where manager_id = p_manager_id
    order by is_read asc, created_at desc
    limit 12
  ) n;

  v_forecast := public.app_get_manager_finance_forecast();
  v_rules := public.app_get_finance_rules();

  return jsonb_build_object(
    'ok', true,
    'favorites', v_favorites,
    'notifications', v_notifications,
    'financeForecast', v_forecast,
    'financeRules', v_rules
  );
end;
$$;

create or replace function public.app_run_audit_action(
  p_manager_id text,
  p_access_code text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode executar auditoria.');
  end if;

  if p_action = 'process_sponsorships' then
    perform public.app_process_all_sponsorship_rewards();
    return jsonb_build_object('ok', true, 'message', 'Bônus de patrocínio reprocessados.');
  elsif p_action = 'refresh_finance' then
    return jsonb_build_object(
      'ok', true,
      'message', 'Previsão financeira atualizada.',
      'forecast', public.app_get_manager_finance_forecast()
    );
  elsif p_action = 'expire_completed_sponsorships' then
    update public.sponsorship_contracts
       set status = 'completed'
     where status = 'active'
       and claims_used >= max_claims;
    return jsonb_build_object('ok', true, 'message', 'Patrocínios completos encerrados.');
  end if;

  return jsonb_build_object('ok', false, 'message', 'Ação de auditoria desconhecida.');
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
begin
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
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);
  v_weekly_salary := public.app_estimate_weekly_salary(p_overall, p_market_value, v_final_value);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);

  select item into v_forecast_row
  from jsonb_array_elements(public.app_get_manager_finance_forecast()) as item
  where lower(item ->> 'manager_name') = lower(p_buyer)
  limit 1;

  v_current_payroll := coalesce((v_forecast_row ->> 'payroll_weekly')::numeric, 0);

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

grant execute on function public.app_estimate_weekly_salary(integer, numeric, numeric) to anon, authenticated;
grant execute on function public.app_get_finance_rules() to anon, authenticated;
grant execute on function public.app_get_manager_finance_forecast() to anon, authenticated;
grant execute on function public.app_get_manager_qol(text, text) to anon, authenticated;
grant execute on function public.app_upsert_manager_favorite(text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.app_delete_manager_favorite(text, text, text, text) to anon, authenticated;
grant execute on function public.app_mark_manager_notifications_read(text, text) to anon, authenticated;
grant execute on function public.app_run_audit_action(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric) to anon, authenticated;
