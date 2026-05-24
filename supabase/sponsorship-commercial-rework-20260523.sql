-- v64 - Sponsorship commercial rework - 23/05/2026.
--
-- Makes sponsorship_rewards the canonical source for sponsorship income,
-- backfills signing bonuses as first-class payments, improves recurring
-- payouts, and refreshes the offer board with stronger weekly/monthly deals.

create or replace function public.app_sponsorship_offers()
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'id','nova_kits_weekly',
      'sponsorName','Nova Sportswear',
      'category','Fornecedor de material esportivo',
      'title','Uniforme garantido',
      'description','Caixa previsível para manter folha e pequenas compras vivas durante a semana.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Fluxo de caixa',
      'signingBonus',1600000,
      'rewardValue',1750000,
      'maxClaims',10,
      'paymentCadence','weekly'
    ),
    jsonb_build_object(
      'id','aurora_kits',
      'sponsorName','Aurora Kits',
      'category','Fornecedor de material esportivo',
      'title','Coleção campeã',
      'description','Pouca gordura, muita vitrine: paga alto quando o time vence convencendo.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigência',
      'dealStyle','Prêmio agressivo',
      'signingBonus',1400000,
      'rewardValue',2700000,
      'maxClaims',5
    ),
    jsonb_build_object(
      'id','adidas_partner',
      'sponsorName','Adidas Originals',
      'category','Fornecedor de material esportivo',
      'title','Camisa de coleção',
      'description','Boa luva e meta simples para técnicos que preferem consistência.',
      'conditionType','any_win',
      'conditionLabel','Vencer qualquer partida',
      'riskLevel','Baixa exigência',
      'dealStyle','Seguro premium',
      'signingBonus',2400000,
      'rewardValue',1450000,
      'maxClaims',8
    ),

    jsonb_build_object(
      'id','redwood_monthly',
      'sponsorName','Redwood Capital',
      'category','Naming Rights de Estádio',
      'title','Redwood Park mensal',
      'description','Naming rights de impacto: poucos vencimentos, todos grandes.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal forte',
      'dealStyle','Cheque grande',
      'signingBonus',3500000,
      'rewardValue',9500000,
      'maxClaims',4,
      'paymentCadence','monthly'
    ),
    jsonb_build_object(
      'id','fortress_arena',
      'sponsorName','Fortress Telecom',
      'category','Naming Rights de Estádio',
      'title','Fortress Stadium',
      'description','Marca barulhenta para times fortes em casa e noites de pressão.',
      'conditionType','home_win',
      'conditionLabel','Vencer como mandante',
      'riskLevel','Média exigência',
      'dealStyle','Casa forte',
      'signingBonus',1800000,
      'rewardValue',2400000,
      'maxClaims',6
    ),
    jsonb_build_object(
      'id','spotify_arena_weekly',
      'sponsorName','Spotify',
      'category','Naming Rights de Estádio',
      'title','Matchday Arena',
      'description','Ativação semanal com dinheiro constante e teto total competitivo.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Constância alta',
      'signingBonus',1800000,
      'rewardValue',1600000,
      'maxClaims',10,
      'paymentCadence','weekly'
    ),

    jsonb_build_object(
      'id','emirates_monthly',
      'sponsorName','Emirates',
      'category','Patrocinador master',
      'title','Global front shirt',
      'description','Contrato master de vitrine global: luva forte e parcelas mensais chamativas.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal elite',
      'dealStyle','Master premium',
      'signingBonus',5000000,
      'rewardValue',12500000,
      'maxClaims',4,
      'paymentCadence','monthly'
    ),
    jsonb_build_object(
      'id','pioneer_master',
      'sponsorName','Pioneer Motors',
      'category','Patrocinador master',
      'title','Frente da camisa',
      'description','Master equilibrado para quem quer receita constante por qualquer vitória.',
      'conditionType','any_win',
      'conditionLabel','Vencer qualquer partida',
      'riskLevel','Baixa exigência',
      'dealStyle','Volume seguro',
      'signingBonus',2800000,
      'rewardValue',1500000,
      'maxClaims',8
    ),
    jsonb_build_object(
      'id','redbull_master',
      'sponsorName','Red Bull',
      'category','Patrocinador master',
      'title','High tempo deal',
      'description','Paga como marca grande quando o ataque transforma jogo em evento.',
      'conditionType','three_goals',
      'conditionLabel','Marcar 3+ gols',
      'riskLevel','Alta exigência',
      'dealStyle','Ataque premiado',
      'signingBonus',2300000,
      'rewardValue',3100000,
      'maxClaims',5
    ),
    jsonb_build_object(
      'id','atlas_master',
      'sponsorName','Atlas Bank',
      'category','Patrocinador master',
      'title','Camisa pesada',
      'description','Master clássico com prêmio alto para noites ofensivas.',
      'conditionType','three_goals',
      'conditionLabel','Marcar 3+ gols',
      'riskLevel','Alta exigência',
      'dealStyle','Master ofensivo',
      'signingBonus',2200000,
      'rewardValue',2900000,
      'maxClaims',5
    ),

    jsonb_build_object(
      'id','sony_monthly',
      'sponsorName','Sony Xperia',
      'category','Parceiro premium',
      'title','Tech mensal',
      'description','Parceiro premium com parcela mensal alta para acelerar reconstruções.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal forte',
      'dealStyle','Impulso de mercado',
      'signingBonus',4500000,
      'rewardValue',10500000,
      'maxClaims',4,
      'paymentCadence','monthly'
    ),
    jsonb_build_object(
      'id','betfair_partner',
      'sponsorName','Betfair',
      'category','Parceiro premium',
      'title','Odds boost',
      'description','Contrato agressivo para quem busca placares largos e retorno imediato.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigência',
      'dealStyle','Alto upside',
      'signingBonus',2200000,
      'rewardValue',2800000,
      'maxClaims',5
    ),
    jsonb_build_object(
      'id','primevideo_weekly',
      'sponsorName','Prime Video',
      'category','Parceiro premium',
      'title','Matchday series',
      'description','Pagamento semanal menor, mas muito confiável para atravessar o calendário.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Piso estavel',
      'signingBonus',1400000,
      'rewardValue',1450000,
      'maxClaims',12,
      'paymentCadence','weekly'
    ),

    jsonb_build_object(
      'id','voasul_logistics',
      'sponsorName','VoaSul',
      'category','Logística e viagens',
      'title','Milhas da delegação',
      'description','Ajuda viagem e paga forte quando o clube ganha como visitante.',
      'conditionType','away_win',
      'conditionLabel','Vencer como visitante',
      'riskLevel','Média exigência',
      'dealStyle','Visitante forte',
      'signingBonus',1400000,
      'rewardValue',2000000,
      'maxClaims',6
    ),
    jsonb_build_object(
      'id','dhl_weekly',
      'sponsorName','DHL Express',
      'category','Logística e viagens',
      'title','Entrega semanal',
      'description','Dinheiro cai no fechamento semanal sem depender de placar.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Previsivel',
      'signingBonus',1600000,
      'rewardValue',1650000,
      'maxClaims',10,
      'paymentCadence','weekly'
    ),
    jsonb_build_object(
      'id','maersk_logistics',
      'sponsorName','Maersk',
      'category','Logística e viagens',
      'title','Rota do norte',
      'description','Bônus robusto para clubes que roubam pontos longe de casa.',
      'conditionType','away_win',
      'conditionLabel','Vencer como visitante',
      'riskLevel','Média exigência',
      'dealStyle','Visitante forte',
      'signingBonus',1700000,
      'rewardValue',2300000,
      'maxClaims',6
    ),

    jsonb_build_object(
      'id','netflix_media',
      'sponsorName','Netflix Sports',
      'category','Mídia e conteúdo',
      'title','Docuserie da temporada',
      'description','Luva alta, marca grande e prêmio por vitórias que rendem manchete.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigência',
      'dealStyle','Vitrine global',
      'signingBonus',3200000,
      'rewardValue',2300000,
      'maxClaims',5
    ),
    jsonb_build_object(
      'id','streamplay_weekly',
      'sponsorName','StreamPlay Sports',
      'category','Mídia e conteúdo',
      'title','Bastidores semanais',
      'description','Conteúdo recorrente com receita leve e constante para todo perfil de elenco.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Base de caixa',
      'signingBonus',1100000,
      'rewardValue',1250000,
      'maxClaims',12,
      'paymentCadence','weekly'
    ),
    jsonb_build_object(
      'id','primecam_media',
      'sponsorName','PrimeCam',
      'category','Mídia e conteúdo',
      'title','Noite de gala',
      'description','Transmissão paga melhor quando o time entrega jogo de gols.',
      'conditionType','three_goals',
      'conditionLabel','Marcar 3+ gols',
      'riskLevel','Média exigência',
      'dealStyle','Show ofensivo',
      'signingBonus',1100000,
      'rewardValue',2100000,
      'maxClaims',6
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
begin
  select id, display_name into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do técnico inválido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do técnico inválido.');
  end if;

  select offers.offer into v_offer
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where offers.offer ->> 'id' = p_offer_id;

  if v_offer is null then
    return jsonb_build_object('ok', false, 'message', 'Patrocinador não encontrado.');
  end if;

  select count(*) into v_active_count
  from public.sponsorship_contracts
  where manager_id = v_manager.id and status = 'active';

  select * into v_existing
  from public.sponsorship_contracts
  where manager_id = v_manager.id
    and status = 'active'
    and category = coalesce(v_offer ->> 'category', 'Patrocínio')
  order by created_at desc
  limit 1;

  if v_existing.id is null and v_active_count >= v_max_active then
    return jsonb_build_object('ok', false, 'message', 'Limite comercial atingido: cada técnico pode manter até 3 patrocínios ativos.');
  end if;

  if v_existing.sponsor_id = (v_offer ->> 'id') then
    return jsonb_build_object('ok', false, 'message', 'Este patrocínio já está ativo.');
  end if;

  v_club_name := coalesce(v_login #>> '{manager,club}', v_manager.display_name);
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
      coalesce(v_login #>> '{manager,name}', v_manager.display_name),
      'Rescisão de patrocínio: ' || v_existing.sponsor_name,
      v_existing.category || ' encerrado para abrir espaco a ' || (v_offer ->> 'sponsorName') || '.',
      '-' || v_termination_fee::text || ' debitado como multa de rescisão.',
      'Patrocínio',
      -v_termination_fee
    );
  end if;

  insert into public.sponsorship_contracts (
    manager_id, manager_name, club_name, sponsor_id, sponsor_name, category, title,
    description, condition_type, signing_bonus, reward_value, max_claims, baseline_result_keys
  ) values (
    v_manager.id,
    coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    v_club_name,
    v_offer ->> 'id',
    v_offer ->> 'sponsorName',
    coalesce(v_offer ->> 'category', 'Patrocínio'),
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
      v_manager.id,
      coalesce(v_login #>> '{manager,name}', v_manager.display_name),
      'signing_bonus|' || v_contract_id::text,
      v_signing_bonus,
      now()
    )
    on conflict (contract_id, result_key) do nothing;
  end if;

  perform public.app_insert_financial_event(
    coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    'Luva de patrocínio: ' || (v_offer ->> 'sponsorName'),
    coalesce(v_offer ->> 'category', 'Patrocínio') || ' fechado por ' || coalesce(v_login #>> '{manager,name}', v_manager.display_name) || '.',
    '+' || v_signing_bonus::text || ' creditado como luva de assinatura.',
    'Patrocínio',
    v_signing_bonus
  );

  return jsonb_build_object(
    'ok', true,
    'message', case when v_existing.id is not null
      then 'Patrocínio substituído com multa de rescisão aplicada e luva creditada.'
      else 'Patrocínio assinado com luva creditada.'
    end,
    'terminationFee', v_termination_fee,
    'signingBonus', v_signing_bonus,
    'contractId', v_contract_id
  );
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
  v_period_seconds numeric;
  v_periods_due integer;
  v_next_claim integer;
  v_inserted integer;
begin
  select id, display_name into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do técnico inválido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do técnico inválido.');
  end if;

  v_results := coalesce(public.app_get_data()::jsonb -> 'results', '[]'::jsonb);

  for v_contract in
    select *
    from public.sponsorship_contracts
    where manager_id = v_manager.id
      and status = 'active'
      and claims_used < max_claims
    order by created_at asc
  loop
    if v_contract.condition_type in ('weekly_payment', 'monthly_payment') then
      v_period_seconds := case
        when v_contract.condition_type = 'monthly_payment' then 30 * 24 * 60 * 60
        else 7 * 24 * 60 * 60
      end;
      v_periods_due := floor(extract(epoch from (now() - v_contract.created_at)) / v_period_seconds)::integer;
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

          v_contract.claims_used := v_contract.claims_used + 1;
          v_periodic_paid := v_periodic_paid + 1;

          perform public.app_insert_financial_event(
            v_contract.manager_name,
            'Parcela de patrocínio: ' || v_contract.sponsor_name,
            case when v_contract.condition_type = 'monthly_payment'
              then 'Pagamento mensal fixo de patrocínio.'
              else 'Pagamento semanal fixo de patrocínio.'
            end,
            '+' || v_contract.reward_value::text || ' creditado por contrato recorrente.',
            'Patrocínio',
            v_contract.reward_value
          );
        end if;

        v_next_claim := v_next_claim + 1;
      end loop;

      continue;
    end if;

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

      if exists (
        select 1
        from public.sponsorship_rewards
        where contract_id = v_contract.id
          and result_key = v_result_key
      ) then
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
      );

      update public.sponsorship_contracts
         set claims_used = claims_used + 1,
             status = case when claims_used + 1 >= max_claims then 'completed' else status end
       where id = v_contract.id;

      v_contract.claims_used := v_contract.claims_used + 1;
      v_created := v_created + 1;

      perform public.app_insert_financial_event(
        v_contract.manager_name,
        'Bônus de patrocínio: ' || v_contract.sponsor_name,
        v_contract.title || ' cumprido por ' || v_contract.club_name || '.',
        '+' || v_contract.reward_value::text || ' creditado por meta de patrocínio.',
        'Patrocínio',
        v_contract.reward_value
      );
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created, 'periodicPaid', v_periodic_paid);
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
          when 'clean_sheet' then 'Não sofrer gols'
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
     and c.category = coalesce(offers.offer ->> 'category', 'Patrocínio')
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

create or replace function public.app_get_budget_reconciliation()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with data as (
    select public.app_get_data()::jsonb as j
  ),
  config as (
    select
      coalesce((j ->> 'budget')::numeric, 65000000) as base_budget_default,
      coalesce((j ->> 'homeMatchBonus')::numeric, 1250000) as home_match_bonus,
      coalesce((j ->> 'winBonus')::numeric, 500000) as win_bonus
    from data
  ),
  teams(manager_name, club_name) as (
    values
      ('Henrique', 'Coventry City'),
      ('Willian', 'Birmingham City'),
      ('Rafael', 'Middlesbrough'),
      ('Renato', 'Southampton'),
      ('Bruno Silva', 'Wrexham')
  ),
  results as (
    select *
    from jsonb_to_recordset(coalesce((select j -> 'results' from data), '[]'::jsonb)) as r(
      "Mandante" text,
      "Visitante" text,
      "GolsMandante" integer,
      "GolsVisitante" integer,
      "Status" text,
      "Competicao" text
    )
    where lower(coalesce("Status", '')) = 'aprovado'
      and lower(coalesce("Competicao", '')) = 'championship'
  ),
  stats as (
    select
      t.manager_name,
      count(*) filter (where lower(r."Mandante") = lower(t.club_name))::integer as home_matches,
      count(*) filter (
        where (
          lower(r."Mandante") = lower(t.club_name)
          and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0)
        ) or (
          lower(r."Visitante") = lower(t.club_name)
          and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0)
        )
      )::integer as wins,
      count(*)::integer as matches_played,
      sum(
        case
          when lower(r."Mandante") = lower(t.club_name) and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0) then 3
          when lower(r."Visitante") = lower(t.club_name) and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0) then 3
          when coalesce(r."GolsMandante", -1) = coalesce(r."GolsVisitante", -2) then 1
          else 0
        end
      )::integer as points
    from teams t
    left join results r
      on lower(r."Mandante") = lower(t.club_name)
      or lower(r."Visitante") = lower(t.club_name)
    group by t.manager_name
  ),
  reward_totals as (
    select
      manager_name,
      sum(reward_value)::numeric as reward_total
    from public.sponsorship_rewards
    group by manager_name
  ),
  sponsorship_payout_events as (
    select
      "Jogador" as manager_name,
      sum(coalesce("ImpactoFinanceiro", 0))::numeric as event_reward_total
    from jsonb_to_recordset(coalesce((select j -> 'events' from data), '[]'::jsonb)) as e(
      "Jogador" text,
      "Titulo" text,
      "Tipo" text,
      "ImpactoFinanceiro" numeric
    )
    where coalesce("ImpactoFinanceiro", 0) > 0
      and (
        lower(coalesce("Tipo", '')) in ('patrocinio', 'patrocínio')
        or lower(coalesce("Titulo", '')) like '%patrocinio%'
        or lower(coalesce("Titulo", '')) like '%patrocínio%'
      )
    group by "Jogador"
  ),
  raw_budgets as (
    select key as manager_name, value as budget
    from jsonb_each(coalesce((select j -> 'budgets' from data), '{}'::jsonb))
  ),
  transfer_spend as (
    select public.app_get_transfer_spend_breakdown() as totals
  ),
  reconciled as (
    select
      t.manager_name,
      coalesce((rb.budget ->> 'baseBudget')::numeric, config.base_budget_default) as base_budget,
      coalesce(s.matches_played, 0) as matches_played,
      coalesce(s.points, 0) as points,
      coalesce(s.home_matches, 0) as home_matches,
      coalesce(s.wins, 0) as wins,
      coalesce((rb.budget ->> 'weeklyIncome')::numeric, 0) as weekly_income_value,
      coalesce(s.home_matches, 0) * config.home_match_bonus as home_bonus,
      coalesce(s.wins, 0) * config.win_bonus as win_bonus_value,
      coalesce((rb.budget ->> 'formBonus')::numeric, 0) as form_bonus,
      coalesce((rb.budget ->> 'cupRebalanceBonus')::numeric, 0) as cup_rebalance_bonus,
      coalesce((rb.budget ->> 'eventTotal')::numeric, 0)
        - coalesce(spe.event_reward_total, 0)
        + coalesce(rt.reward_total, 0) as event_total,
      coalesce(rt.reward_total, 0) as sponsorship_rewards,
      coalesce((rb.budget ->> 'spentTotal')::numeric, 0) as legacy_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'marketTotal')::numeric, 0) as secure_market_total,
      coalesce((ts.totals -> t.manager_name ->> 'finalTotal')::numeric, 0) as secure_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'deltaTotal')::numeric, 0) as secure_delta_total,
      coalesce((ts.totals -> t.manager_name ->> 'nonApprovedMarketTotal')::numeric, 0) as non_approved_market_total,
      greatest(0, coalesce((rb.budget ->> 'spentTotal')::numeric, 0)) as spent_total,
      coalesce((rb.budget ->> 'transferModifier')::integer, 0) as transfer_modifier,
      coalesce((rb.budget ->> 'transferLimit')::integer, 3) as transfer_limit
    from teams t
    cross join config
    cross join transfer_spend ts
    left join raw_budgets rb on rb.manager_name = t.manager_name
    left join stats s on s.manager_name = t.manager_name
    left join reward_totals rt on rt.manager_name = t.manager_name
    left join sponsorship_payout_events spe on spe.manager_name = t.manager_name
  )
  select coalesce(jsonb_object_agg(
    manager_name,
    jsonb_build_object(
      'baseBudget', base_budget,
      'matchesPlayed', matches_played,
      'homeMatches', home_matches,
      'wins', wins,
      'points', points,
      'weeklyIncome', weekly_income_value,
      'homeBonus', home_bonus,
      'winBonusValue', win_bonus_value,
      'formBonus', form_bonus,
      'cupRebalanceBonus', cup_rebalance_bonus,
      'eventTotal', event_total,
      'sponsorshipRewards', sponsorship_rewards,
      'totalBudget', base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total,
      'legacySpentTotal', legacy_spent_total,
      'secureMarketTotal', secure_market_total,
      'secureSpentTotal', secure_spent_total,
      'secureDeltaTotal', secure_delta_total,
      'nonApprovedMarketTotal', non_approved_market_total,
      'spentTotal', spent_total,
      'remainingBudget', base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total,
      'transferModifier', transfer_modifier,
      'transferLimit', transfer_limit,
      'transfersToday', public.app_get_external_transfer_today_count(manager_name)
    )
  ), '{}'::jsonb)
  from reconciled;
