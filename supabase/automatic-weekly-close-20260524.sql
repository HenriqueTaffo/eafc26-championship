-- Fechamento semanal automatico.
-- Agenda a cobranca da folha para domingo, 23:00 no horario de Brasilia
-- (segunda, 02:00 UTC no pg_cron) e mantem o fechamento manual idempotente.

create extension if not exists pg_cron;

create table if not exists public.league_weekly_closures (
  period_key text primary key,
  source text not null default 'manual',
  status text not null default 'completed',
  closed_at timestamptz not null default now(),
  review_summary jsonb not null default '{}'::jsonb,
  payroll_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint league_weekly_closures_status_check
    check (status in ('running', 'completed', 'failed'))
);

alter table public.governance_weekly_reviews
  add column if not exists period_key text,
  add column if not exists source text not null default 'manual';

update public.governance_weekly_reviews
   set period_key = to_char(review_date, 'IYYY-IW')
 where period_key is null;

create unique index if not exists governance_weekly_reviews_manager_period_unique
  on public.governance_weekly_reviews (manager_id, period_key);

create or replace function public.app_get_weekly_close_period_key()
returns text
language sql
stable
as $$
  select to_char((now() at time zone 'America/Sao_Paulo')::date, 'IYYY-IW');
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
  v_period_key text := public.app_get_weekly_close_period_key();
  v_manager_id text;
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
    v_manager_id := coalesce(
      nullif(v_item ->> 'managerId', ''),
      lower(regexp_replace(coalesce(v_item ->> 'owner', ''), '\s+', '-', 'g'))
    );
    v_met := coalesce((v_item ->> 'ok')::integer, 0);
    v_total := greatest(coalesce((v_item ->> 'total')::integer, 4), 1);
    v_verdict := coalesce(v_item ->> 'verdict', 'Neutro');
    v_impact := case
      when v_met >= 3 then 750000
      when v_met <= 1 then -500000
      else 0
    end;

    insert into public.governance_weekly_reviews (
      review_date,
      manager_id,
      manager_name,
      club_name,
      objectives_met,
      objectives_total,
      verdict,
      suggested_impact,
      period_key,
      source
    ) values (
      current_date,
      v_manager_id,
      coalesce(v_item ->> 'owner', 'Tecnico'),
      coalesce(v_item ->> 'team', ''),
      v_met,
      v_total,
      v_verdict,
      v_impact,
      v_period_key,
      'manual'
    )
    on conflict (manager_id, period_key)
    do update set
      review_date = excluded.review_date,
      manager_name = excluded.manager_name,
      club_name = excluded.club_name,
      objectives_met = excluded.objectives_met,
      objectives_total = excluded.objectives_total,
      verdict = excluded.verdict,
      suggested_impact = excluded.suggested_impact,
      source = 'manual',
      created_at = now();

    v_inserted := v_inserted + 1;

    if v_impact <> 0 then
      perform public.app_insert_salary_event(
        v_manager_id,
        'Diretoria',
        case when v_impact > 0 then 'Diretoria aprovou a semana' else 'Diretoria cobrou resultado' end,
        coalesce(v_item ->> 'owner', 'Tecnico') || ' fechou a semana com ' || v_met || '/' || v_total || ' objetivos.',
        case when v_impact > 0 then 'Bonus semanal creditado.' else 'Multa semanal aplicada.' end,
        v_impact,
        'weekly-board-' || v_period_key || '-' || v_manager_id
      );
    end if;
  end loop;

  v_payroll := public.app_apply_weekly_payroll();

  insert into public.league_weekly_closures (
    period_key,
    source,
    status,
    closed_at,
    review_summary,
    payroll_summary,
    updated_at
  ) values (
    v_period_key,
    'manual',
    'completed',
    now(),
    jsonb_build_object('inserted', v_inserted),
    coalesce(v_payroll, '{}'::jsonb),
    now()
  )
  on conflict (period_key)
  do update set
    source = 'manual',
    status = 'completed',
    closed_at = now(),
    review_summary = excluded.review_summary,
    payroll_summary = excluded.payroll_summary,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'message', 'Fechamento semanal e folha registrados.',
    'periodKey', v_period_key,
    'inserted', v_inserted,
    'payroll', v_payroll
  );
