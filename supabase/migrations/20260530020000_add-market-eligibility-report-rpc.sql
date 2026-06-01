begin;

create or replace function public.app_get_market_eligibility_page(
  p_limit integer default 500,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with page as (
    select
      id,
      name,
      normalized_name,
      club,
      league,
      country,
      position,
      age,
      market_value_eur,
      transfermarkt_url,
      source,
      last_synced_at,
      transfermarkt_verified,
      weekly_salary_eur,
      salary_source_name,
      salary_source_url,
      salary_checked_at,
      salary_reference_type,
      salary_eligibility_mode,
      salary_eligibility_source,
      catalog_eligible,
      ineligibility_reason,
      has_official_duplicate
    from public.v_market_player_eligibility
    order by id asc
    limit greatest(1, least(coalesce(p_limit, 500), 1000))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'normalized_name', normalized_name,
        'club', club,
        'league', league,
        'country', country,
        'position', position,
        'age', age,
        'market_value_eur', market_value_eur,
        'transfermarkt_url', transfermarkt_url,
        'source', source,
        'last_synced_at', last_synced_at,
        'transfermarkt_verified', transfermarkt_verified,
        'weekly_salary_eur', weekly_salary_eur,
        'salary_source_name', salary_source_name,
        'salary_source_url', salary_source_url,
        'salary_checked_at', salary_checked_at,
        'salary_reference_type', salary_reference_type,
        'salary_eligibility_mode', salary_eligibility_mode,
        'salary_eligibility_source', salary_eligibility_source,
        'catalog_eligible', catalog_eligible,
        'ineligibility_reason', ineligibility_reason,
        'has_official_duplicate', has_official_duplicate
      )
      order by id
    ),
    '[]'::jsonb
  )
  from page;
$$;

grant execute on function public.app_get_market_eligibility_page(integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
