begin;

alter table public.medical_plan_options
  add column if not exists diagnostics_pct numeric not null default 0,
  add column if not exists science_pct numeric not null default 0,
  add column if not exists relapse_modifier numeric not null default 0,
  add column if not exists staff_profile jsonb not null default '{}'::jsonb;

update public.medical_plan_options
set
  diagnostics_pct = case plan_key
    when 'base_dm' then 0.02
    when 'physio_plus' then 0.08
    when 'sports_science' then 0.16
    when 'elite_medical' then 0.24
    else diagnostics_pct
  end,
  science_pct = case plan_key
    when 'base_dm' then 0.01
    when 'physio_plus' then 0.05
    when 'sports_science' then 0.17
    when 'elite_medical' then 0.22
    else science_pct
  end,
  relapse_modifier = case plan_key
    when 'base_dm' then 0.03
    when 'physio_plus' then -0.04
    when 'sports_science' then -0.08
    when 'elite_medical' then -0.12
    else relapse_modifier
  end,
  staff_profile = case plan_key
    when 'base_dm' then jsonb_build_object(
      'fisioterapia', 1,
      'medicina_esportiva', 1,
      'ciencia_do_esporte', 0,
      'recuperacao', 1
    )
    when 'physio_plus' then jsonb_build_object(
      'fisioterapia', 3,
      'medicina_esportiva', 2,
      'ciencia_do_esporte', 1,
      'recuperacao', 2
    )
    when 'sports_science' then jsonb_build_object(
      'fisioterapia', 3,
      'medicina_esportiva', 3,
      'ciencia_do_esporte', 4,
      'recuperacao', 3
    )
    when 'elite_medical' then jsonb_build_object(
      'fisioterapia', 5,
      'medicina_esportiva', 5,
      'ciencia_do_esporte', 5,
      'recuperacao', 5
    )
    else staff_profile
  end,
  updated_at = now();

alter table public.events
  add column if not exists medical_case_type text,
  add column if not exists medical_case_severity text,
  add column if not exists medical_relapse_risk numeric,
  add column if not exists medical_clearance_status text,
  add column if not exists medical_minutes_cap integer,
  add column if not exists medical_workload_score integer,
  add column if not exists medical_next_review_at timestamptz;

create or replace function public.app_medical_case_type(
  p_title text default '',
  p_duration integer default 0,
  p_seed double precision default null
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_title text := public.normalize_key(coalesce(p_title, ''));
  v_seed double precision := coalesce(p_seed, random());
begin
  if v_title like '%joelho%' then
    return 'Joelho';
  elsif v_title like '%tornozelo%' then
    return 'Tornozelo';
  elsif v_title like '%doenca%' or v_title like '%virus%' then
    return 'Doença';
  elsif v_title like '%ombro%' then
    return 'Ombro';
  elsif v_title like '%fadiga%' or v_title like '%desgaste%' then
    return 'Fadiga';
  elsif v_title like '%muscul%' or v_title like '%treino%' then
    return 'Muscular';
  elsif coalesce(p_duration, 0) >= 11 then
    return 'Joelho';
  elsif coalesce(p_duration, 0) >= 7 then
    return 'Muscular';
  elsif v_seed < 0.22 then
    return 'Muscular';
  elsif v_seed < 0.4 then
    return 'Impacto';
  elsif v_seed < 0.58 then
    return 'Tornozelo';
  elsif v_seed < 0.76 then
    return 'Fadiga';
  elsif v_seed < 0.9 then
    return 'Joelho';
  end if;

  return 'Impacto';
end;
$$;

create or replace function public.app_medical_case_severity(
  p_duration integer default 0
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_duration, 0) >= 11 then 'grave'
    when coalesce(p_duration, 0) >= 6 then 'moderada'
    else 'leve'
  end;
$$;

create or replace function public.app_medical_clearance_status(
  p_duration integer default 0,
  p_event_status text default 'active'
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_event_status, '')) = 'recovered' then 'available'
    when coalesce(p_duration, 0) <= 1 then 'restricted_match'
    when coalesce(p_duration, 0) <= 3 then 'restricted_training'
    when coalesce(p_duration, 0) <= 6 then 'rehab'
    else 'out'
  end;
