-- Remove legacy PIN RPCs - 23/05/2026.
--
-- Public RPCs must authenticate with manager_id + access_code. The old
-- p_pin overloads are replaced by internal functions that are not granted to
-- anon/authenticated clients.

begin;

create or replace function public.app_internal_add_result(
  p_competition text,
  p_week integer,
  p_phase text,
  p_home text,
  p_away text,
  p_home_score integer,
  p_away_score integer,
  p_goal_details text default '',
  p_assist_details text default '',
  p_penalty_winner text default '',
  p_penalty_score text default '',
  p_submitted_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home_id bigint;
  v_away_id bigint;
  v_penalty_winner_id bigint;
  v_manager_id text;
  v_existing public.matches%rowtype;
  v_match_id bigint;
  v_award jsonb;
  v_message text;
begin
  if coalesce(trim(p_competition), '') = '' then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Competição é obrigatória.');
  end if;

  if coalesce(trim(p_phase), '') = '' then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Rodada/Fase é obrigatória.');
  end if;

  if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0 then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Placar inválido.');
  end if;

  v_home_id := public.resolve_club_id(p_home);
  v_away_id := public.resolve_club_id(p_away);
  v_manager_id := public.resolve_manager_id(p_submitted_by);

  if v_home_id is null then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Mandante não encontrado: ' || coalesce(p_home, ''));
  end if;

  if v_away_id is null then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Visitante não encontrado: ' || coalesce(p_away, ''));
  end if;

  if v_home_id = v_away_id then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Mandante e visitante não podem ser o mesmo time.');
  end if;

  if public.normalize_key(p_competition) <> 'championship'
     and p_home_score = p_away_score
     and coalesce(trim(p_penalty_winner), '') = '' then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Jogo de copa empatado precisa informar vencedor nos pênaltis.');
  end if;

  if coalesce(trim(p_penalty_winner), '') <> '' then
    v_penalty_winner_id := public.resolve_club_id(p_penalty_winner);

    if v_penalty_winner_id is null or v_penalty_winner_id not in (v_home_id, v_away_id) then
      return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Vencedor nos pênaltis precisa ser o mandante ou o visitante.');
    end if;
  end if;

  select *
    into v_existing
  from public.matches
  where competition = p_competition
    and phase = p_phase
    and home_club_id = v_home_id
    and away_club_id = v_away_id
  limit 1;

  if found and v_existing.status = 'approved' and v_existing.home_score is not null and v_existing.away_score is not null then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Resultado já cadastrado para este jogo.');
  end if;

  if found then
    update public.matches
       set week = coalesce(p_week, week),
           home_score = p_home_score,
           away_score = p_away_score,
           goals_details = coalesce(p_goal_details, ''),
           assists_details = coalesce(p_assist_details, ''),
           penalty_winner_club_id = v_penalty_winner_id,
           penalty_score = coalesce(p_penalty_score, ''),
           submitted_by = v_manager_id,
           status = 'approved',
           reason = 'OK',
           updated_at = now()
     where id = v_existing.id
     returning id into v_match_id;
  else
    insert into public.matches (
      competition,
      week,
      phase,
      home_club_id,
      away_club_id,
      home_score,
      away_score,
      goals_details,
      assists_details,
      penalty_winner_club_id,
      penalty_score,
      submitted_by,
      status,
      reason
    ) values (
      p_competition,
      p_week,
      p_phase,
      v_home_id,
      v_away_id,
      p_home_score,
      p_away_score,
      coalesce(p_goal_details, ''),
      coalesce(p_assist_details, ''),
      v_penalty_winner_id,
      coalesce(p_penalty_score, ''),
      v_manager_id,
      'approved',
      'OK'
    )
    returning id into v_match_id;
  end if;

  v_message := 'Resultado salvo com sucesso.';

  if public.normalize_key(p_competition) <> 'championship' then
    v_award := public.app_award_cup_progression_for_match(v_match_id);

    if coalesce((v_award ->> 'awarded')::boolean, false) then
      v_message := v_message || ' Premiação de copa aplicada: € ' || to_char((v_award ->> 'prize')::numeric, 'FM999G999G999G999');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'Aprovado',
    'message', v_message,
    'cupAward', coalesce(v_award, '{}'::jsonb)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', 'Resultado duplicado bloqueado pelo banco.');
  when others then
    return jsonb_build_object('ok', false, 'status', 'Rejeitado', 'message', SQLERRM);
end;
$$;

create or replace function public.app_add_result(
  p_manager_id text,
  p_access_code text,
  p_competition text,
  p_week integer,
  p_phase text,
  p_home text,
  p_away text,
  p_home_score integer,
  p_away_score integer,
  p_goal_details text default '',
  p_assist_details text default '',
  p_penalty_winner text default '',
  p_penalty_score text default '',
  p_submitted_by text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_club text;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_club := coalesce(v_login ->> 'clubName', '');

  if not v_is_commissioner
     and not public.app_security_same_team(v_club, p_home)
     and not public.app_security_same_team(v_club, p_away) then
    return jsonb_build_object('ok', false, 'message', 'Voce so pode enviar resultado de jogos do seu clube.');
  end if;

  return public.app_internal_add_result(
    p_competition,
    p_week,
    p_phase,
    p_home,
    p_away,
    p_home_score,
    p_away_score,
    p_goal_details,
    p_assist_details,
    p_penalty_winner,
    p_penalty_score,
    coalesce(nullif(trim(p_submitted_by), ''), v_login ->> 'managerName')
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
  v_club_id bigint;
  v_affected_player text;
  v_status text;
  v_expires_at timestamptz;
  v_unique_key text;
begin
  today_local := (now() at time zone tz)::date;
  current_hour := extract(hour from now() at time zone tz)::integer;

  if current_hour < 5 then
    return jsonb_build_object('ok', true, 'created', 0, 'message', 'Nenhum horário de evento abriu ainda. O primeiro evento abre às 05h.');
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

      v_affected_player := null;

      if v_event.is_injury then
        select t.player_name
          into v_affected_player
        from public.transfers t
        where t.buyer_id = v_manager.id
          and t.status = 'approved'
        order by random()
        limit 1;
      end if;

      v_status := case
        when coalesce(v_event.financial_impact, 0) <> 0 then 'applied'
        else 'active'
      end;

      v_expires_at := null;

      if public.normalize_key(coalesce(v_event.duration_type, '')) = 'dia' then
        v_expires_at := ((today_local + 1)::timestamp at time zone tz);
      elsif public.normalize_key(coalesce(v_event.duration_type, '')) like '%proximo horario%' then
        v_expires_at := ((today_local::timestamp + make_interval(hours => least(v_slot + 3, 23))) at time zone tz);
      end if;

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
        unique_key
      ) values (
        today_local,
        v_slot,
        v_manager.id,
        v_club_id,
        v_event.type,
        v_event.title,
        v_event.description,
        v_event.effect,
        coalesce(v_event.financial_impact, 0),
        coalesce(v_event.transfer_modifier, 0),
        v_affected_player,
        v_event.duration_type,
        v_event.duration_value,
        case
          when public.normalize_key(coalesce(v_event.duration_type, '')) like '%partida%' then v_event.duration_value
          else null
        end,
        v_expires_at,
        v_status,
        v_unique_key
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

create or replace function public.app_generate_due_events(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode gerar eventos automaticos.');
  end if;

  return public.app_internal_generate_due_events();
end;
$$;

create or replace function public.app_internal_simulate_cpu_week(
  p_week integer,
  p_submitted_by text default 'Liga'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  human_pending integer := 0;
  available_matches integer := 0;
  created_count integer := 0;
  rejected_count integer := 0;
  rec record;
  v_home_score integer;
  v_away_score integer;
  v_penalty_winner text;
  v_penalty_score text;
  v_home_pens integer;
  v_away_pens integer;
  v_result jsonb;
  v_details jsonb := '[]'::jsonb;
begin
  if p_week is null or p_week <= 0 then
    return jsonb_build_object('ok', false, 'created', 0, 'rejected', 0, 'message', 'Semana inválida.');
  end if;

  select count(*)
    into available_matches
  from public.matches ma
  where ma.week = p_week
    and ma.status <> 'cancelled';

  if available_matches = 0 then
    return jsonb_build_object(
      'ok', false,
      'created', 0,
      'rejected', 0,
      'message', 'Nenhum jogo encontrado na semana ' || p_week || '. Rode o SQL v18 para completar a tabela da Championship.'
    );
  end if;

  select count(*)
    into human_pending
  from public.matches ma
  join public.clubs home on home.id = ma.home_club_id
  join public.clubs away on away.id = ma.away_club_id
  where ma.week = p_week
    and ma.status <> 'approved'
    and ma.status <> 'cancelled'
    and (home.owner_id is not null or away.owner_id is not null);

  if human_pending > 0 then
    return jsonb_build_object(
      'ok', false,
      'created', 0,
      'rejected', 0,
      'humanPending', human_pending,
      'message', 'Ainda existem ' || human_pending || ' jogo(s) com técnico pendente na semana ' || p_week || '.'
    );
  end if;

  for rec in
    select
      ma.id,
      ma.competition,
      ma.week,
      ma.phase,
      ma.match_order,
      home.name as home,
      away.name as away,
      coalesce(home.strength, 70) as home_strength,
      coalesce(away.strength, 70) as away_strength
    from public.matches ma
    join public.clubs home on home.id = ma.home_club_id
    join public.clubs away on away.id = ma.away_club_id
    where ma.week = p_week
      and ma.status <> 'approved'
      and ma.status <> 'cancelled'
      and ma.home_score is null
      and ma.away_score is null
      and home.owner_id is null
      and away.owner_id is null
    order by ma.competition, ma.match_date nulls last, ma.match_order nulls last, ma.id
  loop
    v_home_score := greatest(0, least(5, round(1.2 + (((rec.home_strength + 3) - rec.away_strength) / 18.0) + random() * 2.2 - 0.7)::integer));
    v_away_score := greatest(0, least(5, round(1.0 + ((rec.away_strength - rec.home_strength) / 18.0) + random() * 2.0 - 0.6)::integer));

    v_penalty_winner := '';
    v_penalty_score := '';

    if public.normalize_key(rec.competition) <> 'championship'
       and v_home_score = v_away_score then
      if random() >= 0.5 then
        v_penalty_winner := rec.home;
        v_home_pens := 4 + floor(random() * 3)::integer;
        v_away_pens := greatest(0, v_home_pens - 1 - floor(random() * 2)::integer);
      else
        v_penalty_winner := rec.away;
        v_away_pens := 4 + floor(random() * 3)::integer;
        v_home_pens := greatest(0, v_away_pens - 1 - floor(random() * 2)::integer);
      end if;

      v_penalty_score := v_home_pens || ' x ' || v_away_pens;
    end if;

    v_result := public.app_internal_add_result(
      rec.competition,
      rec.week,
      rec.phase,
      rec.home,
      rec.away,
      v_home_score,
      v_away_score,
      '',
      '',
      v_penalty_winner,
      v_penalty_score,
      p_submitted_by
    );

    if coalesce((v_result ->> 'ok')::boolean, false) then
      created_count := created_count + 1;
    else
      rejected_count := rejected_count + 1;
    end if;

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'id', rec.id,
      'competition', rec.competition,
      'phase', rec.phase,
      'home', rec.home,
      'away', rec.away,
      'score', v_home_score || ' x ' || v_away_score,
      'penaltyWinner', v_penalty_winner,
      'penaltyScore', v_penalty_score,
      'ok', coalesce((v_result ->> 'ok')::boolean, false),
      'message', coalesce(v_result ->> 'message', '')
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'created', created_count,
    'rejected', rejected_count,
    'details', v_details,
    'message', created_count || ' jogo(s) CPU x CPU simulados na semana ' || p_week || case when rejected_count > 0 then '. ' || rejected_count || ' rejeitado(s).' else '.' end
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'created', created_count, 'rejected', rejected_count, 'message', SQLERRM);
end;
$$;

create or replace function public.app_simulate_cpu_week(
  p_manager_id text,
  p_access_code text,
  p_week integer,
  p_submitted_by text default 'Liga'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode simular rodadas CPU x CPU.');
  end if;

  return public.app_internal_simulate_cpu_week(p_week, p_submitted_by);
end;
$$;

drop function if exists public.app_add_result(
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.app_generate_due_events(text);
drop function if exists public.app_simulate_cpu_week(text, integer, text);

revoke execute on function public.app_internal_add_result(
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

revoke execute on function public.app_internal_generate_due_events()
  from public, anon, authenticated;

revoke execute on function public.app_internal_simulate_cpu_week(integer, text)
  from public, anon, authenticated;

grant execute on function public.app_add_result(
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;

grant execute on function public.app_generate_due_events(text, text)
  to anon, authenticated;

grant execute on function public.app_simulate_cpu_week(text, text, integer, text)
  to anon, authenticated;

comment on function public.app_internal_add_result(
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) is 'Internal result writer. Public clients must call authenticated app_add_result(manager_id, access_code, ...).';

comment on function public.app_internal_generate_due_events()
  is 'Internal automatic event generator. Public clients must call authenticated commissioner wrapper.';

comment on function public.app_internal_simulate_cpu_week(integer, text)
  is 'Internal CPU simulation engine. Public clients must call authenticated commissioner wrapper.';

commit;
