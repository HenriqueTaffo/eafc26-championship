-- Speed up the market-eligibility projection by switching its lookup keys to
-- the immutable app_search_text_key helper and indexing the underlying joins.

begin;

create index if not exists players_market_catalog_lookup_idx
  on public.players_market (
    public.app_search_text_key(coalesce(normalized_name, name, ''))
  );

create index if not exists players_market_catalog_source_lookup_idx
  on public.players_market (
    coalesce(source, ''),
    public.app_search_text_key(coalesce(normalized_name, name, ''))
  );

create index if not exists player_salary_references_catalog_lookup_idx
  on public.player_salary_references (
    public.app_search_text_key(player_name),
    public.app_search_text_key(coalesce(club_name, ''))
  );

create index if not exists club_roster_players_catalog_lookup_idx
  on public.club_roster_players (
    public.app_search_text_key(player_name),
    public.app_search_text_key(club_name)
  );

create index if not exists transfers_salary_history_catalog_lookup_idx
  on public.transfers (
    public.app_search_text_key(coalesce(player_name, '')),
    public.app_search_text_key(coalesce(player_key, '')),
    public.app_search_text_key(coalesce(from_club, ''))
  );

create or replace view public.v_player_salary_reference_candidates as
  select
    'player_salary_references'::text as candidate_source,
    r.id::bigint as candidate_id,
    public.app_search_text_key(trim(r.player_name)) as player_lookup_key,
    public.app_search_text_key(coalesce(trim(r.club_name), '')) as club_lookup_key,
    trim(r.player_name) as player_name,
    trim(coalesce(r.club_name, '')) as club_name,
    r.weekly_salary_eur,
    trim(r.source_name) as source_name,
    trim(r.source_url) as source_url,
    r.source_checked_at as salary_checked_at,
    coalesce(
      r.reference_type,
      public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')
    ) as reference_type,
    'current_public'::text as eligibility_mode,
    10 as source_priority
  from public.player_salary_references r
  where public.app_public_salary_reference_is_valid(
      r.weekly_salary_eur,
      r.source_name,
      r.source_url
    )
    and coalesce(
      r.reference_type,
      public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')
    ) <> 'regulatory_estimate'

  union all

  select
    'club_roster_players'::text as candidate_source,
    r.id::bigint as candidate_id,
    public.app_search_text_key(trim(r.player_name)) as player_lookup_key,
    public.app_search_text_key(coalesce(trim(r.club_name), '')) as club_lookup_key,
    trim(r.player_name) as player_name,
    trim(coalesce(r.club_name, '')) as club_name,
    r.estimated_weekly_salary_eur as weekly_salary_eur,
    trim(coalesce(r.salary_source_name, r.source_name)) as source_name,
    trim(coalesce(r.salary_source_url, r.source_url)) as source_url,
    coalesce(r.salary_checked_at, r.updated_at) as salary_checked_at,
    coalesce(r.salary_reference_type, 'public_club_payroll_reference') as reference_type,
    'current_public'::text as eligibility_mode,
    20 as source_priority
  from public.club_roster_players r
  where public.app_public_salary_reference_is_valid(
      r.estimated_weekly_salary_eur,
      coalesce(r.salary_source_name, r.source_name),
      coalesce(r.salary_source_url, r.source_url)
    )
    and coalesce(r.salary_reference_type, 'public_club_payroll_reference') <> 'regulatory_estimate'

  union all

  select
    'transfers'::text as candidate_source,
    t.id::bigint as candidate_id,
    public.app_search_text_key(trim(coalesce(t.player_name, ''))) as player_lookup_key,
    public.app_search_text_key(coalesce(trim(t.from_club), '')) as club_lookup_key,
    trim(coalesce(t.player_name, '')) as player_name,
    trim(coalesce(t.from_club, '')) as club_name,
    t.weekly_salary_eur,
    trim(coalesce(t.salary_source_name, '')) as source_name,
    trim(coalesce(t.salary_source_url, '')) as source_url,
    coalesce(t.salary_checked_at, t.updated_at, t.created_at) as salary_checked_at,
    coalesce(
      t.salary_reference_type,
      public.app_salary_reference_type(
        t.salary_source_name,
        t.salary_source_url,
        'public_other'
      )
    ) as reference_type,
    'historical_public'::text as eligibility_mode,
    30 as source_priority
  from public.transfers t
  where public.app_public_salary_reference_is_valid(
      t.weekly_salary_eur,
      t.salary_source_name,
      t.salary_source_url
    )
    and coalesce(
      t.salary_reference_type,
      public.app_salary_reference_type(
        t.salary_source_name,
        t.salary_source_url,
        'public_other'
      )
    ) <> 'regulatory_estimate'
    and lower(trim(coalesce(t.status, ''))) not in ('rejected', 'rejeitado', 'recusado')
    and trim(coalesce(t.player_name, '')) <> ''

  union all

  select
    'transfers_player_key'::text as candidate_source,
    t.id::bigint as candidate_id,
    public.app_search_text_key(trim(coalesce(t.player_key, ''))) as player_lookup_key,
    public.app_search_text_key(coalesce(trim(t.from_club), '')) as club_lookup_key,
    trim(coalesce(t.player_name, '')) as player_name,
    trim(coalesce(t.from_club, '')) as club_name,
    t.weekly_salary_eur,
    trim(coalesce(t.salary_source_name, '')) as source_name,
    trim(coalesce(t.salary_source_url, '')) as source_url,
    coalesce(t.salary_checked_at, t.updated_at, t.created_at) as salary_checked_at,
    coalesce(
      t.salary_reference_type,
      public.app_salary_reference_type(
        t.salary_source_name,
        t.salary_source_url,
        'public_other'
      )
    ) as reference_type,
    'historical_public'::text as eligibility_mode,
    31 as source_priority
  from public.transfers t
  where public.app_public_salary_reference_is_valid(
      t.weekly_salary_eur,
      t.salary_source_name,
      t.salary_source_url
    )
    and coalesce(
      t.salary_reference_type,
      public.app_salary_reference_type(
        t.salary_source_name,
        t.salary_source_url,
        'public_other'
      )
    ) <> 'regulatory_estimate'
    and lower(trim(coalesce(t.status, ''))) not in ('rejected', 'rejeitado', 'recusado')
    and trim(coalesce(t.player_key, '')) <> ''
    and public.app_search_text_key(trim(coalesce(t.player_key, ''))) <>
      public.app_search_text_key(trim(coalesce(t.player_name, '')));

