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
      and mb.canonical_transfermarkt_url ~* '^https?://.*transfermarkt[.]'
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
      and mb.canonical_transfermarkt_url ~* '^https?://.*transfermarkt[.]'
      and coalesce(rs.weekly_salary_eur, 0) > 0
      and rs.eligibility_mode in ('current_public', 'historical_public')
    ) as catalog_eligible,
    case
      when mb.has_official_duplicate then 'duplicate_legacy'
      when coalesce(mb.market_value_eur, 0) <= 0 then 'missing_value'
      when not (mb.canonical_transfermarkt_url ~* '^https?://.*transfermarkt[.]') then 'missing_transfermarkt_url'
      when coalesce(rs.weekly_salary_eur, 0) <= 0 then 'missing_public'
      else null
    end as ineligibility_reason
  from market_base mb
  left join ranked_salary rs
    on rs.market_player_id = mb.id
   and rs.rn = 1;

notify pgrst, 'reload schema';

commit;
