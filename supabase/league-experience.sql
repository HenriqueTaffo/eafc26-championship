-- Pacote Liga+: ratings oficiais EA FC, diretoria, moral, oportunidades, leiloes e noticias.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro.
-- 3. Importe a base oficial da EA em ea_player_ratings usando CSV/JSON.
-- 4. Recarregue o app.
--
-- Fonte recomendada dos ratings:
-- https://www.ea.com/games/ea-sports-fc/ratings

create table if not exists public.ea_player_ratings (
  id bigserial primary key,
  ea_id text unique,
  rank integer,
  name text not null,
  normalized_name text generated always as (
    lower(regexp_replace(name, '\s+', ' ', 'g'))
  ) stored,
  nation text,
  club text,
  position text,
  overall integer,
  pace integer,
  shooting integer,
  passing integer,
  dribbling integer,
  defending integer,
  physical integer,
  source_url text not null default 'https://www.ea.com/games/ea-sports-fc/ratings',
  source_name text not null default 'EA SPORTS FC official ratings',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ea_player_ratings_name_idx
  on public.ea_player_ratings using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(club, '') || ' ' || coalesce(position, '')));

create index if not exists ea_player_ratings_overall_idx
  on public.ea_player_ratings (overall desc nulls last);

create table if not exists public.league_opportunities (
  id bigserial primary key,
  player_rating_id bigint references public.ea_player_ratings(id) on delete set null,
  title text not null,
  tag text not null default 'Scout recomenda',
  risk text not null default 'Boa oportunidade',
  suggested_value numeric not null default 0,
  expires_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.league_auto_auctions (
  id bigserial primary key,
  player_name text not null,
  trigger_reason text not null,
  current_value numeric not null default 0,
  status text not null default 'radar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_auto_news (
  id bigserial primary key,
  title text not null,
  body text not null,
  category text not null default 'Liga+',
  manager_name text,
  created_at timestamptz not null default now()
);

create or replace function public.app_upsert_ea_player_ratings(
  p_players jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
begin
  insert into public.ea_player_ratings (
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
    source_url,
    synced_at,
    updated_at
  )
  select
    nullif(player ->> 'ea_id', ''),
    nullif(player ->> 'rank', '')::integer,
    player ->> 'name',
    nullif(player ->> 'nation', ''),
    nullif(player ->> 'club', ''),
    nullif(player ->> 'position', ''),
    nullif(player ->> 'overall', '')::integer,
    nullif(player ->> 'pace', '')::integer,
    nullif(player ->> 'shooting', '')::integer,
    nullif(player ->> 'passing', '')::integer,
    nullif(player ->> 'dribbling', '')::integer,
    nullif(player ->> 'defending', '')::integer,
    nullif(player ->> 'physical', '')::integer,
    coalesce(nullif(player ->> 'source_url', ''), 'https://www.ea.com/games/ea-sports-fc/ratings'),
    now(),
    now()
  from jsonb_array_elements(coalesce(p_players, '[]'::jsonb)) as payload(player)
  where nullif(player ->> 'name', '') is not null
  on conflict (ea_id) do update
     set rank = excluded.rank,
         name = excluded.name,
         nation = excluded.nation,
         club = excluded.club,
         position = excluded.position,
         overall = excluded.overall,
         pace = excluded.pace,
         shooting = excluded.shooting,
         passing = excluded.passing,
         dribbling = excluded.dribbling,
         defending = excluded.defending,
         physical = excluded.physical,
         source_url = excluded.source_url,
         synced_at = now(),
         updated_at = now();

  get diagnostics v_count = row_count;

  return jsonb_build_object('ok', true, 'upserted', v_count);
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
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.overall desc nulls last, r.name), '[]'::jsonb)
  from (
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
      source_url,
      synced_at
    from public.ea_player_ratings
    where coalesce(trim(p_query), '') = ''
       or to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(club, '') || ' ' || coalesce(position, ''))
          @@ plainto_tsquery('simple', p_query)
       or lower(name) like '%' || lower(p_query) || '%'
       or lower(club) like '%' || lower(p_query) || '%'
    order by overall desc nulls last, name
    limit greatest(1, least(coalesce(p_limit, 12), 50))
  ) r;
$$;

create or replace function public.app_get_experience_data()
returns jsonb
language sql
stable
security definer
as $$
  select jsonb_build_object(
    'opportunities', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.created_at desc)
      from (
        select
          o.id,
          o.title,
          o.tag,
          o.risk,
          o.suggested_value,
          o.expires_at,
          o.status,
          o.created_at,
          r.name as player_name,
          r.club,
          r.position,
          r.overall
        from public.league_opportunities o
        left join public.ea_player_ratings r on r.id = o.player_rating_id
        where o.status = 'open'
        order by o.created_at desc
        limit 20
      ) o
    ), '[]'::jsonb),
    'auctions', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (
        select *
        from public.league_auto_auctions
        order by created_at desc
        limit 20
      ) a
    ), '[]'::jsonb),
    'news', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at desc)
      from (
        select *
        from public.league_auto_news
        order by created_at desc
        limit 20
      ) n
    ), '[]'::jsonb)
  );
$$;

create or replace function public.app_create_auto_auction(
  p_player_name text,
  p_buyer text,
  p_existing_owner text,
  p_overall integer,
  p_current_value numeric,
  p_reason text default 'Disputa de jogador'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id bigint;
begin
  if nullif(trim(p_player_name), '') is null then
    return jsonb_build_object('ok', false, 'message', 'Jogador obrigatorio para abrir leilao.');
  end if;

  insert into public.league_auto_auctions (
    player_name,
    trigger_reason,
    current_value,
    status
  ) values (
    trim(p_player_name),
    coalesce(nullif(trim(p_reason), ''), 'Disputa de jogador') || ' - ' || coalesce(p_existing_owner, 'dono atual') || ' x ' || coalesce(p_buyer, 'interessado') || ' - OVR ' || coalesce(p_overall::text, '-'),
    coalesce(p_current_value, 0),
    'open'
  )
  returning id into v_id;

  insert into public.league_auto_news (title, body, category, manager_name)
  values (
    'Leilao aberto: ' || trim(p_player_name),
    coalesce(p_existing_owner, 'Dono atual') || ' e ' || coalesce(p_buyer, 'interessado') || ' entram em disputa. O comissario pode definir prazo e lance minimo.',
    'Leilao',
    p_buyer
  );

  return jsonb_build_object('ok', true, 'auctionId', v_id, 'message', 'Leilao automatico registrado.');
end;
$$;

insert into public.league_auto_news (title, body, category)
select
  'Liga+ ativado',
  'A liga ganhou diretoria, reputacao, scout oficial EA FC, oportunidades, radar de leiloes e noticias automáticas.',
  'Sistema'
where not exists (
  select 1
  from public.league_auto_news
  where title = 'Liga+ ativado'
);
