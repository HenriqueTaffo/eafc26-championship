-- Lista de venda dos tecnicos.
-- Tecnicos marcam jogadores que querem negociar; as propostas externas
-- passam a priorizar esses jogadores e respeitam a pedida informada.

begin;

create table if not exists public.manager_transfer_listings (
  id uuid primary key default gen_random_uuid(),
  manager_id text not null references public.managers(id),
  manager_name text not null,
  player_name text not null,
  from_club text not null default '',
  overall integer not null default 0,
  base_value numeric not null default 0,
  asking_price numeric not null default 0,
  note text not null default '',
  status text not null default 'active',
  offer_count integer not null default 0,
  last_offer_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint manager_transfer_listings_status_check
    check (status in ('active', 'removed', 'sold'))
);

create unique index if not exists manager_transfer_listings_active_unique
  on public.manager_transfer_listings (manager_id, lower(player_name))
  where status = 'active';

create index if not exists manager_transfer_listings_status_idx
  on public.manager_transfer_listings (status, manager_id, updated_at desc);

alter table public.internal_transfer_proposals
  add column if not exists sale_listing_id uuid references public.manager_transfer_listings(id);

create index if not exists internal_transfer_proposals_sale_listing_idx
  on public.internal_transfer_proposals (sale_listing_id, status, created_at desc);

create or replace function public.app_refresh_manager_transfer_listings(
  p_manager_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with latest as (
    select
      t.player_name,
      t.transfer_type,
      buyer.id as buyer_id,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
  )
  update public.manager_transfer_listings l
     set status = 'sold',
         resolved_at = now(),
         updated_at = now()
   where l.status = 'active'
     and l.manager_id = p_manager_id
     and not exists (
       select 1
       from latest latest_owner
       where latest_owner.rn = 1
         and lower(latest_owner.player_name) = lower(l.player_name)
         and latest_owner.buyer_id = l.manager_id
         and latest_owner.transfer_type <> 'cpu_sale'
     );
end;
$$;

create or replace function public.app_get_my_transfer_sale_listings(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
  v_listings jsonb;
  v_owned jsonb;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.', 'listings', '[]'::jsonb, 'ownedPlayers', '[]'::jsonb);
  end if;

  v_manager_name := v_session ->> 'managerName';
  perform public.app_refresh_manager_transfer_listings(p_manager_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'managerId', l.manager_id,
      'managerName', l.manager_name,
      'playerName', l.player_name,
      'player', l.player_name,
      'fromClub', l.from_club,
      'overall', l.overall,
      'baseValue', l.base_value,
      'askingPrice', l.asking_price,
      'note', l.note,
      'status', l.status,
      'offerCount', l.offer_count,
      'lastOfferAt', l.last_offer_at,
      'createdAt', l.created_at,
      'updatedAt', l.updated_at
    )
    order by l.updated_at desc
  ), '[]'::jsonb)
    into v_listings
  from public.manager_transfer_listings l
  where l.manager_id = p_manager_id
    and l.status = 'active';

  with latest as (
    select
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      t.transfer_type,
      buyer.id as buyer_id,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'playerName', latest.player_name,
      'player', latest.player_name,
      'fromClub', latest.from_club,
      'overall', latest.overall,
      'baseValue', latest.base_value,
      'listed', l.id is not null
    )
    order by latest.player_name
  ), '[]'::jsonb)
    into v_owned
  from latest
  left join public.manager_transfer_listings l
    on l.manager_id = p_manager_id
   and l.status = 'active'
   and lower(l.player_name) = lower(latest.player_name)
  where latest.rn = 1
    and latest.buyer_id = p_manager_id
    and latest.transfer_type <> 'cpu_sale';

  return jsonb_build_object(
    'ok', true,
    'managerName', v_manager_name,
    'listings', coalesce(v_listings, '[]'::jsonb),
    'ownedPlayers', coalesce(v_owned, '[]'::jsonb)
  );
end;
$$;