create or replace view public.v_market_player_eligibility as
  with market_base as (
    select
      p.*,
      public.app_search_text_key(coalesce(p.normalized_name, p.name, '')) as player_lookup_key,
      public.app_search_text_key(coalesce(p.club, '')) as club_lookup_key,
      trim(coalesce(p.transfermarkt_url, '')) as canonical_transfermarkt_url,
      exists (
        select 1
        from public.players_market official
        where official.id <> p.id
          and coalesce(official.source, '') <> 'transferencias_existentes'
          and public.app_search_text_key(
            coalesce(official.normalized_name, official.name, '')
          ) = public.app_search_text_key(coalesce(p.normalized_name, p.name, ''))
      ) as has_official_duplicate
    from public.players_market p
  ),
  ranked_salary as (
    select
      mb.id as market_player_id,
      sc.weekly_salary_eur,
      sc.source_name,
      sc.source_url,
      sc.salary_checked_at,
      sc.reference_type,
      sc.eligibility_mode,
      sc.candidate_source,
      sc.candidate_id,
      row_number() over (
        partition by mb.id
        order by
          sc.source_priority,
          case
            when sc.club_lookup_key <> '' and sc.club_lookup_key = mb.club_lookup_key then 0
            when sc.club_lookup_key = '' then 1
            else 2
          end,
          sc.salary_checked_at desc nulls last,
          sc.candidate_id desc
      ) as rn
    from market_base mb
    left join public.v_player_salary_reference_candidates sc
      on sc.player_lookup_key = mb.player_lookup_key
  )
  select
    mb.id,
    mb.name,
    mb.normalized_name,
    mb.club,
    mb.league,
    mb.country,
    mb.position,
    mb.age,
    mb.market_value_eur,
    mb.transfermarkt_url,
    mb.avatar_url,
    mb.source,
    mb.last_synced_at,
    mb.player_lookup_key,
    mb.club_lookup_key,
    mb.has_official_duplicate,
    (
      (coalesce(mb.market_value_eur, 0) > 0)
      and mb.canonical_transfermarkt_url ~* '^https?://[^\\s]*transfermarkt\\.'
    ) as transfermarkt_verified,
    rs.weekly_salary_eur,
    rs.source_name as salary_source_name,
    rs.source_url as salary_source_url,
    rs.salary_checked_at,
    rs.reference_type as salary_reference_type,
    rs.eligibility_mode as salary_eligibility_mode,
    rs.source_name as salary_eligibility_source,
    rs.source_url as salary_eligibility_source_url,
    rs.candidate_source as salary_candidate_source,
    (
      not mb.has_official_duplicate
      and coalesce(mb.market_value_eur, 0) > 0
      and mb.canonical_transfermarkt_url ~* '^https?://[^\\s]*transfermarkt\\.'
      and coalesce(rs.weekly_salary_eur, 0) > 0
      and rs.eligibility_mode in ('current_public', 'historical_public')
    ) as catalog_eligible,
    case
      when mb.has_official_duplicate then 'duplicate_legacy'
      when coalesce(mb.market_value_eur, 0) <= 0 then 'missing_value'
      when not (mb.canonical_transfermarkt_url ~* '^https?://[^\\s]*transfermarkt\\.') then 'missing_transfermarkt_url'
      when coalesce(rs.weekly_salary_eur, 0) <= 0 then 'missing_public'
      else null
    end as ineligibility_reason
  from market_base mb
  left join ranked_salary rs
    on rs.market_player_id = mb.id
   and rs.rn = 1;

