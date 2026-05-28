begin;

update public.ea_player_ratings
   set source_name = 'FIFA Ratings normal FC ratings'
 where lower(coalesce(source_url, '')) like '%fifaratings.com%'
   and lower(coalesce(source_name, '')) like '%ea sports fc official ratings%';

create or replace function public.app_rating_source_priority(
  p_source_name text default '',
  p_source_url text default ''
)
returns integer
language sql
immutable
as $$
  select case
    when lower(coalesce(p_source_url, '')) like '%ea.com%' then 60
    when lower(coalesce(p_source_name, '')) like '%futbin%'
      or lower(coalesce(p_source_url, '')) like '%futbin.com%' then 50
    when lower(coalesce(p_source_name, '')) like '%official%'
      and lower(coalesce(p_source_url, '')) like '%sofifa.com%' then 45
    when (
      lower(coalesce(p_source_name, '')) like '%ea sports%'
      or lower(coalesce(p_source_name, '')) like '%official%'
    ) and lower(coalesce(p_source_url, '')) not like '%fifaratings.com%' then 40
    when lower(coalesce(p_source_name, '')) like '%sofifa%'
      or lower(coalesce(p_source_url, '')) like '%sofifa.com%' then 35
    when lower(coalesce(p_source_name, '')) like '%fifa ratings%'
      or lower(coalesce(p_source_url, '')) like '%fifaratings.com%' then 20
    else 10
  end;
$$;

