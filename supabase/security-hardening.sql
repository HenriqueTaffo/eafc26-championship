-- Hardening de seguranca para a liga.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro depois dos SQLs de gameplay ja existentes.
-- 3. Publique o front atualizado no GitHub Pages.
--
-- O que faz:
-- - Remove o poder do PIN global publicado no front.
-- - Cria wrappers autenticados por tecnico/comissario para resultado, compra externa,
--   eventos automaticos e simulacao CPU.
-- - Revoga execucao publica das funcoes antigas que aceitavam p_pin.
-- - Liga RLS nas tabelas de apoio criadas pelo projeto, mantendo leitura/escrita via RPC.

create or replace function public.app_find_transfer_table()
returns regclass
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_transfer_table regclass;
begin
  select c.oid::regclass
    into v_transfer_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname = 'public'
    and c.relname not like '%proposal%'
    and c.relname not like '%contract%'
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid
        and not a.attisdropped
        and lower(regexp_replace(a.attname, '[^a-z0-9]', '', 'g')) in ('comprador', 'buyer')
    )
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid
        and not a.attisdropped
        and lower(regexp_replace(a.attname, '[^a-z0-9]', '', 'g')) in ('jogador', 'player')
    )
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid
        and not a.attisdropped
        and lower(regexp_replace(a.attname, '[^a-z0-9]', '', 'g')) = 'status'
    )
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid
        and not a.attisdropped
        and lower(regexp_replace(a.attname, '[^a-z0-9]', '', 'g')) in ('timestamp', 'createdat', 'data')
    )
  order by
    case when c.relname in ('transfers', 'transferencias') then 0 else 1 end,
    case when c.relname like '%transfer%' then 0 else 1 end,
    c.relname
  limit 1;

  if v_transfer_table is not null then
    return v_transfer_table;
  end if;

  v_transfer_table := coalesce(
    to_regclass('public.transfers'),
    to_regclass('public.transferencias'),
    to_regclass('public.transfer_requests'),
    to_regclass('public.transfer_submissions')
  );

  if v_transfer_table is not null then
    return v_transfer_table;
  end if;

  select c.oid::regclass
    into v_transfer_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname = 'public'
    and c.relname like '%transfer%'
    and c.relname not like '%proposal%'
    and c.relname not like '%contract%'
    and c.relname not like '%sponsorship%'
    and c.relname not like '%governance%'
  order by c.relname
  limit 1;

  return v_transfer_table;
end;
$$;

