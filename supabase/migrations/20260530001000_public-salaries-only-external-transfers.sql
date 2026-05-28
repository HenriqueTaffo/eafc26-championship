begin;

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
      public.app_salary_lookup_key(p_player_name) as player_lookup_key,
      public.app_salary_lookup_key(p_club_name) as club_lookup_key
  ),
  direct_ref as (
    select
      r.id,
      r.player_name,
      coalesce(r.club_name, '') as club_name,
      r.weekly_salary_eur,
      r.source_name,
      r.source_url,
      r.source_checked_at,
      coalesce(r.reference_type, public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')) as reference_type,
      1 as source_priority,
      case
        when (select club_lookup_key from inputs) <> ''
          and public.app_salary_lookup_key(coalesce(r.club_name, '')) = (select club_lookup_key from inputs)
          then 0
        else 1
      end as club_priority
    from public.player_salary_references r
    cross join inputs i
    where public.app_salary_lookup_key(r.player_name) = i.player_lookup_key
  ),
  roster_ref as (
    select
      r.id,
      r.player_name,
      r.club_name,
      r.estimated_weekly_salary_eur as weekly_salary_eur,
      coalesce(r.salary_source_name, r.source_name) as source_name,
      coalesce(r.salary_source_url, r.source_url) as source_url,
      coalesce(r.salary_checked_at, r.updated_at) as source_checked_at,
      coalesce(r.salary_reference_type, 'public_club_payroll_reference') as reference_type,
      2 as source_priority,
      case
        when (select club_lookup_key from inputs) <> ''
          and public.app_salary_lookup_key(r.club_name) = (select club_lookup_key from inputs)
          then 0
        else 1
      end as club_priority
    from public.club_roster_players r
    cross join inputs i
    where public.app_salary_lookup_key(r.player_name) = i.player_lookup_key
      and coalesce(r.estimated_weekly_salary_eur, 0) > 0
      and trim(coalesce(r.salary_source_url, r.source_url, '')) ~* '^https?://'
  ),
  public_refs as (
    select * from direct_ref
    union all
    select * from roster_ref
  ),
  ranked_refs as (
    select
      public_refs.*,
      row_number() over (
        order by
          source_priority,
          club_priority,
          source_checked_at desc nulls last,
          id desc
      ) as rn
    from public_refs
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
        'salaryCheckedAt', source_checked_at,
        'referenceType', reference_type
      )
      from ranked_refs
      where rn = 1
    ),
    jsonb_build_object(
      'ok', false,
      'playerName', trim(coalesce(p_player_name, '')),
      'clubName', trim(coalesce(p_club_name, '')),
      'message', 'Salario publico pendente para este jogador. Sincronize Capology ou SalarySport antes de negociar.'
    )
  );
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
    when submitted.is_valid then
      jsonb_build_object(
        'ok', true,
        'playerName', trim(coalesce(p_player_name, '')),
        'clubName', trim(coalesce(p_club_name, '')),
        'weeklySalary', submitted.weekly_salary,
        'salarySourceName', submitted.source_name,
        'salarySourceUrl', submitted.source_url,
        'salaryCheckedAt', now(),
        'referenceType', submitted.reference_type
      )
    when coalesce((quote.j ->> 'ok')::boolean, false) then quote.j
    else jsonb_build_object(
      'ok', false,
      'playerName', trim(coalesce(p_player_name, '')),
      'clubName', trim(coalesce(p_club_name, '')),
      'message', coalesce(
        quote.j ->> 'message',
        'Transferencia bloqueada: informe salario semanal e fonte publica.'
      )
    )
  end
  from quote, submitted;
$$;

commit;
