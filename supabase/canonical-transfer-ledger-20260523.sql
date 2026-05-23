-- Canonical transfer ledger - 23/05/2026.
--
-- Removes the legacy transfer columns that caused double reads and conflicting
-- status/value calculations. Public RPC payloads still expose the names used by
-- the current frontend, but the database writes and budget logic now use one
-- canonical schema.

begin;

create or replace function public.calculate_transfer_rate(p_overall integer)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_overall, 0) >= 89 then 0.25
    when coalesce(p_overall, 0) >= 84 then 0.15
    when coalesce(p_overall, 0) >= 80 then 0.10
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end::numeric;
$$;

create or replace function public.pt_status(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'approved' then 'Aprovado'
    when 'pending' then 'Pendente'
    when 'rejected' then 'Rejeitado'
    when 'cancelled' then 'Cancelado'
    when 'reversed' then 'Desfeito'
    when 'active' then 'Ativo'
    when 'applied' then 'Aplicado'
    when 'generated' then 'Gerado'
    when 'ended' then 'Encerrado'
    when 'recovered' then 'Recuperado'
    else coalesce(p_status, '')
  end;
$$;

alter table public.transfers
  add column if not exists transfer_type text,
  add column if not exists seller_id text references public.managers(id),
  add column if not exists negotiated_value numeric,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by text;

alter table public.transfers
  drop constraint if exists transfers_status_check;

alter table public.transfers
  add constraint transfers_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'reversed'));

alter table public.transfers
  drop constraint if exists transfers_transfer_type_check;

alter table public.transfers
  add constraint transfers_transfer_type_check
  check (transfer_type in ('market', 'internal', 'auction', 'manual'));

update public.transfers t
   set buyer_id = coalesce(
         t.buyer_id,
         (
           select m.id
           from public.managers m
           where lower(m.display_name) = lower(t."Comprador")
           limit 1
         )
       ),
       player_name = coalesce(nullif(t.player_name, ''), nullif(t."Jogador", '')),
       from_club = coalesce(nullif(t.from_club, ''), nullif(t."ClubeOrigem", '')),
       overall = coalesce(t.overall, t."Overall", 0),
       market_value = coalesce(t.market_value, t."ValorTransfermarkt", 0),
       overall_rate = coalesce(
         t.overall_rate,
         case
           when coalesce(t.market_value, t."ValorTransfermarkt", 0) > 0
                and t.final_value is not null
             then greatest(0, (t.final_value / coalesce(t.market_value, t."ValorTransfermarkt", 1)) - 1)
           else public.calculate_transfer_rate(coalesce(t.overall, t."Overall", 0))
         end
       ),
       status = case lower(coalesce(t.status, t."Status", 'pending'))
         when 'aprovado' then 'approved'
         when 'approved' then 'approved'
         when 'pendente' then 'pending'
         when 'pending' then 'pending'
         when 'rejeitado' then 'rejected'
         when 'rejected' then 'rejected'
         when 'cancelado' then 'cancelled'
         when 'cancelled' then 'cancelled'
         when 'desfeito' then 'reversed'
         when 'reversed' then 'reversed'
         else 'pending'
       end,
       reason = coalesce(nullif(t.reason, ''), 'OK'),
       created_at = coalesce(t.created_at, t."Timestamp", now()),
       updated_at = coalesce(t.updated_at, t.created_at, t."Timestamp", now()),
       transfer_type = case lower(coalesce(t.transfer_type, t."TipoTransferencia", 'market'))
         when 'internal' then 'internal'
         when 'interno' then 'internal'
         when 'auction' then 'auction'
         when 'leilao' then 'auction'
         when 'manual' then 'manual'
         else 'market'
       end,
       seller_id = coalesce(
         t.seller_id,
         (
           select m.id
           from public.managers m
           where lower(m.display_name) = lower(t."Vendedor")
           limit 1
         )
       ),
       negotiated_value = coalesce(t.negotiated_value, t."ValorNegociado"),
       reversed_at = coalesce(t.reversed_at, t."RevertidaEm"),
       reversed_by = coalesce(t.reversed_by, t."RevertidaPor");

