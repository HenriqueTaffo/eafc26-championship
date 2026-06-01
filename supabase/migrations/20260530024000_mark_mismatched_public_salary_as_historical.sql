begin;

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
      case
        when sc.eligibility_mode = 'historical_public' then 'historical_public'
        when sc.club_lookup_key <> '' and sc.club_lookup_key <> mb.club_lookup_key then 'historical_public'
        else sc.eligibility_mode
      end as resolved_eligibility_mode,
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
    rs.resolved_eligibility_mode as salary_eligibility_mode,
    rs.source_name as salary_eligibility_source,
    rs.source_url as salary_eligibility_source_url,
    rs.candidate_source as salary_candidate_source,
    (
      not mb.has_official_duplicate
      and coalesce(mb.market_value_eur, 0) > 0
      and mb.canonical_transfermarkt_url ~* '^https?://[^\\s]*transfermarkt\\.'
      and coalesce(rs.weekly_salary_eur, 0) > 0
      and rs.resolved_eligibility_mode in ('current_public', 'historical_public')
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
      case
        when c.eligibility_mode = 'historical_public' then 'historical_public'
        when c.club_lookup_key <> '' and c.club_lookup_key <> (select club_lookup_key from inputs) then 'historical_public'
        else c.eligibility_mode
      end as resolved_eligibility_mode,
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
        'eligibilityMode', resolved_eligibility_mode
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

notify pgrst, 'reload schema';

commit;
