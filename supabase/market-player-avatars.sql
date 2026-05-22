-- Add persistent headshots for players imported into the market database.
alter table public.players_market
  add column if not exists avatar_url text;

create index if not exists players_market_avatar_url_idx
  on public.players_market (avatar_url)
  where avatar_url is not null;

create or replace function public.app_search_market_players(
  p_query text default '',
  p_show_contracted boolean default false,
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
as $$
  with params as (
    select
      lower(trim(coalesce(p_query, ''))) as query_text,
      greatest(1, least(coalesce(p_limit, 12), 50)) as result_limit
  ),
  contracted_names as (
    select lower(trim(coalesce(t."Jogador", ''))) as player_name
    from jsonb_to_recordset(coalesce(public.app_get_data()::jsonb -> 'transfers', '[]'::jsonb)) as t(
      "Jogador" text,
      "Status" text
    )
    where lower(trim(coalesce(t."Status", ''))) in ('aprovado', 'approved')
  ),
  filtered as (
    select
      p.*,
      exists (
        select 1
        from contracted_names c
        where c.player_name = lower(trim(coalesce(p.name, '')))
      ) as is_contracted
    from public.players_market p
    cross join params
    where (
      params.query_text = ''
      or lower(coalesce(p.name, '')) like '%' || params.query_text || '%'
      or lower(coalesce(p.normalized_name, '')) like '%' || params.query_text || '%'
      or lower(coalesce(p.club, '')) like '%' || params.query_text || '%'
      or lower(coalesce(p.league, '')) like '%' || params.query_text || '%'
      or lower(coalesce(p.country, '')) like '%' || params.query_text || '%'
      or lower(coalesce(p.position, '')) like '%' || params.query_text || '%'
    )
  ),
  limited as (
    select *
    from filtered
    where p_show_contracted or not is_contracted
    order by
      case when lower(coalesce(name, '')) = (select query_text from params) then 0 else 1 end,
      market_value_eur desc nulls last,
      name
    limit (select result_limit from params)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'club', club,
      'league', league,
      'country', country,
      'position', position,
      'age', age,
      'market_value_eur', market_value_eur,
      'transfermarkt_url', transfermarkt_url,
      'avatar_url', avatar_url,
      'source', source,
      'last_synced_at', last_synced_at,
      'alreadyContracted', is_contracted,
      'is_contracted', is_contracted
    )
    order by market_value_eur desc nulls last, name
  ), '[]'::jsonb)
  from limited;
$$;

grant execute on function public.app_search_market_players(text, boolean, integer) to anon, authenticated;
