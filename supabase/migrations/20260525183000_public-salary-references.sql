-- Requires public salary references for transfer payroll.
-- Market value remains Transfermarkt-based; wages must come from Capology,
-- SalarySport or another public URL and are never inferred from overall.

begin;

alter table public.transfers
  add column if not exists weekly_salary_eur numeric,
  add column if not exists salary_source_name text,
  add column if not exists salary_source_url text,
  add column if not exists salary_checked_at timestamptz;

alter table public.club_roster_players
  add column if not exists salary_source_name text,
  add column if not exists salary_source_url text,
  add column if not exists salary_reference_type text not null default 'public_club_payroll_reference',
  add column if not exists salary_checked_at timestamptz;

create table if not exists public.player_salary_references (
  id bigserial primary key,
  player_name text not null,
  club_name text,
  weekly_salary_eur numeric not null check (weekly_salary_eur > 0),
  currency text not null default 'EUR',
  period text not null default 'week',
  source_name text not null,
  source_url text not null check (source_url ~* '^https?://'),
  source_checked_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_salary_references enable row level security;
revoke all on table public.player_salary_references from anon, authenticated;

create unique index if not exists player_salary_references_unique_source
  on public.player_salary_references (
    lower(trim(player_name)),
    lower(trim(coalesce(club_name, ''))),
    lower(trim(source_url))
  );

create index if not exists player_salary_references_lookup_idx
  on public.player_salary_references (
    lower(trim(player_name)),
    lower(trim(coalesce(club_name, '')))
  );

update public.club_roster_players
   set source_name = 'EA SPORTS FC 26 ratings',
       salary_source_name = case
         when lower(club_name) = lower('Coventry City') then 'Capology Coventry City public salary page'
         when lower(club_name) = lower('Birmingham City') then 'Capology Birmingham City public salary page'
         when lower(club_name) = lower('Middlesbrough') then 'Capology Middlesbrough public salary page'
         when lower(club_name) = lower('Southampton') then 'Capology Southampton public salary page'
         when lower(club_name) = lower('Wrexham') then 'Capology Wrexham public salary page'
         else 'Public club payroll reference'
       end,
       salary_source_url = case
         when lower(club_name) = lower('Coventry City') then 'https://www.capology.com/club/coventry/salaries/'
         when lower(club_name) = lower('Birmingham City') then 'https://www.capology.com/club/birmingham/salaries/'
         when lower(club_name) = lower('Middlesbrough') then 'https://www.capology.com/club/middlesbrough/salaries/'
         when lower(club_name) = lower('Southampton') then 'https://www.capology.com/club/southampton/salaries/'
         when lower(club_name) = lower('Wrexham') then 'https://www.capology.com/club/wrexham/salaries/'
         else source_url
       end,
       salary_reference_type = 'public_club_payroll_reference',
       salary_checked_at = coalesce(salary_checked_at, now()),
       updated_at = now();

insert into public.player_salary_references (
  player_name,
  club_name,
  weekly_salary_eur,
  source_name,
  source_url,
  notes
) values
  (
    'Cristiano Ronaldo',
    'Al Nassr',
    4007692,
    'Capology Cristiano Ronaldo public salary profile',
    'https://www.capology.com/player/cristiano-ronaldo-31083/',
    'High-wage superstar guardrail example: public wage must enter payroll even when market value is low.'
  ),
  (
    'Lukas Klostermann',
    'RB Leipzig',
    108846,
    'Capology Lukas Klostermann public salary profile',
    'https://www.capology.com/player/lukas-klostermann-35219/',
    'Public wage reference used for league payroll checks.'
  ),
  (
    'Jeremiah St. Juste',
    'Sporting CP',
    37692,
    'Capology Jeremiah St. Juste public salary profile',
    'https://www.capology.com/player/jeremiah-st-juste-35357/',
    'Public wage reference used for league payroll checks.'
  )
on conflict do nothing;

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

create or replace function public.app_transfer_window_is_locked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when jsonb_typeof(value) = 'boolean' then value = 'true'::jsonb
        when jsonb_typeof(value) = 'string' then lower(value #>> '{}') = 'true'
        else false
      end
      from public.league_config
      where key = 'transfer_window_locked'
      limit 1
    ),
    false
  );
