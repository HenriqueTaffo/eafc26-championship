-- v56 - Economy and sponsorship rebalance.
-- Run in Supabase SQL editor after the base schema scripts.
-- Keeps existing results/transfers, but changes future calculations and sponsorship behavior.

create or replace function public.app_sponsorship_offers()
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(
    jsonb_build_object('id','aurora_kits','sponsorName','Aurora Kits','category','Fornecedor de material esportivo','title','Colecao campea','description','Linha premium: pouca luva e bonus alto por vitorias fortes.','conditionType','win_by_2','conditionLabel','Vencer por 2+ gols','riskLevel','Alta exigencia','signingBonus',800000,'rewardValue',1800000,'maxClaims',5),
    jsonb_build_object('id','nova_kits','sponsorName','Nova Sportswear','category','Fornecedor de material esportivo','title','Uniforme de alcance','description','Contrato seguro: paga menos, mas qualquer vitoria gera exposicao.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',900000,'rewardValue',900000,'maxClaims',7),
    jsonb_build_object('id','umbra_elite','sponsorName','Umbra Elite','category','Fornecedor de material esportivo','title','Camisa de vitrine','description','Marca internacional paga bem quando o time marca tres gols.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Media exigencia','signingBonus',1200000,'rewardValue',1500000,'maxClaims',5),
    jsonb_build_object('id','castore_lab','sponsorName','Castore Lab','category','Fornecedor de material esportivo','title','Performance kit','description','Contrato equilibrado para elenco competitivo e regular.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',1500000,'rewardValue',750000,'maxClaims',8),
    jsonb_build_object('id','hummel_heritage','sponsorName','Hummel Heritage','category','Fornecedor de material esportivo','title','Camisa retro premium','description','Bonus forte para noites sem sofrer gols.','conditionType','clean_sheet','conditionLabel','Nao sofrer gols','riskLevel','Media exigencia','signingBonus',700000,'rewardValue',1600000,'maxClaims',5),

    jsonb_build_object('id','horizonte_arena','sponsorName','Banco Horizonte','category','Naming Rights de Estadio','title','Horizonte Arena','description','Naming rights pesado, com gatilho por vitoria em casa.','conditionType','home_win','conditionLabel','Vencer como mandante','riskLevel','Media exigencia','signingBonus',1500000,'rewardValue',1700000,'maxClaims',5),
    jsonb_build_object('id','fortress_arena','sponsorName','Fortress Telecom','category','Naming Rights de Estadio','title','Fortress Stadium','description','Oferta agressiva para clubes dominantes em casa.','conditionType','win_by_2','conditionLabel','Vencer por 2+ gols','riskLevel','Alta exigencia','signingBonus',900000,'rewardValue',2300000,'maxClaims',4),
    jsonb_build_object('id','redwood_arena','sponsorName','Redwood Capital','category','Naming Rights de Estadio','title','Redwood Park','description','Mais luvas, bonus moderado e previsivel por qualquer vitoria.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',3000000,'rewardValue',700000,'maxClaims',7),
    jsonb_build_object('id','volt_arena','sponsorName','Volt Energy','category','Naming Rights de Estadio','title','Volt Stadium','description','Energia extra para jogos ofensivos em casa ou fora.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Media exigencia','signingBonus',1700000,'rewardValue',1650000,'maxClaims',5),

    jsonb_build_object('id','neurofit_ct','sponsorName','NeuroFit Performance','category','Naming Rights de CT','title','CT NeuroFit','description','Centro de performance focado em defesa.','conditionType','clean_sheet','conditionLabel','Nao sofrer gols','riskLevel','Media exigencia','signingBonus',900000,'rewardValue',1300000,'maxClaims',6),
    jsonb_build_object('id','ironlab_ct','sponsorName','IronLab','category','Naming Rights de CT','title','IronLab Training Center','description','Preparacao fisica paga por jogos de tres gols.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Alta exigencia','signingBonus',700000,'rewardValue',1900000,'maxClaims',5),
    jsonb_build_object('id','apex_ct','sponsorName','Apex Analytics','category','Naming Rights de CT','title','Apex Data Center','description','Contrato de performance com meta simples e teto menor.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',1400000,'rewardValue',800000,'maxClaims',6),
    jsonb_build_object('id','medcore_ct','sponsorName','MedCore Sports','category','Naming Rights de CT','title','MedCore Campus','description','Paga bem quando o time controla o jogo e nao sofre gols.','conditionType','clean_sheet','conditionLabel','Nao sofrer gols','riskLevel','Media exigencia','signingBonus',1200000,'rewardValue',1500000,'maxClaims',5),

    jsonb_build_object('id','atlas_master','sponsorName','Atlas Bank','category','Patrocinador master','title','Camisa pesada','description','Master de elite: teto alto e exigencia ofensiva.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Alta exigencia','signingBonus',1600000,'rewardValue',2200000,'maxClaims',5),
    jsonb_build_object('id','pioneer_master','sponsorName','Pioneer Motors','category','Patrocinador master','title','Frente da camisa','description','Contrato equilibrado para consistencia.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',1800000,'rewardValue',1100000,'maxClaims',6),
    jsonb_build_object('id','emirates_master','sponsorName','Emirates','category','Patrocinador master','title','Global front shirt','description','Marca global com luvas fortes e bonus por vitoria convincente.','conditionType','win_by_2','conditionLabel','Vencer por 2+ gols','riskLevel','Alta exigencia','signingBonus',3500000,'rewardValue',2400000,'maxClaims',4),
    jsonb_build_object('id','etihad_master','sponsorName','Etihad Airways','category','Patrocinador master','title','Flight plan','description','Boa luva, bonus por vitoria fora e apelo internacional.','conditionType','away_win','conditionLabel','Vencer como visitante','riskLevel','Media exigencia','signingBonus',2600000,'rewardValue',1900000,'maxClaims',5),
    jsonb_build_object('id','redbull_master','sponsorName','Red Bull','category','Patrocinador master','title','High tempo deal','description','Contrato agressivo para times de placar elastico.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Alta exigencia','signingBonus',2200000,'rewardValue',2500000,'maxClaims',4),
    jsonb_build_object('id','spotify_master','sponsorName','Spotify','category','Patrocinador master','title','Matchday playlist','description','Baixa exigencia, retorno constante e teto controlado.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',2400000,'rewardValue',950000,'maxClaims',7),

    jsonb_build_object('id','voasul_logistics','sponsorName','VoaSul','category','Logistica e viagens','title','Milhas da delegacao','description','Ajuda viagens e paga quando o time ganha longe de casa.','conditionType','away_win','conditionLabel','Vencer como visitante','riskLevel','Media exigencia','signingBonus',900000,'rewardValue',1400000,'maxClaims',6),
    jsonb_build_object('id','cargo11_logistics','sponsorName','Cargo11','category','Logistica e viagens','title','Rota continental','description','Menos luvas, premio alto por resultado fora.','conditionType','away_win','conditionLabel','Vencer como visitante','riskLevel','Alta exigencia','signingBonus',500000,'rewardValue',1900000,'maxClaims',5),
    jsonb_build_object('id','dhl_logistics','sponsorName','DHL Express','category','Logistica e viagens','title','Entrega rapida','description','Contrato seguro para qualquer vitoria aprovada.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',1300000,'rewardValue',850000,'maxClaims',7),
    jsonb_build_object('id','maersk_logistics','sponsorName','Maersk','category','Logistica e viagens','title','Rota do norte','description','Bonus robusto por vitoria fora de casa.','conditionType','away_win','conditionLabel','Vencer como visitante','riskLevel','Media exigencia','signingBonus',1400000,'rewardValue',1600000,'maxClaims',5),

    jsonb_build_object('id','streamplay_media','sponsorName','StreamPlay Sports','category','Midia e conteudo','title','Serie de bastidores','description','Retorno constante com teto menor.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',900000,'rewardValue',850000,'maxClaims',7),
    jsonb_build_object('id','primecam_media','sponsorName','PrimeCam','category','Midia e conteudo','title','Noite de gala','description','Transmissao paga melhor quando o time entrega gols.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Media exigencia','signingBonus',700000,'rewardValue',1500000,'maxClaims',5),
    jsonb_build_object('id','netflix_media','sponsorName','Netflix Sports','category','Midia e conteudo','title','Docuserie da temporada','description','Luva alta e bonus por vitorias marcantes.','conditionType','win_by_2','conditionLabel','Vencer por 2+ gols','riskLevel','Alta exigencia','signingBonus',2500000,'rewardValue',1700000,'maxClaims',4),
    jsonb_build_object('id','twitch_media','sponsorName','Twitch Rivals','category','Midia e conteudo','title','Watch party oficial','description','Contrato leve para engajar em qualquer vitoria.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',1200000,'rewardValue',750000,'maxClaims',8),

    jsonb_build_object('id','betfair_partner','sponsorName','Betfair','category','Parceiro premium','title','Odds boost','description','Parceiro premium paga por vitorias fortes.','conditionType','win_by_2','conditionLabel','Vencer por 2+ gols','riskLevel','Alta exigencia','signingBonus',2000000,'rewardValue',2100000,'maxClaims',4),
    jsonb_build_object('id','adidas_partner','sponsorName','Adidas Originals','category','Parceiro premium','title','Capsule collection','description','Bom equilibrio entre luvas e gatilho por qualquer vitoria.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',2800000,'rewardValue',900000,'maxClaims',6),
    jsonb_build_object('id','sony_partner','sponsorName','Sony Xperia','category','Parceiro premium','title','Matchday tech','description','Paga por clean sheets e controle defensivo.','conditionType','clean_sheet','conditionLabel','Nao sofrer gols','riskLevel','Media exigencia','signingBonus',1700000,'rewardValue',1600000,'maxClaims',5)
  );
