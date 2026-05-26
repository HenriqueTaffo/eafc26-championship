-- v97 - Fix external transfer proposals without trade-in players.
-- The negotiation RPCs use a PL/pgSQL record for optional trade-in data.
-- A record has to be assigned before any field reference, even when the
-- current proposal does not include a player exchange.

begin;

do $$
declare
  v_sql text;
  v_marker text := 'Safe empty trade record for no-player trade proposals.';
  v_initializer text := E'begin
  -- Safe empty trade record for no-player trade proposals.
  select
    null::bigint as id,
    null::text as player_name,
    null::text as from_club,
    null::integer as overall,
    null::numeric as market_value,
    null::numeric as final_value,
    null::numeric as negotiated_value,
    null::text as transfer_type,
    null::text as current_owner
    into v_trade;

  if public.app_transfer_window_is_locked() then';
begin
  select pg_get_functiondef(
    'public.app_create_external_transfer_proposal(text,text,text,text,text,integer,numeric,numeric,numeric,text,text,text,numeric)'::regprocedure
  )
    into v_sql;

  if v_sql is null then
    raise exception 'app_create_external_transfer_proposal function not found';
  end if;

  if position(v_marker in v_sql) = 0 then
    v_sql := regexp_replace(
      v_sql,
      E'begin[[:space:]]+if public\\.app_transfer_window_is_locked\\(\\) then',
      v_initializer,
      'i'
    );

    if position(v_marker in v_sql) = 0 then
      raise exception 'Could not patch app_create_external_transfer_proposal trade record initializer';
    end if;

    execute v_sql;
  end if;

  select pg_get_functiondef(
    'public.app_answer_external_transfer_proposal(text,text,bigint,text,numeric)'::regprocedure
  )
    into v_sql;

  if v_sql is null then
    raise exception 'app_answer_external_transfer_proposal function not found';
  end if;

  if position(v_marker in v_sql) = 0 then
    v_sql := regexp_replace(
      v_sql,
      E'begin[[:space:]]+if public\\.app_transfer_window_is_locked\\(\\) then',
      v_initializer,
      'i'
    );

    if position(v_marker in v_sql) = 0 then
      raise exception 'Could not patch app_answer_external_transfer_proposal trade record initializer';
    end if;

    execute v_sql;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
