-- Reset premature sponsorship deals and rebalance commercial income.
-- The league starts on 2026-05-26, so sponsorship installments start after
-- the first league week instead of crediting large signing fees immediately.

begin;

insert into public.league_config (key, value, description, updated_at) values
  ('transfer_budget', '18000000'::jsonb, 'Base budget for second-division level clubs after sponsorship reset.', now()),
  ('home_match_bonus', '150000'::jsonb, 'Matchday income per home league match at second-division level.', now()),
  ('win_bonus', '100000'::jsonb, 'Performance income per approved league win.', now()),
  ('sponsorship_first_weekly_payout', '"2026-06-02T12:00:00Z"'::jsonb, 'First weekly sponsorship payout after week 1 starts.', now()),
  ('sponsorship_first_monthly_payout', '"2026-06-25T12:00:00Z"'::jsonb, 'First monthly sponsorship payout after the app start month.', now())
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

update public.league_finance_rules
   set minimum_runway_weeks = 8,
       updated_at = now()
 where id = 'default';

alter table public.sponsorship_contracts
  add column if not exists payout_start_at timestamptz;

delete from public.sponsorship_rewards;

delete from public.sponsorship_contracts;

delete from public.events
 where lower(coalesce(type, '')) like 'patroc%'
    or lower(coalesce(title, '')) like '%patroc%'
    or lower(coalesce(description, '')) like '%patroc%'
    or lower(coalesce(effect, '')) like '%patroc%';