alter table public.transfers
  alter column buyer_id set not null,
  alter column player_name set not null,
  alter column market_value set not null,
  alter column overall_rate set not null,
  alter column status set not null,
  alter column created_at set not null,
  alter column transfer_type set not null,
  alter column transfer_type set default 'market';

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
      where e.status in ('active', 'applied', 'generated')
    ), 0::numeric) as event_bonus,
    count(e.id) filter (
      where e.status in ('active', 'applied', 'generated')
    ) as event_count,
    coalesce(sum(e.transfer_modifier) filter (
      where e.status in ('active', 'applied', 'generated')
        and (e.created_at at time zone 'America/Sao_Paulo')::date =
            (now() at time zone 'America/Sao_Paulo')::date
    ), 0)::integer as transfer_modifier,
    count(e.id) filter (
      where e.status in ('active', 'applied', 'generated')
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
    coalesce(sum(t.final_value) filter (
      where t.status = 'approved'
        and t.transfer_type <> 'internal'
    ), 0::numeric) as spent_total,
    count(t.id) filter (
      where t.status = 'approved'
        and t.transfer_type <> 'internal'
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
  coalesce(es.event_bonus, 0::numeric) as event_bonus,
  (65000000 + (coalesce(hs.home_matches, 0) * 1250000) + (coalesce(hs.wins, 0) * 500000))::numeric
    + coalesce(es.event_bonus, 0::numeric) as total_budget,
  coalesce(ts.spent_total, 0::numeric) as spent_total,
  ((65000000 + (coalesce(hs.home_matches, 0) * 1250000) + (coalesce(hs.wins, 0) * 500000))::numeric
    + coalesce(es.event_bonus, 0::numeric))
    - coalesce(ts.spent_total, 0::numeric) as remaining_budget,
  coalesce(es.event_count, 0)::integer as event_count,
  coalesce(es.active_injuries, 0)::integer as active_injuries,
  coalesce(es.transfer_modifier, 0)::integer as transfer_modifier,
  greatest(0, 3 + coalesce(es.transfer_modifier, 0))::integer as transfer_limit_today,
  coalesce(ts.transfers_today, 0)::integer as transfers_today
from manager_base mb
left join home_stats hs on hs.manager_id = mb.manager_id
left join event_stats es on es.manager_id = mb.manager_id
left join transfer_stats ts on ts.manager_id = mb.manager_id;

create or replace view public.v_recent_activity as
select
  ma.created_at as activity_at,
  'Resultado'::text as activity_type,
  home.name || ' ' || ma.home_score || ' x ' || ma.away_score || ' ' || away.name as title,
  ma.competition || ' · ' || ma.phase || coalesce(' · ' || manager.display_name, '') as detail
from public.matches ma
join public.clubs home on home.id = ma.home_club_id
join public.clubs away on away.id = ma.away_club_id
left join public.managers manager on manager.id = ma.submitted_by
where ma.status <> 'cancelled'
union all
select
  t.created_at as activity_at,
  'Transferência'::text as activity_type,
  m.display_name || ' contratou ' || t.player_name as title,
  coalesce(t.from_club, '') || ' · € ' || round(t.final_value)::text as detail
from public.transfers t
join public.managers m on m.id = t.buyer_id
where t.status = 'approved'
union all
select
  e.created_at as activity_at,
  'Evento'::text as activity_type,
  e.title,
  m.display_name || ' · ' || e.type || ' · ' || e.status as detail
from public.events e
join public.managers m on m.id = e.manager_id
where e.status <> 'cancelled';

create or replace function public.app_record_external_transfer(
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric,
  p_final_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id text;
  v_rate numeric := 0;
begin
  select id
    into v_buyer_id
  from public.managers
  where lower(display_name) = lower(p_buyer)
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', p_buyer));
  end if;

  v_rate := case
    when coalesce(p_market_value, 0) > 0 and p_final_value is not null
      then greatest(0, (p_final_value / p_market_value) - 1)
    else public.calculate_transfer_rate(p_overall)
  end;

  insert into public.transfers (
    buyer_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
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
    'approved',
    'OK',
    'market',
    now(),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Transferencia registrada.',
    'buyer', p_buyer,
    'player', p_player,
    'fromClub', p_from_club,
    'overall', p_overall,
    'marketValue', p_market_value,
    'finalValue', coalesce(p_market_value, 0) * (1 + v_rate)
  );
end;
$$;

create or replace function public.app_get_external_transfer_today_count(p_buyer text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.transfers t
  join public.managers m on m.id = t.buyer_id
  where t.status = 'approved'
    and t.transfer_type <> 'internal'
    and lower(m.display_name) = lower(p_buyer)
    and (t.created_at at time zone 'America/Sao_Paulo')::date =
        (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public.app_get_transfer_spend_totals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with approved as (
    select
      m.display_name as buyer,
      lower(t.player_name) as player_key,
      t.final_value,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.status = 'approved'
      and t.transfer_type <> 'internal'
  ),
  totals as (
    select buyer, sum(final_value)::numeric as spent_total
    from approved
    where rn = 1
    group by buyer
  )
  select coalesce(jsonb_object_agg(buyer, spent_total), '{}'::jsonb)
  from totals;
$$;

create or replace function public.app_get_transfer_spend_breakdown()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with rows as (
    select
      m.display_name as buyer,
      lower(t.player_name) as player_key,
      coalesce(t.market_value, 0) as market_value,
      coalesce(t.final_value, 0) as final_value,
      t.status as status_key,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.transfer_type <> 'internal'
  ),
  approved_totals as (
    select
      buyer,
      sum(market_value)::numeric as market_total,
      sum(final_value)::numeric as final_total,
      sum(greatest(final_value - market_value, 0))::numeric as delta_total
    from rows
    where status_key = 'approved'
      and rn = 1
    group by buyer
  ),
  non_approved_totals as (
    select
      buyer,
      sum(market_value)::numeric as non_approved_market_total
    from rows
    where status_key <> 'approved'
    group by buyer
  )
  select coalesce(jsonb_object_agg(
    coalesce(a.buyer, n.buyer),
    jsonb_build_object(
      'marketTotal', coalesce(a.market_total, 0),
      'finalTotal', coalesce(a.final_total, 0),
      'deltaTotal', coalesce(a.delta_total, 0),
      'nonApprovedMarketTotal', coalesce(n.non_approved_market_total, 0)
    )
  ), '{}'::jsonb)
  from approved_totals a
  full outer join non_approved_totals n on n.buyer = a.buyer;
$$;

create or replace function public.app_insert_financial_event(
  p_manager_name text,
  p_title text,
  p_description text,
  p_effect text,
  p_type text,
  p_impact numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_id text;
  v_club_id bigint;
begin
  select m.id, c.id
    into v_manager_id, v_club_id
  from public.managers m
  left join public.clubs c on c.owner_id = m.id
  where lower(m.display_name) = lower(p_manager_name)
  limit 1;

  if v_manager_id is null then
    return;
  end if;

  insert into public.events (
    event_date,
    slot_hour,
    manager_id,
    club_id,
    type,
    title,
    description,
    effect,
    financial_impact,
    transfer_modifier,
    status,
    created_at,
    updated_at
  ) values (
    current_date,
    null,
    v_manager_id,
    v_club_id,
    coalesce(nullif(trim(p_type), ''), 'Financeiro'),
    coalesce(nullif(trim(p_title), ''), 'Evento financeiro'),
    coalesce(p_description, ''),
    coalesce(p_effect, ''),
    coalesce(p_impact, 0),
    0,
    'applied',
    now(),
    now()
  );
end;
$$;

create or replace function public.app_record_internal_transfer(
  p_buyer text,
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id text;
  v_seller_id text;
  v_current_owner text;
  v_value numeric := coalesce(p_market_value, 0);
begin
  if coalesce(trim(p_buyer), '') = '' or coalesce(trim(p_seller), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe comprador e vendedor.');
  end if;

  if lower(trim(p_buyer)) = lower(trim(p_seller)) then
    return jsonb_build_object('ok', false, 'message', 'Comprador e vendedor precisam ser tecnicos diferentes.');
  end if;

  if coalesce(trim(p_player), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o jogador negociado.');
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(p_buyer)
  limit 1;

  select id into v_seller_id
  from public.managers
  where lower(display_name) = lower(p_seller)
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', p_buyer));
  end if;

  if v_seller_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o vendedor %s.', p_seller));
  end if;

  select m.display_name
    into v_current_owner
  from public.transfers t
  join public.managers m on m.id = t.buyer_id
  where lower(t.player_name) = lower(p_player)
    and t.status = 'approved'
  order by t.created_at desc nulls last, t.id desc
  limit 1;

  if v_current_owner is null then
    return jsonb_build_object('ok', false, 'message', 'Jogador nao encontrado entre as transferencias aprovadas.');
  end if;

  if lower(trim(v_current_owner)) <> lower(trim(p_seller)) then
    return jsonb_build_object(
      'ok', false,
      'message', format('Este jogador pertence atualmente a %s, nao a %s.', v_current_owner, p_seller)
    );
  end if;

  insert into public.transfers (
    buyer_id,
    seller_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
    status,
    reason,
    transfer_type,
    negotiated_value,
    created_at,
    updated_at
  ) values (
    v_buyer_id,
    v_seller_id,
    trim(p_player),
    coalesce(nullif(trim(p_from_club), ''), 'Negociacao interna: ' || p_seller),
    coalesce(p_overall, 0),
    v_value,
    0,
    'approved',
    'OK',
    'internal',
    v_value,
    now(),
    now()
  );

  perform public.app_insert_financial_event(
    p_seller,
    'Venda interna: ' || p_player,
    p_seller || ' vendeu ' || p_player || ' para ' || p_buyer || '.',
    '+' || v_value::text || ' creditado ao orcamento.',
    'Negociacao interna',
    v_value
  );

  perform public.app_insert_financial_event(
    p_buyer,
    'Compra interna: ' || p_player,
    p_buyer || ' comprou ' || p_player || ' de ' || p_seller || '.',
    '-' || v_value::text || ' descontado do orcamento.',
    'Negociacao interna',
    -v_value
  );

  return jsonb_build_object(
    'ok', true,
    'message', format('%s negociado de %s para %s.', p_player, p_seller, p_buyer),
    'transferType', 'internal',
    'seller', p_seller,
    'buyer', p_buyer,
    'player', p_player,
    'value', v_value,
    'budgetEventsCreated', true
  );
end;
$$;

create or replace function public.app_create_internal_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_name text;
  v_login jsonb;
  v_current_owner text;
  v_existing_id bigint;
  v_proposal_id bigint;
begin
  select display_name
    into v_manager_name
  from public.managers
  where id = p_manager_id;

  if v_manager_name is null then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  v_login := public.app_login_manager(v_manager_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  v_manager_name := coalesce(v_login #>> '{manager,name}', v_manager_name);

  if lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A proposta precisa ser enviada pelo comprador logado.');
  end if;

  if lower(trim(p_buyer)) = lower(trim(p_seller)) then
    return jsonb_build_object('ok', false, 'message', 'Comprador e vendedor precisam ser diferentes.');
  end if;

  if coalesce(p_market_value, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe um valor de proposta maior que zero.');
  end if;

  select m.display_name
    into v_current_owner
  from public.transfers t
  join public.managers m on m.id = t.buyer_id
  where lower(t.player_name) = lower(p_player)
    and t.status = 'approved'
  order by t.created_at desc nulls last, t.id desc
  limit 1;

  if lower(coalesce(v_current_owner, '')) <> lower(trim(p_seller)) then
    return jsonb_build_object(
      'ok', false,
      'message', format('Este jogador pertence atualmente a %s, nao a %s.', coalesce(v_current_owner, 'ninguem'), p_seller)
    );
  end if;

  select id
    into v_existing_id
  from public.internal_transfer_proposals
  where lower(player) = lower(p_player)
    and lower(buyer) = lower(p_buyer)
    and lower(seller) = lower(p_seller)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Ja existe uma proposta pendente para este jogador entre estes tecnicos.');
  end if;

  insert into public.internal_transfer_proposals (
    buyer,
    seller,
    player,
    from_club,
    overall,
    proposed_value
  ) values (
    p_buyer,
    p_seller,
    p_player,
    p_from_club,
    p_overall,
    p_market_value
  )
  returning id into v_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta enviada para %s aprovar ou recusar.', p_seller),
    'proposalId', v_proposal_id
  );
end;
$$;

create or replace function public.app_answer_internal_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_proposal_id bigint,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_name text;
  v_login jsonb;
  v_proposal public.internal_transfer_proposals%rowtype;
  v_transfer_result jsonb;
  v_status text;
begin
  select display_name
    into v_manager_name
  from public.managers
  where id = p_manager_id;

  if v_manager_name is null then
    return jsonb_build_object('ok', false, 'message', 'Login do vendedor invalido.');
  end if;

  v_login := public.app_login_manager(v_manager_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do vendedor invalido.');
  end if;

  v_manager_name := coalesce(v_login #>> '{manager,name}', v_manager_name);

  select *
    into v_proposal
  from public.internal_transfer_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Proposta nao encontrada.');
  end if;

  if lower(v_proposal.seller) <> lower(v_manager_name) then
    return jsonb_build_object('ok', false, 'message', 'Apenas o vendedor pode responder esta proposta.');
  end if;

  if v_proposal.status <> 'pending' then
    return jsonb_build_object('ok', false, 'message', 'Esta proposta ja foi respondida.');
  end if;

  v_status := case
    when lower(p_decision) in ('accepted', 'accept', 'aceitar', 'aprovado') then 'accepted'
    else 'rejected'
  end;

  if v_status = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Proposta recusada pelo vendedor.'
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'message', 'Proposta recusada.', 'status', 'rejected');
  end if;

  v_transfer_result := public.app_record_internal_transfer(
    v_proposal.buyer,
    v_proposal.seller,
    v_proposal.player,
    coalesce(v_proposal.from_club, 'Negociacao interna: ' || v_proposal.seller),
    coalesce(v_proposal.overall, 0),
    coalesce(v_proposal.proposed_value, 0)
  );

  if coalesce((v_transfer_result ->> 'ok')::boolean, false) is not true then
    return v_transfer_result;
  end if;

  update public.internal_transfer_proposals
     set status = 'accepted',
         answered_at = now(),
         answered_by = v_manager_name,
         response_message = 'Proposta aceita pelo vendedor.'
   where id = p_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta aceita. %s foi vendido para %s.', v_proposal.player, v_proposal.buyer),
    'status', 'accepted',
    'transfer', v_transfer_result
  );
end;
$$;

create or replace function public.app_reverse_transfer(
  p_manager_id text,
  p_access_code text,
  p_transfer_id bigint default null,
  p_buyer text default '',
  p_player text default '',
  p_from_club text default '',
  p_timestamp text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_rows integer := 0;
  v_actor text;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode desfazer transferencias.');
  end if;

  v_actor := coalesce(v_login ->> 'managerName', 'Comissario da Liga');

  update public.transfers t
     set status = 'reversed',
         reversed_at = now(),
         reversed_by = v_actor,
         updated_at = now()
    from public.managers m
   where m.id = t.buyer_id
     and t.status = 'approved'
     and (
       (coalesce(p_transfer_id, 0) > 0 and t.id = p_transfer_id)
       or (
         lower(m.display_name) = lower(coalesce(p_buyer, ''))
         and lower(t.player_name) = lower(coalesce(p_player, ''))
         and (
           coalesce(p_from_club, '') = ''
           or lower(coalesce(t.from_club, '')) = lower(coalesce(p_from_club, ''))
         )
         and (
           coalesce(p_timestamp, '') = ''
           or t.created_at::text = p_timestamp
         )
       )
     );

  get diagnostics v_rows = row_count;

  if v_rows = 0 and coalesce(p_buyer, '') <> '' and coalesce(p_player, '') <> '' then
    update public.transfers
       set status = 'reversed',
           reversed_at = now(),
           reversed_by = v_actor,
           updated_at = now()
     where id = (
       select t.id
       from public.transfers t
       join public.managers m on m.id = t.buyer_id
       where lower(m.display_name) = lower(coalesce(p_buyer, ''))
         and lower(t.player_name) = lower(coalesce(p_player, ''))
         and t.status = 'approved'
       order by t.created_at desc nulls last, t.id desc
       limit 1
     );

    get diagnostics v_rows = row_count;
  end if;

  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'message', 'Transferencia aprovada nao encontrada para desfazer.');
  end if;

  delete from public.events
   where lower(coalesce(title, '')) in (
       lower('Compra interna: ' || coalesce(p_player, '')),
       lower('Venda interna: ' || coalesce(p_player, ''))
     )
     and coalesce(status, '') in ('applied', 'active', 'generated');

  return jsonb_build_object(
    'ok', true,
    'message', 'Transferencia desfeita. O jogador foi liberado e o orcamento sera recalculado.',
    'rowsUpdated', v_rows
  );
end;
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
          'Comprador', buyer.display_name,
          'Jogador', t.player_name,
          'ClubeOrigem', t.from_club,
          'Overall', t.overall,
          'ValorTransfermarkt', t.market_value,
          'PercentualOverall', t.overall_rate,
          'ValorFinal', t.final_value,
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

alter table public.transfers
  drop column if exists "TipoTransferencia",
  drop column if exists "Vendedor",
  drop column if exists "ValorNegociado",
  drop column if exists "ValorFinal",
  drop column if exists "ClubeOrigem",
  drop column if exists "Overall",
  drop column if exists "ValorTransfermarkt",
  drop column if exists "Comprador",
  drop column if exists "Jogador",
  drop column if exists "Status",
  drop column if exists "Timestamp",
  drop column if exists "RevertidaEm",
  drop column if exists "RevertidaPor";

drop function if exists public.app_add_internal_transfer(text, text, text, text, text, integer, numeric);
drop function if exists public.app_find_transfer_table();
drop function if exists public.app_find_transfer_table_for_admin();
drop function if exists public.app_ensure_transfer_table_schema();
drop function if exists public.app_transfer_column(regclass, text[]);
drop function if exists public.app_find_event_table();

revoke execute on function public.app_record_external_transfer(text, text, text, integer, numeric, numeric)
  from public, anon, authenticated;

revoke execute on function public.app_record_internal_transfer(text, text, text, text, integer, numeric)
  from public, anon, authenticated;

revoke execute on function public.app_insert_financial_event(text, text, text, text, text, numeric)
  from public, anon, authenticated;

grant execute on function public.app_get_data() to anon, authenticated;
grant execute on function public.app_get_external_transfer_today_count(text) to anon, authenticated;
grant execute on function public.app_get_transfer_spend_totals() to anon, authenticated;
grant execute on function public.app_get_transfer_spend_breakdown() to anon, authenticated;
grant execute on function public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text) to anon, authenticated;
grant execute on function public.app_reverse_transfer(text, text, bigint, text, text, text, text) to anon, authenticated;

comment on table public.transfers
  is 'Canonical transfer ledger. Public RPCs expose compatibility JSON, but storage uses only canonical columns.';

commit;
