-- v95 - Clear external market signings after negotiation workflow rollout.
-- Keeps managers, clubs, base rosters, finance rules, admins, RPCs, RLS and
-- internal/CPU-sale proposal mechanics. Removes only external market signings
-- and their paired trade-out markers.

begin;

with market_rows as (
  select
    id,
    trade_in_transfer_id
  from public.transfers
  where lower(coalesce(transfer_type, 'market')) not in ('internal', 'cpu_sale')
),
paired_trade_sales as (
  select distinct trade_in_transfer_id as id
  from market_rows
  where trade_in_transfer_id is not null
)
delete from public.transfers t
using paired_trade_sales p
where t.id = p.id;

delete from public.transfers t
where lower(coalesce(t.transfer_type, 'market')) not in ('internal', 'cpu_sale');

delete from public.internal_transfer_proposals p
where coalesce(p.proposal_type, '') = 'external_market'
   or coalesce(p.offer_source, '') = 'external_market';

notify pgrst, 'reload schema';

commit;
