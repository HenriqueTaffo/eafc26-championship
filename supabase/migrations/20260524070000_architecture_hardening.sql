-- v71 - Architecture hardening pack - 24/05/2026.
--
-- Goals:
-- 1) Stop storing manager PINs in the browser after login. The app now asks for
--    a short-lived session token and every protected RPC can validate that token
--    through app_security_login.
-- 2) Move automatic jobs to a backend maintenance function. The browser should
--    only read state or submit explicit user actions.
-- 3) Patch the remaining public RPCs that still validated directly through
--    app_login_manager, so session tokens work consistently.

begin;

create extension if not exists pgcrypto;

create table if not exists public.app_manager_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  manager_id text not null,
  manager_name text not null,
  club_name text not null default '',
  is_commissioner boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

alter table public.app_manager_sessions enable row level security;
revoke all on table public.app_manager_sessions from anon, authenticated;

create index if not exists app_manager_sessions_manager_idx
  on public.app_manager_sessions (manager_id, expires_at desc);

create index if not exists app_manager_sessions_active_idx
  on public.app_manager_sessions (expires_at desc)
  where revoked_at is null;

create or replace function public.app_hash_manager_session_token(
  p_token text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.app_validate_manager_session_token(
  p_manager_id text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.app_manager_sessions%rowtype;
begin
  if coalesce(trim(p_manager_id), '') = '' or coalesce(trim(p_session_token), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Sessao obrigatoria.');
  end if;

  select *
    into v_session
  from public.app_manager_sessions
  where token_hash = public.app_hash_manager_session_token(p_session_token)
    and manager_id = p_manager_id
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Sessao expirada. Faca login novamente.');
  end if;

  update public.app_manager_sessions
     set last_seen_at = now()
   where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'managerId', v_session.manager_id,
    'managerName', v_session.manager_name,
    'clubName', v_session.club_name,
    'isCommissioner', v_session.is_commissioner,
    'expiresAt', v_session.expires_at
  );
end;
$$;

create or replace function public.app_create_manager_session(
  p_manager_name text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_manager jsonb;
  v_token text;
  v_expires_at timestamptz := now() + interval '12 hours';
  v_manager_id text;
  v_manager_name text;
  v_club_name text;
  v_is_commissioner boolean;
begin
  if coalesce(trim(p_manager_name), '') = '' or coalesce(trim(p_access_code), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Login obrigatorio.');
  end if;

  if public.app_hash_manager_session_token(p_access_code) in (
    select token_hash
    from public.app_manager_sessions
    where revoked_at is null
      and expires_at > now()
  ) then
    return jsonb_build_object('ok', false, 'message', 'Use o PIN para criar uma nova sessao.');
  end if;

  if lower(trim(p_manager_name)) like '%comiss%' then
    v_login := public.app_login_commissioner(p_manager_name, p_access_code)::jsonb;
  else
    v_login := public.app_login_manager(p_manager_name, p_access_code)::jsonb;
  end if;

  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_manager := coalesce(v_login -> 'manager', '{}'::jsonb);
  v_manager_id := coalesce(v_manager ->> 'id', '');
  v_manager_name := coalesce(v_manager ->> 'name', trim(p_manager_name));
  v_club_name := coalesce(v_manager ->> 'club', '');
  v_is_commissioner := coalesce((v_manager ->> 'isCommissioner')::boolean, false);

  if v_manager_id = '' then
    return jsonb_build_object('ok', false, 'message', 'Sessao nao pode ser criada para este login.');
  end if;

  update public.app_manager_sessions
     set revoked_at = now()
   where manager_id = v_manager_id
     and revoked_at is null
     and expires_at <= now();

  v_token := 'mml_sess_' || encode(gen_random_bytes(32), 'hex');

  insert into public.app_manager_sessions (
    token_hash,
    manager_id,
    manager_name,
    club_name,
    is_commissioner,
    expires_at
  ) values (
    public.app_hash_manager_session_token(v_token),
    v_manager_id,
    v_manager_name,
    v_club_name,
    v_is_commissioner,
    v_expires_at
  );

  return jsonb_build_object(
    'ok', true,
    'sessionToken', v_token,
    'expiresAt', v_expires_at,
    'manager', jsonb_build_object(
      'id', v_manager_id,
      'name', v_manager_name,
      'club', v_club_name,
      'isCommissioner', v_is_commissioner
    )
  );
end;
$$;

create or replace function public.app_revoke_manager_session(
  p_manager_id text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_manager_sessions
     set revoked_at = now()
   where manager_id = p_manager_id
     and token_hash = public.app_hash_manager_session_token(p_session_token)
     and revoked_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_security_login(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager record;
  v_login jsonb;
  v_session jsonb;
begin
  if coalesce(trim(p_manager_id), '') = '' or coalesce(trim(p_access_code), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Login obrigatorio.');
  end if;

  if left(coalesce(p_access_code, ''), 9) = 'mml_sess_' then
    v_session := public.app_validate_manager_session_token(p_manager_id, p_access_code);
    if coalesce((v_session ->> 'ok')::boolean, false) is true then
      return v_session;
    end if;

    return jsonb_build_object('ok', false, 'message', coalesce(v_session ->> 'message', 'Sessao invalida.'));
  end if;

  if p_manager_id = 'comissario' then
    v_login := public.app_login_commissioner('Comissario da Liga', p_access_code)::jsonb;
    if coalesce((v_login ->> 'ok')::boolean, false) is false then
      return jsonb_build_object('ok', false, 'message', 'Login do comissario invalido.');
    end if;

    return jsonb_build_object(
      'ok', true,
      'managerId', 'comissario',
      'managerName', 'Comissário da Liga',
      'clubName', 'Governança da Liga',
      'isCommissioner', true
    );
  end if;

  select id, display_name
    into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'managerId', v_manager.id,
    'managerName', coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    'clubName', coalesce(v_login #>> '{manager,club}', ''),
    'isCommissioner', false
  );
end;
$$;

create or replace function public.app_governance_login(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;

  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode executar acoes de governanca.');
  end if;

  return v_login;
end;
$$;

create or replace function public.app_validate_manager_session(
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
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login invalido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'managerId', v_session ->> 'managerId',
    'managerName', v_session ->> 'managerName',
    'clubName', coalesce(v_session ->> 'clubName', '')
  );
end;
$$;

create table if not exists public.app_maintenance_runs (
  id bigserial primary key,
  run_key text not null unique,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  detail jsonb not null default '{}'::jsonb
);

alter table public.app_maintenance_runs enable row level security;
revoke all on table public.app_maintenance_runs from anon, authenticated;

create or replace function public.app_run_due_maintenance(
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_key text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD-HH24-MI');
  v_run_id bigint;
  v_events jsonb := '{}'::jsonb;
  v_decisions jsonb := '{}'::jsonb;
  v_cpu jsonb := '{}'::jsonb;
  v_sponsor_goals jsonb := '{}'::jsonb;
  v_sponsor_periodic jsonb := '{}'::jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('mml_due_maintenance')) then
    return jsonb_build_object('ok', true, 'skipped', true, 'message', 'Manutencao ja em execucao.');
  end if;

  if not p_force and exists (
    select 1
    from public.app_maintenance_runs
    where started_at > now() - interval '10 minutes'
      and status = 'completed'
  ) then
    return jsonb_build_object('ok', true, 'skipped', true, 'message', 'Manutencao recente ja executada.');
  end if;

  insert into public.app_maintenance_runs (run_key)
  values (v_run_key)
  on conflict (run_key) do update
     set started_at = now(),
         finished_at = null,
         status = 'running',
         detail = '{}'::jsonb
  returning id into v_run_id;

  if to_regprocedure('public.app_internal_generate_due_events()') is not null then
    v_events := public.app_internal_generate_due_events();
  elsif to_regprocedure('public.app_generate_due_events(text)') is not null then
    v_events := public.app_generate_due_events('eafc26'::text);
  end if;

  if to_regprocedure('public.app_generate_due_decision_events()') is not null then
    v_decisions := public.app_generate_due_decision_events();
  end if;

  if to_regprocedure('public.app_generate_due_cpu_transfer_proposals(integer)') is not null then
    v_cpu := public.app_generate_due_cpu_transfer_proposals(4);
  end if;

  if to_regprocedure('public.app_process_all_sponsorship_rewards()') is not null then
    v_sponsor_goals := public.app_process_all_sponsorship_rewards();
  end if;

  if to_regprocedure('public.app_process_periodic_sponsorships()') is not null then
    v_sponsor_periodic := public.app_process_periodic_sponsorships();
  end if;

  update public.app_maintenance_runs
     set finished_at = now(),
         status = 'completed',
         detail = jsonb_build_object(
           'events', v_events,
           'decisions', v_decisions,
           'cpuOffers', v_cpu,
           'sponsorshipGoals', v_sponsor_goals,
           'sponsorshipPeriodic', v_sponsor_periodic
         )
   where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'runKey', v_run_key,
    'events', v_events,
    'decisions', v_decisions,
    'cpuOffers', v_cpu,
    'sponsorshipGoals', v_sponsor_goals,
    'sponsorshipPeriodic', v_sponsor_periodic
  );
exception when others then
  if v_run_id is not null then
    update public.app_maintenance_runs
       set finished_at = now(),
           status = 'failed',
           detail = jsonb_build_object('error', sqlerrm)
     where id = v_run_id;
  end if;
  raise;
end;
$$;

create or replace function public.app_process_sponsorship_rewards(
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
  v_goal jsonb := '{}'::jsonb;
  v_periodic jsonb := '{}'::jsonb;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  if to_regprocedure('public.app_process_all_sponsorship_rewards()') is not null then
    v_goal := public.app_process_all_sponsorship_rewards();
  end if;

  if to_regprocedure('public.app_process_periodic_sponsorships()') is not null then
    v_periodic := public.app_process_periodic_sponsorships();
  end if;

  return jsonb_build_object(
    'ok', true,
    'created', coalesce((v_goal ->> 'created')::integer, 0),
    'periodicPaid', coalesce((v_periodic ->> 'paid')::integer, 0)
  );
end;
$$;

alter table if exists public.internal_transfer_proposals
  add column if not exists is_cpu_offer boolean not null default false;

alter table if exists public.internal_transfer_proposals
  add column if not exists offer_source text not null default 'coach';

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
  v_session jsonb;
  v_manager_name text;
  v_current_owner text;
  v_existing_id bigint;
  v_proposal_id bigint;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  v_manager_name := v_session ->> 'managerName';

  if lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A proposta precisa ser enviada pelo comprador logado.');
  end if;

  if lower(trim(p_buyer)) = lower(trim(p_seller)) then
    return jsonb_build_object('ok', false, 'message', 'Comprador e vendedor precisam ser diferentes.');
  end if;

  if coalesce(p_market_value, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe um valor de proposta maior que zero.');
  end if;

  select case when t.transfer_type = 'cpu_sale' then 'CPU' else m.display_name end
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
    proposed_value,
    is_cpu_offer,
    offer_source
  ) values (
    p_buyer,
    p_seller,
    p_player,
    p_from_club,
    p_overall,
    p_market_value,
    false,
    'coach'
  )
  returning id into v_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta enviada para %s aprovar ou recusar.', p_seller),
    'proposalId', v_proposal_id
  );
end;
$$;

create or replace function public.app_get_my_internal_transfer_proposals(
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
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return '[]'::jsonb;
  end if;

  v_manager_name := v_session ->> 'managerName';

  return coalesce((
    select jsonb_agg(
      to_jsonb(p) ||
      jsonb_build_object(
        'proposal_role',
        case
          when lower(p.seller) = lower(v_manager_name) then 'received'
          else 'sent'
        end,
        'is_cpu_offer', coalesce(p.is_cpu_offer, false),
        'offer_source', coalesce(nullif(p.offer_source, ''), case when coalesce(p.is_cpu_offer, false) then 'cpu' else 'coach' end)
      )
      order by p.created_at desc
    )
    from public.internal_transfer_proposals p
    where lower(p.seller) = lower(v_manager_name)
       or lower(p.buyer) = lower(v_manager_name)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.app_accept_sponsorship(
  p_manager_id text,
  p_access_code text,
  p_offer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_offer jsonb;
  v_contract_id bigint;
  v_max_active integer := 3;
  v_active_count integer := 0;
  v_club_name text;
  v_existing record;
  v_termination_fee numeric := 0;
  v_signing_bonus numeric := 0;
  v_manager_name text;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_manager_name := v_session ->> 'managerName';
  v_club_name := coalesce(v_session ->> 'clubName', v_manager_name);

  select offers.offer into v_offer
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where offers.offer ->> 'id' = p_offer_id;

  if v_offer is null then
    return jsonb_build_object('ok', false, 'message', 'Patrocinador nao encontrado.');
  end if;

  select count(*) into v_active_count
  from public.sponsorship_contracts
  where manager_id = p_manager_id and status = 'active';

  select * into v_existing
  from public.sponsorship_contracts
  where manager_id = p_manager_id
    and status = 'active'
    and category = coalesce(v_offer ->> 'category', 'Patrocinio')
  order by created_at desc
  limit 1;

  if v_existing.id is null and v_active_count >= v_max_active then
    return jsonb_build_object('ok', false, 'message', 'Limite comercial atingido: cada tecnico pode manter ate 3 patrocinios ativos.');
  end if;

  if v_existing.sponsor_id = (v_offer ->> 'id') then
    return jsonb_build_object('ok', false, 'message', 'Este patrocinio ja esta ativo.');
  end if;

  v_signing_bonus := coalesce((v_offer ->> 'signingBonus')::numeric, 0);

  if v_existing.id is not null then
    v_termination_fee := public.app_sponsorship_termination_fee(
      v_existing.signing_bonus,
      v_existing.reward_value,
      v_existing.max_claims,
      v_existing.claims_used
    );

    update public.sponsorship_contracts
       set status = 'terminated'
     where id = v_existing.id;

    perform public.app_insert_financial_event(
      v_manager_name,
      'Rescisao de patrocinio: ' || v_existing.sponsor_name,
      v_existing.category || ' encerrado para abrir espaco a ' || (v_offer ->> 'sponsorName') || '.',
      '-' || v_termination_fee::text || ' debitado como multa de rescisao.',
      'Patrocinio',
      -v_termination_fee
    );
  end if;

  insert into public.sponsorship_contracts (
    manager_id, manager_name, club_name, sponsor_id, sponsor_name, category, title,
    description, condition_type, signing_bonus, reward_value, max_claims, baseline_result_keys
  ) values (
    p_manager_id,
    v_manager_name,
    v_club_name,
    v_offer ->> 'id',
    v_offer ->> 'sponsorName',
    coalesce(v_offer ->> 'category', 'Patrocinio'),
    v_offer ->> 'title',
    v_offer ->> 'description',
    v_offer ->> 'conditionType',
    v_signing_bonus,
    coalesce((v_offer ->> 'rewardValue')::numeric, 0),
    coalesce((v_offer ->> 'maxClaims')::integer, 3),
    public.app_get_sponsorship_baseline_result_keys(v_club_name)
  )
  returning id into v_contract_id;

  if v_signing_bonus > 0 then
    insert into public.sponsorship_rewards (
      contract_id, manager_id, manager_name, result_key, reward_value, created_at
    ) values (
      v_contract_id,
      p_manager_id,
      v_manager_name,
      'signing_bonus|' || v_contract_id::text,
      v_signing_bonus,
      now()
    )
    on conflict (contract_id, result_key) do nothing;
  end if;

  perform public.app_insert_financial_event(
    v_manager_name,
    'Luva de patrocinio: ' || (v_offer ->> 'sponsorName'),
    coalesce(v_offer ->> 'category', 'Patrocinio') || ' fechado por ' || v_manager_name || '.',
    '+' || v_signing_bonus::text || ' creditado como luva de assinatura.',
    'Patrocinio',
    v_signing_bonus
  );

  return jsonb_build_object(
    'ok', true,
    'message', case when v_existing.id is not null
      then 'Patrocinio substituido com multa de rescisao aplicada e luva creditada.'
      else 'Patrocinio assinado com luva creditada.'
    end,
    'terminationFee', v_termination_fee,
    'signingBonus', v_signing_bonus,
    'contractId', v_contract_id
  );
end;
$$;

create or replace function public.app_get_my_sponsorships(
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
  v_active jsonb;
  v_rewards jsonb;
  v_offers jsonb;
  v_active_count integer := 0;
  v_max_active integer := 3;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('active', '[]'::jsonb, 'offers', '[]'::jsonb, 'recentRewards', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
    into v_active
  from (
    select
      c.*,
      public.app_sponsorship_termination_fee(c.signing_bonus, c.reward_value, c.max_claims, c.claims_used) as termination_fee,
      coalesce(o.offer ->> 'conditionLabel',
        case c.condition_type
          when 'win_by_2' then 'Vencer por 2+ gols'
          when 'any_win' then 'Vencer qualquer partida'
          when 'home_win' then 'Vencer como mandante'
          when 'clean_sheet' then 'Nao sofrer gols'
          when 'three_goals' then 'Marcar 3+ gols'
          when 'away_win' then 'Vencer como visitante'
          when 'weekly_payment' then 'Pagamento semanal fixo'
          when 'monthly_payment' then 'Pagamento mensal fixo'
          else 'Meta comercial cumprida'
        end
      ) as condition_label,
      coalesce(o.offer ->> 'riskLevel', 'Contrato ativo') as risk_level,
      coalesce(o.offer ->> 'dealStyle', 'Marca parceira') as deal_style,
      coalesce(o.offer ->> 'paymentCadence',
        case
          when c.condition_type = 'weekly_payment' then 'weekly'
          when c.condition_type = 'monthly_payment' then 'monthly'
          else 'goal'
        end
      ) as payment_cadence,
      coalesce(rr.paid_total, 0) as paid_total,
      rr.last_reward_at,
      rr.last_installment_at,
      rr.signing_paid_at,
      case
        when c.condition_type = 'weekly_payment' and c.claims_used < c.max_claims
          then c.created_at + ((c.claims_used + 1) * interval '7 days')
        when c.condition_type = 'monthly_payment' and c.claims_used < c.max_claims
          then c.created_at + ((c.claims_used + 1) * interval '30 days')
        else null
      end as next_payment_at,
      c.signing_bonus + (c.reward_value * c.max_claims) as total_contract_value
    from public.sponsorship_contracts c
    left join jsonb_array_elements(public.app_sponsorship_offers()) as o(offer)
      on o.offer ->> 'id' = c.sponsor_id
    left join lateral (
      select
        coalesce(sum(r.reward_value), 0) as paid_total,
        max(r.created_at) as last_reward_at,
        max(r.created_at) filter (where r.result_key like 'periodic|%') as last_installment_at,
        max(r.created_at) filter (where r.result_key like 'signing_bonus|%') as signing_paid_at
      from public.sponsorship_rewards r
      where r.contract_id = c.id
    ) rr on true
    where c.manager_id = p_manager_id
      and c.status = 'active'
  ) c;

  select count(*) into v_active_count
  from public.sponsorship_contracts c
  where c.manager_id = p_manager_id and c.status = 'active';

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v_rewards
  from (
    select
      r.id,
      r.contract_id,
      r.manager_id,
      r.manager_name,
      r.result_key,
      r.reward_value,
      r.created_at,
      case
        when r.result_key like 'signing_bonus|%' then 'Luva'
        when r.result_key like 'periodic|%' then 'Parcela'
        else 'Meta'
      end as reward_kind,
      c.sponsor_name,
      c.category,
      c.title
    from public.sponsorship_rewards r
    join public.sponsorship_contracts c on c.id = r.contract_id
    where r.manager_id = p_manager_id
    order by r.created_at desc
    limit 10
  ) r;

  select coalesce(jsonb_agg(offer_with_context order by offer_with_context ->> 'category', offer_with_context ->> 'riskLevel', offer_with_context ->> 'sponsorName'), '[]'::jsonb)
    into v_offers
  from (
    select
      offers.offer
      || jsonb_build_object(
        'isReplacement', c.id is not null,
        'currentSponsorName', coalesce(c.sponsor_name, ''),
        'currentTitle', coalesce(c.title, ''),
        'terminationFee', coalesce(public.app_sponsorship_termination_fee(c.signing_bonus, c.reward_value, c.max_claims, c.claims_used), 0),
        'canSign', (c.id is not null or v_active_count < v_max_active),
        'totalContractValue',
          coalesce((offers.offer ->> 'signingBonus')::numeric, 0)
          + coalesce((offers.offer ->> 'rewardValue')::numeric, 0)
          * coalesce((offers.offer ->> 'maxClaims')::integer, 0)
      ) as offer_with_context
    from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
    left join public.sponsorship_contracts c
      on c.manager_id = p_manager_id
     and c.status = 'active'
     and c.category = coalesce(offers.offer ->> 'category', 'Patrocinio')
    where not exists (
      select 1
      from public.sponsorship_contracts same
      where same.manager_id = p_manager_id
        and same.status = 'active'
        and same.sponsor_id = offers.offer ->> 'id'
    )
    and (c.id is not null or v_active_count < v_max_active)
  ) offers_with_context;

  return jsonb_build_object(
    'active', v_active,
    'offers', v_offers,
    'recentRewards', v_rewards,
    'activeCount', v_active_count,
    'maxActiveContracts', v_max_active,
    'activeSlotsLeft', greatest(v_max_active - v_active_count, 0)
  );
end;
$$;

revoke execute on function public.app_run_due_maintenance(boolean) from public, anon, authenticated;
revoke execute on function public.app_validate_manager_session_token(text, text) from public, anon, authenticated;
revoke execute on function public.app_hash_manager_session_token(text) from public, anon, authenticated;

grant execute on function public.app_create_manager_session(text, text) to anon, authenticated;
grant execute on function public.app_revoke_manager_session(text, text) to anon, authenticated;
grant execute on function public.app_security_login(text, text) to anon, authenticated;
grant execute on function public.app_validate_manager_session(text, text) to anon, authenticated;
grant execute on function public.app_governance_login(text, text) to anon, authenticated;
grant execute on function public.app_process_sponsorship_rewards(text, text) to anon, authenticated;
grant execute on function public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_get_my_internal_transfer_proposals(text, text) to anon, authenticated;
grant execute on function public.app_accept_sponsorship(text, text, text) to anon, authenticated;
grant execute on function public.app_get_my_sponsorships(text, text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.app_run_due_maintenance(boolean) to service_role;
  end if;

  if exists (select 1 from pg_roles where rolname = 'postgres') then
    grant execute on function public.app_run_due_maintenance(boolean) to postgres;
  end if;
end;
$$;

do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception when others then
    raise notice 'pg_cron not available in this project: %', sqlerrm;
  end;

  if to_regclass('cron.job') is not null and to_regprocedure('cron.schedule(text,text,text)') is not null then
    if not exists (select 1 from cron.job where jobname = 'mml-due-maintenance') then
      perform cron.schedule(
        'mml-due-maintenance',
        '*/10 * * * *',
        'select public.app_run_due_maintenance(false);'
      );
    end if;
  end if;
exception when others then
  raise notice 'Could not schedule mml-due-maintenance: %', sqlerrm;
end;
$$;

notify pgrst, 'reload schema';

commit;
