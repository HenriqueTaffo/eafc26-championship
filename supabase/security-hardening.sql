-- Hardening de seguranca para a liga.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro depois dos SQLs de gameplay ja existentes.
-- 3. Publique o front atualizado no GitHub Pages.
--
-- O que faz:
-- - Remove o poder do PIN global publicado no front.
-- - Cria wrappers autenticados por tecnico/comissario para resultado, compra externa,
--   eventos automaticos e simulacao CPU.
-- - Revoga execucao publica das funcoes antigas que aceitavam p_pin.
-- - Liga RLS nas tabelas de apoio criadas pelo projeto, mantendo leitura/escrita via RPC.

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
begin
  if coalesce(trim(p_manager_id), '') = '' or coalesce(trim(p_access_code), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Login obrigatorio.');
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

create or replace function public.app_security_same_team(
  p_left text,
  p_right text
)
returns boolean
language sql
stable
as $$
  select lower(regexp_replace(coalesce(p_left, ''), '\s+(football club|fc|afc)$', '', 'i'))
       = lower(regexp_replace(coalesce(p_right, ''), '\s+(football club|fc|afc)$', '', 'i'));
$$;

create or replace function public.app_add_result(
  p_manager_id text,
  p_access_code text,
  p_competition text,
  p_week integer,
  p_phase text,
  p_home text,
  p_away text,
  p_home_score integer,
  p_away_score integer,
  p_goal_details text default '',
  p_assist_details text default '',
  p_penalty_winner text default '',
  p_penalty_score text default '',
  p_submitted_by text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_club text;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_club := coalesce(v_login ->> 'clubName', '');

  if not v_is_commissioner
     and not public.app_security_same_team(v_club, p_home)
     and not public.app_security_same_team(v_club, p_away) then
    return jsonb_build_object('ok', false, 'message', 'Voce so pode enviar resultado de jogos do seu clube.');
  end if;

  return public.app_add_result(
    'eafc26'::text,
    p_competition,
    p_week,
    p_phase,
    p_home,
    p_away,
    p_home_score,
    p_away_score,
    p_goal_details,
    p_assist_details,
    p_penalty_winner,
    p_penalty_score,
    coalesce(nullif(trim(p_submitted_by), ''), v_login ->> 'managerName')
  );
end;
$$;

create or replace function public.app_add_transfer(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
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
  v_login jsonb;
  v_is_commissioner boolean;
  v_manager_name text;
  v_rate numeric := 0;
  v_final_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_manager_name := coalesce(v_login ->> 'managerName', '');

  if not v_is_commissioner and lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A transferencia precisa ser enviada pelo comprador logado.');
  end if;

  v_rate := case
    when coalesce(p_overall, 0) >= 89 then 0.25
    when coalesce(p_overall, 0) >= 84 then 0.20
    when coalesce(p_overall, 0) >= 80 then 0.15
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end;
  v_final_value := coalesce(p_market_value, 0) + (coalesce(p_market_value, 0) * v_rate);

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);

  v_budget := coalesce(public.app_get_data()::jsonb -> 'budgets' -> p_buyer, '{}'::jsonb);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 0);
  v_transfers_today := coalesce((v_budget ->> 'transfersToday')::integer, 0);

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', p_buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', p_buyer));
  end if;

  if v_final_value > v_remaining then
    return jsonb_build_object(
      'ok', false,
      'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_final_value - v_remaining, 'FM999G999G999G999G990')))
    );
  end if;

  return public.app_add_transfer(
    'eafc26'::text,
    p_buyer,
    p_player,
    p_from_club,
    p_overall,
    p_market_value
  );
end;
$$;

create or replace function public.app_generate_due_events(
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
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode gerar eventos automaticos.');
  end if;

  return public.app_generate_due_events('eafc26'::text);
end;
$$;

create or replace function public.app_simulate_cpu_week(
  p_manager_id text,
  p_access_code text,
  p_week integer,
  p_submitted_by text default 'Liga'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode simular rodadas CPU x CPU.');
  end if;

  return public.app_simulate_cpu_week('eafc26'::text, p_week, p_submitted_by);
end;
$$;

do $$
begin
  if to_regprocedure('public.app_add_result(text,text,integer,text,text,text,integer,integer,text,text,text,text,text)') is not null then
    revoke execute on function public.app_add_result(text, text, integer, text, text, text, integer, integer, text, text, text, text, text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_add_transfer(text,text,text,text,integer,numeric)') is not null then
    revoke execute on function public.app_add_transfer(text, text, text, text, integer, numeric) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_generate_due_events(text)') is not null then
    revoke execute on function public.app_generate_due_events(text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_simulate_cpu_week(text,integer,text)') is not null then
    revoke execute on function public.app_simulate_cpu_week(text, integer, text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_add_internal_transfer(text,text,text,text,text,integer,numeric)') is not null then
    revoke execute on function public.app_add_internal_transfer(text, text, text, text, text, integer, numeric) from public, anon, authenticated;
  end if;
end;
$$;

grant execute on function public.app_security_login(text, text) to anon, authenticated;
grant execute on function public.app_add_result(text, text, text, integer, text, text, text, integer, integer, text, text, text, text, text) to anon, authenticated;
grant execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_generate_due_events(text, text) to anon, authenticated;
grant execute on function public.app_simulate_cpu_week(text, text, integer, text) to anon, authenticated;

alter table if exists public.sponsorship_contracts enable row level security;
alter table if exists public.sponsorship_rewards enable row level security;
alter table if exists public.internal_transfer_proposals enable row level security;
alter table if exists public.governance_auction_intents enable row level security;
alter table if exists public.governance_medical_actions enable row level security;
alter table if exists public.governance_weekly_reviews enable row level security;
alter table if exists public.commissioner_admins enable row level security;

do $$
begin
  if to_regclass('public.commissioner_admins') is not null then
    revoke all on table public.commissioner_admins from anon, authenticated;
  end if;
end;
$$;