create or replace function public.app_get_player_salary_quote(
  p_player_name text,
  p_club_name text default '',
  p_league text default '',
  p_position text default '',
  p_overall integer default null,
  p_market_value numeric default null,
  p_age integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with inputs as (
    select
      trim(coalesce(p_player_name, '')) as player_name,
      trim(coalesce(p_club_name, '')) as club_name,
      public.app_search_text_key(p_player_name) as player_lookup_key,
      public.app_search_text_key(p_club_name) as club_lookup_key
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        order by
          c.source_priority,
          case
            when c.club_lookup_key <> '' and c.club_lookup_key = (select club_lookup_key from inputs) then 0
            when c.club_lookup_key = '' then 1
            else 2
          end,
          c.salary_checked_at desc nulls last,
          c.candidate_id desc
      ) as rn
    from public.v_player_salary_reference_candidates c
    cross join inputs i
    where c.player_lookup_key = i.player_lookup_key
  )
  select coalesce(
    (
      select jsonb_build_object(
        'ok', true,
        'playerName', coalesce(nullif(player_name, ''), (select player_name from inputs)),
        'clubName', coalesce(nullif(club_name, ''), (select club_name from inputs)),
        'weeklySalary', weekly_salary_eur,
        'salarySourceName', source_name,
        'salarySourceUrl', source_url,
        'salaryCheckedAt', salary_checked_at,
        'referenceType', reference_type,
        'eligibilityMode', eligibility_mode
      )
      from ranked
      where rn = 1
    ),
    jsonb_build_object(
      'ok', false,
      'playerName', trim(coalesce(p_player_name, '')),
      'clubName', trim(coalesce(p_club_name, '')),
      'eligibilityMode', 'missing_public',
      'message', 'Salario publico pendente para este jogador. Sincronize uma fonte publica atual antes de negociar.'
    )
  );
$$;

create or replace function public.app_get_public_player_salary(
  p_player_name text,
  p_club_name text default ''
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.app_get_player_salary_quote(p_player_name, p_club_name, '', '', null, null, null);
$$;

create or replace function public.app_get_public_salary_references()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      c.*,
      row_number() over (
        partition by c.player_lookup_key, c.club_lookup_key
        order by
          c.source_priority,
          c.salary_checked_at desc nulls last,
          c.candidate_id desc
      ) as rn
    from public.v_player_salary_reference_candidates c
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'playerName', player_name,
        'clubName', club_name,
        'weeklySalary', weekly_salary_eur,
        'salarySourceName', source_name,
        'salarySourceUrl', source_url,
        'salaryCheckedAt', salary_checked_at,
        'referenceType', reference_type,
        'eligibilityMode', eligibility_mode
      )
      order by player_name, club_name
    ),
    '[]'::jsonb
  )
  from ranked
  where rn = 1;
$$;