$$;

create or replace function public.app_medical_minutes_cap(
  p_clearance_status text default '',
  p_severity text default ''
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_clearance_status, '')) = 'available' then 90
    when lower(coalesce(p_clearance_status, '')) = 'restricted_match' and lower(coalesce(p_severity, '')) = 'grave' then 30
    when lower(coalesce(p_clearance_status, '')) = 'restricted_match' then 45
    when lower(coalesce(p_clearance_status, '')) = 'restricted_training' then 20
    else 0
  end;
$$;

create or replace function public.app_medical_relapse_risk(
  p_severity text default '',
  p_recovery_pct numeric default 0,
  p_relapse_modifier numeric default 0,
  p_duration integer default 0
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(
    0.08,
    least(
      0.92,
      (
        case lower(coalesce(p_severity, 'leve'))
          when 'grave' then 0.46
          when 'moderada' then 0.28
          else 0.16
        end
      )
      + greatest(coalesce(p_duration, 0) - 4, 0) * 0.01
      - coalesce(p_recovery_pct, 0) * 0.35
      + coalesce(p_relapse_modifier, 0)
    )
  );
$$;

create or replace function public.app_medical_workload_score(
  p_duration integer default 0,
  p_severity text default '',
  p_science_pct numeric default 0
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    18,
    least(
      96,
      round(
        34
        + coalesce(p_duration, 0) * 4
        + case lower(coalesce(p_severity, 'leve'))
            when 'grave' then 18
            when 'moderada' then 10
            else 0
          end
        - coalesce(p_science_pct, 0) * 60
      )::integer
    )
  );
$$;

create or replace function public.app_medical_enrich_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan public.medical_plan_options%rowtype;
  v_duration integer;
  v_severity text;
  v_clearance text;
begin
  if nullif(trim(coalesce(new.affected_player, '')), '') is null then
    return new;
  end if;

  select *
    into v_plan
  from public.medical_plan_options
  where plan_key = coalesce(new.medical_plan_key, 'base_dm')
  limit 1;

  v_duration := greatest(
    coalesce(new.duration_value, 0),
    coalesce(new.matches_remaining, 0),
    0
  );
  v_severity := public.app_medical_case_severity(v_duration);
  v_clearance := public.app_medical_clearance_status(v_duration, new.status);

  new.medical_case_type := coalesce(
    nullif(trim(coalesce(new.medical_case_type, '')), ''),
    public.app_medical_case_type(new.title, v_duration)
  );
  new.medical_case_severity := coalesce(
    nullif(trim(coalesce(new.medical_case_severity, '')), ''),
    v_severity
  );
  new.medical_clearance_status := coalesce(
    nullif(trim(coalesce(new.medical_clearance_status, '')), ''),
    v_clearance
  );
  new.medical_minutes_cap := coalesce(
    new.medical_minutes_cap,
    public.app_medical_minutes_cap(
      coalesce(new.medical_clearance_status, v_clearance),
      coalesce(new.medical_case_severity, v_severity)
    )
  );
  new.medical_relapse_risk := coalesce(
    new.medical_relapse_risk,
    public.app_medical_relapse_risk(
      coalesce(new.medical_case_severity, v_severity),
      coalesce(new.medical_recovery_pct, 0),
      coalesce(v_plan.relapse_modifier, 0),
      v_duration
    )
  );
  new.medical_workload_score := coalesce(
    new.medical_workload_score,
    public.app_medical_workload_score(
      v_duration,
      coalesce(new.medical_case_severity, v_severity),
      coalesce(v_plan.science_pct, 0)
    )
  );
  new.medical_next_review_at := coalesce(
    new.medical_next_review_at,
    case
      when new.expires_at is not null then greatest(
        now() + interval '18 hours',
        new.expires_at - interval '2 days'
      )
      else now() + interval '1 day'
    end
  );

  if lower(coalesce(new.status, '')) = 'recovered' then
    new.medical_clearance_status := 'available';
    new.medical_minutes_cap := 90;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_app_medical_enrich_event on public.events;

create trigger trg_app_medical_enrich_event
before insert or update on public.events
for each row
execute function public.app_medical_enrich_event();

update public.events e
set
  medical_case_type = coalesce(e.medical_case_type, public.app_medical_case_type(e.title, greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0)), random())),
  medical_case_severity = coalesce(e.medical_case_severity, public.app_medical_case_severity(greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0)))),
  medical_relapse_risk = coalesce(
    e.medical_relapse_risk,
    public.app_medical_relapse_risk(
      coalesce(e.medical_case_severity, public.app_medical_case_severity(greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0)))),
      coalesce(e.medical_recovery_pct, 0),
      coalesce(mpo.relapse_modifier, 0),
      greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0))
    )
  ),
  medical_clearance_status = coalesce(
    e.medical_clearance_status,
    public.app_medical_clearance_status(
      greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0)),
      e.status
    )
  ),
  medical_minutes_cap = coalesce(
    e.medical_minutes_cap,
    public.app_medical_minutes_cap(
      coalesce(e.medical_clearance_status, public.app_medical_clearance_status(greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0)), e.status)),
      coalesce(e.medical_case_severity, public.app_medical_case_severity(greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0))))
    )
  ),
  medical_workload_score = coalesce(
    e.medical_workload_score,
    public.app_medical_workload_score(
      greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0)),
      coalesce(e.medical_case_severity, public.app_medical_case_severity(greatest(coalesce(e.duration_value, 0), coalesce(e.matches_remaining, 0)))),
      coalesce(mpo.science_pct, 0)
    )
  ),
  medical_next_review_at = coalesce(
    e.medical_next_review_at,
    case
      when e.expires_at is not null then greatest(
        now() + interval '18 hours',
        e.expires_at - interval '2 days'
      )
      else now() + interval '1 day'
    end
  )
