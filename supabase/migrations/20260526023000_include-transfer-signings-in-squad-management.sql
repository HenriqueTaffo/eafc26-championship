-- Include approved transfer signings in squad management rosters.
-- The squad builder previously returned only the original EA FC club roster,
-- so a newly approved signing could exist in transfers but not be selectable.

begin;

create or replace function public.app_get_squad_management_data(
  p_manager_id text default '',
  p_access_code text default ''
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean := false;
  v_manager_id text := '';
  v_manager_name text := '';
  v_payload jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);

  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object(
      'ok', false,
      'message', 'Faca login para ver o gerenciamento de elenco.',
      'managers', '[]'::jsonb,
      'rosters', '{}'::jsonb,
      'lineups', '{}'::jsonb,
      'finance', '[]'::jsonb,
      'sources', jsonb_build_object(
        'ratings', 'EA SPORTS FC 26 official team ratings',
        'salary', 'Public salary references: Capology, SalarySport or manually approved public URL',
        'currency', 'EUR weekly wages for league accounting'
      )
    );
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_id := coalesce(v_login ->> 'managerId', '');
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  with manager_clubs as (
    select
      m.id as manager_id,
      m.display_name as manager_name,
      c.id as club_id,
      c.name as club_name,
      c.logo_url,
      c.primary_color,
      c.secondary_color,
      c.strength
    from public.managers m
    join public.clubs c on c.owner_id = m.id
    where c.is_human is true
      and (v_is_commissioner or m.id = v_manager_id)
  ),
  scoped_finance as (
    select coalesce(jsonb_agg(item order by item ->> 'manager_name'), '[]'::jsonb) as value
    from jsonb_array_elements(coalesce(public.app_get_manager_finance_forecast(), '[]'::jsonb)) as finance(item)
    where v_is_commissioner
       or public.normalize_key(item ->> 'manager_name') = public.normalize_key(v_manager_name)
  )
  select jsonb_build_object(
    'ok', true,
    'scope', case when v_is_commissioner then 'league' else 'manager' end,
    'scopedManagerId', case when v_is_commissioner then '' else v_manager_id end,
    'scopedManagerName', case when v_is_commissioner then '' else v_manager_name end,
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'managerId', manager_id,
        'managerName', manager_name,
        'clubId', club_id,
        'clubName', club_name,
        'logoUrl', logo_url,
        'primaryColor', primary_color,
        'secondaryColor', secondary_color,
        'strength', strength
      ) order by manager_name)
      from manager_clubs
    ), '[]'::jsonb),
    'rosters', coalesce((
      select jsonb_object_agg(mc.manager_name, coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', roster_item.id,
          'clubName', roster_item.club_name,
          'managerName', roster_item.manager_name,
          'eaId', roster_item.ea_id,
          'rank', roster_item.ea_rank,
          'name', roster_item.player_name,
          'position', roster_item.position,
          'positionLabel', roster_item.position_label,
          'overall', roster_item.overall,
          'weeklySalary', roster_item.weekly_salary,
          'salarySourceName', roster_item.salary_source_name,
          'salarySourceUrl', roster_item.salary_source_url,
          'salaryReferenceType', roster_item.salary_reference_type,
          'salaryCheckedAt', roster_item.salary_checked_at,
          'sourceWeeklyPayroll', roster_item.source_weekly_payroll,
          'avatarUrl', roster_item.avatar_url,
          'shieldUrl', roster_item.shield_url,
          'nation', roster_item.nation,
          'sourceName', roster_item.source_name,
          'sourceUrl', roster_item.source_url,
          'rosterSource', roster_item.roster_source
        ) order by roster_item.overall desc, roster_item.ea_rank nulls last, roster_item.player_name)
        from (
          select
            r.id::bigint as id,
            r.club_name,
            r.manager_name,
            r.ea_id,
            r.ea_rank,
            r.player_name,
            r.position,
            r.position_label,
            r.overall,
            r.estimated_weekly_salary_eur as weekly_salary,
            coalesce(r.salary_source_name, r.source_name) as salary_source_name,
            coalesce(r.salary_source_url, r.source_url) as salary_source_url,
            coalesce(r.salary_reference_type, 'public_club_payroll_reference') as salary_reference_type,
            r.salary_checked_at,
            r.source_weekly_payroll_eur as source_weekly_payroll,
            r.avatar_url,
            r.shield_url,
            r.nation,
            r.source_name,
            r.source_url,
            'base'::text as roster_source
          from public.club_roster_players r
          where lower(r.club_name) = lower(mc.club_name)

          union all

          select
            (1000000000 + latest.id)::bigint as id,
            mc.club_name,
            mc.manager_name,
            'transfer-' || latest.id::text as ea_id,
            null::integer as ea_rank,
            latest.player_name,
            coalesce(rating.position, market.position, '') as position,
            coalesce(rating.position, market.position, '') as position_label,
            coalesce(latest.overall, rating.overall, 0)::integer as overall,
            coalesce(latest.weekly_salary_eur, 0)::numeric as weekly_salary,
            coalesce(latest.salary_source_name, 'Referencia salarial aprovada') as salary_source_name,
            coalesce(latest.salary_source_url, '') as salary_source_url,
            coalesce(latest.salary_reference_type, 'transfer_verified') as salary_reference_type,
            latest.salary_checked_at,
            coalesce(latest.weekly_salary_eur, 0)::numeric as source_weekly_payroll,
            coalesce(rating.avatar_url, market.avatar_url, '') as avatar_url,
            coalesce(rating.shield_url, '') as shield_url,
            coalesce(rating.nation, market.country, latest.from_club, 'Mercado') as nation,
            'Transferencia aprovada' as source_name,
            coalesce(latest.salary_source_url, rating.source_url, market.transfermarkt_url, '') as source_url,
            'transfer'::text as roster_source
          from (
            select ranked.*
            from (
              select
                t.*,
                row_number() over (
                  partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
                  order by t.created_at desc nulls last, t.id desc
                ) as rn
              from public.transfers t
              where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
                and coalesce(t.player_key, t.player_name, '') <> ''
            ) ranked
            where ranked.rn = 1
          ) latest
          left join lateral (
            select r.*
            from public.ea_player_ratings r
            where public.normalize_key(r.name) = public.normalize_key(latest.player_name)
            order by
              (public.normalize_key(coalesce(r.club, '')) = public.normalize_key(coalesce(latest.from_club, ''))) desc,
              r.overall desc nulls last
            limit 1
          ) rating on true
          left join lateral (
            select p.*
            from public.players_market p
            where public.normalize_key(p.name) = public.normalize_key(latest.player_name)
            order by
              (public.normalize_key(coalesce(p.club, '')) = public.normalize_key(coalesce(latest.from_club, ''))) desc,
              p.market_value_eur desc nulls last
            limit 1
          ) market on true
          where latest.buyer_id = mc.manager_id
            and lower(coalesce(latest.transfer_type, 'market')) not in ('internal', 'cpu_sale')
            and not exists (
              select 1
              from public.club_roster_players base_player
              where lower(base_player.club_name) = lower(mc.club_name)
                and public.normalize_key(base_player.player_name) = public.normalize_key(latest.player_name)
            )
        ) roster_item
      ), '[]'::jsonb))
      from manager_clubs mc
    ), '{}'::jsonb),
    'lineups', coalesce((
      select jsonb_object_agg(mc.manager_name, jsonb_build_object(
        'managerId', mc.manager_id,
        'managerName', mc.manager_name,
        'clubName', mc.club_name,
        'formation', coalesce(l.formation, '4-2-3-1'),
        'lineup', coalesce(l.lineup, '{}'::jsonb),
        'updatedAt', l.updated_at
      ))
      from manager_clubs mc
      left join public.manager_squad_lineups l on l.manager_id = mc.manager_id
    ), '{}'::jsonb),
    'finance', (select value from scoped_finance),
    'sources', jsonb_build_object(
      'ratings', 'EA SPORTS FC 26 official team ratings',
      'salary', 'Public salary references: Capology, SalarySport or manually approved public URL',
      'currency', 'EUR weekly wages for league accounting'
    )
  )
  into v_payload;

  return v_payload;