create or replace function public.app_search_market_players(
  p_query text default '',
  p_show_contracted boolean default false,
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with params as (
    select
      lower(trim(coalesce(p_query, ''))) as query_text,
      public.app_search_text_key(p_query) as query_key,
      greatest(1, least(coalesce(p_limit, 12), 50)) as result_limit
  ),
  latest_movements as (
    select
      public.app_search_text_key(coalesce(t.player_key, t.player_name, '')) as player_key,
      t.transfer_type,
      t.buyer_id,
      t.destination_club,
      row_number() over (
        partition by public.app_search_text_key(coalesce(t.player_key, t.player_name, ''))
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    where lower(trim(coalesce(t.status, ''))) in ('approved', 'aprovado')
      and coalesce(t.player_key, t.player_name, '') <> ''
  ),
  current_market_state as (
    select *
    from latest_movements
    where rn = 1
  ),
  contracted_names as (
    select cms.player_key
    from current_market_state cms
    join public.managers m on m.id = cms.buyer_id
    where lower(trim(coalesce(cms.transfer_type, 'market'))) <> 'cpu_sale'
  ),
  filtered as (
    select
      e.*,
      case
        when lower(trim(coalesce(cms.transfer_type, ''))) = 'cpu_sale'
          and nullif(trim(coalesce(cms.destination_club, '')), '') is not null
          then trim(cms.destination_club)
        else e.club
      end as display_club,
      case
        when lower(trim(coalesce(cms.transfer_type, ''))) = 'cpu_sale'
          and nullif(trim(coalesce(cms.destination_club, '')), '') is not null
          then 'Mercado externo'
        else e.league
      end as display_league,
      exists (
        select 1
        from contracted_names c
        where c.player_key = e.player_lookup_key
      ) as is_contracted
    from public.v_market_player_eligibility e
    cross join params
    left join current_market_state cms
      on cms.player_key = e.player_lookup_key
    where e.catalog_eligible
      and (
        params.query_text = ''
        or lower(coalesce(e.name, '')) like '%' || params.query_text || '%'
        or lower(coalesce(e.normalized_name, '')) like '%' || params.query_text || '%'
        or lower(coalesce(e.club, '')) like '%' || params.query_text || '%'
        or lower(coalesce(cms.destination_club, '')) like '%' || params.query_text || '%'
        or lower(coalesce(e.league, '')) like '%' || params.query_text || '%'
        or lower(coalesce(e.country, '')) like '%' || params.query_text || '%'
        or lower(coalesce(e.position, '')) like '%' || params.query_text || '%'
        or public.app_search_text_key(coalesce(e.name, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(e.normalized_name, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(e.club, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(cms.destination_club, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(e.league, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(e.country, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(e.position, '')) like '%' || params.query_key || '%'
      )
  ),
  limited as (
    select *
    from filtered
    cross join params
    where p_show_contracted or not is_contracted
    order by
      case
        when public.app_search_text_key(coalesce(name, '')) = params.query_key then 0
        when public.app_search_text_key(coalesce(display_club, '')) = params.query_key then 1
        when lower(coalesce(name, '')) = params.query_text then 2
        else 3
      end,
      market_value_eur desc nulls last,
      name
    limit (select result_limit from params)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'club', l.display_club,
      'original_club', l.club,
      'league', l.display_league,
      'country', l.country,
      'position', l.position,
      'age', l.age,
      'market_value_eur', l.market_value_eur,
      'transfermarkt_url', l.transfermarkt_url,
      'avatar_url', l.avatar_url,
      'source', l.source,
      'last_synced_at', l.last_synced_at,
      'weeklySalary', l.weekly_salary_eur,
      'salarySourceName', l.salary_source_name,
      'salarySourceUrl', l.salary_source_url,
      'salaryReferenceType', l.salary_reference_type,
      'salaryCheckedAt', l.salary_checked_at,
      'eligibilityMode', l.salary_eligibility_mode,
      'transfermarktVerified', l.transfermarkt_verified,
      'salaryEligibilityMode', l.salary_eligibility_mode,
      'salaryEligibilitySource', l.salary_eligibility_source,
      'minimumRegulatorySalary', null,
      'alreadyContracted', l.is_contracted,
      'is_contracted', l.is_contracted
    )
    order by l.market_value_eur desc nulls last, l.name
  ), '[]'::jsonb)
  from limited l;
$$;

notify pgrst, 'reload schema';

commit;