from public.medical_plan_options mpo
where mpo.plan_key = coalesce(e.medical_plan_key, 'base_dm')
  and nullif(trim(coalesce(e.affected_player, '')), '') is not null;

create or replace function public.app_get_medical_center_data(
  p_manager_id text default '',
  p_access_code text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean := false;
  v_options jsonb;
  v_plans jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'planKey', plan_key,
      'name', display_name,
      'description', description,
      'weeklyCost', weekly_cost,
      'setupCost', setup_cost,
      'preventionPct', prevention_pct,
      'recoveryPct', recovery_pct,
      'diagnosticsPct', diagnostics_pct,
      'sciencePct', science_pct,
      'relapseModifier', relapse_modifier,
      'treatmentDaysBonus', treatment_days_bonus,
      'staffProfile', staff_profile,
      'isActive', is_active
    )
    order by weekly_cost
  ), '[]'::jsonb)
    into v_options
  from public.medical_plan_options
  where is_active is true;

  if coalesce(trim(p_manager_id), '') = '' then
    return jsonb_build_object('ok', true, 'options', v_options, 'plans', '{}'::jsonb);
  end if;

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);

  select coalesce(jsonb_object_agg(
    m.display_name,
    jsonb_build_object(
      'managerId', m.id,
      'managerName', m.display_name,
      'clubName', coalesce(c.name, ''),
      'planKey', coalesce(mmp.plan_key, 'base_dm'),
      'name', coalesce(mpo.display_name, base_plan.display_name),
      'description', coalesce(mpo.description, base_plan.description),
      'weeklyCost', coalesce(mpo.weekly_cost, base_plan.weekly_cost),
      'setupCost', coalesce(mpo.setup_cost, base_plan.setup_cost),
      'preventionPct', coalesce(mpo.prevention_pct, base_plan.prevention_pct),
      'recoveryPct', coalesce(mpo.recovery_pct, base_plan.recovery_pct),
      'diagnosticsPct', coalesce(mpo.diagnostics_pct, base_plan.diagnostics_pct),
      'sciencePct', coalesce(mpo.science_pct, base_plan.science_pct),
      'relapseModifier', coalesce(mpo.relapse_modifier, base_plan.relapse_modifier),
      'treatmentDaysBonus', coalesce(mpo.treatment_days_bonus, base_plan.treatment_days_bonus),
      'staffProfile', coalesce(mpo.staff_profile, base_plan.staff_profile),
      'selectedAt', mmp.selected_at
    )
  ), '{}'::jsonb)
    into v_plans
  from public.managers m
  left join public.clubs c on c.owner_id = m.id
  left join public.manager_medical_plans mmp on mmp.manager_id = m.id
  left join public.medical_plan_options mpo on mpo.plan_key = mmp.plan_key
  cross join lateral (
    select *
    from public.medical_plan_options
    where plan_key = 'base_dm'
    limit 1
  ) base_plan
  where v_is_commissioner is true
     or m.id = p_manager_id;

  return jsonb_build_object(
    'ok', true,
    'options', v_options,
    'plans', v_plans
  );