end;
$$;

create or replace function public.app_close_weekly_review_auto()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_key text := public.app_get_weekly_close_period_key();
  v_existing public.league_weekly_closures%rowtype;
  v_manager record;
  v_rows integer := 0;
  v_payroll jsonb;
begin
  select *
    into v_existing
  from public.league_weekly_closures
  where period_key = v_period_key
    and status = 'completed';

  if found then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'message', 'Semana ja processada.',
      'periodKey', v_period_key,
      'payroll', v_existing.payroll_summary
    );
  end if;

  insert into public.league_weekly_closures (
    period_key,
    source,
    status,
    closed_at,
    review_summary,
    payroll_summary,
    updated_at
  ) values (
    v_period_key,
    'automatic',
    'running',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now()
  )
  on conflict (period_key)
  do update set
    source = 'automatic',
    status = 'running',
    updated_at = now();

  for v_manager in
    select
      m.id as manager_id,
      m.display_name as manager_name,
      coalesce(c.name, '') as club_name
    from public.managers m
    left join public.clubs c on c.owner_id = m.id
    order by m.display_name
  loop
    insert into public.governance_weekly_reviews (
      review_date,
      manager_id,
      manager_name,
      club_name,
      objectives_met,
      objectives_total,
      verdict,
      suggested_impact,
      period_key,
      source
    ) values (
      current_date,
      v_manager.manager_id,
      v_manager.manager_name,
      v_manager.club_name,
      0,
      0,
      'Fechamento automatico',
      0,
      v_period_key,
      'automatic'
    )
    on conflict (manager_id, period_key) do nothing;

    get diagnostics v_rows = row_count;
  end loop;

  select count(*)::integer
    into v_rows
  from public.governance_weekly_reviews
  where period_key = v_period_key;

  v_payroll := public.app_apply_weekly_payroll();

  update public.league_weekly_closures
     set status = 'completed',
         closed_at = now(),
         review_summary = jsonb_build_object('inserted', v_rows, 'mode', 'automatic'),
         payroll_summary = coalesce(v_payroll, '{}'::jsonb),
         updated_at = now()
   where period_key = v_period_key;

  return jsonb_build_object(
    'ok', true,
    'message', 'Fechamento automatico semanal registrado.',
    'periodKey', v_period_key,
    'inserted', v_rows,
    'payroll', v_payroll
  );
exception
  when others then
    update public.league_weekly_closures
       set status = 'failed',
           review_summary = jsonb_build_object('error', sqlerrm),
           updated_at = now()
     where period_key = v_period_key;
    raise;
end;
$$;

create or replace function public.app_get_weekly_close_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_period_key text := public.app_get_weekly_close_period_key();
  v_job jsonb := null;
  v_last jsonb := null;
begin
  select to_jsonb(j)
    into v_job
  from cron.job j
  where j.jobname = 'eafc26-weekly-close'
  limit 1;

  select to_jsonb(c)
    into v_last
  from public.league_weekly_closures c
  order by c.closed_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'automatic', coalesce((v_job ->> 'active')::boolean, false),
    'periodKey', v_period_key,
    'schedule', coalesce(v_job ->> 'schedule', ''),
    'scheduledLabel', 'Domingo, 23:00 (BRT)',
    'timezone', 'America/Sao_Paulo',
    'lastClosure', coalesce(v_last, '{}'::jsonb)
  );
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'eafc26-weekly-close'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'eafc26-weekly-close',
    '0 2 * * 1',
    'select public.app_close_weekly_review_auto();'
  );
end;
$$;

grant execute on function public.app_get_weekly_close_period_key() to anon, authenticated;
grant execute on function public.app_get_weekly_close_status() to anon, authenticated;
grant execute on function public.app_close_weekly_review(text, text, text) to anon, authenticated;
revoke execute on function public.app_close_weekly_review_auto() from public, anon, authenticated;