create or replace function public.app_upsert_transfer_sale_listing(
  p_manager_id text,
  p_access_code text,
  p_player text,
  p_asking_price numeric default 0,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
  v_owned record;
  v_default_asking numeric;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_manager_name := v_session ->> 'managerName';

  with latest as (
    select
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      t.transfer_type,
      buyer.id as buyer_id,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
      and lower(t.player_name) = lower(trim(p_player))
  )
  select *
    into v_owned
  from latest
  where rn = 1
    and buyer_id = p_manager_id
    and transfer_type <> 'cpu_sale';

  if v_owned.player_name is null then
    return jsonb_build_object('ok', false, 'message', 'Esse jogador nao pertence ao elenco atual do tecnico.');
  end if;

  v_default_asking := round(greatest(coalesce(v_owned.base_value, 0), 1000000) * 1.12 / 100000) * 100000;

  insert into public.manager_transfer_listings (
    manager_id,
    manager_name,
    player_name,
    from_club,
    overall,
    base_value,
    asking_price,
    note,
    status,
    updated_at
  ) values (
    p_manager_id,
    v_manager_name,
    v_owned.player_name,
    coalesce(v_owned.from_club, ''),
    coalesce(v_owned.overall, 0),
    coalesce(v_owned.base_value, 0),
    greatest(coalesce(p_asking_price, 0), v_default_asking),
    coalesce(p_note, ''),
    'active',
    now()
  )
  on conflict (manager_id, lower(player_name)) where status = 'active'
  do update set
    manager_name = excluded.manager_name,
    from_club = excluded.from_club,
    overall = excluded.overall,
    base_value = excluded.base_value,
    asking_price = excluded.asking_price,
    note = excluded.note,
    updated_at = now();

  return public.app_get_my_transfer_sale_listings(p_manager_id, p_access_code);
end;
$$;

create or replace function public.app_delete_transfer_sale_listing(
  p_manager_id text,
  p_access_code text,
  p_listing_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  update public.manager_transfer_listings
     set status = 'removed',
         resolved_at = now(),
         updated_at = now()
   where id = p_listing_id
     and manager_id = p_manager_id
     and status = 'active';

  return public.app_get_my_transfer_sale_listings(p_manager_id, p_access_code);
end;
$$;

create or replace function public.app_create_external_transfer_offers(
  p_count integer default 4,
  p_target_manager text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := least(12, greatest(1, coalesce(p_count, 4)));
  v_rows jsonb := '[]'::jsonb;
begin
  with latest as (
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      case when t.transfer_type = 'cpu_sale' then coalesce(t.destination_club, 'Clube externo') else buyer.display_name end as seller,
      buyer.id as seller_id,
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
    select
      latest.*,
      listing.id as sale_listing_id,
      listing.asking_price,
      listing.note,
      coalesce(listing.offer_count, 0) as offer_count
    from latest
    left join public.manager_transfer_listings listing
      on listing.manager_id = latest.seller_id
     and listing.status = 'active'
     and lower(listing.player_name) = lower(latest.player_name)
    where latest.rn = 1
      and latest.transfer_type <> 'cpu_sale'
      and coalesce(latest.base_value, 0) >= 1000000
      and (
        coalesce(trim(p_target_manager), '') = ''
        or lower(latest.seller) = lower(trim(p_target_manager))
      )
      and not exists (
        select 1
        from public.internal_transfer_proposals p
        where p.status = 'pending'
          and lower(p.seller) = lower(latest.seller)
          and lower(p.player) = lower(latest.player_name)
          and (
            coalesce(p.is_cpu_offer, false)
            or lower(coalesce(p.offer_source, '')) = 'cpu'
            or lower(coalesce(p.buyer, '')) = 'cpu'
          )
      )
    order by
      case when listing.id is not null then 0 else 1 end,
      coalesce(listing.offer_count, 0) asc,
      random()
    limit v_count
  ),
  prepared as (
    select
      public.app_pick_external_offer_buyer(seller) as buyer,
      seller,
      player_name as player,
      coalesce(nullif(from_club, ''), 'Elenco de ' || seller) as from_club,
      overall,
      sale_listing_id,
      greatest(
        1000000,
        round((
          case
            when sale_listing_id is not null then
              greatest(coalesce(asking_price, 0), base_value) * (0.96 + (random() * 0.12))
            else
              base_value *
              case
                when coalesce(overall, 0) >= 84 then 1.18 + (random() * 0.22)
                when coalesce(overall, 0) >= 80 then 1.12 + (random() * 0.18)
                else 1.08 + (random() * 0.14)
              end
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
      offer_source,
      sale_listing_id
    )
    select
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      true,
      'cpu',
      sale_listing_id
    from prepared
    returning *
  ),
  touched_listings as (
    update public.manager_transfer_listings listing
       set offer_count = listing.offer_count + 1,
           last_offer_at = now(),
           updated_at = now()
      from inserted
     where inserted.sale_listing_id = listing.id
     returning listing.id
  )
  select coalesce(jsonb_agg(to_jsonb(inserted) order by inserted.created_at desc), '[]'::jsonb)
    into v_rows
  from inserted;

  return coalesce(v_rows, '[]'::jsonb);
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
  v_rows jsonb;
  v_created integer := 0;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode gerar propostas externas.');
  end if;

  v_rows := public.app_create_external_transfer_offers(p_count, p_target_manager);
  v_created := jsonb_array_length(coalesce(v_rows, '[]'::jsonb));

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'offers', coalesce(v_rows, '[]'::jsonb),
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
  v_rows jsonb;
  v_created integer := 0;
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

  v_rows := public.app_create_external_transfer_offers(least(8, greatest(1, coalesce(p_count, 4))), '');
  v_created := jsonb_array_length(coalesce(v_rows, '[]'::jsonb));

  update public.cpu_transfer_offer_runs
     set created_count = v_created,
         updated_at = now()
   where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'skipped', false,
    'runDate', v_run_date,
    'offers', coalesce(v_rows, '[]'::jsonb),
    'message', case
      when v_created = 0 then 'Nenhum jogador elegivel para proposta automatica externa hoje.'
      when v_created = 1 then '1 proposta automatica externa gerada.'
      else v_created::text || ' propostas automaticas externas geradas.'
    end
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

    update public.manager_transfer_listings
       set status = 'sold',
           resolved_at = now(),
           updated_at = now()
     where id = v_proposal.sale_listing_id
       and status = 'active';

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

  update public.manager_transfer_listings
     set status = 'sold',
         resolved_at = now(),
         updated_at = now()
   where manager_id = p_manager_id
     and status = 'active'
     and lower(player_name) = lower(v_proposal.player);

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta aceita. %s foi vendido para %s.', v_proposal.player, v_proposal.buyer),
    'status', 'accepted',
    'transfer', v_transfer_result
  );
end;
$$;

grant execute on function public.app_get_my_transfer_sale_listings(text, text) to anon, authenticated;
grant execute on function public.app_upsert_transfer_sale_listing(text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.app_delete_transfer_sale_listing(text, text, uuid) to anon, authenticated;
grant execute on function public.app_generate_cpu_transfer_proposals(text, text, integer, text) to anon, authenticated;
grant execute on function public.app_generate_due_cpu_transfer_proposals(integer) to anon, authenticated;
grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text) to anon, authenticated;
revoke execute on function public.app_create_external_transfer_offers(integer, text) from public, anon, authenticated;
revoke execute on function public.app_refresh_manager_transfer_listings(text) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
