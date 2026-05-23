-- Database cleanup - 23/05/2026.
--
-- Goal: remove dead/staging objects and make legacy internals explicit.
-- This intentionally keeps active feature tables even when empty
-- (auctions, medical actions, weekly reviews, internal proposals).

begin;

do $$
declare
  v_staging_rows integer := 0;
begin
  if to_regclass('public.players_market_import') is not null then
    execute 'select count(*)::integer from public.players_market_import'
      into v_staging_rows;

    if v_staging_rows > 0 then
      raise exception 'players_market_import still has % row(s); refusing to drop staging table.', v_staging_rows;
    end if;
  end if;
end;
$$;

drop function if exists public.import_players_market_from_staging();
drop table if exists public.players_market_import;

drop function if exists public.app_debug_transfer_tables();

drop function if exists public.app_add_transfer(
  text,
  text,
  text,
  text,
  integer,
  numeric
);

drop function if exists public.app_apply_injury_countdown_for_match(
  text,
  bigint
);

revoke execute on function public.app_add_internal_transfer(
  text,
  text,
  text,
  text,
  text,
  integer,
  numeric
) from public, anon, authenticated;

revoke execute on function public.app_add_result(
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

revoke execute on function public.app_generate_due_events(text)
  from public, anon, authenticated;

revoke execute on function public.app_simulate_cpu_week(text, integer, text)
  from public, anon, authenticated;

comment on function public.app_add_internal_transfer(
  text,
  text,
  text,
  text,
  text,
  integer,
  numeric
) is 'Internal implementation used by proposal approval flow. Do not grant directly to clients.';

comment on function public.app_add_result(
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) is 'Internal legacy implementation used by authenticated app_add_result wrapper. Do not grant directly to clients.';

comment on function public.app_generate_due_events(text)
  is 'Internal legacy implementation used by authenticated commissioner wrapper. Do not grant directly to clients.';

comment on function public.app_simulate_cpu_week(text, integer, text)
  is 'Internal legacy implementation used by authenticated commissioner wrapper. Do not grant directly to clients.';

comment on table public.transfers
  is 'Transfer ledger. Contains canonical columns plus temporary legacy aliases kept for app_get_data compatibility.';

comment on table public.events
  is 'Unified event ledger for injuries, market effects and financial impacts.';

commit;
