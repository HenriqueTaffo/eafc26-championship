-- Restore realistic sponsorship signing fees and installment values.
-- Basis: Championship commercial income is materially below elite clubs, but
-- still meaningful. The model keeps total active sponsorships in second-tier
-- scale by using small upfront fees and controlled weekly/monthly installments.

begin;

alter table public.sponsorship_contracts
  add column if not exists payout_start_at timestamptz;

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
      'title','Uniforme principal',
      'description','Contrato de camisa em escala de Championship: luva pequena e parcela semanal moderada.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Kit supplier',
      'signingBonus',120000,
      'rewardValue',55000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','dhl_weekly',
      'sponsorName','DHL Express',
      'category','Logistica e viagens',
      'title','Viagens da temporada',
      'description','Apoio operacional para viagens e logistica, com entrada baixa e receita semanal previsivel.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Operacional',
      'signingBonus',80000,
      'rewardValue',45000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','streamplay_weekly',
      'sponsorName','StreamPlay Sports',
      'category','Midia e conteudo',
      'title','Bastidores semanais',
      'description','Receita de conteudo recorrente, calibrada para nao inflar o caixa antes da bola rolar.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Conteudo',
      'signingBonus',90000,
      'rewardValue',40000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','spotify_arena_weekly',
      'sponsorName','Spotify',
      'category','Naming Rights de Estadio',
      'title','Matchday Arena',
      'description','Naming rights de estadio com luva controlada e fluxo semanal de segunda divisao.',
      'conditionType','weekly_payment',
      'conditionLabel','Pagamento semanal fixo',
      'riskLevel','Receita semanal',
      'dealStyle','Estadio recorrente',
      'signingBonus',150000,
      'rewardValue',70000,
      'maxClaims',36,
      'paymentCadence','weekly',
      'firstPaymentAt', public.app_sponsorship_payout_start('weekly_payment')
    ),
    jsonb_build_object(
      'id','redwood_monthly',
      'sponsorName','Redwood Capital',
      'category','Naming Rights de Estadio',
      'title','Redwood Park',
      'description','Contrato mensal de estadio com valor relevante, mas ainda abaixo de patamar de elite.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal',
      'dealStyle','Estadio mensal',
      'signingBonus',250000,
      'rewardValue',250000,
      'maxClaims',9,
      'paymentCadence','monthly',
      'firstPaymentAt', public.app_sponsorship_payout_start('monthly_payment')
    ),
    jsonb_build_object(
      'id','emirates_monthly',
      'sponsorName','Emirates',
      'category','Patrocinador master',
      'title','Frente da camisa',
      'description','Patrocinador master premium para clube de acesso: entrada realista e parcelas mensais fortes.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal forte',
      'dealStyle','Master premium',
      'signingBonus',400000,
      'rewardValue',425000,
      'maxClaims',9,
      'paymentCadence','monthly',
      'firstPaymentAt', public.app_sponsorship_payout_start('monthly_payment')
    ),
    jsonb_build_object(
      'id','sony_monthly',
      'sponsorName','Sony Xperia',
      'category','Parceiro premium',
      'title','Tech mensal',
      'description','Parceria premium com pagamento mensal forte e teto anual controlado.',
      'conditionType','monthly_payment',
      'conditionLabel','Pagamento mensal fixo',
      'riskLevel','Receita mensal',
      'dealStyle','Parceiro tech',
      'signingBonus',220000,
      'rewardValue',300000,
      'maxClaims',9,
      'paymentCadence','monthly',
      'firstPaymentAt', public.app_sponsorship_payout_start('monthly_payment')
    ),
    jsonb_build_object(
      'id','aurora_kits',
      'sponsorName','Aurora Kits',
      'category','Fornecedor de material esportivo',
      'title','Colecao de acesso',
      'description','Contrato por vitrine esportiva: luva baixa e bonus por vitoria convincente.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Premio por vitrine',
      'signingBonus',100000,
      'rewardValue',120000,
      'maxClaims',10,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','fortress_arena',
      'sponsorName','Fortress Telecom',
      'category','Naming Rights de Estadio',
      'title','Fortress Stadium',
      'description','Premio por transformar mando em receita, com luva abaixo dos naming rights mensais.',
      'conditionType','home_win',
      'conditionLabel','Vencer como mandante',
      'riskLevel','Media exigencia',
      'dealStyle','Mando forte',
      'signingBonus',140000,
      'rewardValue',145000,
      'maxClaims',12,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','atlas_master',
      'sponsorName','Atlas Bank',
      'category','Patrocinador master',
      'title','Camisa pesada',
      'description','Master por desempenho ofensivo, com entrada realista e teto de bonus moderado.',
      'conditionType','three_goals',
      'conditionLabel','Marcar 3+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Master ofensivo',
      'signingBonus',300000,
      'rewardValue',220000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','pioneer_master',
      'sponsorName','Pioneer Motors',
      'category','Patrocinador master',
      'title','Frente da camisa',
      'description','Contrato master conservador, com luva moderada e bonus recorrente por vitoria.',
      'conditionType','any_win',
      'conditionLabel','Vencer qualquer partida',
      'riskLevel','Baixa exigencia',
      'dealStyle','Volume seguro',
      'signingBonus',260000,
      'rewardValue',130000,
      'maxClaims',14,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','voasul_logistics',
      'sponsorName','VoaSul',
      'category','Logistica e viagens',
      'title','Milhas da delegacao',
      'description','Bonus por resultado fora de casa, alinhado a custo real de viagem e operacao.',
      'conditionType','away_win',
      'conditionLabel','Vencer como visitante',
      'riskLevel','Media exigencia',
      'dealStyle','Visitante forte',
      'signingBonus',80000,
      'rewardValue',120000,
      'maxClaims',10,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','betfair_partner',
      'sponsorName','Betfair',
      'category','Parceiro premium',
      'title','Odds boost',
      'description','Parceiro premium por jogos de impacto, com luva menor que contratos master.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Alto upside',
      'signingBonus',180000,
      'rewardValue',170000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','netflix_media',
      'sponsorName','Netflix Sports',
      'category','Midia e conteudo',
      'title','Docuserie da temporada',
      'description','Marca de midia paga por jogos que geram narrativa, com entrada baixa e upside esportivo.',
      'conditionType','win_by_2',
      'conditionLabel','Vencer por 2+ gols',
      'riskLevel','Alta exigencia',
      'dealStyle','Vitrine global',
      'signingBonus',220000,
      'rewardValue',190000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    ),
    jsonb_build_object(
      'id','primecam_media',
      'sponsorName','PrimeCam',
      'category','Midia e conteudo',
      'title','Noite de gala',
      'description','Bonus por partidas ofensivas, com luva e teto anual compativeis com Championship.',
      'conditionType','three_goals',
      'conditionLabel','Marcar 3+ gols',
      'riskLevel','Media exigencia',
      'dealStyle','Show ofensivo',
      'signingBonus',110000,
      'rewardValue',150000,
      'maxClaims',8,
      'paymentCadence','goal',
      'firstPaymentAt', null
    )
  );