$$;

create or replace function public.app_upsert_player_salary_reference(
  p_player_name text,
  p_club_name text,
  p_weekly_salary_eur numeric,
  p_source_name text,
  p_source_url text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_public_salary_reference_is_valid(p_weekly_salary_eur, p_source_name, p_source_url) is false then
    raise exception 'Referencia publica de salario invalida.';
  end if;

  insert into public.player_salary_references (
    player_name,
    club_name,
    weekly_salary_eur,
    source_name,
    source_url,
    notes,
    source_checked_at,
    updated_at
  ) values (
    trim(p_player_name),
    nullif(trim(coalesce(p_club_name, '')), ''),
    p_weekly_salary_eur,
    trim(p_source_name),
    trim(p_source_url),
    p_notes,
    now(),
    now()
  )
  on conflict (
    lower(trim(player_name)),
    lower(trim(coalesce(club_name, ''))),
    lower(trim(source_url))
  )
  do update set
    weekly_salary_eur = excluded.weekly_salary_eur,
    source_name = excluded.source_name,
    notes = coalesce(excluded.notes, public.player_salary_references.notes),
    source_checked_at = now(),
    updated_at = now();
end;
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
  with inputs as (
    select
      lower(trim(coalesce(p_player_name, ''))) as player_key,
      lower(trim(coalesce(p_club_name, ''))) as club_key
  ),
  direct_ref as (
    select
      r.player_name,
      coalesce(r.club_name, '') as club_name,
      r.weekly_salary_eur,
      r.source_name,
      r.source_url,
      r.source_checked_at,
      1 as priority
    from public.player_salary_references r
    cross join inputs i
    where lower(trim(r.player_name)) = i.player_key
      and (
        i.club_key = ''
        or lower(trim(coalesce(r.club_name, ''))) = i.club_key
      )
    order by
      case when lower(trim(coalesce(r.club_name, ''))) = (select club_key from inputs) then 0 else 1 end,
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
      2 as priority
    from public.club_roster_players r
    cross join inputs i
    where lower(trim(r.player_name)) = i.player_key
      and (
        i.club_key = ''
        or lower(trim(r.club_name)) = i.club_key
      )
      and coalesce(r.estimated_weekly_salary_eur, 0) > 0
      and trim(coalesce(r.salary_source_url, r.source_url, '')) ~* '^https?://'
    order by
      case when lower(trim(r.club_name)) = (select club_key from inputs) then 0 else 1 end,
      r.updated_at desc nulls last,
      r.id desc
    limit 1
  ),
  best as (
    select * from direct_ref
    union all
    select * from roster_ref
    order by priority
    limit 1
  )
  select coalesce(
    (
      select jsonb_build_object(
        'ok', true,
        'playerName', player_name,
        'clubName', club_name,
        'weeklySalary', weekly_salary_eur,
        'salarySourceName', source_name,
        'salarySourceUrl', source_url,
        'salaryCheckedAt', source_checked_at
      )
      from best
    ),
    jsonb_build_object(
      'ok', false,
      'message', 'Sem referencia publica de salario para este jogador.'
    )
  );
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
      'direct_public_player_salary'::text as reference_type
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

create or replace function public.app_get_manager_current_payroll(
  p_buyer text,
  p_exclude_player text default ''
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with manager_match as (
    select
      m.id,
      m.display_name,
      c.name as club_name
    from public.managers m
    left join public.clubs c on c.owner_id = m.id
    where lower(m.display_name) = lower(trim(p_buyer))
       or lower(m.id) = lower(trim(p_buyer))
    limit 1
  ),
  base_roster as (
    select coalesce(sum(r.estimated_weekly_salary_eur), 0)::numeric as payroll_weekly
    from public.club_roster_players r
    join manager_match mm on lower(r.club_name) = lower(mm.club_name)
    where (
      coalesce(trim(p_exclude_player), '') = ''
      or lower(trim(r.player_name)) <> lower(trim(p_exclude_player))
    )
  ),
  latest as (
    select
      t.*,
      row_number() over (
        partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
      and coalesce(t.player_key, t.player_name, '') <> ''
  ),
  transfer_payroll as (
    select coalesce(sum(l.weekly_salary_eur), 0)::numeric as payroll_weekly
    from latest l
    join manager_match mm on mm.id = l.buyer_id
    where l.rn = 1
      and lower(coalesce(l.transfer_type, 'market')) not in ('internal', 'cpu_sale')
      and coalesce(l.weekly_salary_eur, 0) > 0
      and (
        coalesce(trim(p_exclude_player), '') = ''
        or lower(trim(l.player_name)) <> lower(trim(p_exclude_player))
      )
      and not exists (
        select 1
        from public.club_roster_players r
        where lower(r.club_name) = lower(mm.club_name)
          and lower(r.player_name) = lower(l.player_name)
      )
  )
  select coalesce((select payroll_weekly from base_roster), 0)
       + coalesce((select payroll_weekly from transfer_payroll), 0);
$$;

create or replace function public.app_get_manager_finance_forecast()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with budgets as materialized (
    select public.app_get_budget_reconciliation()::jsonb as j
  ),
  rules as (
    select *
    from public.league_finance_rules
    where id = 'default'
  ),
  manager_clubs as (
    select
      m.id as manager_id,
      m.display_name as manager_name,
      c.name as club_name
    from public.managers m
    join public.clubs c on c.owner_id = m.id
    where c.is_human is true
  ),
  base_roster as (
    select
      mc.manager_id,
      count(r.id)::integer as roster_count,
      coalesce(sum(r.estimated_weekly_salary_eur), 0)::numeric as base_roster_weekly
    from manager_clubs mc
    left join public.club_roster_players r on lower(r.club_name) = lower(mc.club_name)
    group by mc.manager_id
  ),
  latest as (
    select
      t.*,
      row_number() over (
        partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
      and coalesce(t.player_key, t.player_name, '') <> ''
  ),
  transfer_payroll as (
    select
      mc.manager_id,
      count(*)::integer as transfer_count,
      count(*) filter (where coalesce(l.weekly_salary_eur, 0) <= 0)::integer as missing_salary_reference_count,
      coalesce(sum(l.weekly_salary_eur) filter (where coalesce(l.weekly_salary_eur, 0) > 0), 0)::numeric as transfer_payroll_weekly
    from manager_clubs mc
    join latest l on l.buyer_id = mc.manager_id
    where l.rn = 1
      and lower(coalesce(l.transfer_type, 'market')) not in ('internal', 'cpu_sale')
      and not exists (
        select 1
        from public.club_roster_players r
        where lower(r.club_name) = lower(mc.club_name)
          and lower(r.player_name) = lower(l.player_name)
      )
    group by mc.manager_id
  ),
  rows as (
    select
      mc.manager_name,
      mc.club_name,
      coalesce((budgets.j -> mc.manager_name ->> 'totalBudget')::numeric, 22000000) as total_budget,
      coalesce((budgets.j -> mc.manager_name ->> 'remainingBudget')::numeric, 22000000) as remaining_budget,
      coalesce((budgets.j -> mc.manager_name ->> 'spentTotal')::numeric, 0) as spent_total,
      coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtActive')::boolean, false) as salary_debt_active,
      coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtAmount')::numeric, 0) as salary_debt_amount,
      coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtWeeks')::integer, 0) as salary_debt_weeks,
      coalesce((budgets.j -> mc.manager_name ->> 'marketEmbargo')::boolean, false) as market_embargo,
      coalesce(br.roster_count, 0) + coalesce(tp.transfer_count, 0) as player_count,
      coalesce(br.base_roster_weekly, 0) as base_roster_weekly,
      coalesce(tp.transfer_payroll_weekly, 0) as transfer_payroll_weekly,
      coalesce(tp.missing_salary_reference_count, 0) as missing_salary_reference_count,
      coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0) as payroll_weekly,
      (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)) * 4 as payroll_monthly,
      case
        when coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0) <= 0 then null
        else floor(greatest(coalesce((budgets.j -> mc.manager_name ->> 'remainingBudget')::numeric, 0), 0) / (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)))::integer
      end as runway_weeks,
      case
        when coalesce(tp.missing_salary_reference_count, 0) > 0 then 'Referencia salarial pendente'
        when coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtActive')::boolean, false) then 'Divida salarial'
        when coalesce((budgets.j -> mc.manager_name ->> 'remainingBudget')::numeric, 0) < 0 then 'Divida salarial'
        when (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)) * 4 > coalesce((budgets.j -> mc.manager_name ->> 'totalBudget')::numeric, 22000000) * coalesce((select max_payroll_to_budget_ratio from rules), 0.36) then 'Folha acima do teto'
        when (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)) * 4 > coalesce((budgets.j -> mc.manager_name ->> 'totalBudget')::numeric, 22000000) * coalesce((select warning_payroll_to_budget_ratio from rules), 0.24) then 'Atencao'
        else 'Saudavel'
      end as risk
    from manager_clubs mc
    cross join budgets
    left join base_roster br on br.manager_id = mc.manager_id
    left join transfer_payroll tp on tp.manager_id = mc.manager_id
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by payroll_weekly desc), '[]'::jsonb)
  from rows;
