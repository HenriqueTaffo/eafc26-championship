begin;

create or replace function public.app_accept_sponsorship_v1(
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

  v_signing_bonus := coalesce((v_offer ->> 'signingBonus')::numeric, 0);
  v_payout_start_at := nullif(v_offer ->> 'firstPaymentAt', '')::timestamptz;

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

    if v_termination_fee > 0 then
      perform public.app_insert_financial_event(
        v_manager_name,
        'Rescisao de patrocinio: ' || v_existing.sponsor_name,
        v_existing.category || ' encerrado para abrir espaco a ' || (v_offer ->> 'sponsorName') || '.',
        '-' || v_termination_fee::text || ' debitado como multa de rescisao.',
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
    v_offer ->> 'description',
    v_offer ->> 'conditionType',
    v_signing_bonus,
    coalesce((v_offer ->> 'rewardValue')::numeric, 0),
    coalesce((v_offer ->> 'maxClaims')::integer, 3),
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
      'Luva de patrocinio: ' || (v_offer ->> 'sponsorName'),
      coalesce(v_offer ->> 'category', 'Patrocinio') || ' fechado por ' || v_manager_name || '.',
      '+' || v_signing_bonus::text || ' creditado como luva de assinatura.',
      'Patrocinio',
      v_signing_bonus
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', case
      when v_signing_bonus > 0 then 'Patrocinio assinado com luva creditada.'
      when v_payout_start_at is not null then 'Patrocinio assinado. O primeiro pagamento sera feito na data prevista do contrato.'
      else 'Patrocinio assinado. Pagamentos dependem de metas esportivas aprovadas.'
    end,
    'terminationFee', v_termination_fee,
    'signingBonus', v_signing_bonus,
    'firstPaymentAt', v_payout_start_at,
    'contractId', v_contract_id
  );
end;
$$;

revoke execute on function public.app_accept_sponsorship_v1(text, text, text) from public, anon, authenticated;

commit;
