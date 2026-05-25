-- Scope squad management data to the authenticated manager.
-- Commissioners keep the full league view; managers receive only their club.

begin;

drop function if exists public.app_get_squad_management_data();

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
          'id', r.id,
          'clubName', r.club_name,
          'managerName', r.manager_name,
          'eaId', r.ea_id,
          'rank', r.ea_rank,
          'name', r.player_name,
          'position', r.position,
          'positionLabel', r.position_label,
          'overall', r.overall,
          'weeklySalary', r.estimated_weekly_salary_eur,
          'salarySourceName', coalesce(r.salary_source_name, r.source_name),
          'salarySourceUrl', coalesce(r.salary_source_url, r.source_url),
          'salaryReferenceType', coalesce(r.salary_reference_type, 'public_club_payroll_reference'),
          'salaryCheckedAt', r.salary_checked_at,
          'sourceWeeklyPayroll', r.source_weekly_payroll_eur,
          'avatarUrl', r.avatar_url,
          'shieldUrl', r.shield_url,
          'nation', r.nation,
          'sourceName', r.source_name,
          'sourceUrl', r.source_url
        ) order by r.overall desc, r.ea_rank nulls last, r.player_name)
        from public.club_roster_players r
        where lower(r.club_name) = lower(mc.club_name)
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

grant execute on function public.app_get_squad_management_data(text, text) to anon, authenticated;

commit;
