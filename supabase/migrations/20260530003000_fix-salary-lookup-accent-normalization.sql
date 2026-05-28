begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.app_salary_lookup_key(p_value text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select regexp_replace(
    regexp_replace(
      lower(trim(extensions.unaccent(coalesce(p_value, '')))),
      '\m(football club|futbol club|futbol kulubu|futbol kulubu|club de futbol|club de futebol|futebol clube|societa sportiva|societa sportiva|sports club|sporting club|association football club|real club deportivo|grupo desportivo|calcio|s\.?p\.?a\.?|s\.?a\.?d\.?|fc|cf|sc|ac|as|rc|cd|sd|afc|fk|pfk|club)\M',
      '',
      'gi'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

commit;
