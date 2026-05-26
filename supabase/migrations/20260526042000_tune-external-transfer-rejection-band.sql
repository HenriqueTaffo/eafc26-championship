-- v98 - Tune external market rejection band.
-- Reasonable low openings should become counteroffers, not dead negotiations.

begin;

do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(
    'public.app_external_transfer_seller_response(numeric,numeric,integer,integer)'::regprocedure
  )
    into v_sql;

  if v_sql is null then
    raise exception 'app_external_transfer_seller_response function not found';
  end if;

  if position('v_offer < (v_floor * 0.78)' in v_sql) > 0 then
    v_sql := replace(v_sql, 'v_offer < (v_floor * 0.78)', 'v_offer < (v_floor * 0.72)');
    execute v_sql;
  end if;
end $$;

with rejected_band as (
  select
    p.id,
    p.buyer_offer_value,
    p.trade_in_credit,
    greatest(
      100000,
      round(
        (
          greatest(100000, coalesce(p.reference_value, 0)) *
          case
            when coalesce(p.overall, 0) >= 88 then 1.24
            when coalesce(p.overall, 0) >= 84 then 1.20
            when coalesce(p.overall, 0) >= 80 then 1.15
            when coalesce(p.overall, 0) >= 76 then 1.10
            when coalesce(p.overall, 0) >= 72 then 1.06
            else 1.03
          end
        ) / 100000,
        0
      ) * 100000
    ) as seller_value
  from public.internal_transfer_proposals p
  where p.proposal_type = 'external_market'
    and p.status = 'rejected'
    and coalesce(p.response_message, '') = 'Clube vendedor recusou a proposta. A diferenca para a avaliacao interna ficou grande demais.'
)
update public.internal_transfer_proposals p
   set status = 'buyer_review',
       proposed_value = rejected_band.seller_value,
       cash_offer_value = greatest(0, rejected_band.seller_value - coalesce(rejected_band.trade_in_credit, 0)),
       response_message = 'Clube vendedor respondeu com contraoferta. Revise no hub antes de confirmar.'
  from rejected_band
 where p.id = rejected_band.id
   and rejected_band.buyer_offer_value >= rejected_band.seller_value * 0.72
   and rejected_band.buyer_offer_value < rejected_band.seller_value;

notify pgrst, 'reload schema';

commit;