create or replace function public.app_debug_transfer_tables()
returns table (
  table_name text,
  columns text[]
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.relname::text as table_name,
    array_agg(a.attname::text order by a.attnum) as columns
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  where c.relkind in ('r', 'p')
    and n.nspname = 'public'
    and not a.attisdropped
    and a.attnum > 0
    and (
      c.relname like '%transfer%'
      or exists (
        select 1
        from pg_attribute ax
        where ax.attrelid = c.oid
          and not ax.attisdropped
          and lower(regexp_replace(ax.attname, '[^a-z0-9]', '', 'g')) in ('comprador', 'buyer', 'jogador', 'player')
      )
    )
  group by c.relname
  order by c.relname;
$$;

create or replace function public.app_transfer_column(
  p_table regclass,
  p_options text[]
)
returns text
language sql
security definer
stable
set search_path = public
as $$
  with options as (
    select
      option_name,
      ordinality,
      lower(regexp_replace(option_name, '[^a-z0-9]', '', 'g')) as normalized
    from unnest(p_options) with ordinality as item(option_name, ordinality)
  )
  select quote_ident(a.attname)
  from pg_attribute a
  join options o
    on lower(regexp_replace(a.attname, '[^a-z0-9]', '', 'g')) = o.normalized
  where a.attrelid = p_table
    and not a.attisdropped
  order by o.ordinality
  limit 1;
$$;

create or replace function public.app_ensure_transfer_table_schema()
returns regclass
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_table regclass;
begin
  v_transfer_table := public.app_find_transfer_table();

  if v_transfer_table is null then
    create table if not exists public.transfers (
      id bigserial primary key,
      "Comprador" text,
      "Jogador" text,
      "ClubeOrigem" text,
      "Overall" integer,
      "ValorTransfermarkt" numeric,
      "ValorFinal" numeric,
      "Status" text default 'pendente',
      "Timestamp" timestamptz default now(),
      "TipoTransferencia" text default 'market',
      "Vendedor" text,
      "ValorNegociado" numeric
    );

    v_transfer_table := 'public.transfers'::regclass;
  end if;

  execute format('alter table %s add column if not exists "Comprador" text', v_transfer_table);
  execute format('alter table %s add column if not exists "Jogador" text', v_transfer_table);
  execute format('alter table %s add column if not exists "ClubeOrigem" text', v_transfer_table);
  execute format('alter table %s add column if not exists "Overall" integer', v_transfer_table);
  execute format('alter table %s add column if not exists "ValorTransfermarkt" numeric', v_transfer_table);
  execute format('alter table %s add column if not exists "ValorFinal" numeric', v_transfer_table);
  execute format('alter table %s add column if not exists "Status" text default ''pendente''', v_transfer_table);
  execute format('alter table %s add column if not exists "Timestamp" timestamptz default now()', v_transfer_table);
  execute format('alter table %s add column if not exists "TipoTransferencia" text default ''market''', v_transfer_table);
  execute format('alter table %s add column if not exists "Vendedor" text', v_transfer_table);
  execute format('alter table %s add column if not exists "ValorNegociado" numeric', v_transfer_table);

  return v_transfer_table;
end;
$$;

create or replace function public.app_get_transfer_spend_totals()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_transfer_table regclass;
  v_buyer_col text;
  v_player_col text;
  v_status_col text;
  v_timestamp_col text;
  v_market_value_col text;
  v_overall_col text;
  v_final_value_col text;
  v_type_col text;
  v_value_expr text;
  v_type_filter text := '';
  v_totals jsonb := '{}'::jsonb;
begin
  v_transfer_table := public.app_find_transfer_table();
  if v_transfer_table is null then
    return '{}'::jsonb;
  end if;

  v_buyer_col := public.app_transfer_column(v_transfer_table, array['Comprador', 'buyer', 'comprador']);
  v_player_col := public.app_transfer_column(v_transfer_table, array['Jogador', 'player', 'jogador']);
  v_status_col := public.app_transfer_column(v_transfer_table, array['Status', 'status']);
  v_timestamp_col := public.app_transfer_column(v_transfer_table, array['Timestamp', 'created_at', 'createdAt', 'Data']);
  v_market_value_col := public.app_transfer_column(v_transfer_table, array['ValorTransfermarkt', 'Valor Transfermarkt', 'marketValue', 'market_value']);
  v_overall_col := public.app_transfer_column(v_transfer_table, array['Overall', 'overall']);
  v_final_value_col := public.app_transfer_column(v_transfer_table, array['ValorFinal', 'Valor Final', 'finalValue', 'final_value']);
  v_type_col := public.app_transfer_column(v_transfer_table, array['TipoTransferencia', 'Tipo Transferencia', 'transferType', 'transfer_type']);

  if v_buyer_col is null or v_player_col is null or v_status_col is null or v_timestamp_col is null or v_market_value_col is null then
    return '{}'::jsonb;
  end if;

  v_value_expr := format('coalesce((%s)::numeric, 0) * (1 + case
      when coalesce((%s)::integer, 0) >= 89 then 0.25
      when coalesce((%s)::integer, 0) >= 84 then 0.20
      when coalesce((%s)::integer, 0) >= 80 then 0.15
      when coalesce((%s)::integer, 0) >= 75 then 0.05
      else 0
    end)',
    v_market_value_col,
    coalesce(v_overall_col, '0'),
    coalesce(v_overall_col, '0'),
    coalesce(v_overall_col, '0'),
    coalesce(v_overall_col, '0')
  );

  if v_final_value_col is not null then
    v_value_expr := format('coalesce((%s)::numeric, %s)', v_final_value_col, v_value_expr);
  end if;

  if v_type_col is not null then
    v_type_filter := format('and lower(coalesce(%s::text, ''market'')) <> ''internal''', v_type_col);
  end if;

  execute format(
    'with approved as (
       select
         %4$s::text as buyer,
         lower(%5$s::text) as player_key,
         %1$s as final_value,
         row_number() over (
           partition by lower(%5$s::text)
           order by %6$s desc nulls last, ctid desc
         ) as rn
       from %2$s
       where lower(coalesce(%7$s::text, '''')) = ''aprovado''
         %3$s
     ),
     totals as (
       select buyer, sum(final_value)::numeric as spent_total
       from approved
       where rn = 1
       group by buyer
     )
     select coalesce(jsonb_object_agg(buyer, spent_total), ''{}''::jsonb)
     from totals',
    v_value_expr,
    v_transfer_table,
    v_type_filter,
    v_buyer_col,
    v_player_col,
    v_timestamp_col,
    v_status_col
  )
  into v_totals;

  return coalesce(v_totals, '{}'::jsonb);
end;
$$;

create or replace function public.app_get_external_transfer_today_count(
  p_buyer text
)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_transfer_table regclass;
  v_buyer_col text;
  v_status_col text;
  v_timestamp_col text;
  v_type_col text;
  v_timestamp_type text := '';
  v_date_filter text;
  v_type_filter text := '';
  v_count integer := 0;
begin
  v_transfer_table := public.app_find_transfer_table();
  if v_transfer_table is null then
    return 0;
  end if;

  v_buyer_col := public.app_transfer_column(v_transfer_table, array['Comprador', 'buyer', 'comprador']);
  v_status_col := public.app_transfer_column(v_transfer_table, array['Status', 'status']);
  v_timestamp_col := public.app_transfer_column(v_transfer_table, array['Timestamp', 'created_at', 'createdAt', 'Data']);
  v_type_col := public.app_transfer_column(v_transfer_table, array['TipoTransferencia', 'Tipo Transferencia', 'transferType', 'transfer_type']);

  if v_buyer_col is null or v_status_col is null or v_timestamp_col is null then
    return 0;
  end if;

  if v_type_col is not null then
    v_type_filter := format('and lower(coalesce(%s::text, ''market'')) <> ''internal''', v_type_col);
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_timestamp_type
  from pg_attribute a
  where a.attrelid = v_transfer_table
    and quote_ident(a.attname) = v_timestamp_col
    and not a.attisdropped;

  if coalesce(v_timestamp_type, '') like 'timestamp%' or coalesce(v_timestamp_type, '') = 'date' then
    v_date_filter := format('and %s::date = current_date', v_timestamp_col);
  else
    v_date_filter := format('and (
      %1$s::text like to_char(current_date, ''YYYY-MM-DD'') || ''%%''
      or %1$s::text like to_char(current_date, ''DD/MM/YYYY'') || ''%%''
    )', v_timestamp_col);
  end if;

  execute format(
    'select count(*)::integer
       from %s
      where lower(coalesce(%s::text, '''')) = ''aprovado''
        and lower(%s::text) = lower($1)
        %s
        %s',
    v_transfer_table,
    v_status_col,
    v_buyer_col,
    v_date_filter,
    v_type_filter
  )
  into v_count
  using p_buyer;

  return coalesce(v_count, 0);
exception
  when others then
    return 0;
end;
$$;

create or replace function public.app_record_external_transfer(
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric,
  p_final_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_table regclass;
  v_buyer_col text;
  v_player_col text;
  v_origin_col text;
  v_overall_col text;
  v_market_value_col text;
  v_final_value_col text;
  v_status_col text;
  v_timestamp_col text;
  v_timestamp_type text := '';
  v_timestamp_value_expr text := 'now()';
  v_type_col text;
begin
  v_transfer_table := public.app_ensure_transfer_table_schema();

  v_buyer_col := public.app_transfer_column(v_transfer_table, array['Comprador', 'buyer', 'comprador']);
  v_player_col := public.app_transfer_column(v_transfer_table, array['Jogador', 'player', 'jogador']);
  v_origin_col := public.app_transfer_column(v_transfer_table, array['ClubeOrigem', 'Clube Origem', 'fromClub', 'from_club']);
  v_overall_col := public.app_transfer_column(v_transfer_table, array['Overall', 'overall']);
  v_market_value_col := public.app_transfer_column(v_transfer_table, array['ValorTransfermarkt', 'Valor Transfermarkt', 'marketValue', 'market_value']);
  v_final_value_col := public.app_transfer_column(v_transfer_table, array['ValorFinal', 'Valor Final', 'finalValue', 'final_value']);
  v_status_col := public.app_transfer_column(v_transfer_table, array['Status', 'status']);
  v_timestamp_col := public.app_transfer_column(v_transfer_table, array['Timestamp', 'created_at', 'createdAt', 'Data']);
  v_type_col := public.app_transfer_column(v_transfer_table, array['TipoTransferencia', 'Tipo Transferencia', 'transferType', 'transfer_type']);

  if v_buyer_col is null
     or v_player_col is null
     or v_origin_col is null
     or v_overall_col is null
     or v_market_value_col is null
     or v_final_value_col is null
     or v_status_col is null
     or v_timestamp_col is null
     or v_type_col is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Tabela de transferencias encontrada, mas faltam colunas esperadas.',
      'table', v_transfer_table::text,
      'missing', jsonb_strip_nulls(jsonb_build_object(
        'buyer', case when v_buyer_col is null then 'Comprador' end,
        'player', case when v_player_col is null then 'Jogador' end,
        'origin', case when v_origin_col is null then 'ClubeOrigem' end,
        'overall', case when v_overall_col is null then 'Overall' end,
        'marketValue', case when v_market_value_col is null then 'ValorTransfermarkt' end,
        'finalValue', case when v_final_value_col is null then 'ValorFinal' end,
        'status', case when v_status_col is null then 'Status' end,
        'timestamp', case when v_timestamp_col is null then 'Timestamp' end,
        'type', case when v_type_col is null then 'TipoTransferencia' end
      ))
    );
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_timestamp_type
  from pg_attribute a
  where a.attrelid = v_transfer_table
    and quote_ident(a.attname) = v_timestamp_col
    and not a.attisdropped;

  if coalesce(v_timestamp_type, '') not like 'timestamp%' and coalesce(v_timestamp_type, '') <> 'date' then
    v_timestamp_value_expr := quote_literal(to_char(now(), 'DD/MM/YYYY, HH24:MI'));
  end if;

  execute format(
    'insert into %s (
       %s,
       %s,
       %s,
       %s,
       %s,
       %s,
       %s,
       %s,
       %s
     ) values (%L, %L, %L, %s, %s, %s, ''aprovado'', %s, ''market'')',
    v_transfer_table,
    v_buyer_col,
    v_player_col,
    v_origin_col,
    v_overall_col,
    v_market_value_col,
    v_final_value_col,
    v_status_col,
    v_timestamp_col,
    v_type_col,
    p_buyer,
    p_player,
    p_from_club,
    coalesce(p_overall, 0),
    coalesce(p_market_value, 0),
    coalesce(p_final_value, 0),
    v_timestamp_value_expr
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Transferencia registrada.',
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'marketValue', p_market_value,
    'finalValue', p_final_value
  );
end;
$$;

create or replace function public.app_get_budget_reconciliation()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with data as (
    select public.app_get_data()::jsonb as j
  ),
  config as (
    select
      coalesce((j ->> 'budget')::numeric, 65000000) as base_budget_default,
      coalesce((j ->> 'homeMatchBonus')::numeric, 1250000) as home_match_bonus,
      coalesce((j ->> 'winBonus')::numeric, 500000) as win_bonus
    from data
  ),
  teams(manager_name, club_name) as (
    values
      ('Henrique', 'Coventry City'),
      ('Willian', 'Birmingham City'),
      ('Rafael', 'Middlesbrough'),
      ('Renato', 'Southampton'),
      ('Bruno Silva', 'Wrexham')
  ),
  results as (
    select *
    from jsonb_to_recordset(coalesce((select j -> 'results' from data), '[]'::jsonb)) as r(
      "Mandante" text,
      "Visitante" text,
      "GolsMandante" integer,
      "GolsVisitante" integer,
      "Status" text,
      "Competicao" text
    )
    where lower(coalesce("Status", '')) = 'aprovado'
      and lower(coalesce("Competicao", '')) = 'championship'
  ),
  stats as (
    select
      t.manager_name,
      count(*) filter (where lower(r."Mandante") = lower(t.club_name))::integer as home_matches,
      count(*) filter (
        where (
          lower(r."Mandante") = lower(t.club_name)
          and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0)
        ) or (
          lower(r."Visitante") = lower(t.club_name)
          and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0)
        )
      )::integer as wins
    from teams t
    left join results r
      on lower(r."Mandante") = lower(t.club_name)
      or lower(r."Visitante") = lower(t.club_name)
    group by t.manager_name
  ),
  reward_totals as (
    select
      manager_name,
      sum(reward_value)::numeric as reward_total
    from public.sponsorship_rewards
    group by manager_name
  ),
  sponsorship_reward_events as (
    select
      "Jogador" as manager_name,
      sum(coalesce("ImpactoFinanceiro", 0))::numeric as event_reward_total
    from jsonb_to_recordset(coalesce((select j -> 'events' from data), '[]'::jsonb)) as e(
      "Jogador" text,
      "Titulo" text,
      "ImpactoFinanceiro" numeric
    )
    where lower(coalesce("Titulo", '')) like '%bonus de patrocinio%'
    group by "Jogador"
  ),
  raw_budgets as (
    select key as manager_name, value as budget
    from jsonb_each(coalesce((select j -> 'budgets' from data), '{}'::jsonb))
  ),
  transfer_spend as (
    select public.app_get_transfer_spend_totals() as totals
  ),
  reconciled as (
    select
      t.manager_name,
      coalesce((rb.budget ->> 'baseBudget')::numeric, config.base_budget_default) as base_budget,
      coalesce(s.home_matches, 0) as home_matches,
      coalesce(s.wins, 0) as wins,
      coalesce(s.home_matches, 0) * config.home_match_bonus as home_bonus,
      coalesce(s.wins, 0) * config.win_bonus as win_bonus_value,
      coalesce((rb.budget ->> 'eventTotal')::numeric, 0)
        - coalesce(sre.event_reward_total, 0)
        + coalesce(rt.reward_total, 0) as event_total,
      coalesce(rt.reward_total, 0) as sponsorship_rewards,
      coalesce((ts.totals ->> t.manager_name)::numeric, (rb.budget ->> 'spentTotal')::numeric, 0) as spent_total,
      coalesce((rb.budget ->> 'transferLimit')::integer, 3) as transfer_limit
    from teams t
    cross join config
    cross join transfer_spend ts
    left join raw_budgets rb on rb.manager_name = t.manager_name
    left join stats s on s.manager_name = t.manager_name
    left join reward_totals rt on rt.manager_name = t.manager_name
    left join sponsorship_reward_events sre on sre.manager_name = t.manager_name
  )
  select coalesce(jsonb_object_agg(
    manager_name,
    jsonb_build_object(
      'baseBudget', base_budget,
      'homeMatches', home_matches,
      'wins', wins,
      'homeBonus', home_bonus,
      'winBonusValue', win_bonus_value,
      'eventTotal', event_total,
      'sponsorshipRewards', sponsorship_rewards,
      'totalBudget', base_budget + home_bonus + win_bonus_value + event_total,
      'spentTotal', spent_total,
      'remainingBudget', base_budget + home_bonus + win_bonus_value + event_total - spent_total,
      'transferLimit', transfer_limit,
      'transfersToday', public.app_get_external_transfer_today_count(manager_name)
    )
  ), '{}'::jsonb)
  from reconciled;
$$;

create or replace function public.app_security_login(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager record;
  v_login jsonb;
begin
  if coalesce(trim(p_manager_id), '') = '' or coalesce(trim(p_access_code), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Login obrigatorio.');
  end if;

  if p_manager_id = 'comissario' then
    v_login := public.app_login_commissioner('Comissario da Liga', p_access_code)::jsonb;
    if coalesce((v_login ->> 'ok')::boolean, false) is false then
      return jsonb_build_object('ok', false, 'message', 'Login do comissario invalido.');
    end if;

    return jsonb_build_object(
      'ok', true,
      'managerId', 'comissario',
      'managerName', 'Comissário da Liga',
      'clubName', 'Governança da Liga',
      'isCommissioner', true
    );
  end if;

  select id, display_name
    into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'managerId', v_manager.id,
    'managerName', coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    'clubName', coalesce(v_login #>> '{manager,club}', ''),
    'isCommissioner', false
  );
end;
$$;

create or replace function public.app_security_same_team(
  p_left text,
  p_right text
)
returns boolean
language sql
stable
as $$
  select lower(regexp_replace(coalesce(p_left, ''), '\s+(football club|fc|afc)$', '', 'i'))
       = lower(regexp_replace(coalesce(p_right, ''), '\s+(football club|fc|afc)$', '', 'i'));
$$;

create or replace function public.app_add_result(
  p_manager_id text,
  p_access_code text,
  p_competition text,
  p_week integer,
  p_phase text,
  p_home text,
  p_away text,
  p_home_score integer,
  p_away_score integer,
  p_goal_details text default '',
  p_assist_details text default '',
  p_penalty_winner text default '',
  p_penalty_score text default '',
  p_submitted_by text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_club text;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_club := coalesce(v_login ->> 'clubName', '');

  if not v_is_commissioner
     and not public.app_security_same_team(v_club, p_home)
     and not public.app_security_same_team(v_club, p_away) then
    return jsonb_build_object('ok', false, 'message', 'Voce so pode enviar resultado de jogos do seu clube.');
  end if;

  return public.app_add_result(
    'eafc26'::text,
    p_competition,
    p_week,
    p_phase,
    p_home,
    p_away,
    p_home_score,
    p_away_score,
    p_goal_details,
    p_assist_details,
    p_penalty_winner,
    p_penalty_score,
    coalesce(nullif(trim(p_submitted_by), ''), v_login ->> 'managerName')
  );
end;
$$;

create or replace function public.app_add_transfer(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric
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
  v_rate numeric := 0;
  v_final_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  if not v_is_commissioner and lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A transferencia precisa ser enviada pelo comprador logado.');
  end if;

  v_rate := case
    when coalesce(p_overall, 0) >= 89 then 0.25
    when coalesce(p_overall, 0) >= 84 then 0.20
    when coalesce(p_overall, 0) >= 80 then 0.15
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end;
  v_final_value := coalesce(p_market_value, 0) + (coalesce(p_market_value, 0) * v_rate);

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);

  v_budget := coalesce(public.app_get_data()::jsonb -> 'budgets' -> p_buyer, '{}'::jsonb);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', p_buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', p_buyer));
  end if;

  if v_final_value > v_remaining then
    return jsonb_build_object(
      'ok', false,
      'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_final_value - v_remaining, 'FM999G999G999G999G990')))
    );
  end if;

  return public.app_record_external_transfer(
    p_buyer,
    p_player,
    p_from_club,
    p_overall,
    p_market_value,
    v_final_value
  );
end;
$$;

create or replace function public.app_generate_due_events(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode gerar eventos automaticos.');
  end if;

  return public.app_generate_due_events('eafc26'::text);
end;
$$;

create or replace function public.app_simulate_cpu_week(
  p_manager_id text,
  p_access_code text,
  p_week integer,
  p_submitted_by text default 'Liga'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode simular rodadas CPU x CPU.');
  end if;

  return public.app_simulate_cpu_week('eafc26'::text, p_week, p_submitted_by);
end;
$$;

do $$
begin
  if to_regprocedure('public.app_add_result(text,text,integer,text,text,text,integer,integer,text,text,text,text,text)') is not null then
    revoke execute on function public.app_add_result(text, text, integer, text, text, text, integer, integer, text, text, text, text, text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_add_transfer(text,text,text,text,integer,numeric)') is not null then
    revoke execute on function public.app_add_transfer(text, text, text, text, integer, numeric) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_generate_due_events(text)') is not null then
    revoke execute on function public.app_generate_due_events(text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_simulate_cpu_week(text,integer,text)') is not null then
    revoke execute on function public.app_simulate_cpu_week(text, integer, text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_add_internal_transfer(text,text,text,text,text,integer,numeric)') is not null then
    revoke execute on function public.app_add_internal_transfer(text, text, text, text, text, integer, numeric) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_record_external_transfer(text,text,text,integer,numeric,numeric)') is not null then
    revoke execute on function public.app_record_external_transfer(text, text, text, integer, numeric, numeric) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_ensure_transfer_table_schema()') is not null then
    revoke execute on function public.app_ensure_transfer_table_schema() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_find_transfer_table()') is not null then
    revoke execute on function public.app_find_transfer_table() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_transfer_column(regclass,text[])') is not null then
    revoke execute on function public.app_transfer_column(regclass, text[]) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_debug_transfer_tables()') is not null then
    revoke execute on function public.app_debug_transfer_tables() from public, anon, authenticated;
  end if;
end;
$$;

grant execute on function public.app_security_login(text, text) to anon, authenticated;
grant execute on function public.app_get_budget_reconciliation() to anon, authenticated;
grant execute on function public.app_add_result(text, text, text, integer, text, text, text, integer, integer, text, text, text, text, text) to anon, authenticated;
grant execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_generate_due_events(text, text) to anon, authenticated;
grant execute on function public.app_simulate_cpu_week(text, text, integer, text) to anon, authenticated;

alter table if exists public.sponsorship_contracts enable row level security;
alter table if exists public.sponsorship_rewards enable row level security;
alter table if exists public.internal_transfer_proposals enable row level security;
alter table if exists public.governance_auction_intents enable row level security;
alter table if exists public.governance_medical_actions enable row level security;
alter table if exists public.governance_weekly_reviews enable row level security;
alter table if exists public.commissioner_admins enable row level security;

do $$
begin
  if to_regclass('public.commissioner_admins') is not null then
    revoke all on table public.commissioner_admins from anon, authenticated;
  end if;
end;
$$;
