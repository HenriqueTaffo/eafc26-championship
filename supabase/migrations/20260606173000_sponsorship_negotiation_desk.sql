begin;

create table if not exists public.sponsorship_negotiations (
  id bigserial primary key,
  manager_id text not null,
  manager_name text not null,
  offer_id text not null,
  sponsor_name text not null,
  counter_terms jsonb not null default '{}'::jsonb,
  outcome text not null default 'sent',
  acceptance numeric not null default 0,
  response text not null default '',
  sponsor_counter jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sponsorship_negotiations_manager_created_idx
  on public.sponsorship_negotiations (manager_id, created_at desc);

create or replace function public.app_negotiate_sponsorship_offer(
  p_manager_id text,
  p_access_code text,
  p_offer_id text,
  p_counter_terms jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_offer jsonb;
  v_manager_id text;
  v_manager_name text;
  v_sponsor_name text;
  v_original_total numeric := 0;
  v_counter_total numeric := 0;
  v_lift numeric := 0;
  v_seed numeric := 0;
  v_tolerance numeric := 0;
  v_acceptance numeric := 0;
  v_outcome text := 'sent';
  v_response text := '';
  v_sponsor_counter jsonb := null;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_manager_id := coalesce(nullif(v_session ->> 'managerId', ''), p_manager_id);
  v_manager_name := coalesce(nullif(v_session ->> 'managerName', ''), v_manager_id);

  select offers.offer into v_offer
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where offers.offer ->> 'id' = p_offer_id;

  if v_offer is null then
    return jsonb_build_object('ok', false, 'message', 'Patrocinador nao encontrado.');
  end if;

  v_sponsor_name := coalesce(v_offer ->> 'sponsorName', 'Marca');
  v_original_total :=
    coalesce((v_offer ->> 'signingBonus')::numeric, 0) +
    coalesce((v_offer ->> 'rewardValue')::numeric, 0) *
      greatest(1, coalesce((v_offer ->> 'maxClaims')::integer, 1));
  v_counter_total :=
    coalesce((p_counter_terms ->> 'signingBonus')::numeric, 0) +
    coalesce((p_counter_terms ->> 'rewardValue')::numeric, 0) *
      greatest(1, coalesce((p_counter_terms ->> 'maxClaims')::integer, 1)) -
    greatest(0, coalesce((p_counter_terms ->> 'terminationFee')::numeric, 0));
  v_lift := case
    when v_original_total > 0 then greatest(0, v_counter_total - v_original_total) / v_original_total
    else 0
  end;
  v_seed := (abs(hashtext(v_manager_id || ':' || p_offer_id || ':' || coalesce(p_counter_terms ->> 'mode', 'balanced'))) % 19)::numeric / 100;
  v_tolerance := 0.08 + (abs(hashtext(v_sponsor_name)) % 11)::numeric / 100;
  v_acceptance := greatest(0.05, least(0.96, 0.64 + v_seed + v_tolerance - (v_lift * 1.38)));

  if v_acceptance >= 0.66 then
    v_outcome := 'accepted';
    v_response := 'A marca aceitou os termos como pacote final.';
  elsif v_acceptance >= 0.48 then
    v_outcome := 'countered';
    v_response := 'A marca aceitou parte do pedido e devolveu uma proposta intermediaria.';
    v_sponsor_counter := jsonb_build_object(
      'signingBonus', round((coalesce((p_counter_terms ->> 'signingBonus')::numeric, 0) + coalesce((v_offer ->> 'signingBonus')::numeric, 0)) / 2),
      'rewardValue', round((coalesce((p_counter_terms ->> 'rewardValue')::numeric, 0) + coalesce((v_offer ->> 'rewardValue')::numeric, 0)) / 2),
      'maxClaims', greatest(1, coalesce((p_counter_terms ->> 'maxClaims')::integer, coalesce((v_offer ->> 'maxClaims')::integer, 1))),
      'terminationFee', round((coalesce((p_counter_terms ->> 'terminationFee')::numeric, 0) + coalesce((v_offer ->> 'terminationFee')::numeric, 0)) / 2)
    );
  else
    v_outcome := 'rejected';
    v_response := 'A marca recusou o salto pedido e pediu termos mais proximos da oferta original.';
  end if;

  insert into public.sponsorship_negotiations (
    manager_id,
    manager_name,
    offer_id,
    sponsor_name,
    counter_terms,
    outcome,
    acceptance,
    response,
    sponsor_counter
  ) values (
    v_manager_id,
    v_manager_name,
    p_offer_id,
    v_sponsor_name,
    coalesce(p_counter_terms, '{}'::jsonb),
    v_outcome,
    round(v_acceptance * 100),
    v_response,
    v_sponsor_counter
  );

  return jsonb_build_object(
    'ok', true,
    'outcome', v_outcome,
    'acceptance', round(v_acceptance * 100),
    'response', v_response,
    'sponsorCounter', v_sponsor_counter
  );
end;
$$;

create or replace function public.app_accept_sponsorship_negotiated(
  p_manager_id text,
  p_access_code text,
  p_offer_id text,
  p_negotiated_terms jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager record;
  v_session jsonb;
  v_offer jsonb;
  v_contract_id bigint;
  v_max_active integer := 3;
  v_active_count integer := 0;
  v_manager_id text;
  v_manager_name text;
  v_club_name text;
  v_existing record;
  v_termination_fee numeric := 0;
  v_signing_bonus numeric := 0;
  v_reward_value numeric := 0;
  v_max_claims integer := 1;
  v_original_total numeric := 0;
  v_negotiated_total numeric := 0;
  v_payout_start_at timestamptz;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_manager_id := coalesce(nullif(v_session ->> 'managerId', ''), p_manager_id);

  select id, display_name into v_manager
  from public.managers
  where id = v_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_manager_name := coalesce(nullif(v_session ->> 'managerName', ''), v_manager.display_name);
  v_club_name := coalesce(nullif(v_session ->> 'clubName', ''), v_manager_name);

  if public.app_sponsorship_signing_is_locked() then
    return jsonb_build_object(
      'ok', false,
      'message', 'Assinaturas de patrocinio indisponiveis no momento.'
    );
  end if;

  select offers.offer into v_offer
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where offers.offer ->> 'id' = p_offer_id;

  if v_offer is null then
    return jsonb_build_object('ok', false, 'message', 'Patrocinador nao encontrado.');
  end if;

  v_original_total :=
    coalesce((v_offer ->> 'signingBonus')::numeric, 0) +
    coalesce((v_offer ->> 'rewardValue')::numeric, 0) *
      greatest(1, coalesce((v_offer ->> 'maxClaims')::integer, 1));
  v_signing_bonus := greatest(
    0,
    coalesce((p_negotiated_terms ->> 'signingBonus')::numeric, coalesce((v_offer ->> 'signingBonus')::numeric, 0))
  );
  v_reward_value := greatest(
    0,
    coalesce((p_negotiated_terms ->> 'rewardValue')::numeric, coalesce((v_offer ->> 'rewardValue')::numeric, 0))
  );
  v_max_claims := greatest(
    1,
    least(16, coalesce((p_negotiated_terms ->> 'maxClaims')::integer, coalesce((v_offer ->> 'maxClaims')::integer, 1)))
  );
  v_negotiated_total := v_signing_bonus + v_reward_value * v_max_claims;

  if v_original_total > 0 and v_negotiated_total > v_original_total * 1.7 then
    return jsonb_build_object('ok', false, 'message', 'Termos negociados acima do limite comercial permitido.');
  end if;

  select count(*) into v_active_count
  from public.sponsorship_contracts
  where manager_id = v_manager_id and status = 'active';

  select * into v_existing
  from public.sponsorship_contracts
  where manager_id = v_manager_id
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

  v_payout_start_at := nullif(v_offer ->> 'firstPaymentAt', '')::timestamptz;

  if v_existing.id is not null then
    v_termination_fee := coalesce((p_negotiated_terms ->> 'terminationFee')::numeric, public.app_sponsorship_termination_fee(
      v_existing.signing_bonus,
      v_existing.reward_value,
      v_existing.max_claims,
      v_existing.claims_used
    ));

    update public.sponsorship_contracts
       set status = 'terminated'
     where id = v_existing.id;

    if v_termination_fee > 0 then
      perform public.app_insert_financial_event(
        v_manager_name,
        'Rescisao de patrocinio: ' || v_existing.sponsor_name,
        v_existing.category || ' encerrado para abrir espaco a ' || (v_offer ->> 'sponsorName') || '.',
        '-' || v_termination_fee::text || ' debitado como multa de rescisao negociada.',
        'Patrocinio',
        -v_termination_fee
      );
    end if;
  end if;

  insert into public.sponsorship_contracts (
    manager_id, manager_name, club_name, sponsor_id, sponsor_name, category, title,
    description, condition_type, signing_bonus, reward_value, max_claims, baseline_result_keys,
    payout_start_at
  ) values (
    v_manager_id,
    v_manager_name,
    v_club_name,
    v_offer ->> 'id',
    v_offer ->> 'sponsorName',
    coalesce(v_offer ->> 'category', 'Patrocinio'),
    v_offer ->> 'title',
    coalesce(v_offer ->> 'description', '') || ' Termos ajustados na mesa comercial.',
    v_offer ->> 'conditionType',
    v_signing_bonus,
    v_reward_value,
    v_max_claims,
    public.app_get_sponsorship_baseline_result_keys(v_club_name),
    v_payout_start_at
  )
  returning id into v_contract_id;

  if v_signing_bonus > 0 then
    insert into public.sponsorship_rewards (
      contract_id, manager_id, manager_name, result_key, reward_value, created_at
    ) values (
      v_contract_id,
      v_manager_id,
      v_manager_name,
      'signing_bonus|' || v_contract_id::text,
      v_signing_bonus,
      now()
    )
    on conflict (contract_id, result_key) do nothing;

    perform public.app_insert_financial_event(
      v_manager_name,
      'Luva negociada de patrocinio: ' || (v_offer ->> 'sponsorName'),
      coalesce(v_offer ->> 'category', 'Patrocinio') || ' fechado por ' || v_manager_name || '.',
      '+' || v_signing_bonus::text || ' creditado como luva negociada.',
      'Patrocinio',
      v_signing_bonus
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Patrocinio assinado com termos negociados.',
    'terminationFee', v_termination_fee,
    'signingBonus', v_signing_bonus,
    'rewardValue', v_reward_value,
    'maxClaims', v_max_claims,
    'contractId', v_contract_id
  );
end;
$$;

grant select, insert on public.sponsorship_negotiations to anon, authenticated;
grant usage, select on sequence public.sponsorship_negotiations_id_seq to anon, authenticated;
grant execute on function public.app_negotiate_sponsorship_offer(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.app_accept_sponsorship_negotiated(text, text, text, jsonb) to anon, authenticated;

commit;