$$;

with offer_rows as (
  select offer
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
),
updated_contracts as (
  update public.sponsorship_contracts c
     set sponsor_name = o.offer ->> 'sponsorName',
         title = o.offer ->> 'title',
         description = o.offer ->> 'description',
         condition_type = o.offer ->> 'conditionType',
         signing_bonus = coalesce((o.offer ->> 'signingBonus')::numeric, c.signing_bonus),
         reward_value = coalesce((o.offer ->> 'rewardValue')::numeric, c.reward_value),
         max_claims = coalesce((o.offer ->> 'maxClaims')::integer, c.max_claims)
    from offer_rows o
   where c.sponsor_id = o.offer ->> 'id'
     and c.status = 'active'
     and c.claims_used = 0
  returning c.id, c.signing_bonus
)
update public.sponsorship_rewards r
   set reward_value = u.signing_bonus
  from updated_contracts u
 where r.contract_id = u.id
   and r.result_key = 'signing_bonus|' || u.id::text;

insert into public.sponsorship_rewards (
  contract_id,
  manager_id,
  manager_name,
  result_key,
  reward_value,
  created_at
)
select
  c.id,
  c.manager_id,
  c.manager_name,
  'signing_bonus|' || c.id::text,
  c.signing_bonus,
  c.created_at
from public.sponsorship_contracts c
where coalesce(c.signing_bonus, 0) > 0
  and c.status = 'active'
on conflict (contract_id, result_key) do nothing;

grant execute on function public.app_sponsorship_offers() to anon, authenticated;
grant execute on function public.app_accept_sponsorship(text, text, text) to anon, authenticated;
grant execute on function public.app_process_sponsorship_rewards(text, text) to anon, authenticated;
grant execute on function public.app_get_my_sponsorships(text, text) to anon, authenticated;
grant execute on function public.app_get_budget_reconciliation() to anon, authenticated;
