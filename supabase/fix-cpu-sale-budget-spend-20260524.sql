-- Corrige orçamento após venda externa - 24/05/2026.
-- Vendas para clubes externos aumentam receita via evento financeiro, mas não
-- podem entrar como gasto do técnico.

create or replace view public.v_manager_budgets as
with manager_base as (
  select
    m.id as manager_id,
    m.display_name as manager_name,
    c.id as club_id,
    c.name as club_name
  from public.managers m
  left join public.clubs c on c.owner_id = m.id
),
home_stats as (
  select
    mb.manager_id,
    count(ma.id) filter (
      where ma.status = 'approved'
        and ma.competition = 'Championship'
        and ma.home_club_id = mb.club_id
    ) as home_matches,
    count(ma.id) filter (
      where ma.status = 'approved'
        and ma.competition = 'Championship'
        and (
          (ma.home_club_id = mb.club_id and ma.home_score > ma.away_score)
          or (ma.away_club_id = mb.club_id and ma.away_score > ma.home_score)
        )
    ) as wins
  from manager_base mb
  left join public.matches ma
    on ma.home_club_id = mb.club_id
    or ma.away_club_id = mb.club_id
  group by mb.manager_id
),
event_stats as (
  select
    e.manager_id,
    coalesce(sum(e.financial_impact) filter (
      where e.status = any (array['active', 'applied', 'generated'])
    ), 0)::numeric as event_bonus,
    count(e.id) filter (
      where e.status = any (array['active', 'applied', 'generated'])
    ) as event_count,
    coalesce(sum(e.transfer_modifier) filter (
      where e.status = any (array['active', 'applied', 'generated'])
        and (e.created_at at time zone 'America/Sao_Paulo')::date =
          (now() at time zone 'America/Sao_Paulo')::date
    ), 0)::integer as transfer_modifier,
    count(e.id) filter (
      where e.status = any (array['active', 'applied', 'generated'])
        and coalesce(e.affected_player, '') <> ''
        and (
          coalesce(e.matches_remaining, 0) > 0
          or e.expires_at > now()
          or e.expires_at is null
        )
    ) as active_injuries
  from public.events e
  group by e.manager_id
),
transfer_stats as (
  select
    t.buyer_id as manager_id,
    coalesce(sum(
      case
        when t.status = 'approved'
          and t.transfer_type not in ('internal', 'cpu_sale')
          then coalesce(t.negotiated_value, t.final_value, 0)
        else 0
      end
    ), 0)::numeric as spent_total,
    count(t.id) filter (
      where t.status = 'approved'
        and t.transfer_type not in ('internal', 'cpu_sale')
        and (t.created_at at time zone 'America/Sao_Paulo')::date =
          (now() at time zone 'America/Sao_Paulo')::date
    ) as transfers_today
  from public.transfers t
  group by t.buyer_id
)
select
  mb.manager_id,
  mb.manager_name,
  mb.club_id,
  mb.club_name,
  65000000::numeric as base_budget,
  coalesce(hs.home_matches, 0)::integer as home_matches,
  coalesce(hs.wins, 0)::integer as wins,
  (coalesce(hs.home_matches, 0) * 1250000)::numeric as home_bonus,
  (coalesce(hs.wins, 0) * 500000)::numeric as win_bonus,
  coalesce(es.event_bonus, 0)::numeric as event_bonus,
  (65000000 + coalesce(hs.home_matches, 0) * 1250000 + coalesce(hs.wins, 0) * 500000)::numeric
    + coalesce(es.event_bonus, 0)::numeric as total_budget,
  coalesce(ts.spent_total, 0)::numeric as spent_total,
  (65000000 + coalesce(hs.home_matches, 0) * 1250000 + coalesce(hs.wins, 0) * 500000)::numeric
    + coalesce(es.event_bonus, 0)::numeric
    - coalesce(ts.spent_total, 0)::numeric as remaining_budget,
  coalesce(es.event_count, 0)::integer as event_count,
  coalesce(es.active_injuries, 0)::integer as active_injuries,
  coalesce(es.transfer_modifier, 0)::integer as transfer_modifier,
  greatest(0, 3 + coalesce(es.transfer_modifier, 0)) as transfer_limit_today,
  coalesce(ts.transfers_today, 0)::integer as transfers_today
from manager_base mb
left join home_stats hs on hs.manager_id = mb.manager_id
left join event_stats es on es.manager_id = mb.manager_id
left join transfer_stats ts on ts.manager_id = mb.manager_id;
