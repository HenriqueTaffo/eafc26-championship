begin;

create table if not exists public.medical_plan_options (
  plan_key text primary key,
  display_name text not null,
  description text not null,
  weekly_cost numeric not null default 0,
  setup_cost numeric not null default 0,
  prevention_pct numeric not null default 0,
  recovery_pct numeric not null default 0,
  treatment_days_bonus integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.medical_plan_options (
  plan_key,
  display_name,
  description,
  weekly_cost,
  setup_cost,
  prevention_pct,
  recovery_pct,
  treatment_days_bonus,
  is_active,
  updated_at
) values
  (
    'base_dm',
    'DM base',
    'Departamento medico padrao do clube. Sem custo extra, mas com recuperacao e prevencao basicas.',
    0,
    0,
    0,
    0,
    1,
    true,
    now()
  ),
  (
    'physio_plus',
    'Fisioterapia reforcada',
    'Contrata fisioterapeutas adicionais para reduzir reincidencia e acelerar lesoes leves.',
    45000,
    120000,
    0.08,
    0.10,
    3,
    true,
    now()
  ),
  (
    'sports_science',
    'Ciencia esportiva',
    'Equipe de performance, carga de treino e recuperacao com monitoramento semanal.',
    95000,
    260000,
    0.15,
    0.18,
    5,
    true,
    now()
  ),
  (
    'elite_medical',
    'Centro medico elite',
    'Medicos especialistas, fisiologia e recuperacao acelerada para proteger titulares.',
    170000,
    480000,
    0.23,
    0.28,
    7,
    true,
    now()
  )
on conflict (plan_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  weekly_cost = excluded.weekly_cost,
  setup_cost = excluded.setup_cost,
  prevention_pct = excluded.prevention_pct,
  recovery_pct = excluded.recovery_pct,
  treatment_days_bonus = excluded.treatment_days_bonus,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.manager_medical_plans (
  manager_id text primary key references public.managers(id) on delete cascade,
  plan_key text not null references public.medical_plan_options(plan_key),
  selected_by text,
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.governance_medical_actions (
  id bigserial primary key,
  manager_id text not null,
  manager_name text not null,
  event_id bigint,
  event_key text,
  player_name text not null,
  action_type text not null,
  cost numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists medical_plan_key text,
  add column if not exists medical_base_duration_days integer,
  add column if not exists medical_recovery_pct numeric;

create or replace function public.app_governance_insert_event(
  p_manager_id text,
  p_title text,
  p_description text,
  p_effect text,
  p_type text,
  p_impact numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
    (now() at time zone 'America/Sao_Paulo')::date,
    null,
    p_manager_id,
    null,
    p_type,
    p_title,
    p_description,
    p_effect,
    coalesce(p_impact, 0),
    0,
    null,
    null,
    null,
    null,
    null,
    'applied',
    'governance|' || coalesce(p_manager_id, 'manager') || '|' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '|' || substr(md5(coalesce(p_title, '') || random()::text), 1, 10),
    now(),
    now()
  );
end;
$$;

update public.event_catalog
   set is_active = false,
       updated_at = now()
 where is_injury is true
   and public.normalize_key(title) in (
     public.normalize_key('DM pediu um minuto'),
     public.normalize_key('Treino cobrou a conta')
   );

insert into public.event_catalog (
  type,
  title,
  description,
  effect,
  financial_impact,
  transfer_modifier,
  duration_type,
  duration_value,
  is_injury,
  weight,
  is_active,
  updated_at
)
select *
from (
  values
    (
      'Departamento medico',
      'Desconforto muscular',
      'O jogador sentiu desconforto no treino e o DM recomendou preservacao.',
      'Fora por alguns dias corridos. Estrutura medica reduz o prazo final.',
      0::numeric,
      0::integer,
      'Dia',
      7::integer,
      true,
      5::integer,
      true,
      now()
    ),
    (
      'Departamento medico',
      'Entorse leve',
      'Torcedura leve detectada apos atividade de campo. O retorno depende da resposta ao tratamento.',
      'Fora por periodo curto em dias corridos.',
      0::numeric,
      0::integer,
      'Dia',
      12::integer,
      true,
      4::integer,
      true,
      now()
    ),
    (
      'Departamento medico',
      'Lesao muscular grau 1',
      'Exame apontou lesao muscular leve. O atleta precisa cumprir protocolo antes de voltar.',
      'Fora por periodo moderado em dias corridos.',
      0::numeric,
      0::integer,
      'Dia',
      18::integer,
      true,
      3::integer,
      true,
      now()
    ),
    (
      'Departamento medico',
      'Lesao no joelho em avaliacao',
      'O jogador relatou dor no joelho e sera acompanhado pelo departamento medico.',
      'Fora por varias semanas, com prazo ajustado pela estrutura medica.',
      0::numeric,
      0::integer,
      'Dia',
      28::integer,
      true,
      2::integer,
      true,
      now()
    ),
    (
      'Departamento medico',
      'Lesao muscular grau 2',
      'Lesao muscular relevante exige reabilitacao completa antes da liberacao.',
      'Fora por prazo longo em dias corridos.',
      0::numeric,
      0::integer,
      'Dia',
      42::integer,
      true,
      1::integer,
      true,
      now()
    )
) as seed(
  type,
  title,
  description,
  effect,
  financial_impact,
  transfer_modifier,
  duration_type,
  duration_value,
  is_injury,
  weight,
  is_active,
  updated_at
)
where not exists (
  select 1
  from public.event_catalog ec
  where public.normalize_key(ec.title) = public.normalize_key(seed.title)
);

update public.events
   set duration_type = 'Dia',
       duration_value = greatest(3, coalesce(matches_remaining, duration_value, 1) * 7),
       matches_remaining = null,
       expires_at = coalesce(
         expires_at,
         now() + make_interval(days => greatest(3, coalesce(matches_remaining, duration_value, 1) * 7))
       ),
       updated_at = now()
 where status in ('active', 'applied', 'generated')
   and nullif(trim(coalesce(affected_player, '')), '') is not null
   and public.normalize_key(coalesce(duration_type, '')) like '%partida%';

update public.events
   set status = 'recovered',
       updated_at = now()
 where status in ('active', 'applied', 'generated')
   and nullif(trim(coalesce(affected_player, '')), '') is not null
   and expires_at is not null
   and expires_at < now();

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
      'treatmentDaysBonus', treatment_days_bonus,
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
      'treatmentDaysBonus', coalesce(mpo.treatment_days_bonus, base_plan.treatment_days_bonus),
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

create or replace function public.app_set_manager_medical_plan(
  p_manager_id text,
  p_access_code text,
  p_plan_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_plan public.medical_plan_options%rowtype;
  v_previous_key text;
  v_manager_name text;
  v_club_id bigint;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Entre como tecnico para contratar estrutura medica.');
  end if;

  select *
    into v_plan
  from public.medical_plan_options
  where plan_key = coalesce(nullif(trim(p_plan_key), ''), 'base_dm')
    and is_active is true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Plano medico indisponivel.');
  end if;

  select plan_key
    into v_previous_key
  from public.manager_medical_plans
  where manager_id = p_manager_id;

  if coalesce(v_previous_key, 'base_dm') = v_plan.plan_key then
    return jsonb_build_object('ok', true, 'message', 'Estrutura medica ja estava ativa.', 'planKey', v_plan.plan_key);
  end if;

  select m.display_name, c.id
    into v_manager_name, v_club_id
  from public.managers m
  left join public.clubs c on c.owner_id = m.id
  where m.id = p_manager_id
  limit 1;

  insert into public.manager_medical_plans (
    manager_id,
    plan_key,
    selected_by,
    selected_at,
    updated_at
  ) values (
    p_manager_id,
    v_plan.plan_key,
    p_manager_id,
    now(),
    now()
  )
  on conflict (manager_id) do update set
    plan_key = excluded.plan_key,
    selected_by = excluded.selected_by,
    selected_at = excluded.selected_at,
    updated_at = now();

  if coalesce(v_plan.setup_cost, 0) > 0 then
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
      v_today,
      null,
      p_manager_id,
      v_club_id,
      'Departamento medico',
      'Estrutura medica contratada: ' || v_plan.display_name,
      'O tecnico contratou uma estrutura medica para prevencao, tratamento e recuperacao do elenco.',
      'Custo de implantacao debitado do orcamento. Custo semanal entra no planejamento do clube.',
      -coalesce(v_plan.setup_cost, 0),
      0,
      null,
      null,
      null,
      null,
      null,
      'applied',
      'medical-plan|' || p_manager_id || '|' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '|' || v_plan.plan_key,
      now(),
      now()
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Estrutura medica atualizada para ' || v_plan.display_name || '.',
    'planKey', v_plan.plan_key,
    'managerName', coalesce(v_manager_name, p_manager_id)
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
  v_plan record;
  v_is_commissioner boolean := false;
  v_action text := lower(coalesce(p_action_type, 'intensive'));
  v_current_expires timestamptz;
  v_current_days integer;
  v_reduce_days integer;
  v_new_days integer;
  v_cost numeric := 0;
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
    return jsonb_build_object('ok', false, 'message', 'Lesao/evento medico nao encontrado.');
  end if;

  if v_event.expires_at is not null and v_event.expires_at < now() then
    update public.events
       set status = 'recovered',
           updated_at = now()
     where id = v_event.id;
    return jsonb_build_object('ok', false, 'message', 'Jogador ja esta recuperado pelo calendario.');
  end if;

  if v_is_commissioner is false and v_event.manager_id <> p_manager_id then
    return jsonb_build_object('ok', false, 'message', 'Voce so pode tratar lesoes do seu clube.');
  end if;

  if v_action = 'force_return' then
    if v_is_commissioner is false then
      return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode forcar retorno imediato.');
    end if;

    update public.events
       set status = 'recovered',
           matches_remaining = 0,
           expires_at = coalesce(expires_at, now()),
           updated_at = now()
     where id = v_event.id;

    perform public.app_governance_insert_event(
      v_event.manager_id,
      'Retorno forcado: ' || v_event.affected_player,
      'O departamento medico liberou o jogador antes do prazo por decisao administrativa.',
      'Jogador recuperado imediatamente, com risco esportivo assumido.',
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

    return jsonb_build_object('ok', true, 'message', 'Retorno forcado aplicado.');
  end if;

  select
    mpo.plan_key,
    mpo.display_name,
    mpo.weekly_cost,
    mpo.treatment_days_bonus
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
    select plan_key, display_name, weekly_cost, treatment_days_bonus
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
  v_reduce_days := greatest(1, coalesce(v_plan.treatment_days_bonus, 1));
  v_new_days := greatest(1, v_current_days - v_reduce_days);
  v_cost := greatest(
    75000,
    (ceil((80000 + coalesce(v_plan.weekly_cost, 0) * 1.4) / 1000.0) * 1000)::numeric
  );

  update public.events
     set duration_type = 'Dia',
         duration_value = v_new_days,
         matches_remaining = null,
         expires_at = now() + make_interval(days => v_new_days),
         updated_at = now()
   where id = v_event.id;

  perform public.app_governance_insert_event(
    v_event.manager_id,
    'Tratamento intensivo: ' || v_event.affected_player,
    'O tecnico investiu em atendimento adicional para acelerar a recuperacao.',
    'Previsao reduzida em ' || v_reduce_days || ' dia(s). Novo prazo: ' || v_new_days || ' dia(s) corrido(s).',
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
    'cost', v_cost
  );
end;
$$;

create or replace function public.app_internal_generate_due_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text := 'America/Sao_Paulo';
  today_local date;
  current_hour integer;
  created_count integer := 0;
  v_slot integer;
  v_manager record;
  v_event record;
  v_prevention_event record;
  v_plan record;
  v_club_id bigint;
  v_affected_player text;
  v_status text;
  v_expires_at timestamptz;
  v_unique_key text;
  v_duration_type text;
  v_duration_value integer;
  v_matches_remaining integer;
  v_description text;
  v_effect text;
  v_base_duration integer;
  v_adjusted_duration integer;
begin
  today_local := (now() at time zone tz)::date;
  current_hour := extract(hour from now() at time zone tz)::integer;

  if current_hour < 5 then
    return jsonb_build_object('ok', true, 'created', 0, 'message', 'Nenhum horario de evento abriu ainda. O primeiro evento abre as 05h.');
  end if;

  for v_slot in
    select value::integer
    from jsonb_array_elements_text(
      coalesce(
        (select value from public.league_config where key = 'event_slots'),
        '[5,8,11,14,17,20,23]'::jsonb
      )
    ) as value
    where value::integer <= current_hour
    order by value::integer
  loop
    for v_manager in
      select m.id, m.display_name
      from public.managers m
      order by m.id
    loop
      if exists (
        select 1
        from public.events e
        where e.event_date = today_local
          and e.slot_hour = v_slot
          and e.manager_id = v_manager.id
          and e.status <> 'cancelled'
          and not (
            lower(coalesce(e.type, '')) like 'premia%'
            or lower(coalesce(e.title, '')) like 'premia%'
            or lower(coalesce(e.title, '')) like '%avan%cop%'
            or lower(coalesce(e.description, '')) like '%premia%'
          )
      ) then
        continue;
      end if;

      v_unique_key := 'dynamic-event|' || today_local::text || '|' || v_slot::text || '|' || v_manager.id::text;

      if exists (
        select 1
        from public.events e
        where e.unique_key = v_unique_key
          and e.status <> 'cancelled'
      ) then
        continue;
      end if;

      select c.id
        into v_club_id
      from public.clubs c
      where c.owner_id = v_manager.id
      limit 1;

      select ec.*
        into v_event
      from public.event_catalog ec
      where ec.is_active = true
        and (
          ec.is_injury = false
          or exists (
            select 1
            from public.club_roster_players r
            join public.clubs c on lower(c.name) = lower(r.club_name)
            where c.owner_id = v_manager.id
            limit 1
          )
          or exists (
            select 1
            from public.transfers t
            where t.buyer_id = v_manager.id
              and t.status = 'approved'
          )
        )
        and not exists (
          select 1
          from public.events used
          where used.manager_id = v_manager.id
            and used.event_date = today_local
            and public.normalize_key(used.title) = public.normalize_key(ec.title)
            and used.status <> 'cancelled'
            and not (
              lower(coalesce(used.type, '')) like 'premia%'
              or lower(coalesce(used.title, '')) like 'premia%'
              or lower(coalesce(used.title, '')) like '%avan%cop%'
              or lower(coalesce(used.description, '')) like '%premia%'
            )
        )
      order by (-ln(greatest(random(), 0.000001)) / greatest(ec.weight, 1))
      limit 1;

      if not found then
        select ec.*
          into v_event
        from public.event_catalog ec
        where ec.is_active = true
          and ec.is_injury = false
        order by (-ln(greatest(random(), 0.000001)) / greatest(ec.weight, 1))
        limit 1;
      end if;

      if not found then
        continue;
      end if;

      select
        mpo.plan_key,
        mpo.display_name,
        mpo.prevention_pct,
        mpo.recovery_pct
        into v_plan
      from public.medical_plan_options mpo
      where mpo.plan_key = coalesce(
        (
          select mmp.plan_key
          from public.manager_medical_plans mmp
          where mmp.manager_id = v_manager.id
        ),
        'base_dm'
      )
      limit 1;

      if not found then
        select plan_key, display_name, prevention_pct, recovery_pct
          into v_plan
        from public.medical_plan_options
        where plan_key = 'base_dm'
        limit 1;
      end if;

      if v_event.is_injury and random() < coalesce(v_plan.prevention_pct, 0) then
        select ec.*
          into v_prevention_event
        from public.event_catalog ec
        where ec.is_active = true
          and ec.is_injury = false
          and not exists (
            select 1
            from public.events used
            where used.manager_id = v_manager.id
              and used.event_date = today_local
              and public.normalize_key(used.title) = public.normalize_key(ec.title)
              and used.status <> 'cancelled'
          )
        order by (-ln(greatest(random(), 0.000001)) / greatest(ec.weight, 1))
        limit 1;

        if found then
          v_event := v_prevention_event;
        end if;
      end if;

      v_affected_player := null;
      v_expires_at := null;
      v_duration_type := v_event.duration_type;
      v_duration_value := v_event.duration_value;
      v_matches_remaining := case
        when public.normalize_key(coalesce(v_event.duration_type, '')) like '%partida%' then v_event.duration_value
        else null
      end;
      v_description := v_event.description;
      v_effect := v_event.effect;
      v_base_duration := null;
      v_adjusted_duration := null;

      if v_event.is_injury then
        select candidate.player_name
          into v_affected_player
        from (
          select r.player_name
          from public.club_roster_players r
          join public.clubs c on lower(c.name) = lower(r.club_name)
          where c.owner_id = v_manager.id
          union
          select t.player_name
          from public.transfers t
          where t.buyer_id = v_manager.id
            and t.status = 'approved'
            and coalesce(t.transfer_type, 'market') <> 'cpu_sale'
        ) candidate
        where nullif(trim(candidate.player_name), '') is not null
        order by random()
        limit 1;

        if v_affected_player is null then
          select ec.*
            into v_event
          from public.event_catalog ec
          where ec.is_active = true
            and ec.is_injury = false
          order by (-ln(greatest(random(), 0.000001)) / greatest(ec.weight, 1))
          limit 1;

          v_duration_type := v_event.duration_type;
          v_duration_value := v_event.duration_value;
          v_matches_remaining := null;
          v_description := v_event.description;
          v_effect := v_event.effect;
        else
          v_base_duration := greatest(coalesce(v_event.duration_value, 7), 1);
          v_adjusted_duration := greatest(
            2,
            ceil(v_base_duration * (1 - coalesce(v_plan.recovery_pct, 0)))::integer
          );
          v_duration_type := 'Dia';
          v_duration_value := v_adjusted_duration;
          v_matches_remaining := null;
          v_expires_at := (
            today_local::timestamp
            + make_interval(days => v_adjusted_duration)
            + make_interval(hours => v_slot)
          ) at time zone tz;
          v_description := v_event.description
            || ' Plano medico: '
            || coalesce(v_plan.display_name, 'DM base')
            || '. Duracao base: '
            || v_base_duration
            || ' dia(s), prazo ajustado: '
            || v_adjusted_duration
            || ' dia(s).';
          v_effect := 'Jogador fora por '
            || v_adjusted_duration
            || ' dia(s) corrido(s). O calendario reduz automaticamente o prazo.';
        end if;
      elsif public.normalize_key(coalesce(v_event.duration_type, '')) = 'dia' then
        v_expires_at := (
          today_local::timestamp
          + make_interval(days => greatest(coalesce(v_event.duration_value, 1), 1))
          + make_interval(hours => v_slot)
        ) at time zone tz;
      elsif public.normalize_key(coalesce(v_event.duration_type, '')) like '%proximo horario%' then
        v_expires_at := ((today_local::timestamp + make_interval(hours => least(v_slot + 3, 23))) at time zone tz);
      end if;

      v_status := case
        when coalesce(v_event.financial_impact, 0) <> 0 then 'applied'
        else 'active'
      end;

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
        medical_plan_key,
        medical_base_duration_days,
        medical_recovery_pct
      ) values (
        today_local,
        v_slot,
        v_manager.id,
        v_club_id,
        v_event.type,
        v_event.title,
        v_description,
        v_effect,
        coalesce(v_event.financial_impact, 0),
        coalesce(v_event.transfer_modifier, 0),
        v_affected_player,
        v_duration_type,
        v_duration_value,
        v_matches_remaining,
        v_expires_at,
        v_status,
        v_unique_key,
        case when v_event.is_injury then coalesce(v_plan.plan_key, 'base_dm') else null end,
        v_base_duration,
        case when v_event.is_injury then coalesce(v_plan.recovery_pct, 0) else null end
      )
      on conflict (event_date, slot_hour, manager_id)
      where status <> 'cancelled'
      do nothing;

      if found then
        created_count := created_count + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'created', created_count,
    'message', created_count || ' evento(s) gerado(s).'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'created', created_count, 'message', SQLERRM);
end;
$$;

grant execute on function public.app_get_medical_center_data(text, text) to anon, authenticated;
grant execute on function public.app_set_manager_medical_plan(text, text, text) to anon, authenticated;
grant execute on function public.app_apply_medical_action(text, text, bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.app_internal_generate_due_events() to anon, authenticated;

commit;
