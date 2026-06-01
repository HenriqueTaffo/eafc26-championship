begin;

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
  filtered_market as (
    select
      p.id,
      p.name,
      p.normalized_name,
      p.club,
      p.league,
      p.country,
      p.position,
      p.age,
      p.market_value_eur,
      p.transfermarkt_url,
      p.avatar_url,
      p.source,
      p.last_synced_at,
      public.app_search_text_key(coalesce(p.normalized_name, p.name, '')) as player_lookup_key,
      public.app_search_text_key(coalesce(p.club, '')) as club_lookup_key,
      case
        when lower(trim(coalesce(cms.transfer_type, ''))) = 'cpu_sale'
          and nullif(trim(coalesce(cms.destination_club, '')), '') is not null
          then trim(cms.destination_club)
        else p.club
      end as display_club,
      case
        when lower(trim(coalesce(cms.transfer_type, ''))) = 'cpu_sale'
          and nullif(trim(coalesce(cms.destination_club, '')), '') is not null
          then 'Mercado externo'
        else p.league
      end as display_league,
      exists (
        select 1
        from contracted_names c
        where c.player_key = public.app_search_text_key(coalesce(p.normalized_name, p.name, ''))
      ) as is_contracted
    from public.players_market p
    cross join params
    left join current_market_state cms
      on cms.player_key = public.app_search_text_key(coalesce(p.normalized_name, p.name, ''))
    where (
        params.query_text = ''
        or lower(coalesce(p.name, '')) like '%' || params.query_text || '%'
        or lower(coalesce(p.normalized_name, '')) like '%' || params.query_text || '%'
        or lower(coalesce(p.club, '')) like '%' || params.query_text || '%'
        or lower(coalesce(cms.destination_club, '')) like '%' || params.query_text || '%'
        or lower(coalesce(p.league, '')) like '%' || params.query_text || '%'
        or lower(coalesce(p.country, '')) like '%' || params.query_text || '%'
        or lower(coalesce(p.position, '')) like '%' || params.query_text || '%'
        or public.app_search_text_key(coalesce(p.name, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(p.normalized_name, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(p.club, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(cms.destination_club, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(p.league, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(p.country, '')) like '%' || params.query_key || '%'
        or public.app_search_text_key(coalesce(p.position, '')) like '%' || params.query_key || '%'
      )
      and not (
        p.source = 'transferencias_existentes'
        and exists (
          select 1
          from public.players_market official
          where official.id <> p.id
            and coalesce(official.source, '') <> 'transferencias_existentes'
            and public.app_search_text_key(
              coalesce(official.normalized_name, official.name, '')
            ) = public.app_search_text_key(coalesce(p.normalized_name, p.name, ''))
        )
      )
  ),
  ranked_salary as (
    select
      fm.id as market_player_id,
      c.weekly_salary_eur,
      c.source_name,
      c.source_url,
      c.salary_checked_at,
      c.reference_type,
      c.eligibility_mode,
      row_number() over (
        partition by fm.id
        order by
          c.source_priority,
          case
            when c.club_lookup_key <> '' and c.club_lookup_key = fm.club_lookup_key then 0
            when c.club_lookup_key = '' then 1
            else 2
          end,
          c.salary_checked_at desc nulls last,
          c.candidate_id desc
      ) as rn
    from filtered_market fm
    left join public.v_player_salary_reference_candidates c
      on c.player_lookup_key = fm.player_lookup_key
  ),
  eligible as (
    select
      fm.*,
      rs.weekly_salary_eur,
      rs.source_name as salary_source_name,
      rs.source_url as salary_source_url,
      rs.salary_checked_at,
      rs.reference_type as salary_reference_type,
      rs.eligibility_mode as salary_eligibility_mode,
      (
        coalesce(fm.market_value_eur, 0) > 0
        and trim(coalesce(fm.transfermarkt_url, '')) ~* '^https?://.*transfermarkt[.]'
      ) as transfermarkt_verified
    from filtered_market fm
    left join ranked_salary rs
      on rs.market_player_id = fm.id
     and rs.rn = 1
    where coalesce(fm.market_value_eur, 0) > 0
      and trim(coalesce(fm.transfermarkt_url, '')) ~* '^https?://.*transfermarkt[.]'
      and coalesce(rs.weekly_salary_eur, 0) > 0
      and rs.eligibility_mode in ('current_public', 'historical_public')
  ),
  limited as (
    select *
    from eligible
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
      'salaryEligibilitySource', l.salary_source_name,
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
