begin;

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
    reference_type,
    notes,
    source_checked_at,
    updated_at
  ) values (
    trim(p_player_name),
    nullif(trim(coalesce(p_club_name, '')), ''),
    p_weekly_salary_eur,
    trim(p_source_name),
    trim(p_source_url),
    public.app_salary_reference_type(p_source_name, p_source_url, 'public_other'),
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
    reference_type = public.app_salary_reference_type(
      excluded.source_name,
      excluded.source_url,
      coalesce(public.player_salary_references.reference_type, 'public_other')
    ),
    notes = coalesce(excluded.notes, public.player_salary_references.notes),
    source_checked_at = now(),
    updated_at = now();
end;
$$;

update public.player_salary_references
   set reference_type = public.app_salary_reference_type(
     source_name,
     source_url,
     'public_other'
   ),
       updated_at = now()
 where coalesce(reference_type, 'public_other') = 'public_other';

notify pgrst, 'reload schema';

commit;
