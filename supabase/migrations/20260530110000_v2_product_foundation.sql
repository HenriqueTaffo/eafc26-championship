create schema if not exists platform;
create schema if not exists sport;
create schema if not exists market;
create schema if not exists commercial;
create schema if not exists ops;
create schema if not exists audit;

create table if not exists platform.organizations (
  id text primary key,
  slug text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform.leagues (
  id text primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  slug text not null,
  display_name text not null,
  legacy_competition_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists platform.seasons (
  id text primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  slug text not null,
  display_name text not null,
  starts_at date,
  ends_at date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, slug)
);

create table if not exists platform.managers (
  id bigint generated always as identity primary key,
  legacy_manager_id text not null unique,
  display_name text not null,
  club_name text not null default '',
  is_commissioner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform.memberships (
  id bigint generated always as identity primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  season_id text not null references platform.seasons(id) on delete cascade,
  manager_id bigint not null references platform.managers(id) on delete cascade,
  role text not null check (role in ('manager', 'commissioner')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, manager_id, role)
);

create table if not exists platform.pin_credentials (
  manager_id bigint primary key references platform.managers(id) on delete cascade,
  legacy_manager_id text not null unique,
  pin_hash text,
  pin_version integer not null default 1,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform.scoped_sessions (
  session_token text primary key,
  legacy_session_token text not null unique,
  manager_id bigint not null references platform.managers(id) on delete cascade,
  membership_id bigint not null references platform.memberships(id) on delete cascade,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  season_id text not null references platform.seasons(id) on delete cascade,
  role text not null check (role in ('manager', 'commissioner')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_scoped_sessions_manager_idx
  on platform.scoped_sessions (manager_id, expires_at desc);

create table if not exists sport.club_identities (
  id bigint generated always as identity primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  legacy_owner_manager_id text,
  legacy_club_name text not null,
  canonical_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_club_name)
);

create table if not exists sport.season_results (
  id bigint generated always as identity primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  season_id text not null references platform.seasons(id) on delete cascade,
  legacy_result_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists market.player_identities (
  id bigint generated always as identity primary key,
  normalized_name text not null,
  display_name text not null,
  transfermarkt_url text,
  current_club_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name, current_club_name)
);

create table if not exists market.valuation_snapshots (
  id bigint generated always as identity primary key,
  player_identity_id bigint not null references market.player_identities(id) on delete cascade,
  amount_eur numeric(14, 2),
  source text not null check (source in ('transfermarkt', 'manual_override')),
  source_url text,
  as_of date,
  override_flag boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists market.rating_snapshots (
  id bigint generated always as identity primary key,
  player_identity_id bigint not null references market.player_identities(id) on delete cascade,
  overall integer,
  source text not null check (source in ('ea_ratings', 'manual_override')),
  source_url text,
  as_of date,
  override_flag boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists market.salary_references_v2 (
  id bigint generated always as identity primary key,
  player_identity_id bigint not null references market.player_identities(id) on delete cascade,
  weekly_salary_eur numeric(14, 2),
  source text not null check (source in ('capology', 'salarysport', 'mlspa', 'manual_override')),
  source_url text,
  as_of date,
  override_flag boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists market.manual_overrides (
  id bigint generated always as identity primary key,
  player_identity_id bigint not null references market.player_identities(id) on delete cascade,
  field_name text not null check (field_name in ('market_value', 'overall', 'salary')),
  override_value text not null,
  reason text not null default '',
  source_url text,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists commercial.finance_ledger_v2 (
  id bigint generated always as identity primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  season_id text not null references platform.seasons(id) on delete cascade,
  manager_id bigint references platform.managers(id) on delete set null,
  entry_type text not null,
  amount_eur numeric(14, 2) not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists commercial.sponsorship_contracts_v2 (
  id bigint generated always as identity primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  season_id text not null references platform.seasons(id) on delete cascade,
  manager_id bigint references platform.managers(id) on delete set null,
  contract_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ops.notifications_v2 (
  id bigint generated always as identity primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  season_id text not null references platform.seasons(id) on delete cascade,
  manager_id bigint references platform.managers(id) on delete set null,
  channel text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ops.medical_cases_v2 (
  id bigint generated always as identity primary key,
  organization_id text not null references platform.organizations(id) on delete cascade,
  league_id text not null references platform.leagues(id) on delete cascade,
  season_id text not null references platform.seasons(id) on delete cascade,
  manager_id bigint references platform.managers(id) on delete set null,
  player_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit.import_runs (
  id bigint generated always as identity primary key,
  source text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists audit.reconciliation_events (
  id bigint generated always as identity primary key,
  source text not null,
  entity_type text not null,
  entity_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit.domain_events (
  id bigint generated always as identity primary key,
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into platform.organizations (id, slug, display_name)
values ('org-4linhas', '4linhas', '4 Linhas')
on conflict (id) do update
set slug = excluded.slug,
    display_name = excluded.display_name,
    updated_at = now();

insert into platform.leagues (id, organization_id, slug, display_name, legacy_competition_key)
values (
  'league-championship',
  'org-4linhas',
  'championship',
  'Championship Managers Hub',
  'championship'
)
on conflict (id) do update
set display_name = excluded.display_name,
    legacy_competition_key = excluded.legacy_competition_key,
    updated_at = now();

insert into platform.seasons (
  id,
  organization_id,
  league_id,
  slug,
  display_name,
  starts_at,
  is_active
)
values (
  'season-2026-championship',
  'org-4linhas',
  'league-championship',
  '2026-championship',
  'Temporada 2026',
  date '2026-05-26',
  true
)
on conflict (id) do update
set display_name = excluded.display_name,
    starts_at = excluded.starts_at,
    is_active = excluded.is_active,
    updated_at = now();

insert into platform.managers (
  legacy_manager_id,
  display_name,
  club_name,
  is_commissioner
)
select
  m.id,
  m.display_name,
  coalesce(m.club, ''),
  false
from public.managers m
on conflict (legacy_manager_id) do update
set display_name = excluded.display_name,
    club_name = excluded.club_name,
    updated_at = now();

insert into platform.managers (
  legacy_manager_id,
  display_name,
  club_name,
  is_commissioner
)
values ('comissario', 'Comissário da Liga', 'Governança da Liga', true)
on conflict (legacy_manager_id) do update
set display_name = excluded.display_name,
    club_name = excluded.club_name,
    is_commissioner = true,
    updated_at = now();

insert into platform.memberships (
  organization_id,
  league_id,
  season_id,
  manager_id,
  role
)
select
  'org-4linhas',
  'league-championship',
  'season-2026-championship',
  pm.id,
  case when pm.is_commissioner then 'commissioner' else 'manager' end
from platform.managers pm
on conflict (season_id, manager_id, role) do update
set status = 'active',
    updated_at = now();

create or replace view platform.v_current_legacy_scope as
select
  o.id as organization_id,
  o.display_name as organization_name,
  l.id as league_id,
  l.display_name as league_name,
  s.id as season_id,
  s.display_name as season_name
from platform.organizations o
join platform.leagues l on l.organization_id = o.id
join platform.seasons s on s.league_id = l.id
where o.id = 'org-4linhas'
  and l.id = 'league-championship'
  and s.id = 'season-2026-championship';

create or replace function public.app_create_manager_scoped_session(
  p_manager_name text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, platform
as $$
declare
  v_base jsonb;
  v_manager_id text;
  v_manager_name text;
  v_club_name text;
  v_is_commissioner boolean;
  v_platform_manager_id bigint;
  v_membership_id bigint;
  v_membership_role text;
begin
  v_base := public.app_create_manager_session(p_manager_name, p_access_code);

  if coalesce((v_base ->> 'ok')::boolean, false) is false then
    return v_base;
  end if;

  v_manager_id := coalesce(v_base #>> '{manager,id}', '');
  v_manager_name := coalesce(v_base #>> '{manager,name}', trim(p_manager_name));
  v_club_name := coalesce(v_base #>> '{manager,club}', '');
  v_is_commissioner := coalesce((v_base #>> '{manager,isCommissioner}')::boolean, false);

  if v_manager_id = '' then
    return jsonb_build_object('ok', false, 'message', 'Sessão sem managerId.');
  end if;

  insert into platform.managers (
    legacy_manager_id,
    display_name,
    club_name,
    is_commissioner
  )
  values (
    v_manager_id,
    v_manager_name,
    v_club_name,
    v_is_commissioner
  )
  on conflict (legacy_manager_id) do update
  set display_name = excluded.display_name,
      club_name = excluded.club_name,
      is_commissioner = excluded.is_commissioner,
      updated_at = now()
  returning id into v_platform_manager_id;

  if v_platform_manager_id is null then
    select id
      into v_platform_manager_id
    from platform.managers
    where legacy_manager_id = v_manager_id;
  end if;

  insert into platform.memberships (
    organization_id,
    league_id,
    season_id,
    manager_id,
    role
  )
  values (
    'org-4linhas',
    'league-championship',
    'season-2026-championship',
    v_platform_manager_id,
    case when v_is_commissioner then 'commissioner' else 'manager' end
  )
  on conflict (season_id, manager_id, role) do update
  set status = 'active',
      updated_at = now()
  returning id, role into v_membership_id, v_membership_role;

  if v_membership_id is null then
    select id, role
      into v_membership_id, v_membership_role
    from platform.memberships
    where season_id = 'season-2026-championship'
      and manager_id = v_platform_manager_id
    order by case when role = 'commissioner' then 0 else 1 end
    limit 1;
  end if;

  insert into platform.scoped_sessions (
    session_token,
    legacy_session_token,
    manager_id,
    membership_id,
    organization_id,
    league_id,
    season_id,
    role,
    expires_at
  )
  values (
    coalesce(v_base ->> 'sessionToken', ''),
    coalesce(v_base ->> 'sessionToken', ''),
    v_platform_manager_id,
    v_membership_id,
    'org-4linhas',
    'league-championship',
    'season-2026-championship',
    coalesce(v_membership_role, case when v_is_commissioner then 'commissioner' else 'manager' end),
    coalesce((v_base ->> 'expiresAt')::timestamptz, now() + interval '12 hours')
  )
  on conflict (session_token) do update
  set membership_id = excluded.membership_id,
      manager_id = excluded.manager_id,
      organization_id = excluded.organization_id,
      league_id = excluded.league_id,
      season_id = excluded.season_id,
      role = excluded.role,
      expires_at = excluded.expires_at,
      revoked_at = null,
      updated_at = now();

  return v_base || jsonb_build_object(
    'scope', jsonb_build_object(
      'organizationId', 'org-4linhas',
      'organizationName', '4 Linhas',
      'leagueId', 'league-championship',
      'leagueName', 'Championship Managers Hub',
      'seasonId', 'season-2026-championship',
      'seasonName', 'Temporada 2026',
      'membershipRole', coalesce(v_membership_role, case when v_is_commissioner then 'commissioner' else 'manager' end)
    )
  );
end;
$$;

grant usage on schema platform, sport, market, commercial, ops, audit to anon, authenticated;
grant select on platform.v_current_legacy_scope to anon, authenticated;
grant execute on function public.app_create_manager_scoped_session(text, text) to anon, authenticated;