end;
$$;

create or replace function public.app_save_manager_squad_lineup(
  p_manager_id text,
  p_access_code text,
  p_club_name text,
  p_formation text,
  p_lineup jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_target_manager_id text;
  v_target_manager_name text;
  v_target_club_name text;
  v_total integer := 0;
  v_distinct integer := 0;
  v_invalid integer := 0;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);

  if v_is_commissioner and coalesce(trim(p_club_name), '') <> '' then
    select c.owner_id, m.display_name, c.name
      into v_target_manager_id, v_target_manager_name, v_target_club_name
    from public.clubs c
    join public.managers m on m.id = c.owner_id
    where lower(c.name) = lower(trim(p_club_name))
    limit 1;
  else
    v_target_manager_id := coalesce(v_login ->> 'managerId', '');
    v_target_manager_name := coalesce(v_login ->> 'managerName', '');
    v_target_club_name := coalesce(v_login ->> 'clubName', '');
  end if;

  if coalesce(v_target_manager_id, '') = '' or coalesce(v_target_club_name, '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Clube do tecnico nao encontrado.');
  end if;

  if not v_is_commissioner and lower(v_target_manager_id) <> lower(p_manager_id) then
    return jsonb_build_object('ok', false, 'message', 'Voce so pode salvar a sua propria escalacao.');
  end if;

  if coalesce(trim(p_formation), '') <> all(array[
    '3-1-4-2',
    '3-4-1-2',
    '3-4-2-1',
    '3-4-3',
    '3-5-2',
    '4-1-2-1-2',
    '4-1-2-1-2 (2)',
    '4-1-3-2',
    '4-1-4-1',
    '4-2-1-3',
    '4-2-2-2',
    '4-2-3-1',
    '4-2-3-1 (2)',
    '4-2-4',
    '4-3-1-2',
    '4-3-2-1',
    '4-3-3',
    '4-3-3 (2)',
    '4-3-3 (3)',
    '4-3-3 (4)',
    '4-4-1-1 (2)',
    '4-4-2',
    '4-4-2 (2)',
    '4-5-1',
    '4-5-1 (2)',
    '5-2-1-2',
    '5-2-3',
    '5-3-2',
    '5-4-1'
  ]) then
    return jsonb_build_object('ok', false, 'message', 'Formacao invalida.');
  end if;

  with selected as (
    select nullif(trim(value #>> '{}'), '') as roster_id
    from jsonb_each(coalesce(p_lineup, '{}'::jsonb))
    where jsonb_typeof(value) in ('number', 'string')
      and lower(coalesce(value #>> '{}', '')) not in ('', 'null', 'undefined')
  ),
  latest as (
    select ranked.*
    from (
      select
        t.*,
        row_number() over (
          partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
          order by t.created_at desc nulls last, t.id desc
        ) as rn
      from public.transfers t
      where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
        and coalesce(t.player_key, t.player_name, '') <> ''
    ) ranked
    where ranked.rn = 1
  ),
  valid_ids as (
    select r.id::text as roster_id
    from public.club_roster_players r
    where lower(r.club_name) = lower(v_target_club_name)

    union

    select (1000000000 + latest.id)::text as roster_id
    from latest
    where latest.buyer_id = v_target_manager_id
      and lower(coalesce(latest.transfer_type, 'market')) not in ('internal', 'cpu_sale')
      and not exists (
        select 1
        from public.club_roster_players base_player
        where lower(base_player.club_name) = lower(v_target_club_name)
          and public.normalize_key(base_player.player_name) = public.normalize_key(latest.player_name)
      )
  )
  select
    (select count(*) from selected),
    (select count(distinct roster_id) from selected),
    (select count(*)
     from selected s
     where s.roster_id is null
        or not exists (
          select 1
          from valid_ids v
          where v.roster_id = s.roster_id
        ))
    into v_total, v_distinct, v_invalid;

  if v_invalid > 0 then
    return jsonb_build_object('ok', false, 'message', 'A escalacao contem jogador fora deste elenco.');
  end if;

  if v_total > 11 then
    return jsonb_build_object('ok', false, 'message', 'A escalacao inicial pode ter no maximo 11 jogadores.');
  end if;

  if v_total <> v_distinct then
    return jsonb_build_object('ok', false, 'message', 'Nao repita o mesmo jogador na escalacao.');
  end if;

  insert into public.manager_squad_lineups (
    manager_id,
    manager_name,
    club_name,
    formation,
    lineup,
    updated_at
  ) values (
    v_target_manager_id,
    v_target_manager_name,
    v_target_club_name,
    trim(p_formation),
    coalesce(p_lineup, '{}'::jsonb),
    now()
  )
  on conflict (manager_id) do update set
    manager_name = excluded.manager_name,
    club_name = excluded.club_name,
    formation = excluded.formation,
    lineup = excluded.lineup,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'message', 'Escalacao salva.',
    'managerName', v_target_manager_name,
    'clubName', v_target_club_name,
    'formation', trim(p_formation),
    'lineup', coalesce(p_lineup, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.app_get_squad_management_data(text, text) to anon, authenticated;
grant execute on function public.app_save_manager_squad_lineup(text, text, text, text, jsonb) to anon, authenticated;

commit;
