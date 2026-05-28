begin;

create or replace function public.app_search_text_key(p_value text)
returns text
language sql
immutable
as $$
  select lower(
    trim(
      extensions.unaccent(
        replace(replace(coalesce(p_value, ''), '’', ''), '''', '')
      )
    )
  );
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
      public.app_search_text_key(p_query) as query_key,
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
      public.app_rating_source_priority(source_name, source_url) as source_priority
    from public.ea_player_ratings
    cross join params
    where (coalesce(gender, '') = '' or lower(gender) not like '%women%')
      and lower(name) not in (
        'alexia putellas',
        'aitana bonmatã­',
        'caroline graham hansen',
        'alessia russo',
        'mariona',
        'patri guijarro',
        'khadija shaw',
        'mapi leã³n',
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
        'klara bã¼hl',
        'ona batlle',
        'lea schã¼ller',
        'melchie dumornay',
        'pernille harder'
      )
      and (
        params.query_text = ''
        or to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(club, '') || ' ' || coalesce(position, ''))
           @@ plainto_tsquery('simple', p_query)
        or lower(name) like '%' || lower(p_query) || '%'
        or lower(club) like '%' || lower(p_query) || '%'
        or public.app_search_text_key(name) like '%' || params.query_key || '%'
        or public.app_search_text_key(club) like '%' || params.query_key || '%'
        or public.app_search_text_key(position) like '%' || params.query_key || '%'
      )
  ),
  deduped as (
    select *
    from (
      select
        candidates.*,
        row_number() over (
          partition by
            lower(coalesce(name, '')),
            lower(coalesce(club, '')),
            lower(coalesce(position, ''))
          order by
            source_priority desc,
            synced_at desc nulls last,
            overall desc nulls last,
            id desc
        ) as rn
      from candidates
    ) ranked
    where rn = 1
    order by
      case
        when public.app_search_text_key(name) = (select query_key from params) then 0
        when public.app_search_text_key(club) = (select query_key from params) then 1
        else 2
      end,
      source_priority desc,
      overall desc nulls last,
      name
    limit (select result_limit from params)
  )
  select coalesce(
    jsonb_agg(to_jsonb(deduped) - 'rn' order by source_priority desc, overall desc nulls last, name),
    '[]'::jsonb
  )
  from deduped;
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
      lower(trim(coalesce(p_query, ''))) as query_text,
      public.app_search_text_key(p_query) as query_key,
      greatest(1, least(coalesce(p_limit, 12), 50)) as result_limit
  ),
  latest_movements as (
    select
      lower(trim(coalesce(t.player_key, t.player_name, ''))) as player_key,
      t.transfer_type,
      t.buyer_id,
      t.destination_club,
      row_number() over (
        partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
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
        where c.player_key = lower(trim(coalesce(p.normalized_name, p.name, '')))
      ) as is_contracted
    from public.players_market p
    cross join params
    left join current_market_state cms
      on cms.player_key = lower(trim(coalesce(p.normalized_name, p.name, '')))
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
        where coalesce(official.source, '') <> 'transferencias_existentes'
          and lower(trim(official.normalized_name)) = lower(trim(p.normalized_name))
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

grant execute on function public.app_search_text_key(text) to anon, authenticated;
grant execute on function public.app_search_ea_player_ratings(text, integer) to anon, authenticated;
grant execute on function public.app_search_market_players(text, boolean, integer) to anon, authenticated;

commit;