create or replace function public.app_sponsorship_payout_start(
  p_condition_type text
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_condition_type, '') = 'monthly_payment' then coalesce(
      (select (value #>> '{}')::timestamptz from public.league_config where key = 'sponsorship_first_monthly_payout'),
      '2026-06-25T12:00:00Z'::timestamptz
    )
    when coalesce(p_condition_type, '') = 'weekly_payment' then coalesce(
      (select (value #>> '{}')::timestamptz from public.league_config where key = 'sponsorship_first_weekly_payout'),
      '2026-06-02T12:00:00Z'::timestamptz
    )
    else null::timestamptz
  end;
$$;

create or replace function public.app_sponsorship_offers()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'id','nova_kits_weekly',
      'sponsorName','Nova Sportswear',
      'category','Fornecedor de material esportivo',
      'title','Uniforme base',
      'description','Contrato de camisa em patamar realista, sem luva inicial e com parcela semanal moderada.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Piso comercial',
      'signingBonus',0,
      'rewardValue',85000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','dhl_weekly',
      'sponsorName','DHL Express',
      'category','Logistica e viagens',
      'title','Viagens da temporada',
      'description','Apoio operacional recorrente para deslocamentos, pago por semana apos o inicio da liga.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Operacional',
      'signingBonus',0,
      'rewardValue',70000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','streamplay_weekly',
      'sponsorName','StreamPlay Sports',
      'category','Midia e conteudo',
      'title','Bastidores semanais',
      'description','Receita de conteudo em escala de segunda divisao, com fluxo previsivel e teto controlado.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Conteudo',
      'signingBonus',0,
      'rewardValue',60000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','spotify_arena_weekly',
      'sponsorName','Spotify',
      'category','Naming Rights de Estadio',
      'title','Matchday Arena',
      'description','Naming rights leve, parcelado semanalmente para nao distorcer o mercado.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Estadio recorrente',
      'signingBonus',0,
      'rewardValue',95000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','redwood_monthly',
      'sponsorName','Redwood Capital',
      'category','Naming Rights de Estadio',
      'title','Redwood Park',
      'description','Contrato mensal de estadio com valor relevante, mas compativel com clubes de acesso.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal',
      'dealStyle','Estadio mensal',
      'signingBonus',0,
      'rewardValue',300000,
      'maxClaims',9,
      'paymentCadence','monthly',
      'firstPaymentAt', public.app_sponsorship_payout_start('monthly_payment')
    ),
    jsonb_build_object(
      'id','emirates_monthly',
      'sponsorName','Emirates',
      'category','Patrocinador master',
      'title','Frente da camisa',
      'description','Patrocinador master premium, parcelado por mes para evitar caixa artificial no dia zero.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal forte',
      'dealStyle','Master premium',
      'signingBonus',0,
      'rewardValue',550000,
      'maxClaims',9,
      'paymentCadence','monthly',
      'firstPaymentAt', public.app_sponsorship_payout_start('monthly_payment')
    ),
    jsonb_build_object(
      'id','sony_monthly',
      'sponsorName','Sony Xperia',
      'category','Parceiro premium',
      'title','Tech mensal',
      'description','Parceria premium com pagamento mensal forte, ainda dentro do nivel de segunda divisao.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal',
      'dealStyle','Parceiro tech',
      'signingBonus',0,
      'rewardValue',400000,
      'maxClaims',9,
      'paymentCadence','monthly',
      'firstPaymentAt', public.app_sponsorship_payout_start('monthly_payment')
    ),
    jsonb_build_object(
      'id','aurora_kits',
      'sponsorName','Aurora Kits',
      'category','Fornecedor de material esportivo',
      'title','Colecao de acesso',
      'description','Bonus por vitoria convincente, sem dinheiro adiantado antes de bola rolar.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Premio por vitrine',
      'signingBonus',0,
      'rewardValue',180000,
      'maxClaims',10,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','fortress_arena',
      'sponsorName','Fortress Telecom',
      'category','Naming Rights de Estadio',
      'title','Fortress Stadium',
      'description','Premio por transformar mando em receita sem inflar o caixa inicial.',
      'conditionType','home_win',
      'conditionLabel','Vencer como mandante',
      'riskLevel','Media exigencia',
      'dealStyle','Mando forte',
      'signingBonus',0,
      'rewardValue',200000,
      'maxClaims',12,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','atlas_master',
      'sponsorName','Atlas Bank',
      'category','Patrocinador master',
      'title','Camisa pesada',
      'description','Master por desempenho ofensivo, pago somente quando a entrega esportiva aparece.',
      'conditionType','three_goals',
      'conditionLabel','Marcar 3+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Master ofensivo',
      'signingBonus',0,
      'rewardValue',275000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','pioneer_master',
      'sponsorName','Pioneer Motors',
      'category','Patrocinador master',
      'title','Frente da camisa',
      'description','Contrato master conservador, com bonus menor e mais recorrente por vitoria.',
      'conditionType','any_win',
      'conditionLabel','Vencer qualquer partida',
      'riskLevel','Baixa exigencia',
      'dealStyle','Volume seguro',
      'signingBonus',0,
      'rewardValue',150000,
      'maxClaims',14,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','voasul_logistics',
      'sponsorName','VoaSul',
      'category','Logistica e viagens',
      'title','Milhas da delegacao',
      'description','Bonus por resultado fora de casa, alinhado ao custo real de viagem e operacao.',
      'conditionType','away_win',
      'conditionLabel','Vencer como visitante',
      'riskLevel','Media exigencia',
      'dealStyle','Visitante forte',
      'signingBonus',0,
      'rewardValue',180000,
      'maxClaims',10,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','betfair_partner',
      'sponsorName','Betfair',
      'category','Parceiro premium',
      'title','Odds boost',
      'description','Parceiro premium baseado em jogos de impacto, sem luva para evitar vantagem antes da estreia.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Alto upside',
      'signingBonus',0,
      'rewardValue',225000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','netflix_media',
      'sponsorName','Netflix Sports',
      'category','Midia e conteudo',
      'title','Docuserie da temporada',
      'description','Marca de midia paga por jogos que geram narrativa, nao por assinatura antecipada.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Vitrine global',
      'signingBonus',0,
      'rewardValue',250000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','primecam_media',
      'sponsorName','PrimeCam',
      'category','Midia e conteudo',
      'title','Noite de gala',
      'description','Bonus por partidas ofensivas, com teto anual moderado.',
      'conditionType','three_goals',
      'conditionLabel','Marcar 3+ gols',
      'riskLevel','Media exigencia',
      'dealStyle','Show ofensivo',
      'signingBonus',0,
      'rewardValue',220000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    )
  );
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

create or replace function public.app_process_periodic_sponsorships()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_period_seconds numeric;
  v_period_interval interval;
  v_period_anchor timestamptz;
  v_periods_due integer;
  v_next_claim integer;
  v_result_key text;
  v_inserted integer;
  v_paid integer := 0;
begin
  for v_contract in
    select *
    from public.sponsorship_contracts
    where status = 'active'
      and condition_type in ('weekly_payment', 'monthly_payment')
      and claims_used < max_claims
    order by created_at asc
  loop
    v_period_interval := case
      when v_contract.condition_type = 'monthly_payment' then interval '30 days'
      else interval '7 days'
    end;
    v_period_seconds := extract(epoch from v_period_interval);
    v_period_anchor := coalesce(v_contract.payout_start_at, v_contract.created_at + v_period_interval);

    if now() < v_period_anchor then
      continue;
    end if;

    v_periods_due := floor(extract(epoch from (now() - v_period_anchor)) / v_period_seconds)::integer + 1;
    v_next_claim := coalesce(v_contract.claims_used, 0) + 1;

    while v_next_claim <= least(v_periods_due, coalesce(v_contract.max_claims, 0)) loop
      v_result_key := concat_ws('|', 'periodic', v_contract.id::text, v_contract.condition_type, v_next_claim::text);

      insert into public.sponsorship_rewards (
        contract_id, manager_id, manager_name, result_key, reward_value
      ) values (
        v_contract.id,
        v_contract.manager_id,
        v_contract.manager_name,
        v_result_key,
        v_contract.reward_value
      )
      on conflict (contract_id, result_key) do nothing;
      get diagnostics v_inserted = row_count;

      if v_inserted > 0 then
        update public.sponsorship_contracts
           set claims_used = claims_used + 1,
               status = case when claims_used + 1 >= max_claims then 'completed' else status end
         where id = v_contract.id;

        v_contract.claims_used := coalesce(v_contract.claims_used, 0) + 1;
        v_paid := v_paid + 1;

        perform public.app_insert_financial_event(
          v_contract.manager_name,
          'Parcela de patrocinio: ' || v_contract.sponsor_name,
          case when v_contract.condition_type = 'monthly_payment'
            then 'Pagamento mensal fixo de patrocinio.'
            else 'Pagamento semanal fixo de patrocinio.'
          end,
          '+' || v_contract.reward_value::text || ' creditado por contrato recorrente.',
          'Patrocinio',
          v_contract.reward_value
        );
      end if;

      v_next_claim := v_next_claim + 1;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'paid', v_paid);
end;
$$;

create or replace function public.app_process_all_sponsorship_rewards()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_result record;
  v_result_key text;
  v_gf integer;
  v_ga integer;
  v_is_home boolean;
  v_hit boolean;
  v_created integer := 0;
  v_periodic_paid integer := 0;
  v_results jsonb;
  v_inserted integer;
begin
  v_periodic_paid := coalesce((public.app_process_periodic_sponsorships() ->> 'paid')::integer, 0);
  v_results := coalesce(public.app_get_data()::jsonb -> 'results', '[]'::jsonb);

  for v_contract in
    select *
    from public.sponsorship_contracts
    where status = 'active'
      and condition_type not in ('weekly_payment', 'monthly_payment')
      and claims_used < max_claims
    order by created_at asc
  loop
    for v_result in
      select *
      from jsonb_to_recordset(v_results) as r(
        "Mandante" text,
        "Visitante" text,
        "GolsMandante" integer,
        "GolsVisitante" integer,
        "Status" text
      )
      where lower(coalesce(r."Status", '')) = lower('aprovado')
        and (
          lower(coalesce(r."Mandante", '')) = lower(v_contract.club_name)
          or lower(coalesce(r."Visitante", '')) = lower(v_contract.club_name)
        )
    loop
      exit when v_contract.claims_used >= v_contract.max_claims;

      v_result_key := concat_ws(
        '|',
        coalesce(v_result."Mandante"::text, ''),
        coalesce(v_result."Visitante"::text, ''),
        coalesce(v_result."GolsMandante"::text, ''),
        coalesce(v_result."GolsVisitante"::text, '')
      );

      if coalesce(v_contract.baseline_result_keys, '[]'::jsonb) ? v_result_key then
        continue;
      end if;

      if lower(v_result."Mandante"::text) = lower(v_contract.club_name) then
        v_is_home := true;
        v_gf := coalesce(v_result."GolsMandante", 0);
        v_ga := coalesce(v_result."GolsVisitante", 0);
      else
        v_is_home := false;
        v_gf := coalesce(v_result."GolsVisitante", 0);
        v_ga := coalesce(v_result."GolsMandante", 0);
      end if;

      v_hit := case v_contract.condition_type
        when 'clean_sheet' then v_ga = 0
        when 'three_goals' then v_gf >= 3
        when 'win_by_2' then (v_gf - v_ga) >= 2
        when 'any_win' then v_gf > v_ga
        when 'home_win' then v_is_home and v_gf > v_ga
        when 'away_win' then not v_is_home and v_gf > v_ga
        else false
      end;

      if not v_hit then
        continue;
      end if;

      insert into public.sponsorship_rewards (
        contract_id, manager_id, manager_name, result_key, reward_value
      ) values (
        v_contract.id, v_contract.manager_id, v_contract.manager_name, v_result_key, v_contract.reward_value
      )
      on conflict (contract_id, result_key) do nothing;
      get diagnostics v_inserted = row_count;

      if v_inserted <= 0 then
        continue;
      end if;

      update public.sponsorship_contracts
         set claims_used = claims_used + 1,
             status = case when claims_used + 1 >= max_claims then 'completed' else status end
       where id = v_contract.id;

      v_contract.claims_used := coalesce(v_contract.claims_used, 0) + 1;
      v_created := v_created + 1;

      perform public.app_insert_financial_event(
        v_contract.manager_name,
        'Bonus de patrocinio: ' || v_contract.sponsor_name,
        v_contract.title || ' cumprido por ' || v_contract.club_name || '.',
        '+' || v_contract.reward_value::text || ' creditado por meta de patrocinio.',
        'Patrocinio',
        v_contract.reward_value
      );
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created, 'periodicPaid', v_periodic_paid);
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
  v_manager record;
  v_login jsonb;
  v_all jsonb;
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

  v_all := public.app_process_all_sponsorship_rewards();
  return jsonb_build_object(
    'ok', true,
    'created', coalesce((v_all ->> 'created')::integer, 0),
    'periodicPaid', coalesce((v_all ->> 'periodicPaid')::integer, 0)
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
  v_manager record;
  v_login jsonb;
  v_active jsonb;
  v_rewards jsonb;
  v_offers jsonb;
  v_active_count integer := 0;
  v_max_active integer := 3;
begin
  select id, display_name into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('active', '[]'::jsonb, 'offers', '[]'::jsonb, 'recentRewards', '[]'::jsonb);
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
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
          then coalesce(c.payout_start_at, c.created_at + interval '7 days') + (c.claims_used * interval '7 days')
        when c.condition_type = 'monthly_payment' and c.claims_used < c.max_claims
          then coalesce(c.payout_start_at, c.created_at + interval '30 days') + (c.claims_used * interval '30 days')
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
    where c.manager_id = v_manager.id
      and c.status = 'active'
  ) c;

  select count(*) into v_active_count
  from public.sponsorship_contracts c
  where c.manager_id = v_manager.id and c.status = 'active';

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
    where r.manager_id = v_manager.id
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
      on c.manager_id = v_manager.id
     and c.status = 'active'
     and c.category = coalesce(offers.offer ->> 'category', 'Patrocinio')
    where not exists (
      select 1
      from public.sponsorship_contracts same
      where same.manager_id = v_manager.id
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

create or replace view public.v_manager_budgets as
with config as (
  select
    public.get_config_numeric('transfer_budget', 18000000) as base_budget,
    public.get_config_numeric('home_match_bonus', 150000) as home_match_bonus,
    public.get_config_numeric('win_bonus', 100000) as win_bonus,
    public.get_config_int('daily_transfer_limit', 3) as daily_transfer_limit
),
manager_base as (
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
  left join public.matches ma on ma.home_club_id = mb.club_id or ma.away_club_id = mb.club_id
  group by mb.manager_id
),
event_stats as (
  select
    e.manager_id,
    coalesce(sum(e.financial_impact) filter (where e.status in ('active', 'applied', 'generated')), 0) as event_bonus,
    count(e.id) filter (where e.status in ('active', 'applied', 'generated')) as event_count,
    coalesce(sum(e.transfer_modifier) filter (
      where e.status in ('active', 'applied', 'generated')
        and (e.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
    ), 0)::integer as transfer_modifier,
    count(e.id) filter (
      where e.status in ('active', 'applied', 'generated')
        and coalesce(e.affected_player, '') <> ''
        and (coalesce(e.matches_remaining, 0) > 0 or e.expires_at > now() or e.expires_at is null)
    ) as active_injuries
  from public.events e
  group by e.manager_id
),
transfer_stats as (
  select
    t.buyer_id as manager_id,
    coalesce(sum(case
      when t.status = 'approved' and t.transfer_type not in ('internal', 'cpu_sale')
        then coalesce(t.negotiated_value, t.final_value, 0)
      else 0
    end), 0) as spent_total,
    count(t.id) filter (
      where t.status = 'approved'
        and t.transfer_type not in ('internal', 'cpu_sale')
        and (t.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
    ) as transfers_today
  from public.transfers t
  group by t.buyer_id
)
select
  mb.manager_id,
  mb.manager_name,
  mb.club_id,
  mb.club_name,
  config.base_budget::numeric as base_budget,
  coalesce(hs.home_matches, 0)::integer as home_matches,
  coalesce(hs.wins, 0)::integer as wins,
  (coalesce(hs.home_matches, 0) * config.home_match_bonus)::numeric as home_bonus,
  (coalesce(hs.wins, 0) * config.win_bonus)::numeric as win_bonus,
  coalesce(es.event_bonus, 0)::numeric as event_bonus,
  (
    config.base_budget
    + (coalesce(hs.home_matches, 0) * config.home_match_bonus)
    + (coalesce(hs.wins, 0) * config.win_bonus)
    + coalesce(es.event_bonus, 0)
  )::numeric as total_budget,
  coalesce(ts.spent_total, 0)::numeric as spent_total,
  (
    config.base_budget
    + (coalesce(hs.home_matches, 0) * config.home_match_bonus)
    + (coalesce(hs.wins, 0) * config.win_bonus)
    + coalesce(es.event_bonus, 0)
    - coalesce(ts.spent_total, 0)
  )::numeric as remaining_budget,
  coalesce(es.event_count, 0)::integer as event_count,
  coalesce(es.active_injuries, 0)::integer as active_injuries,
  coalesce(es.transfer_modifier, 0)::integer as transfer_modifier,
  greatest(0, config.daily_transfer_limit + coalesce(es.transfer_modifier, 0))::integer as transfer_limit_today,
  coalesce(ts.transfers_today, 0)::integer as transfers_today
from manager_base mb
cross join config
left join home_stats hs on hs.manager_id = mb.manager_id
left join event_stats es on es.manager_id = mb.manager_id
left join transfer_stats ts on ts.manager_id = mb.manager_id;

grant execute on function public.app_sponsorship_payout_start(text) to anon, authenticated;
grant execute on function public.app_sponsorship_offers() to anon, authenticated;
grant execute on function public.app_accept_sponsorship(text, text, text) to anon, authenticated;
grant execute on function public.app_process_periodic_sponsorships() to anon, authenticated;
grant execute on function public.app_process_all_sponsorship_rewards() to anon, authenticated;
grant execute on function public.app_process_sponsorship_rewards(text, text) to anon, authenticated;
grant execute on function public.app_get_my_sponsorships(text, text) to anon, authenticated;

commit;
