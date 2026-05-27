-- v105 - Compatibilidade de schema para pgcrypto (avoid extension path drift).
-- Garante que `extensions.digest` funcione mesmo se pgcrypto foi criado
-- originalmente no schema public em ambientes legados.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto;

do $$
begin
  if to_regprocedure('extensions.digest(text, text)') is null
     and to_regprocedure('public.digest(text, text)') is not null then
    execute $sql$
      create or replace function extensions.digest(p_data text, p_algorithm text)
      returns bytea
      language sql
      immutable strict
      as $$
        select public.digest(coalesce(p_data, ''), p_algorithm);
      $$;
    $sql$;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
