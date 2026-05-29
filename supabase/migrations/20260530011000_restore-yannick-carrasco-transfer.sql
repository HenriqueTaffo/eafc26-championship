-- Restore Yannick Carrasco after the external-market cleanup left Henrique's
-- approved signing without a ledger row.

begin;

delete from public.players_market pm
where lower(trim(pm.normalized_name)) = 'carrasco'
  and lower(coalesce(pm.source, '')) = 'transferencias_existentes'
  and exists (
    select 1
    from public.players_market canonical
    where lower(trim(canonical.normalized_name)) = 'yannick carrasco'
      and canonical.market_value_eur = pm.market_value_eur
  );

insert into public.transfers (
  buyer_id,
  player_name,
  from_club,
  overall,
  market_value,
  overall_rate,
  negotiated_value,
  weekly_salary_eur,
  salary_source_name,
  salary_source_url,
  salary_reference_type,
  salary_checked_at,
  status,
  reason,
  transfer_type,
  created_at,
  updated_at
)
select
  'henrique',
  'Yannick Carrasco',
  'Al-Shabab Club',
  81,
  6000000,
  0.15,
  6900000,
  121500,
  'Estimativa regulatoria da liga',
  'https://henriquetaffo.github.io/eafc26-championship/#salary-regulatory-model',
  'regulatory_estimate',
  now(),
  'approved',
  'Restored after missing approved signing report.',
  'market',
  timestamp with time zone '2026-05-27 12:00:00-03',
  now()
where exists (
    select 1
    from public.managers m
    where m.id = 'henrique'
  )
  and not exists (
    select 1
    from public.transfers t
    where lower(trim(t.player_name)) in ('yannick carrasco', 'carrasco')
      and t.buyer_id = 'henrique'
      and coalesce(t.status, '') = 'approved'
      and coalesce(t.transfer_type, 'market') <> 'cpu_sale'
  );

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
      lower(trim(coalesce(t.player_key, t.player_name, ''))) as player_key,
      t.transfer_type,
      t.buyer_id,
      t.destination_club,
      t.overall,
      t.weekly_salary_eur,
      t.salary_source_name,
      t.salary_source_url,
      t.salary_reference_type,
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
      ) as is_contracted,
      cms.overall as movement_overall,
      cms.weekly_salary_eur as movement_weekly_salary_eur,
      cms.salary_source_name as movement_salary_source_name,
      cms.salary_source_url as movement_salary_source_url,
      cms.salary_reference_type as movement_salary_reference_type
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
      'weeklySalary', coalesce(
        nullif(l.movement_weekly_salary_eur, 0),
        (salary_quote.j ->> 'weeklySalary')::numeric
      ),
      'salarySourceName', coalesce(
        nullif(l.movement_salary_source_name, ''),
        salary_quote.j ->> 'salarySourceName'
      ),
      'salarySourceUrl', coalesce(
        nullif(l.movement_salary_source_url, ''),
        salary_quote.j ->> 'salarySourceUrl'
      ),
      'salaryReferenceType', coalesce(
        nullif(l.movement_salary_reference_type, ''),
        salary_quote.j ->> 'referenceType'
      ),
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
      l.movement_overall,
      l.market_value_eur,
      l.age
    ) as j
  ) salary_quote;
$$;

notify pgrst, 'reload schema';

commit;