$$;

create or replace function public.app_get_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'ok', true,

    'budget', public.get_config_numeric('transfer_budget', 65000000),
    'homeMatchBonus', public.get_config_numeric('home_match_bonus', 1250000),
    'winBonus', public.get_config_numeric('win_bonus', 500000),
    'dailyTransferLimit', public.get_config_int('daily_transfer_limit', 3),
    'eventSlots', coalesce(
      (select value from public.league_config where key = 'event_slots'),
      '[5, 8, 11, 14, 17, 20, 23]'::jsonb
    ),

    'clubs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'Time', c.name,
          'Dono', coalesce(m.display_name, 'CPU'),
          'LogoUrl', coalesce(c.logo_url, ''),
          'ApiId', c.id,
          'NomeApi', c.name,
          'CorPrimaria', c.primary_color,
          'CorSecundaria', c.secondary_color,
          'Forca', c.strength,
          'Status', 'OK',
          'Motivo', 'Supabase'
        )
        order by c.id
      )
      from public.clubs c
      left join public.managers m on m.id = c.owner_id
    ), '[]'::jsonb),

    'budgets', coalesce((
      select jsonb_object_agg(
        b.manager_name,
        jsonb_build_object(
          'buyer', b.manager_name,
          'baseBudget', b.base_budget,
          'homeMatches', b.home_matches,
          'wins', b.wins,
          'homeBonus', b.home_bonus,
          'winBonus', b.win_bonus,
          'winBonusValue', b.win_bonus,
          'eventBonus', b.event_bonus,
          'eventTotal', b.event_bonus,
          'totalBudget', b.total_budget,
          'spentTotal', b.spent_total,
          'remainingBudget', b.remaining_budget,
          'eventCount', b.event_count,
          'activeInjuries', b.active_injuries,
          'transferModifier', b.transfer_modifier,
          'transferLimit', b.transfer_limit_today,
          'transfersToday', b.transfers_today
        )
      )
      from public.v_manager_budgets b
    ), '{}'::jsonb),

    'results', coalesce((
      select jsonb_agg(row_data order by created_at)
      from (
        select
          ma.created_at,
          jsonb_build_object(
            'Timestamp', ma.created_at,
            'Competicao', ma.competition,
            'Semana', ma.week,
            'RodadaFase', ma.phase,
            'Mandante', home.name,
            'Visitante', away.name,
            'GolsMandante', ma.home_score,
            'GolsVisitante', ma.away_score,
            'GolsDetalhes', coalesce(ma.goals_details, ''),
            'AssistenciasDetalhes', coalesce(ma.assists_details, ''),
            'VencedorPenaltis', coalesce(pen.name, ''),
            'PlacarPenaltis', coalesce(ma.penalty_score, ''),
            'EnviadoPor', coalesce(m.display_name, ''),
            'ChaveUnica', coalesce(ma.unique_key, ''),
            'Status', public.pt_status(ma.status),
            'Motivo', coalesce(ma.reason, 'OK')
          ) as row_data
        from public.matches ma
        join public.clubs home on home.id = ma.home_club_id
        join public.clubs away on away.id = ma.away_club_id
        left join public.clubs pen on pen.id = ma.penalty_winner_club_id
        left join public.managers m on m.id = ma.submitted_by
        where ma.status <> 'cancelled'
      ) q
    ), '[]'::jsonb),

    'transfers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'Id', t.id,
          'Timestamp', t.created_at,
          'Comprador', case
            when t.transfer_type = 'cpu_sale' then coalesce(nullif(t.destination_club, ''), 'Clube interessado')
            else buyer.display_name
          end,
          'CompradorRegistro', buyer.display_name,
          'Jogador', t.player_name,
          'ClubeOrigem', t.from_club,
          'ClubeDestino', coalesce(t.destination_club, ''),
          'Destino', coalesce(t.destination_club, ''),
          'destination_club', coalesce(t.destination_club, ''),
          'Overall', t.overall,
          'ValorTransfermarkt', t.market_value,
          'PercentualOverall', t.overall_rate,
          'ValorFinal', t.final_value,
          'SalarioSemanal', coalesce(t.weekly_salary_eur, 0),
          'salaryWeekly', coalesce(t.weekly_salary_eur, 0),
          'weeklySalary', coalesce(t.weekly_salary_eur, 0),
          'FonteSalario', coalesce(t.salary_source_name, ''),
          'salarySourceName', coalesce(t.salary_source_name, ''),
          'UrlFonteSalario', coalesce(t.salary_source_url, ''),
          'salarySourceUrl', coalesce(t.salary_source_url, ''),
          'SalarioConferidoEm', t.salary_checked_at,
          'TipoTransferencia', t.transfer_type,
          'Vendedor', seller.display_name,
          'ValorNegociado', t.negotiated_value,
          'RevertidaEm', t.reversed_at,
          'RevertidaPor', t.reversed_by,
          'Status', public.pt_status(t.status),
          'Motivo', coalesce(t.reason, 'OK')
        )
        order by t.created_at
      )
      from public.transfers t
      join public.managers buyer on buyer.id = t.buyer_id
      left join public.managers seller on seller.id = t.seller_id
      where t.status <> 'cancelled'
    ), '[]'::jsonb),

    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'Id', e.id,
          'id', e.id,
          'Timestamp', e.created_at,
          'Data', to_char(e.event_date, 'DD/MM/YYYY'),
          'Horario', case when e.slot_hour is null then '' else lpad(e.slot_hour::text, 2, '0') || ':00' end,
          'Jogador', m.display_name,
          'Time', coalesce(c.name, ''),
          'Tipo', e.type,
          'Titulo', e.title,
          'Descricao', coalesce(e.description, ''),
          'Efeito', coalesce(e.effect, ''),
          'ImpactoFinanceiro', e.financial_impact,
          'Status', public.pt_status(e.status),
          'ChaveUnica', coalesce(e.unique_key, ''),
          'ModificadorTransferencias', e.transfer_modifier,
          'JogadorAfetado', coalesce(e.affected_player, ''),
          'DuracaoTipo', coalesce(e.duration_type, ''),
          'DuracaoValor', e.duration_value,
          'PartidasRestantes', e.matches_remaining,
          'ExpiraEm', e.expires_at
        )
        order by e.event_date, e.slot_hour, e.created_at
      )
      from public.events e
      join public.managers m on m.id = e.manager_id
      left join public.clubs c on c.id = e.club_id
      where e.status <> 'cancelled'
    ), '[]'::jsonb)
  )
  into payload;

  return payload;
