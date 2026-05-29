begin;

create or replace function public.app_market_catalog_meta()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'leagues',
    coalesce(
      (
        select jsonb_agg(league order by league)
        from (
          select distinct trim(coalesce(p.league, '')) as league
          from public.players_market p
          where trim(coalesce(p.league, '')) <> ''
        ) leagues
      ),
      '[]'::jsonb
    ),
    'positions',
    coalesce(
      (
        select jsonb_agg(position order by position)
        from (
          select distinct trim(coalesce(p.position, '')) as position
          from public.players_market p
          where trim(coalesce(p.position, '')) <> ''
        ) positions
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.app_market_catalog_meta() to anon, authenticated;

commit;