end;
$$;

create or replace function public.app_apply_medical_action(
  p_manager_id text,
  p_access_code text,
  p_event_id bigint default 0,
  p_event_key text default '',
  p_event_owner text default '',
  p_player_name text default '',
  p_action_type text default 'intensive'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_event public.events%rowtype;
  v_plan public.medical_plan_options%rowtype;
  v_is_commissioner boolean := false;
  v_action text := lower(coalesce(p_action_type, 'intensive'));
  v_current_expires timestamptz;
  v_current_days integer;
  v_reduce_days integer;
  v_new_days integer;
  v_cost numeric := 0;
  v_minutes_cap integer := 0;
  v_clearance_status text := '';
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);

  select *
    into v_event
  from public.events
  where (
      (coalesce(p_event_id, 0) > 0 and id = p_event_id)
      or (coalesce(trim(p_event_key), '') <> '' and unique_key = p_event_key)
      or (
        coalesce(trim(p_event_owner), '') <> ''
        and coalesce(trim(p_player_name), '') <> ''
        and lower(manager_id) in (
          select lower(id)
          from public.managers
          where lower(display_name) = lower(trim(p_event_owner))
        )
        and lower(affected_player) = lower(trim(p_player_name))
      )
    )
    and nullif(trim(coalesce(affected_player, '')), '') is not null
    and status in ('active', 'applied', 'generated')
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Lesão/evento médico não encontrado.');
  end if;

  if v_event.expires_at is not null and v_event.expires_at < now() then
    update public.events
       set status = 'recovered',
           updated_at = now()
     where id = v_event.id;
    return jsonb_build_object('ok', false, 'message', 'Jogador já está recuperado pelo calendário.');
  end if;

  if v_is_commissioner is false and v_event.manager_id <> p_manager_id then
    return jsonb_build_object('ok', false, 'message', 'Você só pode tratar lesões do seu clube.');
  end if;

  select *
    into v_plan
  from public.medical_plan_options mpo
  where mpo.plan_key = coalesce(
    (
      select mmp.plan_key
      from public.manager_medical_plans mmp
      where mmp.manager_id = v_event.manager_id
    ),
    'base_dm'
  )
  limit 1;

  if not found then
    select *
      into v_plan
    from public.medical_plan_options
    where plan_key = 'base_dm'
    limit 1;
  end if;

  v_current_expires := coalesce(
    v_event.expires_at,
    now() + make_interval(days => greatest(coalesce(v_event.duration_value, 7), 1))
  );
  v_current_days := greatest(
    1,
    ceil(extract(epoch from (v_current_expires - now())) / 86400.0)::integer
  );

  if v_action = 'force_return' then
    if v_is_commissioner is false then
      return jsonb_build_object('ok', false, 'message', 'Apenas o comissário pode forçar retorno imediato.');
    end if;

    update public.events
       set status = 'recovered',
           matches_remaining = 0,
           expires_at = coalesce(expires_at, now()),
           medical_clearance_status = 'available',
           medical_minutes_cap = 45,
           medical_relapse_risk = least(0.95, coalesce(medical_relapse_risk, 0.22) + 0.18),
           medical_next_review_at = now() + interval '12 hours',
           updated_at = now()
     where id = v_event.id;

    perform public.app_governance_insert_event(
      v_event.manager_id,
      'Retorno forçado: ' || v_event.affected_player,
      'O departamento médico liberou o jogador antes do prazo por decisão administrativa.',
      'Jogador liberado imediatamente, com restrição de minutos e risco de recaída elevado.',
      'Departamento medico',
      0
    );

    insert into public.governance_medical_actions (
      manager_id,
      manager_name,
      event_id,
      event_key,
      player_name,
      action_type,
      cost
    ) values (
      v_event.manager_id,
      coalesce(v_login ->> 'managerName', p_manager_id),
      v_event.id,
      v_event.unique_key,
      v_event.affected_player,
      v_action,
      0
    );

    return jsonb_build_object('ok', true, 'message', 'Retorno forçado aplicado com controle de minutos.');
  end if;

  if v_action = 'managed_return' then
    if v_current_days > 4 then
      return jsonb_build_object('ok', false, 'message', 'Ainda é cedo para retorno controlado. Espere o caso entrar na reta final.');
    end if;

    v_minutes_cap := case
      when v_current_days <= 1 then 60
      else 30
    end;
    v_clearance_status := case
      when v_current_days <= 1 then 'restricted_match'
      else 'restricted_training'
    end;
    v_cost := greatest(
      25000,
      ceil((coalesce(v_plan.weekly_cost, 0) * 0.3 + 18000) / 1000.0) * 1000
    );

    update public.events
       set duration_type = 'Dia',
           duration_value = greatest(1, v_current_days),
           matches_remaining = null,
           expires_at = coalesce(expires_at, now() + make_interval(days => greatest(1, v_current_days))),
           medical_clearance_status = v_clearance_status,
           medical_minutes_cap = v_minutes_cap,
           medical_relapse_risk = least(0.9, greatest(0.12, coalesce(medical_relapse_risk, 0.22) + 0.06)),
           medical_next_review_at = now() + interval '18 hours',
           updated_at = now()
     where id = v_event.id;

    perform public.app_governance_insert_event(
      v_event.manager_id,
      'Retorno controlado: ' || v_event.affected_player,
      'O técnico liberou o atleta para retorno progressivo com supervisão do staff.',
      'Jogador segue em monitoramento. Minutagem recomendada: ' || v_minutes_cap || ' minuto(s).',
      'Departamento medico',
      -v_cost
    );

    insert into public.governance_medical_actions (
      manager_id,
      manager_name,
      event_id,
      event_key,
      player_name,
      action_type,
      cost
    ) values (
      v_event.manager_id,
      coalesce(v_login ->> 'managerName', p_manager_id),
      v_event.id,
      v_event.unique_key,
      v_event.affected_player,
      v_action,
      v_cost
    );

    return jsonb_build_object(
      'ok', true,
      'message', 'Retorno controlado liberado. O atleta voltou com restrição de minutos.',
      'minutesCap', v_minutes_cap,
      'cost', v_cost
    );
  end if;

  v_reduce_days := greatest(1, coalesce(v_plan.treatment_days_bonus, 1));
  v_new_days := greatest(1, v_current_days - v_reduce_days);
  v_cost := greatest(
    75000,
    ceil((80000 + coalesce(v_plan.weekly_cost, 0) * 1.4) / 1000.0) * 1000
  );
  v_clearance_status := public.app_medical_clearance_status(v_new_days, v_event.status);
  v_minutes_cap := public.app_medical_minutes_cap(
    v_clearance_status,
    coalesce(v_event.medical_case_severity, public.app_medical_case_severity(v_new_days))
  );

  update public.events
     set duration_type = 'Dia',
         duration_value = v_new_days,
         matches_remaining = null,
         expires_at = now() + make_interval(days => v_new_days),
         medical_clearance_status = v_clearance_status,
         medical_minutes_cap = v_minutes_cap,
         medical_relapse_risk = greatest(
           0.08,
           least(0.88, coalesce(medical_relapse_risk, 0.24) - 0.05)
         ),
         medical_next_review_at = now() + interval '1 day',
         updated_at = now()
   where id = v_event.id;

  perform public.app_governance_insert_event(
    v_event.manager_id,
    'Tratamento intensivo: ' || v_event.affected_player,
    'O técnico investiu em atendimento adicional para acelerar a recuperação.',
    'Previsão reduzida em ' || v_reduce_days || ' dia(s). Novo prazo: ' || v_new_days || ' dia(s) corrido(s).',
    'Departamento medico',
    -v_cost
  );

  insert into public.governance_medical_actions (
    manager_id,
    manager_name,
    event_id,
    event_key,
    player_name,
    action_type,
    cost
  ) values (
    v_event.manager_id,
    coalesce(v_login ->> 'managerName', p_manager_id),
    v_event.id,
    v_event.unique_key,
    v_event.affected_player,
    'intensive',
    v_cost
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Tratamento aplicado. Prazo atual: ' || v_new_days || ' dia(s).',
    'daysRemaining', v_new_days,
    'minutesCap', v_minutes_cap,
    'cost', v_cost
  );
