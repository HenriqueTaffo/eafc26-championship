-- Ofertas externas com clubes reais.
-- Mantem a origem automatica da proposta, mas troca o comprador generico "CPU"
-- por um clube real interessado e grava esse destino nas vendas aceitas.

begin;

alter table public.transfers
  add column if not exists destination_club text;

create index if not exists idx_transfers_destination_club
  on public.transfers (destination_club)
  where transfer_type = 'cpu_sale';

create or replace function public.app_pick_external_offer_buyer(
  p_seller text default ''
)
returns text
language sql
security definer
volatile
set search_path = public
as $$
  with external_clubs(club_name) as (
    values
      ('Arsenal'),
      ('Aston Villa'),
      ('Bournemouth'),
      ('Brentford'),
      ('Brighton'),
      ('Burnley'),
      ('Chelsea'),
      ('Crystal Palace'),
      ('Everton'),
      ('Fulham'),
      ('Leeds United'),
      ('Liverpool'),
      ('Manchester City'),
      ('Manchester United'),
      ('Newcastle United'),
      ('Nottingham Forest'),
      ('Sunderland'),
      ('Tottenham Hotspur'),
      ('West Ham United'),
      ('Wolverhampton'),
      ('Bolton Wanderers'),
      ('Reading'),
      ('Wigan Athletic'),
      ('Barnsley'),
      ('Stockport County'),
      ('Bradford City'),
      ('Lincoln City'),
      ('Peterborough United')
  ),
  league_cpu_clubs as (
    select c.name as club_name
    from public.clubs c
    where c.owner_id is null
  ),
  pool as (
    select club_name from external_clubs
    union
    select club_name from league_cpu_clubs
  )
  select coalesce((
    select club_name
    from pool
    where coalesce(trim(club_name), '') <> ''
    order by random()
    limit 1
  ), 'Clube interessado');
$$;