create or replace function public.app_search_ea_player_ratings(
  p_query text default '',
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      trim(coalesce(p_query, '')) as query_text,
      public.app_salary_lookup_key(p_query) as query_key,
      greatest(1, least(coalesce(p_limit, 12), 50)) as result_limit
  ),
  candidates as (
    select
      id,
      ea_id,
      rank,
      name,
      nation,
      club,
      position,
      overall,
      pace,
      shooting,
      passing,
      dribbling,
      defending,
      physical,
      avatar_url,
      shield_url,
      card_type,
      gender,
      source_name,
      source_url,
      synced_at,
      public.app_rating_source_priority(source_name, source_url) as source_priority,
      public.app_salary_lookup_key(name) as name_lookup_key,
      public.app_salary_lookup_key(club) as club_lookup_key,
      public.app_salary_lookup_key(position) as position_lookup_key
    from public.ea_player_ratings
    cross join params
    where (coalesce(gender, '') = '' or lower(gender) not like '%women%')
      and lower(name) not in (
        'alexia putellas',
        'aitana bonmatí',
        'caroline graham hansen',
        'alessia russo',
        'mariona',
        'patri guijarro',
        'khadija shaw',
        'mapi león',
        'marie katoto',
        'kadidiatou diani',
        'sophia wilson',
        'guro reiten',
        'ewa pajor',
        'christiane endler',
        'debinha',
        'irene paredes',
        'chloe kelly',
        'lindsey heaps',
        'lucy bronze',
        'rose lavelle',
        'sakina karchaoui',
        'leah williamson',
        'beth mead',
        'mallory swanson',
        'ada hegerberg',
        'lauren hemp',
        'millie bright',
        'katie mccabe',
        'sam kerr',
        'ann-katrin berger',
        'grace geyoro',
        'claudia pina',
        'klara büehl',
        'ona batlle',
        'lea schüller',
        'melchie dumornay',
        'pernille harder'
      )
      and (
        params.query_text = ''
        or public.app_salary_lookup_key(name) like '%' || params.query_key || '%'
        or public.app_salary_lookup_key(club) like '%' || params.query_key || '%'
        or public.app_salary_lookup_key(position) like '%' || params.query_key || '%'
      )
  ),
  deduped as (
    select *
    from (
      select
        candidates.*,
        row_number() over (
          partition by
            coalesce(name_lookup_key, ''),
            coalesce(club_lookup_key, ''),
            coalesce(position_lookup_key, '')
          order by
            source_priority desc,
            synced_at desc nulls last,
            overall desc nulls last,
            id desc
        ) as rn
      from candidates
    ) ranked
    where rn = 1
  ),
  limited as (
    select
      deduped.*
    from deduped
    cross join params
    order by
      case
        when deduped.name_lookup_key = params.query_key then 0
        when deduped.club_lookup_key = params.query_key then 1
        when deduped.position_lookup_key = params.query_key then 2
        else 3
      end,
      source_priority desc,
      overall desc nulls last,
      name
    limit (select result_limit from params)
  )
  select coalesce(
    jsonb_agg(
      (
        to_jsonb(limited)
        - 'rn'
        - 'name_lookup_key'
        - 'club_lookup_key'
        - 'position_lookup_key'
      )
      order by source_priority desc, overall desc nulls last, name
    ),
    '[]'::jsonb
  )
  from limited;
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
set search_path = public
as $$
  with params as (
    select
      trim(coalesce(p_query, '')) as query_text,
      public.app_salary_lookup_key(p_query) as query_key,
      greatest(1, least(coalesce(p_limit, 12), 50)) as result_limit
  ),
  latest_movements as (
    select
      public.app_salary_lookup_key(coalesce(t.player_key, t.player_name, '')) as player_key,
      t.transfer_type,
      t.buyer_id,
      t.destination_club,
      row_number() over (
        partition by public.app_salary_lookup_key(coalesce(t.player_key, t.player_name, ''))
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
      p.*,
      public.app_salary_lookup_key(coalesce(p.normalized_name, p.name, '')) as player_lookup_key,
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
        where c.player_key = public.app_salary_lookup_key(coalesce(p.normalized_name, p.name, ''))
      ) as is_contracted
    from public.players_market p
    cross join params
    left join current_market_state cms
      on cms.player_key = public.app_salary_lookup_key(coalesce(p.normalized_name, p.name, ''))
    where (
      params.query_text = ''
      or public.app_salary_lookup_key(coalesce(p.name, '')) like '%' || params.query_key || '%'
      or public.app_salary_lookup_key(coalesce(p.normalized_name, '')) like '%' || params.query_key || '%'
      or public.app_salary_lookup_key(coalesce(p.club, '')) like '%' || params.query_key || '%'
      or public.app_salary_lookup_key(coalesce(cms.destination_club, '')) like '%' || params.query_key || '%'
      or public.app_salary_lookup_key(coalesce(p.league, '')) like '%' || params.query_key || '%'
      or public.app_salary_lookup_key(coalesce(p.country, '')) like '%' || params.query_key || '%'
      or public.app_salary_lookup_key(coalesce(p.position, '')) like '%' || params.query_key || '%'
    )
    and not (
      p.source = 'transferencias_existentes'
      and exists (
        select 1
        from public.players_market official
        where coalesce(official.source, '') <> 'transferencias_existentes'
          and public.app_salary_lookup_key(coalesce(official.normalized_name, official.name, '')) =
            public.app_salary_lookup_key(coalesce(p.normalized_name, p.name, ''))
      )
    )
  ),
  limited as (
    select *
    from filtered
    cross join params
    where p_show_contracted or not is_contracted
    order by
      case
        when filtered.player_lookup_key = params.query_key then 0
        when public.app_salary_lookup_key(coalesce(filtered.display_club, '')) = params.query_key then 1
        else 2
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
      'weeklySalary', (salary_quote.j ->> 'weeklySalary')::numeric,
      'salarySourceName', salary_quote.j ->> 'salarySourceName',
      'salarySourceUrl', salary_quote.j ->> 'salarySourceUrl',
      'salaryReferenceType', salary_quote.j ->> 'referenceType',
      'minimumRegulatorySalary', (salary_quote.j ->> 'minimumRegulatorySalary')::numeric,
      'alreadyContracted', l.is_contracted,
      'is_contracted', l.is_contracted
    )
    order by l.market_value_eur desc nulls last, l.name
  ), '[]'::jsonb)
  from limited l
  cross join lateral (
    select public.app_get_player_salary_quote(
      l.name,
      l.display_club,
      l.display_league,
      l.position,
      null,
      l.market_value_eur,
      l.age
    ) as j
  ) salary_quote;
$$;

grant execute on function public.app_rating_source_priority(text, text) to anon, authenticated;
grant execute on function public.app_search_ea_player_ratings(text, integer) to anon, authenticated;
grant execute on function public.app_search_market_players(text, boolean, integer) to anon, authenticated;

commit;