$$;

create or replace function public.app_sponsorship_termination_fee(
  p_signing_bonus numeric,
  p_reward_value numeric,
  p_max_claims integer,
  p_claims_used integer
)
returns numeric
language sql
immutable
as $$
  select greatest(
    0,
    round(
      coalesce(p_signing_bonus, 0) * 0.50
      + coalesce(p_reward_value, 0) * greatest(coalesce(p_max_claims, 0) - coalesce(p_claims_used, 0), 0) * 0.25
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
begin
  select id, display_name into v_manager from public.managers where id = p_manager_id;
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
    v_manager.id,
    coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    v_club_name,
    v_offer ->> 'id',
    v_offer ->> 'sponsorName',
    coalesce(v_offer ->> 'category', 'Patrocinio'),
    v_offer ->> 'title',
    v_offer ->> 'description',
    v_offer ->> 'conditionType',
    coalesce((v_offer ->> 'signingBonus')::numeric, 0),
    coalesce((v_offer ->> 'rewardValue')::numeric, 0),
    coalesce((v_offer ->> 'maxClaims')::integer, 3),
    public.app_get_sponsorship_baseline_result_keys(v_club_name)
  )
  returning id into v_contract_id;

  perform public.app_insert_financial_event(
    coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    'Patrocinio assinado: ' || (v_offer ->> 'sponsorName'),
    coalesce(v_offer ->> 'category', 'Patrocinio') || ' fechado por ' || coalesce(v_login #>> '{manager,name}', v_manager.display_name) || '.',
    '+' || (v_offer ->> 'signingBonus') || ' creditado como bonus de assinatura.',
    'Patrocinio',
    coalesce((v_offer ->> 'signingBonus')::numeric, 0)
  );

  return jsonb_build_object(
    'ok', true,
    'message', case when v_existing.id is not null
      then 'Patrocinio substituido com multa de rescisao aplicada.'
      else 'Patrocinio assinado com sucesso.'
    end,
    'terminationFee', v_termination_fee,
    'contractId', v_contract_id
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
      1500000::numeric as home_match_bonus,
      1250000::numeric as win_bonus,
      2000000::numeric as weekly_income
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
  all_results as (
    select *
    from jsonb_to_recordset(coalesce((select j -> 'results' from data), '[]'::jsonb)) as r(
      "Mandante" text,
      "Visitante" text,
      "GolsMandante" integer,
      "GolsVisitante" integer,
      "Status" text,
      "Competicao" text,
      "RodadaFase" text,
      "Semana" integer
    )
    where lower(coalesce("Status", '')) = 'aprovado'
  ),
  season_clock as (
    select coalesce(max("Semana"), 0)::integer as current_week
    from all_results
  ),
  league_results as (
    select * from all_results where lower(coalesce("Competicao", '')) = 'championship'
  ),
  stats as (
    select
      t.manager_name,
      count(*) filter (where lower(r."Mandante") = lower(t.club_name) or lower(r."Visitante") = lower(t.club_name))::integer as matches_played,
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
      sum(case
        when lower(r."Mandante") = lower(t.club_name) and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0) then 3
        when lower(r."Visitante") = lower(t.club_name) and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0) then 3
        when (lower(r."Mandante") = lower(t.club_name) or lower(r."Visitante") = lower(t.club_name))
          and coalesce(r."GolsMandante", 0) = coalesce(r."GolsVisitante", 0) then 1
        else 0
      end)::integer as points
    from teams t
    left join league_results r
      on lower(r."Mandante") = lower(t.club_name)
      or lower(r."Visitante") = lower(t.club_name)
    group by t.manager_name
  ),
  cup_adjustments as (
    select
      winner.manager_name,
      sum(case
        when lower(coalesce(r."RodadaFase", '')) like '%oitavas%' then 1500000
        when lower(coalesce(r."RodadaFase", '')) like '%quartas%' then 2500000
        when lower(coalesce(r."RodadaFase", '')) like '%semifinal%' then 4000000
        when lower(coalesce(r."RodadaFase", '')) like '%final%' then 4500000
        else 0
      end)::numeric as cup_rebalance_bonus
    from all_results r
    join teams winner on lower(winner.club_name) = lower(
      case
        when coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0) then r."Mandante"
        when coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0) then r."Visitante"
        else ''
      end
    )
    where lower(coalesce(r."Competicao", '')) <> 'championship'
    group by winner.manager_name
  ),
  reward_totals as (
    select manager_name, sum(reward_value)::numeric as reward_total
    from public.sponsorship_rewards
    group by manager_name
  ),
  sponsorship_reward_events as (
    select "Jogador" as manager_name, sum(coalesce("ImpactoFinanceiro", 0))::numeric as event_reward_total
    from jsonb_to_recordset(coalesce((select j -> 'events' from data), '[]'::jsonb)) as e(
      "Jogador" text,
      "Titulo" text,
      "ImpactoFinanceiro" numeric
    )
    where lower(coalesce("Titulo", '')) like '%bonus de patrocinio%'
    group by "Jogador"
  ),
  raw_budgets as (
    select key as manager_name, value as budget
    from jsonb_each(coalesce((select j -> 'budgets' from data), '{}'::jsonb))
  ),
  reconciled as (
    select
      t.manager_name,
      coalesce((rb.budget ->> 'baseBudget')::numeric, config.base_budget_default) as base_budget,
      coalesce(s.matches_played, 0) as matches_played,
      coalesce(s.home_matches, 0) as home_matches,
      coalesce(s.wins, 0) as wins,
      coalesce(s.points, 0) as points,
      (select current_week from season_clock) * config.weekly_income as weekly_income_value,
      coalesce(s.home_matches, 0) * config.home_match_bonus as home_bonus,
      coalesce(s.wins, 0) * config.win_bonus as win_bonus_value,
      floor(coalesce(s.matches_played, 0)::numeric / 5) * case
        when coalesce(s.matches_played, 0) = 0 then 0
        when coalesce(s.points, 0)::numeric / greatest(coalesce(s.matches_played, 0), 1) >= 2.0 then 5000000
        when coalesce(s.points, 0)::numeric / greatest(coalesce(s.matches_played, 0), 1) >= 1.4 then 3000000
        when coalesce(s.points, 0)::numeric / greatest(coalesce(s.matches_played, 0), 1) >= 0.8 then 1000000
        else 0
      end as form_bonus,
      coalesce(ca.cup_rebalance_bonus, 0) as cup_rebalance_bonus,
      coalesce((rb.budget ->> 'eventTotal')::numeric, 0)
        - coalesce(sre.event_reward_total, 0)
        + coalesce(rt.reward_total, 0)
        + coalesce(ca.cup_rebalance_bonus, 0) as event_total,
      coalesce(rt.reward_total, 0) as sponsorship_rewards,
      coalesce((rb.budget ->> 'spentTotal')::numeric, 0) as spent_total
    from teams t
    cross join config
    left join raw_budgets rb on rb.manager_name = t.manager_name
    left join stats s on s.manager_name = t.manager_name
    left join cup_adjustments ca on ca.manager_name = t.manager_name
    left join reward_totals rt on rt.manager_name = t.manager_name
    left join sponsorship_reward_events sre on sre.manager_name = t.manager_name
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
      'spentTotal', spent_total,
      'remainingBudget', base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total,
      'transferLimit', 3
    )
  ), '{}'::jsonb)
  from reconciled;
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
    when coalesce(p_overall, 0) >= 84 then 0.15
    when coalesce(p_overall, 0) >= 80 then 0.10
    when coalesce(p_overall, 0) >= 75 then 0.05
    else 0
  end;
  v_final_value := coalesce(p_market_value, 0) + (coalesce(p_market_value, 0) * v_rate);

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> p_buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_transfers_today := public.app_get_external_transfer_today_count(p_buyer);

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

  return public.app_record_external_transfer(p_buyer, p_player, p_from_club, p_overall, p_market_value, v_final_value);