end;
$$;

create or replace function public.app_get_squad_management_data()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with manager_clubs as (
    select
      m.id as manager_id,
      m.display_name as manager_name,
      c.id as club_id,
      c.name as club_name,
      c.logo_url,
      c.primary_color,
      c.secondary_color,
      c.strength
    from public.managers m
    join public.clubs c on c.owner_id = m.id
    where c.is_human is true
  )
  select jsonb_build_object(
    'ok', true,
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'managerId', manager_id,
        'managerName', manager_name,
        'clubId', club_id,
        'clubName', club_name,
        'logoUrl', logo_url,
        'primaryColor', primary_color,
        'secondaryColor', secondary_color,
        'strength', strength
      ) order by manager_name)
      from manager_clubs
    ), '[]'::jsonb),
    'rosters', coalesce((
      select jsonb_object_agg(mc.manager_name, coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'clubName', r.club_name,
          'managerName', r.manager_name,
          'eaId', r.ea_id,
          'rank', r.ea_rank,
          'name', r.player_name,
          'position', r.position,
          'positionLabel', r.position_label,
          'overall', r.overall,
          'weeklySalary', r.estimated_weekly_salary_eur,
          'salarySourceName', coalesce(r.salary_source_name, r.source_name),
          'salarySourceUrl', coalesce(r.salary_source_url, r.source_url),
          'salaryReferenceType', coalesce(r.salary_reference_type, 'public_club_payroll_reference'),
          'salaryCheckedAt', r.salary_checked_at,
          'sourceWeeklyPayroll', r.source_weekly_payroll_eur,
          'avatarUrl', r.avatar_url,
          'shieldUrl', r.shield_url,
          'nation', r.nation,
          'sourceName', r.source_name,
          'sourceUrl', r.source_url
        ) order by r.overall desc, r.ea_rank nulls last, r.player_name)
        from public.club_roster_players r
        where lower(r.club_name) = lower(mc.club_name)
      ), '[]'::jsonb))
      from manager_clubs mc
    ), '{}'::jsonb),
    'lineups', coalesce((
      select jsonb_object_agg(mc.manager_name, jsonb_build_object(
        'managerId', mc.manager_id,
        'managerName', mc.manager_name,
        'clubName', mc.club_name,
        'formation', coalesce(l.formation, '4-2-3-1'),
        'lineup', coalesce(l.lineup, '{}'::jsonb),
        'updatedAt', l.updated_at
      ))
      from manager_clubs mc
      left join public.manager_squad_lineups l on l.manager_id = mc.manager_id
    ), '{}'::jsonb),
    'finance', coalesce(public.app_get_manager_finance_forecast(), '[]'::jsonb),
    'sources', jsonb_build_object(
      'ratings', 'EA SPORTS FC 26 official team ratings',
      'salary', 'Public salary references: Capology, SalarySport or manually approved public URL',
      'currency', 'EUR weekly wages for league accounting'
    )
  );
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
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', false,
    'message', 'Transferencia bloqueada: informe salario semanal e fonte publica. Use app_add_transfer_verified_salary.'
  );
