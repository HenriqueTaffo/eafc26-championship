-- Corrige duplicidade de jogadores no mercado apos venda externa - 24/05/2026.
-- A base antiga "transferencias_existentes" servia como fallback antes da
-- importacao oficial. Quando a linha oficial existe, ela deve prevalecer.

delete from public.players_market legacy
using public.players_market official
where legacy.source = 'transferencias_existentes'
  and coalesce(official.source, '') <> 'transferencias_existentes'
  and lower(trim(official.normalized_name)) = lower(trim(legacy.normalized_name));

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
  latest_movements as (
    select
      lower(trim(coalesce(t.player_key, t.player_name, ''))) as player_key,
      t.transfer_type,
      t.buyer_id,
      row_number() over (
        partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    where lower(trim(coalesce(t.status, ''))) in ('approved', 'aprovado')
      and coalesce(t.player_key, t.player_name, '') <> ''
  ),
  contracted_names as (
    select lm.player_key
    from latest_movements lm
    join public.managers m on m.id = lm.buyer_id
    where lm.rn = 1
      and lower(trim(coalesce(lm.transfer_type, 'market'))) <> 'cpu_sale'
  ),
  filtered as (
    select
      p.*,
      exists (
        select 1
        from contracted_names c
        where c.player_key = lower(trim(coalesce(p.normalized_name, p.name, '')))
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