create or replace function public.app_record_cpu_transfer_sale(
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_value numeric,
  p_destination_club text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id text;
  v_current_owner text;
  v_current_overall integer := 0;
  v_value numeric := coalesce(p_value, 0);
  v_destination_club text := coalesce(nullif(trim(p_destination_club), ''), 'Clube interessado');
begin
  if coalesce(trim(p_seller), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o vendedor.');
  end if;

  if coalesce(trim(p_player), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o jogador negociado.');
  end if;

  if v_value <= 0 then
    return jsonb_build_object('ok', false, 'message', 'A proposta externa precisa ter valor maior que zero.');
  end if;

  select id into v_seller_id
  from public.managers
  where lower(display_name) = lower(p_seller)
  limit 1;

  if v_seller_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o vendedor %s.', p_seller));
  end if;

  select
    case when t.transfer_type = 'cpu_sale' then coalesce(nullif(t.destination_club, ''), 'Clube externo') else m.display_name end,
    coalesce(t.overall, 0)
    into v_current_owner, v_current_overall
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
    destination_club,
    created_at,
    updated_at
  ) values (
    v_seller_id,
    v_seller_id,
    trim(p_player),
    coalesce(nullif(trim(p_from_club), ''), 'Elenco de ' || p_seller),
    case when coalesce(p_overall, 0) > 0 then p_overall else v_current_overall end,
    0,
    0,
    'approved',
    'Venda externa',
    'cpu_sale',
    v_value,
    v_destination_club,
    now(),
    now()
  );

  perform public.app_insert_financial_event(
    p_seller,
    'Venda externa: ' || p_player,
    p_seller || ' vendeu ' || p_player || ' para ' || v_destination_club || '.',
    '+' || v_value::text || ' creditado ao orcamento.',
    'Venda externa',
    v_value
  );

  return jsonb_build_object(
    'ok', true,
    'message', format('%s vendido para %s por %s.', p_player, v_destination_club, trim(to_char(v_value, 'FM999G999G999G999G990'))),
    'transferType', 'cpu_sale',
    'seller', p_seller,
    'buyer', v_destination_club,
    'destinationClub', v_destination_club,
    'player', p_player,
    'value', v_value,
    'budgetEventsCreated', true
  );
end;
$$;

create or replace function public.app_record_cpu_transfer_sale(
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_value numeric
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.app_record_cpu_transfer_sale(
    p_seller,
    p_player,
    p_from_club,
    p_overall,
    p_value,
    public.app_pick_external_offer_buyer(p_seller)
  );
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
  v_session jsonb;
  v_manager_name text;
  v_proposal public.internal_transfer_proposals%rowtype;
  v_transfer_result jsonb;
  v_status text;
  v_is_cpu_offer boolean;
  v_external_buyer text;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do vendedor invalido.');
  end if;

  v_manager_name := v_session ->> 'managerName';

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
  v_is_cpu_offer := coalesce(v_proposal.is_cpu_offer, false)
    or lower(coalesce(v_proposal.offer_source, '')) = 'cpu'
    or lower(coalesce(v_proposal.buyer, '')) = 'cpu';
  v_external_buyer := case
    when lower(coalesce(v_proposal.buyer, '')) = 'cpu' then public.app_pick_external_offer_buyer(v_proposal.seller)
    else coalesce(nullif(trim(v_proposal.buyer), ''), public.app_pick_external_offer_buyer(v_proposal.seller))
  end;

  if v_is_cpu_offer and lower(coalesce(v_proposal.buyer, '')) = 'cpu' then
    update public.internal_transfer_proposals
       set buyer = v_external_buyer
     where id = p_proposal_id;
  end if;

  if v_status = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = case
             when v_is_cpu_offer then 'Proposta de ' || v_external_buyer || ' recusada pelo vendedor.'
             else 'Proposta recusada pelo vendedor.'
           end
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'message', 'Proposta recusada.', 'status', 'rejected');
  end if;

  if v_is_cpu_offer then
    v_transfer_result := public.app_record_cpu_transfer_sale(
      v_proposal.seller,
      v_proposal.player,
      coalesce(v_proposal.from_club, 'Elenco de ' || v_proposal.seller),
      coalesce(v_proposal.overall, 0),
      coalesce(v_proposal.proposed_value, 0),
      v_external_buyer
    );

    if coalesce((v_transfer_result ->> 'ok')::boolean, false) is not true then
      return v_transfer_result;
    end if;

    update public.internal_transfer_proposals
       set status = 'accepted',
           buyer = v_external_buyer,
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Proposta de ' || v_external_buyer || ' aceita pelo vendedor.'
     where id = p_proposal_id;

    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = 'Sistema',
           response_message = 'Encerrada porque o jogador foi vendido para ' || v_external_buyer || '.'
     where id <> p_proposal_id
       and status = 'pending'
       and lower(seller) = lower(v_proposal.seller)
       and lower(player) = lower(v_proposal.player)
       and (
         coalesce(is_cpu_offer, false)
         or lower(coalesce(offer_source, '')) = 'cpu'
         or lower(coalesce(buyer, '')) = 'cpu'
       );

    return jsonb_build_object(
      'ok', true,
      'message', format('Proposta aceita. %s foi vendido para %s.', v_proposal.player, v_external_buyer),
      'status', 'accepted',
      'transfer', v_transfer_result
    );
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

create or replace function public.app_generate_cpu_transfer_proposals(
  p_manager_id text,
  p_access_code text,
  p_count integer default 4,
  p_target_manager text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_count integer := least(12, greatest(1, coalesce(p_count, 4)));
  v_created integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode gerar propostas externas.');
  end if;

  with latest as (
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      case when t.transfer_type = 'cpu_sale' then coalesce(t.destination_club, 'Clube externo') else buyer.display_name end as seller,
      t.transfer_type,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
  ),
  eligible as (
    select *
    from latest l
    where l.rn = 1
      and l.transfer_type <> 'cpu_sale'
      and lower(l.seller) <> 'cpu'
      and coalesce(l.base_value, 0) > 0
      and (
        coalesce(trim(p_target_manager), '') = ''
        or lower(l.seller) = lower(trim(p_target_manager))
      )
      and not exists (
        select 1
        from public.internal_transfer_proposals p
        where p.status = 'pending'
          and lower(p.seller) = lower(l.seller)
          and lower(p.player) = lower(l.player_name)
          and (
            coalesce(p.is_cpu_offer, false)
            or lower(coalesce(p.offer_source, '')) = 'cpu'
            or lower(coalesce(p.buyer, '')) = 'cpu'
          )
      )
    order by random()
    limit v_count
  ),
  prepared as (
    select
      public.app_pick_external_offer_buyer(seller) as buyer,
      seller,
      player_name as player,
      coalesce(nullif(from_club, ''), 'Elenco de ' || seller) as from_club,
      overall,
      greatest(
        1000000,
        round((
          base_value *
          case
            when coalesce(overall, 0) >= 84 then 1.18 + (random() * 0.22)
            when coalesce(overall, 0) >= 80 then 1.12 + (random() * 0.18)
            else 1.08 + (random() * 0.14)
          end
        ) / 100000) * 100000
      )::numeric as proposed_value
    from eligible
  ),
  inserted as (
    insert into public.internal_transfer_proposals (
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      is_cpu_offer,
      offer_source
    )
    select
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      true,
      'cpu'
    from prepared
    returning *
  )
  select count(*)::integer, coalesce(jsonb_agg(to_jsonb(inserted) order by created_at desc), '[]'::jsonb)
    into v_created, v_rows
  from inserted;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'offers', v_rows,
    'message', case
      when v_created = 0 then 'Nenhum jogador elegivel para nova proposta externa agora.'
      when v_created = 1 then '1 proposta externa gerada.'
      else v_created::text || ' propostas externas geradas.'
    end
  );
end;
$$;

create or replace function public.app_generate_due_cpu_transfer_proposals(
  p_count integer default 4
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id bigint;
  v_run_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_count integer := least(8, greatest(1, coalesce(p_count, 4)));
  v_created integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  insert into public.cpu_transfer_offer_runs (run_date, run_kind)
  values (v_run_date, 'daily')
  on conflict (run_date, run_kind) do nothing
  returning id into v_run_id;

  if v_run_id is null then
    return jsonb_build_object(
      'ok', true,
      'created', 0,
      'skipped', true,
      'message', 'Propostas automaticas externas ja foram avaliadas hoje.'
    );
  end if;

  with latest as (
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      case when t.transfer_type = 'cpu_sale' then coalesce(t.destination_club, 'Clube externo') else buyer.display_name end as seller,
      t.transfer_type,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
  ),
  eligible as (
    select *
    from latest l
    where l.rn = 1
      and l.transfer_type <> 'cpu_sale'
      and lower(l.seller) <> 'cpu'
      and coalesce(l.base_value, 0) >= 1000000
      and not exists (
        select 1
        from public.internal_transfer_proposals p
        where p.status = 'pending'
          and lower(p.seller) = lower(l.seller)
          and lower(p.player) = lower(l.player_name)
          and (
            coalesce(p.is_cpu_offer, false)
            or lower(coalesce(p.offer_source, '')) = 'cpu'
            or lower(coalesce(p.buyer, '')) = 'cpu'
          )
      )
    order by random()
    limit v_count
  ),
  prepared as (
    select
      public.app_pick_external_offer_buyer(seller) as buyer,
      seller,
      player_name as player,
      coalesce(nullif(from_club, ''), 'Elenco de ' || seller) as from_club,
      overall,
      greatest(
        1000000,
        round((
          base_value *
          case
            when coalesce(overall, 0) >= 84 then 1.18 + (random() * 0.22)
            when coalesce(overall, 0) >= 80 then 1.12 + (random() * 0.18)
            else 1.08 + (random() * 0.14)
          end
        ) / 100000) * 100000
      )::numeric as proposed_value
    from eligible
  ),
  inserted as (
    insert into public.internal_transfer_proposals (
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      is_cpu_offer,
      offer_source
    )
    select
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      true,
      'cpu'
    from prepared
    returning *
  )
  select count(*)::integer, coalesce(jsonb_agg(to_jsonb(inserted) order by created_at desc), '[]'::jsonb)
    into v_created, v_rows
  from inserted;

  update public.cpu_transfer_offer_runs
     set created_count = v_created,
         updated_at = now()
   where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'skipped', false,
    'runDate', v_run_date,
    'offers', v_rows,
    'message', case
      when v_created = 0 then 'Nenhum jogador elegivel para proposta automatica externa hoje.'
      when v_created = 1 then '1 proposta automatica externa gerada.'
      else v_created::text || ' propostas automaticas externas geradas.'
    end
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
          'Comprador', case
            when t.transfer_type = 'cpu_sale' then coalesce(nullif(t.destination_club, ''), 'Clube interessado')
            else buyer.display_name
          end,
          'CompradorRegistro', buyer.display_name,
          'Jogador', t.player_name,
          'ClubeOrigem', t.from_club,
          'ClubeDestino', coalesce(t.destination_club, ''),
          'Destino', coalesce(t.destination_club, ''),
          'destination_club', coalesce(t.destination_club, ''),
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

update public.internal_transfer_proposals
   set buyer = public.app_pick_external_offer_buyer(seller),
       response_message = replace(coalesce(response_message, ''), 'CPU', 'clube interessado')
 where (coalesce(is_cpu_offer, false) or lower(coalesce(offer_source, '')) = 'cpu')
   and lower(coalesce(buyer, '')) = 'cpu';

update public.transfers t
   set destination_club = coalesce(
         nullif(t.destination_club, ''),
         (
           select p.buyer
           from public.internal_transfer_proposals p
           where (coalesce(p.is_cpu_offer, false) or lower(coalesce(p.offer_source, '')) = 'cpu')
             and p.status = 'accepted'
             and lower(p.player) = lower(t.player_name)
             and exists (
               select 1
               from public.managers sm
               where sm.id = t.seller_id
                 and lower(p.seller) = lower(sm.display_name)
             )
           order by p.answered_at desc nulls last, p.created_at desc
           limit 1
         ),
         public.app_pick_external_offer_buyer(coalesce(seller.display_name, ''))
       ),
       reason = case when lower(coalesce(t.reason, '')) = 'venda para cpu' then 'Venda externa' else t.reason end,
       updated_at = now()
  from public.managers seller
 where t.transfer_type = 'cpu_sale'
   and t.seller_id = seller.id
   and coalesce(nullif(t.destination_club, ''), '') = '';

update public.transfers
   set reason = replace(coalesce(reason, ''), 'CPU', coalesce(nullif(destination_club, ''), 'clube interessado')),
       updated_at = now()
 where transfer_type = 'cpu_sale'
   and reason ilike '%CPU%';

grant execute on function public.app_pick_external_offer_buyer(text) to anon, authenticated;
revoke execute on function public.app_record_cpu_transfer_sale(text, text, text, integer, numeric) from public, anon, authenticated;
revoke execute on function public.app_record_cpu_transfer_sale(text, text, text, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text) to anon, authenticated;
grant execute on function public.app_generate_cpu_transfer_proposals(text, text, integer, text) to anon, authenticated;
grant execute on function public.app_generate_due_cpu_transfer_proposals(integer) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
