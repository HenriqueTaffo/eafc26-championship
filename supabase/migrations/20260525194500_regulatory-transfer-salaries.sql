-- Adds a regulatory wage floor for external market transfers.
-- Public references still win when they are higher, but the database no
-- longer accepts a zero/cheap payroll when no Capology row exists.

begin;

alter table public.player_salary_references
  add column if not exists reference_type text not null default 'public_other';

alter table public.transfers
  add column if not exists salary_reference_type text not null default 'public_other';

update public.player_salary_references
   set reference_type = case
     when lower(coalesce(source_name, '')) like '%capology%' then 'public_capology'
     when lower(coalesce(source_name, '')) like '%salarysport%' then 'public_salarysport'
     else coalesce(nullif(reference_type, ''), 'public_other')
   end,
       updated_at = now()
 where reference_type is null
    or reference_type = 'public_other';

create or replace function public.app_salary_lookup_key(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      lower(trim(coalesce(p_value, ''))),
      '\m(football club|futbol club|futbol kulubu|futbol kulübü|club de futbol|club de fútbol|futebol clube|societa sportiva|società sportiva|sports club|sporting club|association football club|real club deportivo|grupo desportivo|calcio|s\.?p\.?a\.?|s\.?a\.?d\.?|fc|cf|sc|ac|as|rc|cd|sd|afc|fk|pfk|club)\M',
      '',
      'gi'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.app_salary_reference_type(
  p_source_name text,
  p_source_url text,
  p_fallback text default 'public_other'
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_fallback, '')) = 'regulatory_estimate' then 'regulatory_estimate'
    when lower(coalesce(p_source_url, '')) like '%capology.com%' or lower(coalesce(p_source_name, '')) like '%capology%' then 'public_capology'
    when lower(coalesce(p_source_url, '')) like '%salarysport.com%' or lower(coalesce(p_source_name, '')) like '%salarysport%' then 'public_salarysport'
    when lower(coalesce(p_fallback, '')) in ('manual_commissioner_reference', 'public_other') then lower(coalesce(p_fallback, 'public_other'))
    else 'public_other'
  end;
$$;

create or replace function public.app_salary_regulatory_model_url()
returns text
language sql
immutable
as $$
  select 'https://henriquetaffo.github.io/eafc26-championship/#salary-regulatory-model'::text;
$$;

create or replace function public.app_public_salary_reference_is_valid(
  p_weekly_salary_eur numeric,
  p_source_name text,
  p_source_url text
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_weekly_salary_eur, 0) > 0
     and length(trim(coalesce(p_source_name, ''))) >= 3
     and trim(coalesce(p_source_url, '')) ~* '^https?://';
$$;

