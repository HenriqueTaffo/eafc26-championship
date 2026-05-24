-- Prioriza ratings FUTBIN quando a base for importada.
-- A tabela continua com o nome ea_player_ratings por compatibilidade do app.

create or replace function public.app_search_ea_player_ratings(
  p_query text default '',
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
as $$
  with candidates as (
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
      case
        when lower(coalesce(source_name, '')) like '%futbin%' then 50
        when lower(coalesce(source_name, '')) like '%ea sports%' then 40
        when lower(coalesce(source_name, '')) like '%official%' then 40
        when lower(coalesce(source_name, '')) like '%sofifa%' then 30
        when lower(coalesce(source_name, '')) like '%fifa ratings%' then 20
        else 10
      end as source_priority
    from public.ea_player_ratings
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
        'klara bühl',
        'ona batlle',
        'lea schüller',
        'melchie dumornay',
        'pernille harder'
      )
      and (
        coalesce(trim(p_query), '') = ''
        or to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(club, '') || ' ' || coalesce(position, ''))
           @@ plainto_tsquery('simple', p_query)
        or lower(name) like '%' || lower(p_query) || '%'
        or lower(club) like '%' || lower(p_query) || '%'
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
    order by source_priority desc, overall desc nulls last, name
    limit greatest(1, least(coalesce(p_limit, 12), 50))
  )
  select coalesce(
    jsonb_agg(to_jsonb(deduped) - 'rn' order by source_priority desc, overall desc nulls last, name),
    '[]'::jsonb
  )
  from deduped;
$$;

grant execute on function public.app_search_ea_player_ratings(text, integer) to anon, authenticated;