end;
$$;

create or replace function public.app_get_my_sponsorships(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
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
  select id, display_name into v_manager from public.managers where id = p_manager_id;

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
          else 'Meta comercial cumprida'
        end
      ) as condition_label
    from public.sponsorship_contracts c
    left join jsonb_array_elements(public.app_sponsorship_offers()) as o(offer)
      on o.offer ->> 'id' = c.sponsor_id
    where c.manager_id = v_manager.id
      and c.status = 'active'
  ) c;

  select count(*) into v_active_count
  from public.sponsorship_contracts c
  where c.manager_id = v_manager.id and c.status = 'active';

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v_rewards
  from (
    select r.id, r.contract_id, r.manager_id, r.manager_name, r.result_key, r.reward_value, r.created_at,
           c.sponsor_name, c.category, c.title
    from public.sponsorship_rewards r
    join public.sponsorship_contracts c on c.id = r.contract_id
    where r.manager_id = v_manager.id
    order by r.created_at desc
    limit 8
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
        'canSign', (c.id is not null or v_active_count < v_max_active)
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

grant execute on function public.app_sponsorship_termination_fee(numeric, numeric, integer, integer) to anon, authenticated;
grant execute on function public.app_sponsorship_offers() to anon, authenticated;
grant execute on function public.app_accept_sponsorship(text, text, text) to anon, authenticated;
grant execute on function public.app_get_my_sponsorships(text, text) to anon, authenticated;
grant execute on function public.app_get_budget_reconciliation() to anon, authenticated;
grant execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric) to anon, authenticated;