$$;

with offers as (
  select
    offer ->> 'id' as sponsor_id,
    offer ->> 'sponsorName' as sponsor_name,
    coalesce(offer ->> 'category', 'Patrocinio') as category,
    offer ->> 'title' as title,
    offer ->> 'description' as description,
    offer ->> 'conditionType' as condition_type,
    coalesce((offer ->> 'signingBonus')::numeric, 0) as signing_bonus,
    coalesce((offer ->> 'rewardValue')::numeric, 0) as reward_value,
    coalesce((offer ->> 'maxClaims')::integer, 0) as max_claims,
    case
      when coalesce(offer ->> 'firstPaymentAt', '') <> ''
        then (offer ->> 'firstPaymentAt')::timestamptz
      else null::timestamptz
    end as payout_start_at
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
)
update public.sponsorship_contracts c
   set sponsor_name = offers.sponsor_name,
       category = offers.category,
       title = offers.title,
       description = offers.description,
       condition_type = offers.condition_type,
       signing_bonus = offers.signing_bonus,
       reward_value = offers.reward_value,
       max_claims = offers.max_claims,
       payout_start_at = offers.payout_start_at
  from offers
 where c.sponsor_id = offers.sponsor_id
   and c.status = 'active';

do $$
declare
  v_contract record;
  v_inserted integer;
begin
  for v_contract in
    select
      c.id,
      c.manager_id,
      c.manager_name,
      c.sponsor_name,
      c.category,
      c.signing_bonus
    from public.sponsorship_contracts c
    where c.status = 'active'
      and c.signing_bonus > 0
      and not exists (
        select 1
        from public.sponsorship_rewards r
        where r.contract_id = c.id
          and r.result_key = 'signing_bonus|' || c.id::text
      )
  loop
    insert into public.sponsorship_rewards (
      contract_id, manager_id, manager_name, result_key, reward_value, created_at
    ) values (
      v_contract.id,
      v_contract.manager_id,
      v_contract.manager_name,
      'signing_bonus|' || v_contract.id::text,
      v_contract.signing_bonus,
      now()
    )
    on conflict (contract_id, result_key) do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted > 0 then
      perform public.app_insert_financial_event(
        v_contract.manager_name,
        'Luva de patrocinio: ' || v_contract.sponsor_name,
        v_contract.category || ' ajustado para valores realistas de Championship.',
        '+' || v_contract.signing_bonus::text || ' creditado como luva de assinatura.',
        'Patrocinio',
        v_contract.signing_bonus
      );
    end if;
  end loop;
end $$;

grant execute on function public.app_sponsorship_payout_start(text) to anon, authenticated;
grant execute on function public.app_sponsorship_offers() to anon, authenticated;

commit;
