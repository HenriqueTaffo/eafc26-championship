begin;

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
    and lower(trim(coalesce(r.source_name, ''))) not like '%estimativa regulatoria%'
    and lower(trim(coalesce(r.source_url, ''))) not like '%salary-regulatory-model%'

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
    and lower(trim(coalesce(r.salary_source_name, r.source_name, ''))) not like '%estimativa regulatoria%'
    and lower(trim(coalesce(r.salary_source_url, r.source_url, ''))) not like '%salary-regulatory-model%'

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
    and lower(trim(coalesce(t.salary_source_name, ''))) not like '%estimativa regulatoria%'
    and lower(trim(coalesce(t.salary_source_url, ''))) not like '%salary-regulatory-model%'
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
    and lower(trim(coalesce(t.salary_source_name, ''))) not like '%estimativa regulatoria%'
    and lower(trim(coalesce(t.salary_source_url, ''))) not like '%salary-regulatory-model%'
    and lower(trim(coalesce(t.status, ''))) not in ('rejected', 'rejeitado', 'recusado')
    and trim(coalesce(t.player_key, '')) <> ''
    and public.app_search_text_key(trim(coalesce(t.player_key, ''))) <>
      public.app_search_text_key(trim(coalesce(t.player_name, '')));

notify pgrst, 'reload schema';

commit;
