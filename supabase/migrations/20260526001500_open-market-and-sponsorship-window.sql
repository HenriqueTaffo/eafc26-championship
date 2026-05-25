-- v89 - Reopen the active transfer and sponsorship windows until 31/05/2026 23:59 BRT.

begin;

insert into public.league_config (key, value, description, updated_at) values
  (
    'transfer_window_locked',
    'false'::jsonb,
    'Janela de transferencias reaberta ate 31/05/2026 23:59 BRT.',
    now()
  ),
  (
    'transfer_window_open_until',
    '"2026-06-01T02:59:59Z"'::jsonb,
    'Encerramento automatico da janela de transferencias em 31/05/2026 23:59 BRT.',
    now()
  ),
  (
    'daily_transfer_limit',
    '3'::jsonb,
    'Limite diario restaurado enquanto a janela de transferencias estiver aberta.',
    now()
  ),
  (
    'sponsorship_signing_locked',
    'false'::jsonb,
    'Assinaturas de patrocinio liberadas ate 31/05/2026 23:59 BRT.',
    now()
  ),
  (
    'sponsorship_signing_open_until',
    '"2026-06-01T02:59:59Z"'::jsonb,
    'Encerramento automatico das assinaturas de patrocinio em 31/05/2026 23:59 BRT.',
    now()
  )
on conflict (key) do update
   set value = excluded.value,
       description = excluded.description,
       updated_at = now();

create or replace function public.app_transfer_window_is_locked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with config as (
    select
      coalesce(
        (
          select case
            when jsonb_typeof(value) = 'boolean' then value = 'true'::jsonb
            when jsonb_typeof(value) = 'string' then lower(value #>> '{}') = 'true'
            else false
          end
          from public.league_config
          where key = 'transfer_window_locked'
          limit 1
        ),
        false
      ) as hard_locked,
      (
        select case
          when jsonb_typeof(value) = 'string' and nullif(value #>> '{}', '') is not null
            then (value #>> '{}')::timestamptz
          else null
        end
        from public.league_config
        where key = 'transfer_window_open_until'
        limit 1
      ) as open_until
  )
  select hard_locked or (open_until is not null and now() > open_until)
  from config;
$$;

create or replace function public.app_sponsorship_signing_is_locked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with config as (
    select
      coalesce(
        (
          select case
            when jsonb_typeof(value) = 'boolean' then value = 'true'::jsonb
            when jsonb_typeof(value) = 'string' then lower(value #>> '{}') = 'true'
            else false
          end
          from public.league_config
          where key = 'sponsorship_signing_locked'
          limit 1
        ),
        false
      ) as hard_locked,
      (
        select case
          when jsonb_typeof(value) = 'string' and nullif(value #>> '{}', '') is not null
            then (value #>> '{}')::timestamptz
          else null
        end
        from public.league_config
        where key = 'sponsorship_signing_open_until'
        limit 1
      ) as open_until
  )
  select hard_locked or (open_until is not null and now() > open_until)
  from config;
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
  v_manager record;
  v_login jsonb;
  v_offer jsonb;
  v_contract_id bigint;
  v_max_active integer := 3;
  v_active_count integer := 0;
  v_club_name text;
  v_existing record;
  v_termination_fee numeric := 0;
  v_signing_bonus numeric := 0;
  v_payout_start_at timestamptz;
begin
  select id, display_name into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  if public.app_sponsorship_signing_is_locked() then
    return jsonb_build_object(
      'ok', false,
      'message', 'Assinatura de patrocinios encerrada em 31/05/2026, 23:59.'
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
  where manager_id = v_manager.id and status = 'active';

  select * into v_existing
  from public.sponsorship_contracts
  where manager_id = v_manager.id
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

  v_club_name := coalesce(v_login #>> '{manager,club}', v_manager.display_name);
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
        coalesce(v_login #>> '{manager,name}', v_manager.display_name),
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
    v_manager.id,
    coalesce(v_login #>> '{manager,name}', v_manager.display_name),
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
      v_manager.id,
      coalesce(v_login #>> '{manager,name}', v_manager.display_name),
      'signing_bonus|' || v_contract_id::text,
      v_signing_bonus,
      now()
    )
    on conflict (contract_id, result_key) do nothing;

    perform public.app_insert_financial_event(
      coalesce(v_login #>> '{manager,name}', v_manager.display_name),
      'Luva de patrocinio: ' || (v_offer ->> 'sponsorName'),
      coalesce(v_offer ->> 'category', 'Patrocinio') || ' fechado por ' || coalesce(v_login #>> '{manager,name}', v_manager.display_name) || '.',
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

grant execute on function public.app_sponsorship_signing_is_locked() to anon, authenticated;

do $$
begin
  if to_regprocedure('public.app_create_internal_transfer_proposal(text,text,text,text,text,text,integer,numeric)') is not null then
    grant execute on function public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric)
      to anon, authenticated;
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal(text,text,bigint,text)') is not null then
    grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text)
      to anon, authenticated;
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal(text,text,bigint,text,numeric)') is not null then
    grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text, numeric)
      to anon, authenticated;
  end if;

  if to_regprocedure('public.app_upsert_transfer_sale_listing(text,text,text,numeric,text)') is not null then
    grant execute on function public.app_upsert_transfer_sale_listing(text, text, text, numeric, text)
      to anon, authenticated;
  end if;

  if to_regprocedure('public.app_delete_transfer_sale_listing(text,text,uuid)') is not null then
    grant execute on function public.app_delete_transfer_sale_listing(text, text, uuid)
      to anon, authenticated;
  end if;
end;
$$;

commit;