create or replace function public.app_calculate_regulatory_weekly_salary(
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
  v_club text := lower(trim(coalesce(p_club_name, '')));
  v_league text := lower(trim(coalesce(p_league, '')));
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
  v_market_rate numeric := 0.025;
  v_market_weekly numeric := 0;
  v_overall_weekly numeric := 0;
  v_star_floor numeric := 0;
  v_salary numeric := 0;
begin
  if v_player = '' then
    return jsonb_build_object('ok', false, 'message', 'Jogador nao informado.');
  end if;

  if v_league in ('premier-league', 'laliga', 'serie-a', 'bundesliga', 'ligue-1') then
    v_league_floor := 35000;
    v_league_factor := 1.18;
  elsif v_league in ('saudi-pro-league') then
    v_league_floor := 75000;
    v_league_factor := 1.35;
  elsif v_league in ('major-league-soccer') then
    v_league_floor := 28000;
    v_league_factor := 1.05;
  elsif v_league in ('eredivisie', 'liga-portugal', 'super-lig') then
    v_league_floor := 22000;
    v_league_factor := 0.95;
  elsif v_league in ('jupiler-pro-league', 'scottish-premiership', 'premier-liga', 'campeonato-brasileiro-serie-a', 'argentina primera división', 'argentina primera division') then
    v_league_floor := 14000;
    v_league_factor := 0.82;
  elsif v_league in ('base atual da liga', 'championship') then
    v_league_floor := 9000;
    v_league_factor := 0.72;
  end if;

  if v_club ~ '(al[ -]?nassr|al[ -]?hilal|al[ -]?ittihad|al[ -]?ahli)' then
    v_club_floor := 180000;
    v_club_factor := 1.45;
  elsif v_club ~ '(real madrid|barcelona|manchester city|manchester united|liverpool|arsenal|chelsea|tottenham|paris saint|psg|bayern|juventus|inter|internazionale|milan|atletico madrid)' then
    v_club_floor := 120000;
    v_club_factor := 1.35;
  elsif v_club ~ '(borussia dortmund|bayer leverkusen|rb leipzig|leipzig|napoli|roma|lazio|ajax|psv|feyenoord|benfica|porto|sporting|fenerbahce|galatasaray|besiktas|sevilla|valencia|real sociedad|athletic)' then
    v_club_floor := 85000;
    v_club_factor := 1.15;
  end if;

  v_position_factor := case
    when v_position in ('ST', 'CF', 'LW', 'RW', 'CAM') then 1.08
    when v_position in ('CM', 'CDM', 'LM', 'RM') then 1.02
    when v_position in ('GK') then 0.96
    else 1.00
  end;

  v_age_factor := case
    when v_age between 24 and 31 then 1.08
    when v_age between 32 and 34 then 1.00
    when v_age >= 35 then 0.92
    when v_age between 18 and 21 then 0.86
    else 1.00
  end;

  v_market_rate := case
    when v_market_value >= 100000000 then 0.075
    when v_market_value >= 50000000 then 0.065
    when v_market_value >= 25000000 then 0.055
    when v_market_value >= 10000000 then 0.045
    when v_market_value >= 5000000 then 0.0375
    when v_market_value >= 1000000 then 0.030
    else 0.0225
  end;

  v_market_weekly := round((v_market_value * v_market_rate) / 52);

  v_overall_weekly := case
    when v_overall >= 91 then 420000
    when v_overall >= 89 then 320000
    when v_overall >= 87 then 240000
    when v_overall >= 85 then 165000
    when v_overall >= 83 then 125000
    when v_overall >= 81 then 90000
    when v_overall >= 79 then 70000
    when v_overall >= 76 then 46000
    when v_overall >= 73 then 30000
    when v_overall >= 70 then 21000
    when v_overall >= 66 then 14000
    when v_overall > 0 then 9000
    else 0
  end;

  v_star_floor := case
    when v_overall >= 89 then 260000
    when v_overall >= 87 then 200000
    when v_overall >= 85 then 145000
    when v_overall >= 83 then 110000
    when v_overall >= 81 then 85000
    when v_overall >= 79 then 65000
    else 0
  end;

  v_salary := greatest(
    v_league_floor,
    v_club_floor,
    v_market_weekly,
    v_star_floor,
    round(v_overall_weekly * v_league_factor * v_club_factor * v_position_factor * v_age_factor)
  );

  v_salary := greatest(1500, round(v_salary / 500) * 500);

  return jsonb_build_object(
    'ok', true,
    'playerName', v_player,
    'clubName', trim(coalesce(p_club_name, '')),
    'weeklySalary', v_salary,
    'salarySourceName', 'Estimativa regulatoria da liga',
    'salarySourceUrl', public.app_salary_regulatory_model_url(),
    'salaryCheckedAt', now(),
    'referenceType', 'regulatory_estimate',
    'salaryRuleVersion', '2026-05-25-v1',
    'explanation', 'Maior valor entre piso da liga, piso de clube, rating, valor de mercado e trava de jogador de alto impacto.'
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
      lower(trim(coalesce(p_player_name, ''))) as player_key,
      public.app_salary_lookup_key(p_player_name) as player_lookup_key,
      lower(trim(coalesce(p_club_name, ''))) as club_key,
      public.app_salary_lookup_key(p_club_name) as club_lookup_key
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
    where public.app_salary_lookup_key(coalesce(p.normalized_name, p.name)) = i.player_lookup_key
      and (
        i.club_lookup_key = ''
        or public.app_salary_lookup_key(p.club) = i.club_lookup_key
      )
    order by
      case when public.app_salary_lookup_key(p.club) = (select club_lookup_key from inputs) then 0 else 1 end,
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
    where public.app_salary_lookup_key(r.name) = i.player_lookup_key
      and (
        i.club_lookup_key = ''
        or public.app_salary_lookup_key(r.club) = i.club_lookup_key
      )
    order by
      case when public.app_salary_lookup_key(r.club) = (select club_lookup_key from inputs) then 0 else 1 end,
      r.overall desc nulls last,
      r.updated_at desc nulls last,
      r.id desc
    limit 1
  ),
  direct_ref as (
    select
      r.player_name,
      coalesce(r.club_name, (select club_name from inputs)) as club_name,
      r.weekly_salary_eur,
      r.source_name,
      r.source_url,
      r.source_checked_at,
      coalesce(r.reference_type, public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')) as reference_type,
      1 as priority
    from public.player_salary_references r
    cross join inputs i
    where public.app_salary_lookup_key(r.player_name) = i.player_lookup_key
      and (
        i.club_lookup_key = ''
        or public.app_salary_lookup_key(coalesce(r.club_name, '')) = i.club_lookup_key
      )
    order by
      case when public.app_salary_lookup_key(coalesce(r.club_name, '')) = (select club_lookup_key from inputs) then 0 else 1 end,
      case when coalesce(r.reference_type, '') = 'regulatory_estimate' then 1 else 0 end,
      r.source_checked_at desc nulls last,
      r.id desc
    limit 1
  ),
  roster_ref as (
    select
      r.player_name,
      r.club_name,
      r.estimated_weekly_salary_eur as weekly_salary_eur,
      coalesce(r.salary_source_name, r.source_name) as source_name,
      coalesce(r.salary_source_url, r.source_url) as source_url,
      coalesce(r.salary_checked_at, r.updated_at) as source_checked_at,
      coalesce(r.salary_reference_type, 'public_club_payroll_reference') as reference_type,
      2 as priority
    from public.club_roster_players r
    cross join inputs i
    where public.app_salary_lookup_key(r.player_name) = i.player_lookup_key
      and (
        i.club_lookup_key = ''
        or public.app_salary_lookup_key(r.club_name) = i.club_lookup_key
      )
      and coalesce(r.estimated_weekly_salary_eur, 0) > 0
      and trim(coalesce(r.salary_source_url, r.source_url, '')) ~* '^https?://'
    order by
      case when public.app_salary_lookup_key(r.club_name) = (select club_lookup_key from inputs) then 0 else 1 end,
      r.updated_at desc nulls last,
      r.id desc
    limit 1
  ),
  public_best as (
    select * from direct_ref
    union all
    select * from roster_ref
    order by priority
    limit 1
  ),
  regulatory as (
    select public.app_calculate_regulatory_weekly_salary(
      (select player_name from inputs),
      coalesce(nullif((select club_name from inputs), ''), (select club from market_ref), (select club from rating_ref), ''),
      coalesce(nullif(p_league, ''), (select league from market_ref), ''),
      coalesce(nullif(p_position, ''), (select position from rating_ref), (select position from market_ref), ''),
      coalesce(nullif(p_overall, 0), (select overall from rating_ref), null),
      coalesce(p_market_value, (select market_value_eur from market_ref), 0),
      coalesce(p_age, (select age from market_ref), null)
    ) as j
  ),
  chosen as (
    select
      case
        when pb.weekly_salary_eur is not null
          and pb.weekly_salary_eur >= coalesce((regulatory.j ->> 'weeklySalary')::numeric, 0)
          then jsonb_build_object(
            'ok', true,
            'playerName', pb.player_name,
            'clubName', pb.club_name,
            'weeklySalary', pb.weekly_salary_eur,
            'salarySourceName', pb.source_name,
            'salarySourceUrl', pb.source_url,
            'salaryCheckedAt', pb.source_checked_at,
            'referenceType', pb.reference_type,
            'minimumRegulatorySalary', (regulatory.j ->> 'weeklySalary')::numeric
          )
        else regulatory.j || jsonb_build_object(
          'minimumRegulatorySalary', (regulatory.j ->> 'weeklySalary')::numeric,
          'publicSalaryReference', case
            when pb.weekly_salary_eur is null then null::jsonb
            else jsonb_build_object(
              'weeklySalary', pb.weekly_salary_eur,
              'salarySourceName', pb.source_name,
              'salarySourceUrl', pb.source_url,
              'referenceType', pb.reference_type
            )
          end
        )
      end as j
    from regulatory
    left join public_best pb on true
  )
  select coalesce(
    (select j from chosen),
    jsonb_build_object('ok', false, 'message', 'Nao foi possivel calcular salario.')
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

create or replace function public.app_get_public_salary_references()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with refs as (
    select
      r.player_name,
      coalesce(r.club_name, '') as club_name,
      r.weekly_salary_eur,
      r.source_name,
      r.source_url,
      r.source_checked_at,
      coalesce(r.reference_type, public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')) as reference_type
    from public.player_salary_references r
    union all
    select
      r.player_name,
      r.club_name,
      r.estimated_weekly_salary_eur as weekly_salary_eur,
      coalesce(r.salary_source_name, r.source_name) as source_name,
      coalesce(r.salary_source_url, r.source_url) as source_url,
      coalesce(r.salary_checked_at, r.updated_at) as source_checked_at,
      coalesce(r.salary_reference_type, 'public_club_payroll_reference') as reference_type
    from public.club_roster_players r
    where coalesce(r.estimated_weekly_salary_eur, 0) > 0
      and trim(coalesce(r.salary_source_url, r.source_url, '')) ~* '^https?://'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'playerName', player_name,
    'clubName', club_name,
    'weeklySalary', weekly_salary_eur,
    'salarySourceName', source_name,
    'salarySourceUrl', source_url,
    'salaryCheckedAt', source_checked_at,
    'referenceType', reference_type
  ) order by player_name, club_name), '[]'::jsonb)
  from refs;
$$;

create or replace function public.app_resolve_transfer_salary(
  p_player_name text,
  p_club_name text default '',
  p_league text default '',
  p_position text default '',
  p_overall integer default null,
  p_market_value numeric default null,
  p_age integer default null,
  p_weekly_salary_eur numeric default null,
  p_source_name text default '',
  p_source_url text default ''
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with quote as (
    select public.app_get_player_salary_quote(
      p_player_name,
      p_club_name,
      p_league,
      p_position,
      p_overall,
      p_market_value,
      p_age
    ) as j
  ),
  submitted as (
    select
      public.app_public_salary_reference_is_valid(p_weekly_salary_eur, p_source_name, p_source_url) as is_valid,
      coalesce(p_weekly_salary_eur, 0)::numeric as weekly_salary,
      trim(coalesce(p_source_name, '')) as source_name,
      trim(coalesce(p_source_url, '')) as source_url,
      public.app_salary_reference_type(p_source_name, p_source_url, 'manual_commissioner_reference') as reference_type
  )
  select case
    when coalesce((quote.j ->> 'ok')::boolean, false) is false then quote.j
    when submitted.is_valid
      and submitted.weekly_salary >= coalesce((quote.j ->> 'weeklySalary')::numeric, 0)
      then jsonb_build_object(
        'ok', true,
        'playerName', p_player_name,
        'clubName', p_club_name,
        'weeklySalary', submitted.weekly_salary,
        'salarySourceName', submitted.source_name,
        'salarySourceUrl', submitted.source_url,
        'salaryCheckedAt', now(),
        'referenceType', submitted.reference_type,
        'minimumRegulatorySalary', (quote.j ->> 'minimumRegulatorySalary')::numeric,
        'databaseQuote', quote.j
      )
    else quote.j
  end
  from quote, submitted;
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

create or replace function public.app_add_transfer_verified_salary(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric,
  p_weekly_salary_eur numeric,
  p_salary_source_name text,
  p_salary_source_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_manager_name text;
  v_buyer_id text;
  v_rate numeric := 0;
  v_final_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_weekly_salary numeric := 0;
  v_salary_source_name text := '';
  v_salary_source_url text := '';
  v_salary_reference_type text := 'regulatory_estimate';
  v_salary_quote jsonb;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
begin
  if public.app_transfer_window_is_locked() then
    return jsonb_build_object('ok', false, 'message', 'Janela de transferencias fechada enquanto consolidamos o app.');
  end if;

  v_salary_quote := public.app_resolve_transfer_salary(
    p_player,
    p_from_club,
    '',
    '',
    p_overall,
    p_market_value,
    null,
    p_weekly_salary_eur,
    p_salary_source_name,
    p_salary_source_url
  );

  if coalesce((v_salary_quote ->> 'ok')::boolean, false) is false then
    return v_salary_quote;
  end if;

  v_weekly_salary := coalesce((v_salary_quote ->> 'weeklySalary')::numeric, 0);
  v_salary_source_name := coalesce(v_salary_quote ->> 'salarySourceName', 'Estimativa regulatoria da liga');
  v_salary_source_url := coalesce(v_salary_quote ->> 'salarySourceUrl', public.app_salary_regulatory_model_url());
  v_salary_reference_type := coalesce(v_salary_quote ->> 'referenceType', 'regulatory_estimate');

  perform public.app_get_salary_debt_status();

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  if not v_is_commissioner and lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A transferencia precisa ser enviada pelo comprador logado.');
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(trim(p_buyer))
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', p_buyer));
  end if;

  v_rate := case
    when coalesce(p_overall, 0) >= 89 then 0.25
    when coalesce(p_overall, 0) >= 84 then 0.15
    when coalesce(p_overall, 0) >= 80 then 0.10
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end;
  v_final_value := coalesce(p_market_value, 0) + (coalesce(p_market_value, 0) * v_rate);

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 22000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(p_buyer);

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object('ok', false, 'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo.', p_buyer));
  end if;

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', p_buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', p_buyer));
  end if;

  if v_final_value > v_remaining then
    return jsonb_build_object('ok', false, 'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_final_value - v_remaining, 'FM999G999G999G999G990'))));
  end if;

  if (v_current_payroll + v_weekly_salary) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. O salario de folha do jogador inviabiliza a contratacao.');
  end if;

  if v_salary_reference_type <> 'regulatory_estimate' then
    perform public.app_upsert_player_salary_reference(
      p_player,
      p_from_club,
      v_weekly_salary,
      v_salary_source_name,
      v_salary_source_url,
      'Criado automaticamente a partir de transferencia aprovada.'
    );
  end if;

  insert into public.transfers (
    buyer_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
    final_value,
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
  ) values (
    v_buyer_id,
    trim(p_player),
    nullif(trim(p_from_club), ''),
    coalesce(p_overall, 0),
    coalesce(p_market_value, 0),
    v_rate,
    v_final_value,
    v_weekly_salary,
    v_salary_source_name,
    v_salary_source_url,
    v_salary_reference_type,
    now(),
    'approved',
    'OK',
    'market',
    now(),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'message', case when v_salary_reference_type = 'regulatory_estimate'
      then 'Transferencia registrada com salario regulatorio de folha.'
      else 'Transferencia registrada com salario publico verificado.'
    end,
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'marketValue', p_market_value,
    'finalValue', v_final_value,
    'weeklySalary', v_weekly_salary,
    'salarySourceName', v_salary_source_name,
    'salarySourceUrl', v_salary_source_url,
    'salaryReferenceType', v_salary_reference_type
  );
end;
$$;

create or replace function public.app_add_transfer_with_trade_verified_salary(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric,
  p_trade_in_player text default '',
  p_trade_in_credit numeric default null,
  p_weekly_salary_eur numeric default null,
  p_salary_source_name text default '',
  p_salary_source_url text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_manager_name text;
  v_buyer_id text;
  v_rate numeric := 0;
  v_gross_value numeric := 0;
  v_cash_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_weekly_salary numeric := 0;
  v_salary_source_name text := '';
  v_salary_source_url text := '';
  v_salary_reference_type text := 'regulatory_estimate';
  v_salary_quote jsonb;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
  v_trade record;
  v_trade_value numeric := 0;
  v_trade_credit numeric := 0;
  v_purchase_id bigint;
  v_trade_sale_id bigint;
begin
  if public.app_transfer_window_is_locked() then
    return jsonb_build_object('ok', false, 'message', 'Janela de transferencias fechada enquanto consolidamos o app.');
  end if;

  v_salary_quote := public.app_resolve_transfer_salary(
    p_player,
    p_from_club,
    '',
    '',
    p_overall,
    p_market_value,
    null,
    p_weekly_salary_eur,
    p_salary_source_name,
    p_salary_source_url
  );

  if coalesce((v_salary_quote ->> 'ok')::boolean, false) is false then
    return v_salary_quote;
  end if;

  v_weekly_salary := coalesce((v_salary_quote ->> 'weeklySalary')::numeric, 0);
  v_salary_source_name := coalesce(v_salary_quote ->> 'salarySourceName', 'Estimativa regulatoria da liga');
  v_salary_source_url := coalesce(v_salary_quote ->> 'salarySourceUrl', public.app_salary_regulatory_model_url());
  v_salary_reference_type := coalesce(v_salary_quote ->> 'referenceType', 'regulatory_estimate');

  perform public.app_get_salary_debt_status();

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  if not v_is_commissioner and lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A transferencia precisa ser enviada pelo comprador logado.');
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(trim(p_buyer))
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', p_buyer));
  end if;

  v_rate := case
    when coalesce(p_overall, 0) >= 89 then 0.25
    when coalesce(p_overall, 0) >= 84 then 0.15
    when coalesce(p_overall, 0) >= 80 then 0.10
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end;
  v_gross_value := coalesce(p_market_value, 0) + (coalesce(p_market_value, 0) * v_rate);

  if coalesce(trim(p_trade_in_player), '') <> '' then
    if lower(trim(p_trade_in_player)) = lower(trim(p_player)) then
      return jsonb_build_object('ok', false, 'message', 'O jogador oferecido na troca precisa ser diferente do alvo.');
    end if;

    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      t.market_value,
      t.final_value,
      t.negotiated_value,
      t.transfer_type,
      m.display_name as current_owner
      into v_trade
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.status = 'approved'
      and lower(t.player_name) = lower(trim(p_trade_in_player))
    order by t.created_at desc nulls last, t.id desc
    limit 1;

    if v_trade.id is null then
      return jsonb_build_object('ok', false, 'message', 'Jogador de troca nao encontrado no elenco atual.');
    end if;

    if v_trade.transfer_type = 'cpu_sale' or lower(v_trade.current_owner) <> lower(trim(p_buyer)) then
      return jsonb_build_object('ok', false, 'message', format('%s nao pertence atualmente a %s.', p_trade_in_player, p_buyer));
    end if;

    v_trade_value := greatest(
      coalesce(v_trade.negotiated_value, 0),
      coalesce(v_trade.final_value, 0),
      coalesce(v_trade.market_value, 0),
      0
    );
    v_trade_credit := round(
      least(
        v_gross_value * 0.70,
        v_trade_value * 0.85,
        greatest(coalesce(p_trade_in_credit, v_trade_value * 0.85), 0)
      ) / 100000
    ) * 100000;
  end if;

  v_cash_value := greatest(0, v_gross_value - coalesce(v_trade_credit, 0));
  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 22000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(
    p_buyer,
    case when v_trade_credit > 0 then v_trade.player_name else '' end
  );

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object('ok', false, 'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo.', p_buyer));
  end if;

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', p_buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', p_buyer));
  end if;

  if v_cash_value > v_remaining then
    return jsonb_build_object('ok', false, 'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_cash_value - v_remaining, 'FM999G999G999G999G990'))));
  end if;

  if (v_current_payroll + v_weekly_salary) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. O salario de folha do jogador inviabiliza a contratacao.');
  end if;

  if v_salary_reference_type <> 'regulatory_estimate' then
    perform public.app_upsert_player_salary_reference(
      p_player,
      p_from_club,
      v_weekly_salary,
      v_salary_source_name,
      v_salary_source_url,
      'Criado automaticamente a partir de transferencia aprovada.'
    );
  end if;

  insert into public.transfers (
    buyer_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
    final_value,
    weekly_salary_eur,
    salary_source_name,
    salary_source_url,
    salary_reference_type,
    salary_checked_at,
    status,
    reason,
    transfer_type,
    negotiated_value,
    trade_in_player_name,
    trade_in_credit,
    created_at,
    updated_at
  ) values (
    v_buyer_id,
    trim(p_player),
    nullif(trim(p_from_club), ''),
    coalesce(p_overall, 0),
    coalesce(p_market_value, 0),
    v_rate,
    v_gross_value,
    v_weekly_salary,
    v_salary_source_name,
    v_salary_source_url,
    v_salary_reference_type,
    now(),
    'approved',
    'OK',
    'market',
    v_cash_value,
    nullif(trim(coalesce(p_trade_in_player, '')), ''),
    v_trade_credit,
    now(),
    now()
  )
  returning id into v_purchase_id;

  if v_trade_credit > 0 and v_trade.id is not null then
    insert into public.transfers (
      buyer_id,
      seller_id,
      player_name,
      from_club,
      overall,
      market_value,
      overall_rate,
      final_value,
      status,
      reason,
      transfer_type,
      negotiated_value,
      destination_club,
      created_at,
      updated_at
    ) values (
      v_buyer_id,
      v_buyer_id,
      v_trade.player_name,
      coalesce(nullif(v_trade.from_club, ''), 'Elenco de ' || p_buyer),
      coalesce(v_trade.overall, 0),
      0,
      0,
      'approved',
      'Troca usada na compra de ' || trim(p_player),
      'cpu_sale',
      0,
      coalesce(nullif(trim(p_from_club), ''), 'Clube vendedor'),
      now(),
      now()
    )
    returning id into v_trade_sale_id;

    update public.transfers
       set trade_in_transfer_id = v_trade_sale_id,
           updated_at = now()
     where id = v_purchase_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', case when v_salary_reference_type = 'regulatory_estimate'
      then 'Transferencia registrada com salario regulatorio de folha.'
      else 'Transferencia registrada com salario publico verificado.'
    end,
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'marketValue', p_market_value,
    'finalValue', v_gross_value,
    'cashValue', v_cash_value,
    'tradeInPlayer', nullif(trim(coalesce(p_trade_in_player, '')), ''),
    'tradeInCredit', v_trade_credit,
    'purchaseTransferId', v_purchase_id,
    'tradeSaleTransferId', v_trade_sale_id,
    'weeklySalary', v_weekly_salary,
    'salarySourceName', v_salary_source_name,
    'salarySourceUrl', v_salary_source_url,
    'salaryReferenceType', v_salary_reference_type
  );
end;
$$;

grant execute on function public.app_salary_lookup_key(text) to anon, authenticated;
grant execute on function public.app_salary_reference_type(text, text, text) to anon, authenticated;
grant execute on function public.app_salary_regulatory_model_url() to anon, authenticated;
grant execute on function public.app_calculate_regulatory_weekly_salary(text, text, text, text, integer, numeric, integer) to anon, authenticated;
grant execute on function public.app_get_player_salary_quote(text, text, text, text, integer, numeric, integer) to anon, authenticated;
grant execute on function public.app_get_public_player_salary(text, text) to anon, authenticated;
grant execute on function public.app_get_public_salary_references() to anon, authenticated;
grant execute on function public.app_resolve_transfer_salary(text, text, text, text, integer, numeric, integer, numeric, text, text) to anon, authenticated;
grant execute on function public.app_search_market_players(text, boolean, integer) to anon, authenticated;
grant execute on function public.app_add_transfer_verified_salary(text, text, text, text, text, integer, numeric, numeric, text, text) to anon, authenticated;
grant execute on function public.app_add_transfer_with_trade_verified_salary(text, text, text, text, text, integer, numeric, text, numeric, numeric, text, text) to anon, authenticated;

commit;