$$;

create or replace function public.app_add_transfer_with_trade(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric,
  p_trade_in_player text default '',
  p_trade_in_credit numeric default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', false,
    'message', 'Transferencia bloqueada: informe salario semanal e fonte publica. Use app_add_transfer_with_trade_verified_salary.'
  );
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
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
begin
  if public.app_transfer_window_is_locked() then
    return jsonb_build_object('ok', false, 'message', 'Janela de transferencias fechada enquanto consolidamos o app.');
  end if;

  if public.app_public_salary_reference_is_valid(p_weekly_salary_eur, p_salary_source_name, p_salary_source_url) is false then
    return jsonb_build_object('ok', false, 'message', 'Informe salario semanal e URL publica da fonte salarial.');
  end if;

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
  v_weekly_salary := coalesce(p_weekly_salary_eur, 0);

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
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. O salario publico do jogador inviabiliza a contratacao.');
  end if;

  perform public.app_upsert_player_salary_reference(
    p_player,
    p_from_club,
    v_weekly_salary,
    p_salary_source_name,
    p_salary_source_url,
    'Criado automaticamente a partir de transferencia aprovada.'
  );

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
    trim(p_salary_source_name),
    trim(p_salary_source_url),
    now(),
    'approved',
    'OK',
    'market',
    now(),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Transferencia registrada com salario publico verificado.',
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'marketValue', p_market_value,
    'finalValue', v_final_value,
    'weeklySalary', v_weekly_salary,
    'salarySourceName', p_salary_source_name,
    'salarySourceUrl', p_salary_source_url
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

  if public.app_public_salary_reference_is_valid(p_weekly_salary_eur, p_salary_source_name, p_salary_source_url) is false then
    return jsonb_build_object('ok', false, 'message', 'Informe salario semanal e URL publica da fonte salarial.');
  end if;

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
  v_weekly_salary := coalesce(p_weekly_salary_eur, 0);

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
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. O salario publico do jogador inviabiliza a contratacao.');
  end if;

  perform public.app_upsert_player_salary_reference(
    p_player,
    p_from_club,
    v_weekly_salary,
    p_salary_source_name,
    p_salary_source_url,
    'Criado automaticamente a partir de transferencia aprovada.'
  );

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
    trim(p_salary_source_name),
    trim(p_salary_source_url),
    now(),
    'approved',
    case when v_trade_credit > 0 then 'OK - Troca: ' || v_trade.player_name else 'OK' end,
    'market',
    case when v_trade_credit > 0 then v_cash_value else null end,
    case when v_trade_credit > 0 then v_trade.player_name else null end,
    coalesce(v_trade_credit, 0),
    now(),
    now()
  )
  returning id into v_purchase_id;

  if v_trade_credit > 0 then
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
    'message', case
      when v_trade_credit > 0 then 'Transferencia registrada com troca e salario publico verificado.'
      else 'Transferencia registrada com salario publico verificado.'
    end,
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'marketValue', p_market_value,
    'finalValue', v_gross_value,
    'cashValue', v_cash_value,
    'weeklySalary', v_weekly_salary,
    'salarySourceName', p_salary_source_name,
    'salarySourceUrl', p_salary_source_url,
    'tradeInPlayer', coalesce(v_trade.player_name, ''),
    'tradeInCredit', coalesce(v_trade_credit, 0)
  );
end;
$$;

grant execute on function public.app_get_public_salary_references() to anon, authenticated;
grant execute on function public.app_get_public_player_salary(text, text) to anon, authenticated;
grant execute on function public.app_get_manager_current_payroll(text, text) to anon, authenticated;
grant execute on function public.app_add_transfer_verified_salary(text, text, text, text, text, integer, numeric, numeric, text, text) to anon, authenticated;
grant execute on function public.app_add_transfer_with_trade_verified_salary(text, text, text, text, text, integer, numeric, text, numeric, numeric, text, text) to anon, authenticated;
revoke execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric) from public, anon, authenticated;
revoke execute on function public.app_add_transfer_with_trade(text, text, text, text, text, integer, numeric, text, numeric) from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.app_estimate_weekly_salary(integer,numeric,numeric)') is not null then
    revoke execute on function public.app_estimate_weekly_salary(integer, numeric, numeric)
      from public, anon, authenticated;
  end if;
end;
$$;

commit;
