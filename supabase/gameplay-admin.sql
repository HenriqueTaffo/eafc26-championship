-- Camada de governanca da jogatina.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro.
-- 3. Recarregue o app e use a aba "Comissario".

create table if not exists public.governance_auction_intents (
  id bigserial primary key,
  opened_by text not null,
  opened_by_name text not null,
  player_name text not null,
  overall integer not null default 0,
  opening_value numeric not null default 0,
  status text not null default 'open',
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
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

create table if not exists public.governance_weekly_reviews (
  id bigserial primary key,
  review_date date not null default current_date,
  manager_id text,
  manager_name text not null,
  club_name text,
  objectives_met integer not null default 0,
  objectives_total integer not null default 0,
  verdict text not null,
  suggested_impact numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.commissioner_admins (
  id text primary key,
  display_name text not null,
  access_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.commissioner_admins (id, display_name, access_code)
values ('comissario', 'Comissario da Liga', 'MML-2026')
on conflict (id) do update
   set display_name = excluded.display_name,
       access_code = excluded.access_code,
       updated_at = now();

create or replace function public.app_login_commissioner(
  p_manager_name text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_admin public.commissioner_admins%rowtype;
begin
  select *
    into v_admin
  from public.commissioner_admins
  where id = 'comissario'
    and lower(p_manager_name) in (lower(display_name), lower('Comissário da Liga'))
  limit 1;

  if not found or v_admin.access_code is distinct from p_access_code then
    return jsonb_build_object('ok', false, 'message', 'Login do comissario invalido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'manager', jsonb_build_object(
      'id', v_admin.id,
      'name', 'Comissário da Liga',
      'club', 'Governança da Liga',
      'isCommissioner', true
    )
  );
end;
$$;

create or replace function public.app_governance_login(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_manager record;
  v_login jsonb;
begin
  if p_manager_id = 'comissario' then
    v_login := public.app_login_commissioner('Comissario da Liga', p_access_code)::jsonb;
    if coalesce((v_login ->> 'ok')::boolean, false) is false then
      return jsonb_build_object('ok', false, 'message', 'Login do comissario invalido.');
    end if;

    return jsonb_build_object(
      'ok', true,
      'managerId', 'comissario',
      'managerName', 'Comissário da Liga',
      'clubName', 'Governança da Liga',
      'isCommissioner', true
    );
  end if;

  select id, display_name
    into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode executar acoes de governanca.');
end;
$$;

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
    current_date,
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
    '',
    now(),
    now()
  );
end;
$$;

create or replace function public.app_get_governance_data(
  p_manager_id text default '',
  p_access_code text default ''
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_auctions jsonb;
  v_medical jsonb;
  v_reviews jsonb;
begin
  update public.governance_auction_intents
     set status = 'expired'
   where status = 'open'
     and expires_at < now();

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    into v_auctions
  from (
    select *
    from public.governance_auction_intents
    order by created_at desc
    limit 20
  ) a;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc), '[]'::jsonb)
    into v_medical
  from (
    select *
    from public.governance_medical_actions
    order by created_at desc
    limit 20
  ) m;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v_reviews
  from (
    select *
    from public.governance_weekly_reviews
    order by created_at desc
    limit 30
  ) r;

  return jsonb_build_object(
    'auctions', v_auctions,
    'medicalActions', v_medical,
    'weeklyReviews', v_reviews
  );
end;
$$;

create or replace function public.app_open_auction_intent(
  p_manager_id text,
  p_access_code text,
  p_player_name text,
  p_overall integer,
  p_opening_value numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_login jsonb;
  v_id bigint;
begin
  v_login := public.app_governance_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce(trim(p_player_name), '') = '' or coalesce(p_opening_value, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe jogador e lance inicial.');
  end if;

  insert into public.governance_auction_intents (
    opened_by,
    opened_by_name,
    player_name,
    overall,
    opening_value
  ) values (
    p_manager_id,
    v_login ->> 'managerName',
    trim(p_player_name),
    coalesce(p_overall, 0),
    coalesce(p_opening_value, 0)
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message', 'Leilao aberto por 24 horas.', 'auctionId', v_id);
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
as $$
declare
  v_login jsonb;
  v_event public.events%rowtype;
  v_cost numeric := 0;
  v_action text := lower(coalesce(p_action_type, 'intensive'));
begin
  v_login := public.app_governance_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

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
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Lesao/evento medico nao encontrado.');
  end if;

  if v_action = 'force_return' then
    update public.events
       set status = 'recovered',
           matches_remaining = 0,
           expires_at = coalesce(expires_at, now()),
           updated_at = now()
     where id = v_event.id;

    perform public.app_governance_insert_event(
      v_event.manager_id,
      'Retorno forcado: ' || v_event.affected_player,
      'O departamento medico liberou o jogador antes do previsto por decisao do comissario.',
      'Jogador recuperado imediatamente, com risco esportivo assumido pelo tecnico.',
      'Departamento medico',
      0
    );

    if random() < 0.35 then
      perform public.app_governance_insert_event(
        v_event.manager_id,
        'Cobranca do DM',
        'A pressa no retorno gerou custo extra de acompanhamento medico.',
        'Despesa medica aplicada ao orcamento.',
        'Departamento medico',
        -600000
      );
    end if;

    insert into public.governance_medical_actions (
      manager_id, manager_name, event_id, event_key, player_name, action_type, cost
    ) values (
      v_event.manager_id, v_login ->> 'managerName', v_event.id, v_event.unique_key, v_event.affected_player, v_action, 0
    );

    return jsonb_build_object('ok', true, 'message', 'Retorno forcado aplicado.');
  end if;

  v_cost := 450000;

  update public.events
     set matches_remaining = greatest(coalesce(matches_remaining, duration_value, 1) - 1, 0),
         status = case when greatest(coalesce(matches_remaining, duration_value, 1) - 1, 0) = 0 then 'recovered' else status end,
         updated_at = now()
   where id = v_event.id;

  perform public.app_governance_insert_event(
    v_event.manager_id,
    'Tratamento intensivo: ' || v_event.affected_player,
    'O tecnico investiu em recuperacao acelerada para reduzir o tempo no DM.',
    'Uma partida foi reduzida da duracao da lesao.',
    'Departamento medico',
    -v_cost
  );

  insert into public.governance_medical_actions (
    manager_id, manager_name, event_id, event_key, player_name, action_type, cost
  ) values (
    v_event.manager_id, v_login ->> 'managerName', v_event.id, v_event.unique_key, v_event.affected_player, v_action, v_cost
  );

  return jsonb_build_object('ok', true, 'message', 'Tratamento intensivo aplicado.');
end;
$$;

create or replace function public.app_commissioner_clear_injuries(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_login jsonb;
  v_count integer := 0;
begin
  v_login := public.app_governance_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  update public.events
     set status = 'recovered',
         matches_remaining = 0,
         expires_at = coalesce(expires_at, now()),
         updated_at = now()
   where status in ('active', 'applied')
     and nullif(trim(coalesce(affected_player, '')), '') is not null;

  get diagnostics v_count = row_count;

  perform public.app_governance_insert_event(
    p_manager_id,
    'Mutirao do DM',
    'O comissario abriu uma acao emergencial para limpar o departamento medico da liga.',
    'Lesoes ativas foram encerradas por decisao administrativa.',
    'Evento do comissario',
    0
  );

  return jsonb_build_object('ok', true, 'message', 'Lesoes limpas.', 'recovered', v_count);
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

  return jsonb_build_object('ok', true, 'message', 'Fechamento semanal registrado.', 'inserted', v_inserted);
end;
$$;