end;
$$;

create or replace function public.app_get_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'ok', true,

    'budget', public.get_config_numeric('transfer_budget', 65000000),
    'homeMatchBonus', public.get_config_numeric('home_match_bonus', 1250000),
    'winBonus', public.get_config_numeric('win_bonus', 500000),
    'dailyTransferLimit', public.get_config_int('daily_transfer_limit', 3),
    'eventSlots', coalesce(
      (select value from public.league_config where key = 'event_slots'),
      '[5, 8, 11, 14, 17, 20, 23]'::jsonb
    ),

    'clubs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'Time', c.name,
          'Dono', coalesce(m.display_name, 'CPU'),
          'LogoUrl', coalesce(c.logo_url, ''),
          'ApiId', c.id,
          'NomeApi', c.name,
          'CorPrimaria', c.primary_color,
          'CorSecundaria', c.secondary_color,
          'Forca', c.strength,
          'Status', 'OK',
          'Motivo', 'Supabase'
        )
        order by c.id
      )
      from public.clubs c
      left join public.managers m on m.id = c.owner_id
    ), '[]'::jsonb),

    'budgets', coalesce((
      select jsonb_object_agg(
        b.manager_name,
        jsonb_build_object(
          'buyer', b.manager_name,
          'baseBudget', b.base_budget,
          'homeMatches', b.home_matches,
          'wins', b.wins,
          'homeBonus', b.home_bonus,
          'winBonus', b.win_bonus,
          'winBonusValue', b.win_bonus,
          'eventBonus', b.event_bonus,
          'eventTotal', b.event_bonus,
          'totalBudget', b.total_budget,
          'spentTotal', b.spent_total,
          'remainingBudget', b.remaining_budget,
          'eventCount', b.event_count,
          'activeInjuries', b.active_injuries,
          'transferModifier', b.transfer_modifier,
          'transferLimit', b.transfer_limit_today,
          'transfersToday', b.transfers_today
        )
      )
      from public.v_manager_budgets b
    ), '{}'::jsonb),

    'results', coalesce((
      select jsonb_agg(row_data order by created_at)
      from (
        select
          ma.created_at,
          jsonb_build_object(
            'Timestamp', ma.created_at,
            'Competicao', ma.competition,
            'Semana', ma.week,
            'RodadaFase', ma.phase,
            'Mandante', home.name,
            'Visitante', away.name,
            'GolsMandante', ma.home_score,
            'GolsVisitante', ma.away_score,
            'GolsDetalhes', coalesce(ma.goals_details, ''),
            'AssistenciasDetalhes', coalesce(ma.assists_details, ''),
            'VencedorPenaltis', coalesce(pen.name, ''),
            'PlacarPenaltis', coalesce(ma.penalty_score, ''),
            'EnviadoPor', coalesce(m.display_name, ''),
            'ChaveUnica', coalesce(ma.unique_key, ''),
            'Status', public.pt_status(ma.status),
            'Motivo', coalesce(ma.reason, 'OK')
          ) as row_data
        from public.matches ma
        join public.clubs home on home.id = ma.home_club_id
        join public.clubs away on away.id = ma.away_club_id
        left join public.clubs pen on pen.id = ma.penalty_winner_club_id
        left join public.managers m on m.id = ma.submitted_by
        where ma.status <> 'cancelled'
      ) q
    ), '[]'::jsonb),

    'transfers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'Id', t.id,
          'Timestamp', t.created_at,
          'Comprador', case
            when t.transfer_type = 'cpu_sale' then coalesce(nullif(t.destination_club, ''), 'Clube interessado')
            else buyer.display_name
          end,
          'CompradorRegistro', buyer.display_name,
          'Jogador', t.player_name,
          'ClubeOrigem', t.from_club,
          'ClubeDestino', coalesce(t.destination_club, ''),
          'Destino', coalesce(t.destination_club, ''),
          'destination_club', coalesce(t.destination_club, ''),
          'Overall', t.overall,
          'ValorTransfermarkt', t.market_value,
          'PercentualOverall', t.overall_rate,
          'ValorFinal', t.final_value,
          'SalarioSemanal', coalesce(t.weekly_salary_eur, 0),
          'salaryWeekly', coalesce(t.weekly_salary_eur, 0),
          'weeklySalary', coalesce(t.weekly_salary_eur, 0),
          'FonteSalario', coalesce(t.salary_source_name, ''),
          'salarySourceName', coalesce(t.salary_source_name, ''),
          'UrlFonteSalario', coalesce(t.salary_source_url, ''),
          'salarySourceUrl', coalesce(t.salary_source_url, ''),
          'SalarioConferidoEm', t.salary_checked_at,
          'TipoTransferencia', t.transfer_type,
          'Vendedor', seller.display_name,
          'ValorNegociado', t.negotiated_value,
          'RevertidaEm', t.reversed_at,
          'RevertidaPor', t.reversed_by,
          'Status', public.pt_status(t.status),
          'Motivo', coalesce(t.reason, 'OK')
        )
        order by t.created_at
      )
      from public.transfers t
      join public.managers buyer on buyer.id = t.buyer_id
      left join public.managers seller on seller.id = t.seller_id
      where t.status <> 'cancelled'
    ), '[]'::jsonb),

    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'Id', e.id,
          'id', e.id,
          'Timestamp', e.created_at,
          'Data', to_char(e.event_date, 'DD/MM/YYYY'),
          'Horario', case when e.slot_hour is null then '' else lpad(e.slot_hour::text, 2, '0') || ':00' end,
          'Jogador', m.display_name,
          'Time', coalesce(c.name, ''),
          'Tipo', e.type,
          'Titulo', e.title,
          'Descricao', coalesce(e.description, ''),
          'Efeito', coalesce(e.effect, ''),
          'ImpactoFinanceiro', e.financial_impact,
          'Status', public.pt_status(e.status),
          'ChaveUnica', coalesce(e.unique_key, ''),
          'ModificadorTransferencias', e.transfer_modifier,
          'JogadorAfetado', coalesce(e.affected_player, ''),
          'DuracaoTipo', coalesce(e.duration_type, ''),
          'DuracaoValor', e.duration_value,
          'PartidasRestantes', e.matches_remaining,
          'ExpiraEm', e.expires_at,
          'TipoLesao', coalesce(e.medical_case_type, ''),
          'medicalCaseType', coalesce(e.medical_case_type, ''),
          'GravidadeLesao', coalesce(e.medical_case_severity, ''),
          'medicalCaseSeverity', coalesce(e.medical_case_severity, ''),
          'RiscoRecaida', coalesce(e.medical_relapse_risk, 0),
          'medicalRelapseRisk', coalesce(e.medical_relapse_risk, 0),
          'StatusClinico', coalesce(e.medical_clearance_status, ''),
          'medicalClearanceStatus', coalesce(e.medical_clearance_status, ''),
          'MinutosControlados', e.medical_minutes_cap,
          'medicalMinutesCap', e.medical_minutes_cap,
          'CargaMedica', e.medical_workload_score,
          'medicalWorkloadScore', e.medical_workload_score,
          'ProximaRevisaoMedica', e.medical_next_review_at,
          'medicalNextReviewAt', e.medical_next_review_at
        )
        order by e.event_date, e.slot_hour, e.created_at
      )
      from public.events e
      join public.managers m on m.id = e.manager_id
      left join public.clubs c on c.id = e.club_id
      where e.status <> 'cancelled'
    ), '[]'::jsonb)
  )
  into payload;

  return payload;
end;
$$;

commit;
