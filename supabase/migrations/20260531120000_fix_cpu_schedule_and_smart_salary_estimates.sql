begin;

create index if not exists players_market_top_value_idx
  on public.players_market (market_value_eur desc nulls last, name)
  where market_value_eur > 0
    and transfermarkt_url is not null;

create index if not exists ea_player_ratings_search_lookup_idx
  on public.ea_player_ratings (
    public.app_search_text_key(name),
    public.app_search_text_key(coalesce(club, '')),
    overall desc nulls last
  );

create or replace function public.app_transfermarkt_player_key(
  p_url text
)
returns text
language sql
immutable
as $$
  select nullif(substring(coalesce(p_url, '') from '/spieler/([0-9]+)'), '');
$$;

create or replace function public.app_calculate_smart_weekly_salary(
  p_player_name text default '',
  p_club_name text default '',
  p_league text default '',
  p_position text default '',
  p_overall integer default null,
  p_market_value numeric default null,
  p_age integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_player text := trim(coalesce(p_player_name, ''));
  v_name_key text := public.app_search_text_key(p_player_name);
  v_club text := public.app_search_text_key(p_club_name);
  v_league text := public.app_search_text_key(p_league);
  v_position text := upper(trim(coalesce(p_position, '')));
  v_overall integer := greatest(0, coalesce(p_overall, 0));
  v_market_value numeric := greatest(0, coalesce(p_market_value, 0));
  v_age integer := coalesce(p_age, 0);
  v_league_floor numeric := 8000;
  v_league_factor numeric := 1.00;
  v_club_floor numeric := 0;
  v_club_factor numeric := 1.00;
  v_position_factor numeric := 1.00;
  v_age_factor numeric := 1.00;
  v_market_rate numeric := 0.026;
  v_market_weekly numeric := 0;
  v_overall_weekly numeric := 0;
  v_star_floor numeric := 0;
  v_media_floor numeric := 0;
  v_salary numeric := 0;
begin
  if v_player = '' then
    return jsonb_build_object('ok', false, 'message', 'Jogador nao informado.');
  end if;

  if v_league in ('premier league', 'premier-league', 'laliga', 'serie a', 'serie-a', 'bundesliga', 'ligue 1', 'ligue-1') then
    v_league_floor := 38000;
    v_league_factor := 1.22;
  elsif v_league in ('saudi pro league', 'saudi-pro-league') then
    v_league_floor := 90000;
    v_league_factor := 1.45;
  elsif v_league in ('major league soccer', 'major-league-soccer') then
    v_league_floor := 30000;
    v_league_factor := 1.08;
  elsif v_league in ('eredivisie', 'liga portugal', 'liga-portugal', 'super lig', 'super-lig') then
    v_league_floor := 23000;
    v_league_factor := 0.98;
  elsif v_league in ('jupiler pro league', 'jupiler-pro-league', 'scottish premiership', 'scottish-premiership', 'campeonato brasileiro serie a', 'argentina primera division') then
    v_league_floor := 15000;
    v_league_factor := 0.86;
  elsif v_league in ('championship', 'base atual da liga') then
    v_league_floor := 9500;
    v_league_factor := 0.76;
  end if;

  if v_club ~ '(al nassr|al hilal|al ittihad|al ahli)' then
    v_club_floor := 190000;
    v_club_factor := 1.48;
  elsif v_club ~ '(real madrid|barcelona|manchester city|manchester united|liverpool|arsenal|chelsea|tottenham|paris saint|psg|bayern|juventus|inter|internazionale|milan|atletico madrid)' then
    v_club_floor := 125000;
    v_club_factor := 1.36;
  elsif v_club ~ '(borussia dortmund|bayer leverkusen|rb leipzig|leipzig|napoli|roma|lazio|ajax|psv|feyenoord|benfica|porto|sporting|fenerbahce|galatasaray|besiktas|sevilla|valencia|real sociedad|athletic)' then
    v_club_floor := 85000;
    v_club_factor := 1.15;
  end if;

  v_position_factor := case
    when v_position in ('ST', 'CF', 'LW', 'RW', 'CAM') then 1.10
    when v_position in ('CM', 'CDM', 'LM', 'RM') then 1.03
    when v_position in ('GK') then 0.97
    else 1.00
  end;

  v_age_factor := case
    when v_age between 24 and 31 then 1.08
    when v_age between 32 and 34 then 1.02
    when v_age >= 35 then 0.96
    when v_age between 18 and 21 then 0.86
    else 1.00
  end;

  v_market_rate := case
    when v_market_value >= 120000000 then 0.090
    when v_market_value >= 80000000 then 0.080
    when v_market_value >= 50000000 then 0.070
    when v_market_value >= 25000000 then 0.058
    when v_market_value >= 10000000 then 0.048
    when v_market_value >= 5000000 then 0.040
    when v_market_value >= 1000000 then 0.032
    else 0.024
  end;

  v_market_weekly := round((v_market_value * v_market_rate) / 52);

  v_overall_weekly := case
    when v_overall >= 91 then 460000
    when v_overall >= 89 then 355000
    when v_overall >= 87 then 270000
    when v_overall >= 85 then 190000
    when v_overall >= 83 then 140000
    when v_overall >= 81 then 100000
    when v_overall >= 79 then 74000
    when v_overall >= 76 then 50000
    when v_overall >= 73 then 33000
    when v_overall >= 70 then 23000
    when v_overall >= 66 then 15000
    when v_overall > 0 then 9500
    else 0
  end;

  v_star_floor := case
    when v_overall >= 91 then 420000
    when v_overall >= 89 then 320000
    when v_overall >= 87 then 245000
    when v_overall >= 85 then 170000
    when v_overall >= 83 then 125000
    when v_overall >= 81 then 90000
    when v_overall >= 79 then 70000
    else 0
  end;

  v_media_floor := case
    when v_name_key ~ '(^|[^a-z])(lionel messi|cristiano ronaldo|neymar|kylian mbappe|erling haaland)([^a-z]|$)' then 360000
    when v_name_key ~ '(^|[^a-z])(vinicius junior|vini jr|jude bellingham|mohamed salah|kevin de bruyne|harry kane|robert lewandowski|antoine griezmann|luka modric|heung min son|karim benzema)([^a-z]|$)' then 240000
    when v_overall >= 87 and v_market_value >= 25000000 then 220000
    when v_overall >= 85 and v_market_value >= 15000000 then 160000
    else 0
  end;

  v_salary := greatest(
    v_league_floor,
    v_club_floor,
    v_market_weekly,
    v_star_floor,
    v_media_floor,
    round(v_overall_weekly * v_league_factor * v_club_factor * v_position_factor * v_age_factor)
  );

  v_salary := greatest(1500, ceil(v_salary / 1000) * 1000);

  return jsonb_build_object(
    'ok', true,
    'playerName', v_player,
    'clubName', trim(coalesce(p_club_name, '')),
    'weeklySalary', v_salary,
    'salarySourceName', 'Estimativa inteligente da liga',
    'salarySourceUrl', 'https://henriquetaffo.github.io/eafc26-championship/#salary-smart-estimate-v20260531',
    'salaryCheckedAt', now(),
    'referenceType', 'league_smart_estimate',
    'eligibilityMode', 'league_estimate',
    'salaryRuleVersion', '2026-05-31-v1',
    'explanation', 'Estimativa usada apenas quando nao ha referencia publica: combina liga, clube, valor de mercado, overall, idade, posicao e impacto midiatico.'
  );
end;
$$;

create or replace function public.app_get_player_salary_quote(
  p_player_name text,
  p_club_name text default '',
  p_league text default '',
  p_position text default '',
  p_overall integer default null,
  p_market_value numeric default null,
  p_age integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with inputs as (
    select
      trim(coalesce(p_player_name, '')) as player_name,
      trim(coalesce(p_club_name, '')) as club_name,
      public.app_search_text_key(p_player_name) as player_lookup_key,
      public.app_search_text_key(p_club_name) as club_lookup_key
  ),
  market_ref as (
    select
      p.club,
      p.league,
      p.position,
      p.age,
      p.market_value_eur
    from public.players_market p
    cross join inputs i
    where public.app_search_text_key(coalesce(p.normalized_name, p.name, '')) = i.player_lookup_key
      and (
        i.club_lookup_key = ''
        or public.app_search_text_key(coalesce(p.club, '')) = i.club_lookup_key
      )
    order by
      case when public.app_search_text_key(coalesce(p.club, '')) = (select club_lookup_key from inputs) then 0 else 1 end,
      p.market_value_eur desc nulls last,
      p.id desc
    limit 1
  ),
  rating_ref as (
    select
      r.overall,
      r.club,
      r.position
    from public.ea_player_ratings r
    cross join inputs i
    where public.app_search_text_key(r.name) = i.player_lookup_key
      and (
        i.club_lookup_key = ''
        or public.app_search_text_key(coalesce(r.club, '')) = i.club_lookup_key
      )
    order by
      case when public.app_search_text_key(coalesce(r.club, '')) = (select club_lookup_key from inputs) then 0 else 1 end,
      public.app_rating_source_priority(r.source_name, r.source_url) desc,
      r.overall desc nulls last,
      r.updated_at desc nulls last,
      r.id desc
    limit 1
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        order by
          c.source_priority,
          case
            when c.club_lookup_key <> '' and c.club_lookup_key = (select club_lookup_key from inputs) then 0
            when c.club_lookup_key = '' then 1
            else 2
          end,
          c.salary_checked_at desc nulls last,
          c.candidate_id desc
      ) as rn
    from public.v_player_salary_reference_candidates c
    cross join inputs i
    where c.player_lookup_key = i.player_lookup_key
  ),
  estimate as (
    select public.app_calculate_smart_weekly_salary(
      (select player_name from inputs),
      coalesce(nullif((select club_name from inputs), ''), (select club from market_ref), (select club from rating_ref), ''),
      coalesce(nullif(p_league, ''), (select league from market_ref), ''),
      coalesce(nullif(p_position, ''), (select position from rating_ref), (select position from market_ref), ''),
      coalesce(nullif(p_overall, 0), (select overall from rating_ref), null),
      coalesce(p_market_value, (select market_value_eur from market_ref), 0),
      coalesce(p_age, (select age from market_ref), null)
    ) as j
  )
  select coalesce(
    (
      select jsonb_build_object(
        'ok', true,
        'playerName', coalesce(nullif(player_name, ''), (select player_name from inputs)),
        'clubName', coalesce(nullif(club_name, ''), (select club_name from inputs)),
        'weeklySalary', weekly_salary_eur,
        'salarySourceName', source_name,
        'salarySourceUrl', source_url,
        'salaryCheckedAt', salary_checked_at,
        'referenceType', reference_type,
        'eligibilityMode', eligibility_mode
      )
      from ranked
      where rn = 1
    ),
    (select j from estimate)
  );
$$;

create or replace function public.app_get_public_player_salary(
  p_player_name text,
  p_club_name text default ''
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.app_get_player_salary_quote(p_player_name, p_club_name, '', '', null, null, null);
$$;

create or replace view public.v_market_player_eligibility as
  with market_base as (
    select
      p.*,
      public.app_search_text_key(coalesce(p.normalized_name, p.name, '')) as player_lookup_key,
      public.app_search_text_key(coalesce(p.club, '')) as club_lookup_key,
      trim(coalesce(p.transfermarkt_url, '')) as canonical_transfermarkt_url,
      exists (
        select 1
        from public.players_market official
        where official.id <> p.id
          and coalesce(official.source, '') <> 'transferencias_existentes'
          and public.app_search_text_key(
            coalesce(official.normalized_name, official.name, '')
          ) = public.app_search_text_key(coalesce(p.normalized_name, p.name, ''))
      ) as has_official_duplicate
    from public.players_market p
  ),
  ranked_salary as (
    select
      mb.id as market_player_id,
      sc.weekly_salary_eur,
      sc.source_name,
      sc.source_url,
      sc.salary_checked_at,
      sc.reference_type,
      case
        when sc.eligibility_mode = 'historical_public' then 'historical_public'
        when sc.club_lookup_key <> '' and sc.club_lookup_key <> mb.club_lookup_key then 'historical_public'
        else sc.eligibility_mode
      end as resolved_eligibility_mode,
      sc.candidate_source,
      sc.candidate_id,
      row_number() over (
        partition by mb.id
        order by
          sc.source_priority,
          case
            when sc.club_lookup_key <> '' and sc.club_lookup_key = mb.club_lookup_key then 0
            when sc.club_lookup_key = '' then 1
            else 2
          end,
          sc.salary_checked_at desc nulls last,
          sc.candidate_id desc
      ) as rn
    from market_base mb
    left join public.v_player_salary_reference_candidates sc
      on sc.player_lookup_key = mb.player_lookup_key
  ),
  rated_market as (
    select
      mb.*,
      rating.overall as rating_overall,
      rating.position as rating_position,
      estimate.j as estimate_json
    from market_base mb
    left join lateral (
      select r.overall, r.position
      from public.ea_player_ratings r
      where public.app_search_text_key(r.name) = mb.player_lookup_key
        and (
          mb.club_lookup_key = ''
          or public.app_search_text_key(coalesce(r.club, '')) = mb.club_lookup_key
        )
      order by
        case when public.app_search_text_key(coalesce(r.club, '')) = mb.club_lookup_key then 0 else 1 end,
        public.app_rating_source_priority(r.source_name, r.source_url) desc,
        r.overall desc nulls last,
        r.updated_at desc nulls last,
        r.id desc
      limit 1
    ) rating on true
    left join lateral (
      select public.app_calculate_smart_weekly_salary(
        mb.name,
        mb.club,
        mb.league,
        coalesce(rating.position, mb.position),
        rating.overall,
        mb.market_value_eur,
        mb.age
      ) as j
    ) estimate on true
  )
  select
    mb.id,
    mb.name,
    mb.normalized_name,
    mb.club,
    mb.league,
    mb.country,
    mb.position,
    mb.age,
    mb.market_value_eur,
    mb.transfermarkt_url,
    mb.avatar_url,
    mb.source,
    mb.last_synced_at,
    mb.player_lookup_key,
    mb.club_lookup_key,
    mb.has_official_duplicate,
    (
      (coalesce(mb.market_value_eur, 0) > 0)
      and mb.canonical_transfermarkt_url ~* '^https?://.*transfermarkt[.]'
    ) as transfermarkt_verified,
    coalesce(rs.weekly_salary_eur, nullif((mb.estimate_json ->> 'weeklySalary')::numeric, 0)) as weekly_salary_eur,
    coalesce(rs.source_name, mb.estimate_json ->> 'salarySourceName') as salary_source_name,
    coalesce(rs.source_url, mb.estimate_json ->> 'salarySourceUrl') as salary_source_url,
    coalesce(rs.salary_checked_at, (mb.estimate_json ->> 'salaryCheckedAt')::timestamptz) as salary_checked_at,
    coalesce(rs.reference_type, mb.estimate_json ->> 'referenceType') as salary_reference_type,
    coalesce(rs.resolved_eligibility_mode, mb.estimate_json ->> 'eligibilityMode') as salary_eligibility_mode,
    coalesce(rs.source_name, mb.estimate_json ->> 'salarySourceName') as salary_eligibility_source,
    coalesce(rs.source_url, mb.estimate_json ->> 'salarySourceUrl') as salary_eligibility_source_url,
    coalesce(rs.candidate_source, 'smart_estimate') as salary_candidate_source,
    (
      not mb.has_official_duplicate
      and coalesce(mb.market_value_eur, 0) > 0
      and mb.canonical_transfermarkt_url ~* '^https?://.*transfermarkt[.]'
      and coalesce(rs.weekly_salary_eur, nullif((mb.estimate_json ->> 'weeklySalary')::numeric, 0), 0) > 0
    ) as catalog_eligible,
    case
      when mb.has_official_duplicate then 'duplicate_legacy'
      when coalesce(mb.market_value_eur, 0) <= 0 then 'missing_value'
      when not (mb.canonical_transfermarkt_url ~* '^https?://.*transfermarkt[.]') then 'missing_transfermarkt_url'
      when coalesce(rs.weekly_salary_eur, nullif((mb.estimate_json ->> 'weeklySalary')::numeric, 0), 0) <= 0 then 'missing_salary_estimate'
      else null
    end as ineligibility_reason
  from rated_market mb
  left join ranked_salary rs
    on rs.market_player_id = mb.id
   and rs.rn = 1;

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
  seed_players as (
    select query_pick.*
    from (
      select p.*
      from public.players_market p
      cross join params
      where params.query_text <> ''
        and (
          lower(coalesce(p.name, '')) like '%' || params.query_text || '%'
          or lower(coalesce(p.normalized_name, '')) like '%' || params.query_text || '%'
          or lower(coalesce(p.club, '')) like '%' || params.query_text || '%'
          or lower(coalesce(p.league, '')) like '%' || params.query_text || '%'
          or lower(coalesce(p.country, '')) like '%' || params.query_text || '%'
          or lower(coalesce(p.position, '')) like '%' || params.query_text || '%'
          or public.app_search_text_key(coalesce(p.name, '')) like '%' || params.query_key || '%'
          or public.app_search_text_key(coalesce(p.normalized_name, '')) like '%' || params.query_key || '%'
          or public.app_search_text_key(coalesce(p.club, '')) like '%' || params.query_key || '%'
        )
      order by
        case
          when coalesce(p.source, '') = 'transfermarkt_profile_sync' then 100
          when coalesce(p.source, '') = 'dcaribou_transfermarkt_datasets' and coalesce(p.market_value_eur, 0) > 0 then 80
          when trim(coalesce(p.transfermarkt_url, '')) ~* '^https?://.*transfermarkt[.]' and coalesce(p.market_value_eur, 0) > 0 then 70
          when coalesce(p.market_value_eur, 0) > 0 then 50
          else 10
        end desc,
        p.market_value_eur desc nulls last,
        p.name
      limit (select greatest(result_limit * 40, 800) from params)
    ) query_pick
  ),
  candidate_source as (
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
      coalesce(
        'tm:' || public.app_transfermarkt_player_key(p.transfermarkt_url),
        public.app_search_text_key(coalesce(p.normalized_name, p.name, '')) || '|' || public.app_search_text_key(coalesce(p.club, ''))
      ) as market_identity_key,
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
      ) as is_contracted,
      case
        when coalesce(p.source, '') = 'transfermarkt_profile_sync' then 100
        when coalesce(p.source, '') = 'dcaribou_transfermarkt_datasets' and coalesce(p.market_value_eur, 0) > 0 then 80
        when trim(coalesce(p.transfermarkt_url, '')) ~* '^https?://.*transfermarkt[.]' and coalesce(p.market_value_eur, 0) > 0 then 70
        when coalesce(p.market_value_eur, 0) > 0 then 50
        else 10
      end as source_rank,
      case
        when public.app_search_text_key(coalesce(p.name, '')) = params.query_key then 0
        when public.app_search_text_key(coalesce(
          case
            when lower(trim(coalesce(cms.transfer_type, ''))) = 'cpu_sale'
              and nullif(trim(coalesce(cms.destination_club, '')), '') is not null
              then trim(cms.destination_club)
            else p.club
          end,
          ''
        )) = params.query_key then 1
        when lower(coalesce(p.name, '')) = params.query_text then 2
        else 3
      end as search_rank
    from seed_players p
    cross join params
    left join current_market_state cms
      on cms.player_key = public.app_search_text_key(coalesce(p.normalized_name, p.name, ''))
  ),
  raw_candidates as (
    select cs.*
    from candidate_source cs
    cross join params
    order by
      cs.search_rank,
      cs.source_rank desc,
      cs.market_value_eur desc nulls last,
      cs.name
    limit (
      select case
        when query_text = '' then greatest(result_limit * 12, 120)
        else greatest(result_limit * 40, 800)
      end
      from params
    )
  ),
  filtered_raw as (
    select rc.*
    from raw_candidates rc
    where not (
        rc.source = 'transferencias_existentes'
        and exists (
          select 1
          from public.players_market official
          where official.id <> rc.id
            and coalesce(official.source, '') <> 'transferencias_existentes'
            and public.app_search_text_key(
              coalesce(official.normalized_name, official.name, '')
            ) = rc.player_lookup_key
        )
      )
  ),
  filtered_market as (
    select *
    from (
      select
        fr.*,
        row_number() over (
          partition by fr.market_identity_key
          order by
            fr.source_rank desc,
            fr.market_value_eur desc nulls last,
            fr.last_synced_at desc nulls last,
            fr.id desc
        ) as rn
      from filtered_raw fr
    ) deduped
    where rn = 1
  ),
  candidate_pool as (
    select
      fm.*
    from filtered_market fm
    cross join params
    where p_show_contracted or not fm.is_contracted
    order by
      case
        when public.app_search_text_key(coalesce(fm.name, '')) = params.query_key then 0
        when public.app_search_text_key(coalesce(fm.display_club, '')) = params.query_key then 1
        when lower(coalesce(fm.name, '')) = params.query_text then 2
        else 3
      end,
      fm.source_rank desc,
      fm.market_value_eur desc nulls last,
      fm.name
    limit (
      select case
        when query_text = '' then greatest(result_limit * 2, 40)
        else greatest(result_limit * 12, 120)
      end
      from params
    )
  ),
  ranked_salary as (
    select
      cp.id as market_player_id,
      c.weekly_salary_eur,
      c.source_name,
      c.source_url,
      c.salary_checked_at,
      c.reference_type,
      case
        when c.eligibility_mode = 'historical_public' then 'historical_public'
        when c.club_lookup_key <> '' and c.club_lookup_key <> cp.club_lookup_key then 'historical_public'
        else c.eligibility_mode
      end as resolved_eligibility_mode,
      row_number() over (
        partition by cp.id
        order by
          c.source_priority,
          case
            when c.club_lookup_key <> '' and c.club_lookup_key = cp.club_lookup_key then 0
            when c.club_lookup_key = '' then 1
            else 2
          end,
          c.salary_checked_at desc nulls last,
          c.candidate_id desc
      ) as rn
    from candidate_pool cp
    left join public.v_player_salary_reference_candidates c
      on c.player_lookup_key = cp.player_lookup_key
  ),
  rated_pool as (
    select
      cp.*,
      rating.overall as rating_overall,
      rating.position as rating_position,
      estimate.j as estimate_json
    from candidate_pool cp
    left join lateral (
      select r.overall, r.position
      from public.ea_player_ratings r
      where public.app_search_text_key(r.name) = cp.player_lookup_key
        and (
          cp.club_lookup_key = ''
          or public.app_search_text_key(coalesce(r.club, '')) = cp.club_lookup_key
        )
      order by
        case when public.app_search_text_key(coalesce(r.club, '')) = cp.club_lookup_key then 0 else 1 end,
        public.app_rating_source_priority(r.source_name, r.source_url) desc,
        r.overall desc nulls last,
        r.updated_at desc nulls last,
        r.id desc
      limit 1
    ) rating on true
    left join lateral (
      select public.app_calculate_smart_weekly_salary(
        cp.name,
        cp.club,
        cp.league,
        coalesce(rating.position, cp.position),
        rating.overall,
        cp.market_value_eur,
        cp.age
      ) as j
    ) estimate on true
  ),
  eligible as (
    select
      rp.*,
      coalesce(rs.weekly_salary_eur, nullif((rp.estimate_json ->> 'weeklySalary')::numeric, 0)) as weekly_salary_eur,
      coalesce(rs.source_name, rp.estimate_json ->> 'salarySourceName') as salary_source_name,
      coalesce(rs.source_url, rp.estimate_json ->> 'salarySourceUrl') as salary_source_url,
      coalesce(rs.salary_checked_at, (rp.estimate_json ->> 'salaryCheckedAt')::timestamptz) as salary_checked_at,
      coalesce(rs.reference_type, rp.estimate_json ->> 'referenceType') as salary_reference_type,
      coalesce(rs.resolved_eligibility_mode, rp.estimate_json ->> 'eligibilityMode') as salary_eligibility_mode,
      (
        coalesce(rp.market_value_eur, 0) > 0
        and trim(coalesce(rp.transfermarkt_url, '')) ~* '^https?://.*transfermarkt[.]'
      ) as transfermarkt_verified
    from rated_pool rp
    left join ranked_salary rs
      on rs.market_player_id = rp.id
     and rs.rn = 1
    where coalesce(rp.market_value_eur, 0) > 0
      and trim(coalesce(rp.transfermarkt_url, '')) ~* '^https?://.*transfermarkt[.]'
      and coalesce(rs.weekly_salary_eur, nullif((rp.estimate_json ->> 'weeklySalary')::numeric, 0), 0) > 0
  ),
  limited as (
    select *
    from eligible
    cross join params
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

create or replace function public.app_seed_championship_fixtures(
  p_week integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teams text[] := array[
    'Coventry City',
    'Ipswich Town',
    'Birmingham City',
    'Middlesbrough',
    'Southampton',
    'Bristol City',
    'Hull City',
    'Leicester City',
    'Millwall',
    'Sheffield United',
    'Swansea City',
    'Wrexham',
    'Derby County',
    'Norwich City',
    'Preston North End',
    'Queens Park Rangers',
    'Stoke City',
    'Watford',
    'West Bromwich Albion',
    'Blackburn Rovers',
    'Charlton Athletic',
    'Oxford United',
    'Portsmouth',
    'Sheffield Wednesday'
  ];
  v_rotation text[] := array[
    'Ipswich Town',
    'Birmingham City',
    'Middlesbrough',
    'Southampton',
    'Bristol City',
    'Hull City',
    'Leicester City',
    'Millwall',
    'Sheffield United',
    'Swansea City',
    'Wrexham',
    'Derby County',
    'Norwich City',
    'Preston North End',
    'Queens Park Rangers',
    'Stoke City',
    'Watford',
    'West Bromwich Albion',
    'Blackburn Rovers',
    'Charlton Athletic',
    'Oxford United',
    'Portsmouth',
    'Sheffield Wednesday'
  ];
  v_arranged text[];
  v_team_count integer := 24;
  v_round_index integer;
  v_round_number integer;
  v_match_index integer;
  v_home text;
  v_away text;
  v_tmp text;
  v_inserted integer := 0;
  v_row_count integer := 0;
begin
  for v_round_index in 0..(v_team_count - 2) loop
    v_arranged := array_prepend(v_teams[1], v_rotation);
    v_round_number := v_round_index + 1;

    for v_match_index in 1..(v_team_count / 2) loop
      v_home := v_arranged[v_match_index];
      v_away := v_arranged[v_team_count - v_match_index + 1];

      if mod(v_round_index, 2) = 1 then
        v_tmp := v_home;
        v_home := v_away;
        v_away := v_tmp;
      end if;

      if p_week is null or ceil(v_round_number / 3.0)::integer = p_week then
        insert into public.matches (
          competition,
          week,
          phase,
          match_order,
          match_date,
          home_club_id,
          away_club_id,
          status,
          reason,
          unique_key
        )
        select
          'Championship',
          ceil(v_round_number / 3.0)::integer,
          'Rodada ' || v_round_number,
          v_match_index,
          date '2026-05-26' + (((ceil(v_round_number / 3.0)::integer - 1) * 7) + (array[0, 2, 5])[mod(v_round_number - 1, 3) + 1]),
          home.id,
          away.id,
          'pending',
          'Pendente',
          public.normalize_key('Championship') || '|' || public.normalize_key('Rodada ' || v_round_number) || '|' || home.id || '|' || away.id
        from public.clubs home
        join public.clubs away on away.name = v_away
        where home.name = v_home
          and not exists (
            select 1
            from public.matches existing
            where existing.competition = 'Championship'
              and existing.phase = 'Rodada ' || v_round_number
              and existing.home_club_id = home.id
              and existing.away_club_id = away.id
          );

        get diagnostics v_row_count = row_count;
        v_inserted := v_inserted + v_row_count;
      end if;

      if p_week is null or ceil((v_round_number + v_team_count - 1) / 3.0)::integer = p_week then
        insert into public.matches (
          competition,
          week,
          phase,
          match_order,
          match_date,
          home_club_id,
          away_club_id,
          status,
          reason,
          unique_key
        )
        select
          'Championship',
          ceil((v_round_number + v_team_count - 1) / 3.0)::integer,
          'Rodada ' || (v_round_number + v_team_count - 1),
          v_match_index,
          date '2026-05-26' + (((ceil((v_round_number + v_team_count - 1) / 3.0)::integer - 1) * 7) + (array[0, 2, 5])[mod((v_round_number + v_team_count - 1) - 1, 3) + 1]),
          home.id,
          away.id,
          'pending',
          'Pendente',
          public.normalize_key('Championship') || '|' || public.normalize_key('Rodada ' || (v_round_number + v_team_count - 1)) || '|' || home.id || '|' || away.id
        from public.clubs home
        join public.clubs away on away.name = v_home
        where home.name = v_away
          and not exists (
            select 1
            from public.matches existing
            where existing.competition = 'Championship'
              and existing.phase = 'Rodada ' || (v_round_number + v_team_count - 1)
              and existing.home_club_id = home.id
              and existing.away_club_id = away.id
          );

        get diagnostics v_row_count = row_count;
        v_inserted := v_inserted + v_row_count;
      end if;
    end loop;

    v_rotation := array_prepend(v_rotation[array_length(v_rotation, 1)], v_rotation[1:array_length(v_rotation, 1) - 1]);
  end loop;

  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'week', p_week);
end;
$$;

create or replace function public.app_internal_simulate_cpu_week(
  p_week integer,
  p_submitted_by text default 'Liga'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  human_pending integer := 0;
  available_matches integer := 0;
  created_count integer := 0;
  rejected_count integer := 0;
  seed_result jsonb;
  rec record;
  v_home_score integer;
  v_away_score integer;
  v_penalty_winner text;
  v_penalty_score text;
  v_home_pens integer;
  v_away_pens integer;
  v_result jsonb;
  v_details jsonb := '[]'::jsonb;
begin
  if p_week is null or p_week <= 0 then
    return jsonb_build_object('ok', false, 'created', 0, 'rejected', 0, 'message', 'Semana invalida.');
  end if;

  seed_result := public.app_seed_championship_fixtures(p_week);

  select count(*)
    into available_matches
  from public.matches ma
  where ma.week = p_week
    and ma.status <> 'cancelled';

  if available_matches = 0 then
    return jsonb_build_object(
      'ok', false,
      'created', 0,
      'rejected', 0,
      'message', 'Nenhum jogo encontrado na semana ' || p_week || '.'
    );
  end if;

  select count(*)
    into human_pending
  from public.matches ma
  join public.clubs home on home.id = ma.home_club_id
  join public.clubs away on away.id = ma.away_club_id
  where ma.week = p_week
    and ma.status <> 'approved'
    and ma.status <> 'cancelled'
    and (home.owner_id is not null or away.owner_id is not null);

  if human_pending > 0 then
    return jsonb_build_object(
      'ok', false,
      'created', 0,
      'rejected', 0,
      'seeded', coalesce((seed_result ->> 'inserted')::integer, 0),
      'humanPending', human_pending,
      'message', 'Ainda existem ' || human_pending || ' jogo(s) com tecnico pendente na semana ' || p_week || '.'
    );
  end if;

  for rec in
    select
      ma.id,
      ma.competition,
      ma.week,
      ma.phase,
      ma.match_order,
      home.name as home,
      away.name as away,
      coalesce(home.strength, 70) as home_strength,
      coalesce(away.strength, 70) as away_strength
    from public.matches ma
    join public.clubs home on home.id = ma.home_club_id
    join public.clubs away on away.id = ma.away_club_id
    where ma.week = p_week
      and ma.status <> 'approved'
      and ma.status <> 'cancelled'
      and ma.home_score is null
      and ma.away_score is null
      and home.owner_id is null
      and away.owner_id is null
    order by ma.competition, ma.match_date nulls last, ma.match_order nulls last, ma.id
  loop
    v_home_score := greatest(0, least(5, round(1.2 + (((rec.home_strength + 3) - rec.away_strength) / 18.0) + random() * 2.2 - 0.7)::integer));
    v_away_score := greatest(0, least(5, round(1.0 + ((rec.away_strength - rec.home_strength) / 18.0) + random() * 2.0 - 0.6)::integer));

    v_penalty_winner := '';
    v_penalty_score := '';

    if public.normalize_key(rec.competition) <> 'championship'
       and v_home_score = v_away_score then
      if random() >= 0.5 then
        v_penalty_winner := rec.home;
        v_home_pens := 4 + floor(random() * 3)::integer;
        v_away_pens := greatest(0, v_home_pens - 1 - floor(random() * 2)::integer);
      else
        v_penalty_winner := rec.away;
        v_away_pens := 4 + floor(random() * 3)::integer;
        v_home_pens := greatest(0, v_away_pens - 1 - floor(random() * 2)::integer);
      end if;

      v_penalty_score := v_home_pens || ' x ' || v_away_pens;
    end if;

    v_result := public.app_internal_add_result(
      rec.competition,
      rec.week,
      rec.phase,
      rec.home,
      rec.away,
      v_home_score,
      v_away_score,
      '',
      '',
      v_penalty_winner,
      v_penalty_score,
      p_submitted_by
    );

    if coalesce((v_result ->> 'ok')::boolean, false) then
      created_count := created_count + 1;
    else
      rejected_count := rejected_count + 1;
    end if;

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'id', rec.id,
      'competition', rec.competition,
      'phase', rec.phase,
      'home', rec.home,
      'away', rec.away,
      'score', v_home_score || ' x ' || v_away_score,
      'penaltyWinner', v_penalty_winner,
      'penaltyScore', v_penalty_score,
      'ok', coalesce((v_result ->> 'ok')::boolean, false),
      'message', coalesce(v_result ->> 'message', '')
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'created', created_count,
    'rejected', rejected_count,
    'seeded', coalesce((seed_result ->> 'inserted')::integer, 0),
    'details', v_details,
    'message', created_count || ' jogo(s) CPU x CPU simulados na semana ' || p_week || case when rejected_count > 0 then '. ' || rejected_count || ' rejeitado(s).' else '.' end
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'created', created_count, 'rejected', rejected_count, 'message', SQLERRM);
end;
$$;

select public.app_seed_championship_fixtures(null);

grant execute on function public.app_transfermarkt_player_key(text) to anon, authenticated;
grant execute on function public.app_calculate_smart_weekly_salary(text, text, text, text, integer, numeric, integer) to anon, authenticated;
grant execute on function public.app_seed_championship_fixtures(integer) to anon, authenticated;
grant execute on function public.app_get_player_salary_quote(text, text, text, text, integer, numeric, integer) to anon, authenticated;
grant execute on function public.app_get_public_player_salary(text, text) to anon, authenticated;
grant execute on function public.app_search_market_players(text, boolean, integer) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
