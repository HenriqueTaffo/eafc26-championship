-- Sistema de patrocinio por tecnico.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro.
-- 3. Entre no app como tecnico e abra o Painel para assinar patrocinadores.
--
-- Categorias disponiveis:
-- - Fornecedor de material esportivo
-- - Naming Rights de Estadio
-- - Naming Rights de CT
-- - Patrocinador master
-- - Logistica e viagens
-- - Midia e conteudo
--
-- Condicoes disponiveis:
-- - clean_sheet: bonus quando o time nao sofre gol.
-- - three_goals: bonus quando o time marca 3+ gols.
-- - win_by_2: bonus quando vence por 2+ gols.
-- - any_win: bonus por qualquer vitoria.
-- - home_win: bonus por vitoria como mandante.
-- - away_win: bonus por vitoria como visitante.

drop function if exists public.app_accept_sponsorship(bigint, text, text);
drop function if exists public.app_process_sponsorship_rewards(bigint, text);
drop function if exists public.app_get_my_sponsorships(bigint, text);
drop function if exists public.app_accept_sponsorship(text, text, text);
drop function if exists public.app_process_sponsorship_rewards(text, text);
drop function if exists public.app_get_my_sponsorships(text, text);

create table if not exists public.sponsorship_contracts (
  id bigserial primary key,
  manager_id text not null,
  manager_name text not null,
  club_name text not null,
  sponsor_id text not null,
  sponsor_name text not null,
  category text not null default 'Patrocinio',
  title text not null,
  description text not null,
  condition_type text not null,
  signing_bonus numeric not null default 0,
  reward_value numeric not null default 0,
  max_claims integer not null default 3,
  claims_used integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.sponsorship_contracts
  add column if not exists category text not null default 'Patrocinio';

alter table public.sponsorship_contracts
  add column if not exists baseline_result_keys jsonb not null default '[]'::jsonb;

alter table public.sponsorship_contracts
  alter column manager_id type text using manager_id::text;

create unique index if not exists sponsorship_contracts_active_unique
  on public.sponsorship_contracts (manager_id, sponsor_id)
  where status = 'active';

create unique index if not exists sponsorship_contracts_active_category_unique
  on public.sponsorship_contracts (manager_id, category)
  where status = 'active';

create table if not exists public.sponsorship_rewards (
  id bigserial primary key,
  contract_id bigint not null references public.sponsorship_contracts(id) on delete cascade,
  manager_id text not null,
  manager_name text not null,
  result_key text not null,
  reward_value numeric not null,
  created_at timestamptz not null default now()
);

alter table public.sponsorship_rewards
  alter column manager_id type text using manager_id::text;

create unique index if not exists sponsorship_rewards_contract_result_unique
  on public.sponsorship_rewards (contract_id, result_key);

create or replace function public.app_sponsorship_offers()
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'id', 'aurora_kits',
      'sponsorName', 'Aurora Kits',
      'category', 'Fornecedor de material esportivo',
      'title', 'Colecao campea',
      'description', 'Linha premium, pouco adiantamento e bonus alto quando a camisa aparece em vitorias fortes.',
      'conditionType', 'win_by_2',
      'conditionLabel', 'Vencer por 2+ gols',
      'riskLevel', 'Alta exigencia',
      'signingBonus', 500000,
      'rewardValue', 1400000,
      'maxClaims', 4
    ),
    jsonb_build_object(
      'id', 'nova_kits',
      'sponsorName', 'Nova Sportswear',
      'category', 'Fornecedor de material esportivo',
      'title', 'Uniforme de alcance',
      'description', 'Contrato mais seguro: paga menos por meta, mas aceita qualquer vitoria como exposicao valida.',
      'conditionType', 'any_win',
      'conditionLabel', 'Vencer qualquer partida',
      'riskLevel', 'Baixa exigencia',
      'signingBonus', 250000,
      'rewardValue', 650000,
      'maxClaims', 6
    ),
    jsonb_build_object(
      'id', 'horizonte_arena',
      'sponsorName', 'Banco Horizonte',
      'category', 'Naming Rights de Estadio',
      'title', 'Horizonte Arena',
      'description', 'Naming rights pesado, mas o banco so paga bonus quando o mando vira resultado.',
      'conditionType', 'home_win',
      'conditionLabel', 'Vencer como mandante',
      'riskLevel', 'Media exigencia',
      'signingBonus', 700000,
      'rewardValue', 1300000,
      'maxClaims', 4
    ),
    jsonb_build_object(
      'id', 'fortress_arena',
      'sponsorName', 'Fortress Telecom',
      'category', 'Naming Rights de Estadio',
      'title', 'Fortress Stadium',
      'description', 'Oferta agressiva para clubes dominantes em casa: menos parcelas, premio maior.',
      'conditionType', 'win_by_2',
      'conditionLabel', 'Vencer por 2+ gols',
      'riskLevel', 'Alta exigencia',
      'signingBonus', 350000,
      'rewardValue', 1700000,
      'maxClaims', 3
    ),
    jsonb_build_object(
      'id', 'neurofit_ct',
      'sponsorName', 'NeuroFit Performance',
      'category', 'Naming Rights de CT',
      'title', 'CT NeuroFit',
      'description', 'Centro de performance focado em defesa: paga bem quando o time nao sofre gols.',
      'conditionType', 'clean_sheet',
      'conditionLabel', 'Nao sofrer gols',
      'riskLevel', 'Media exigencia',
      'signingBonus', 400000,
      'rewardValue', 950000,
      'maxClaims', 5
    ),
    jsonb_build_object(
      'id', 'ironlab_ct',
      'sponsorName', 'IronLab',
      'category', 'Naming Rights de CT',
      'title', 'IronLab Training Center',
      'description', 'Marca de preparacao fisica quer desempenho ofensivo e paga por jogos de tres gols.',
      'conditionType', 'three_goals',
      'conditionLabel', 'Marcar 3+ gols',
      'riskLevel', 'Alta exigencia',
      'signingBonus', 300000,
      'rewardValue', 1300000,
      'maxClaims', 4
    ),
    jsonb_build_object(
      'id', 'atlas_master',
      'sponsorName', 'Atlas Bank',
      'category', 'Patrocinador master',
      'title', 'Camisa pesada',
      'description', 'Master de elite: baixa luva inicial, teto alto e exigencia de show ofensivo.',
      'conditionType', 'three_goals',
      'conditionLabel', 'Marcar 3+ gols',
      'riskLevel', 'Alta exigencia',
      'signingBonus', 650000,
      'rewardValue', 1500000,
      'maxClaims', 4
    ),
    jsonb_build_object(
      'id', 'pioneer_master',
      'sponsorName', 'Pioneer Motors',
      'category', 'Patrocinador master',
      'title', 'Frente da camisa',
      'description', 'Contrato equilibrado para quem prefere consistencia a grandes picos de receita.',
      'conditionType', 'any_win',
      'conditionLabel', 'Vencer qualquer partida',
      'riskLevel', 'Baixa exigencia',
      'signingBonus', 450000,
      'rewardValue', 800000,
      'maxClaims', 5
    ),
    jsonb_build_object(
      'id', 'voasul_logistics',
      'sponsorName', 'VoaSul',
      'category', 'Logistica e viagens',
      'title', 'Milhas da delegacao',
      'description', 'Ajuda viagens, mas so vira dinheiro forte quando o time ganha longe de casa.',
      'conditionType', 'away_win',
      'conditionLabel', 'Vencer como visitante',
      'riskLevel', 'Media exigencia',
      'signingBonus', 300000,
      'rewardValue', 1100000,
      'maxClaims', 5
    ),
    jsonb_build_object(
      'id', 'cargo11_logistics',
      'sponsorName', 'Cargo11',
      'category', 'Logistica e viagens',
      'title', 'Rota continental',
      'description', 'Menos luvas, mais premio: ideal para quem confia em arrancar resultados fora.',
      'conditionType', 'away_win',
      'conditionLabel', 'Vencer como visitante',
      'riskLevel', 'Alta exigencia',
      'signingBonus', 150000,
      'rewardValue', 1400000,
      'maxClaims', 4
    ),
    jsonb_build_object(
      'id', 'streamplay_media',
      'sponsorName', 'StreamPlay Sports',
      'category', 'Midia e conteudo',
      'title', 'Serie de bastidores',
      'description', 'Contrato de conteudo com retorno constante, mas teto menor que os grandes naming rights.',
      'conditionType', 'any_win',
      'conditionLabel', 'Vencer qualquer partida',
      'riskLevel', 'Baixa exigencia',
      'signingBonus', 200000,
      'rewardValue', 700000,
      'maxClaims', 6
    ),
    jsonb_build_object(
      'id', 'primecam_media',
      'sponsorName', 'PrimeCam',
      'category', 'Midia e conteudo',
      'title', 'Noite de gala',
      'description', 'Parceiro de transmissao paga melhor quando o time entrega jogo movimentado.',
      'conditionType', 'three_goals',
      'conditionLabel', 'Marcar 3+ gols',
      'riskLevel', 'Media exigencia',
      'signingBonus', 250000,
      'rewardValue', 1100000,
      'maxClaims', 4
    )
  );
$$;

create or replace function public.app_find_event_table()
returns regclass
language plpgsql
stable
as $$
declare
  v_event_table regclass;
begin
  select c.oid::regclass
    into v_event_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname = 'public'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Jogador' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Titulo' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'ImpactoFinanceiro' and not a.attisdropped)
  order by c.relname
  limit 1;

  return v_event_table;
end;
$$;

create or replace function public.app_insert_financial_event(
  p_manager_name text,
  p_title text,
  p_description text,
  p_effect text,
  p_type text,
  p_impact numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_event_table regclass;
begin
  v_event_table := public.app_find_event_table();
  if v_event_table is null then
    return;
  end if;

  execute format('alter table %s add column if not exists "Descricao" text', v_event_table);
  execute format('alter table %s add column if not exists "Efeito" text', v_event_table);
  execute format('alter table %s add column if not exists "Tipo" text', v_event_table);
  execute format('alter table %s add column if not exists "Status" text', v_event_table);
  execute format('alter table %s add column if not exists "Timestamp" timestamptz', v_event_table);
  execute format('alter table %s add column if not exists "Data" text', v_event_table);
  execute format('alter table %s add column if not exists "Horario" text', v_event_table);
  execute format('alter table %s add column if not exists "ModificadorTransferencias" numeric default 0', v_event_table);

  execute format(
    'insert into %s (
       "Jogador", "Titulo", "Descricao", "Efeito", "Tipo",
       "ImpactoFinanceiro", "ModificadorTransferencias", "Status",
       "Timestamp", "Data", "Horario"
     ) values (%L, %L, %L, %L, %L, %s, 0, ''aplicado'', now(), %L, %L)',
    v_event_table,
    p_manager_name,
    p_title,
    p_description,
    p_effect,
    p_type,
    coalesce(p_impact, 0),
    to_char(now(), 'DD/MM/YYYY'),
    to_char(now(), 'HH24:MI')
  );
end;
$$;

create or replace function public.app_get_sponsorship_baseline_result_keys(
  p_club_name text
)
returns jsonb
language sql
stable
security definer
as $$
  select coalesce(jsonb_agg(result_key), '[]'::jsonb)
  from (
    select concat_ws(
      '|',
      coalesce(r."Mandante"::text, ''),
      coalesce(r."Visitante"::text, ''),
      coalesce(r."GolsMandante"::text, ''),
      coalesce(r."GolsVisitante"::text, '')
    ) as result_key
    from jsonb_to_recordset(coalesce(public.app_get_data()::jsonb -> 'results', '[]'::jsonb)) as r(
      "Mandante" text,
      "Visitante" text,
      "GolsMandante" integer,
      "GolsVisitante" integer,
      "Status" text
    )
    where lower(coalesce(r."Status", '')) = lower('aprovado')
      and (
        lower(coalesce(r."Mandante", '')) = lower(p_club_name)
        or lower(coalesce(r."Visitante", '')) = lower(p_club_name)
      )
  ) existing_results;
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
  v_max_active integer := 2;
  v_active_count integer := 0;
  v_club_name text;
begin
  select id, display_name
    into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  select count(*)
    into v_active_count
  from public.sponsorship_contracts
  where manager_id = v_manager.id
    and status = 'active';

  if v_active_count >= v_max_active then
    return jsonb_build_object('ok', false, 'message', 'Limite comercial atingido: cada tecnico pode manter ate 2 patrocinios ativos.');
  end if;

  select offers.offer
    into v_offer
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where offers.offer ->> 'id' = p_offer_id;

  if v_offer is null then
    return jsonb_build_object('ok', false, 'message', 'Patrocinador nao encontrado.');
  end if;

  v_club_name := coalesce(v_login #>> '{manager,club}', v_manager.display_name);

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
  on conflict do nothing
  returning id into v_contract_id;

  if v_contract_id is null then
    return jsonb_build_object('ok', false, 'message', 'Voce ja tem um patrocinio ativo nessa categoria.');
  end if;

  perform public.app_insert_financial_event(
    coalesce(v_login #>> '{manager,name}', v_manager.display_name),
    'Patrocinio assinado: ' || (v_offer ->> 'sponsorName'),
    coalesce(v_offer ->> 'category', 'Patrocinio') || ' fechado por ' || coalesce(v_login #>> '{manager,name}', v_manager.display_name) || '.',
    '+' || (v_offer ->> 'signingBonus') || ' creditado como bonus de assinatura.',
    'Patrocinio',
    coalesce((v_offer ->> 'signingBonus')::numeric, 0)
  );

  return jsonb_build_object('ok', true, 'message', 'Patrocinio assinado com sucesso.');
end;
$$;

create or replace function public.app_process_sponsorship_rewards(
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
  v_contract record;
  v_result record;
  v_result_key text;
  v_gf integer;
  v_ga integer;
  v_is_home boolean;
  v_hit boolean;
  v_created integer := 0;
  v_results jsonb;
begin
  select id, display_name
    into v_manager
  from public.managers
  where id = p_manager_id;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_login := public.app_login_manager(v_manager.display_name, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_results := coalesce(public.app_get_data()::jsonb -> 'results', '[]'::jsonb);

  for v_contract in
    select *
    from public.sponsorship_contracts
    where manager_id = v_manager.id
      and status = 'active'
      and claims_used < max_claims
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
             status = case
               when claims_used + 1 >= max_claims then 'completed'
               else status
             end
       where id = v_contract.id;

      v_contract.claims_used := v_contract.claims_used + 1;
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

  return jsonb_build_object('ok', true, 'created', v_created);
end;
$$;

create or replace function public.app_process_all_sponsorship_rewards()
returns jsonb
language plpgsql
security definer
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
  v_results jsonb;
begin
  v_results := coalesce(public.app_get_data()::jsonb -> 'results', '[]'::jsonb);

  for v_contract in
    select *
    from public.sponsorship_contracts
    where status = 'active'
      and claims_used < max_claims
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
             status = case
               when claims_used + 1 >= max_claims then 'completed'
               else status
             end
       where id = v_contract.id;

      v_contract.claims_used := v_contract.claims_used + 1;
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

  return jsonb_build_object('ok', true, 'created', v_created);
end;
$$;

create or replace function public.app_get_sponsorship_reward_totals()
returns jsonb
language sql
security definer
stable
as $$
  select coalesce(jsonb_object_agg(manager_name, reward_total), '{}'::jsonb)
  from (
    select
      manager_name,
      sum(reward_value)::numeric as reward_total
    from public.sponsorship_rewards
    group by manager_name
  ) totals;
$$;

create or replace function public.app_get_budget_reconciliation()
returns jsonb
language sql
security definer
stable
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
      )::integer as wins
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
  sponsorship_reward_events as (
    select
      "Jogador" as manager_name,
      sum(coalesce("ImpactoFinanceiro", 0))::numeric as event_reward_total
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
      coalesce(s.home_matches, 0) as home_matches,
      coalesce(s.wins, 0) as wins,
      coalesce(s.home_matches, 0) * config.home_match_bonus as home_bonus,
      coalesce(s.wins, 0) * config.win_bonus as win_bonus_value,
      coalesce((rb.budget ->> 'eventTotal')::numeric, 0)
        - coalesce(sre.event_reward_total, 0)
        + coalesce(rt.reward_total, 0) as event_total,
      coalesce(rt.reward_total, 0) as sponsorship_rewards,
      coalesce((rb.budget ->> 'spentTotal')::numeric, 0) as spent_total
    from teams t
    cross join config
    left join raw_budgets rb on rb.manager_name = t.manager_name
    left join stats s on s.manager_name = t.manager_name
    left join reward_totals rt on rt.manager_name = t.manager_name
    left join sponsorship_reward_events sre on sre.manager_name = t.manager_name
  )
  select coalesce(jsonb_object_agg(
    manager_name,
    jsonb_build_object(
      'baseBudget', base_budget,
      'homeMatches', home_matches,
      'wins', wins,
      'homeBonus', home_bonus,
      'winBonusValue', win_bonus_value,
      'eventTotal', event_total,
      'sponsorshipRewards', sponsorship_rewards,
      'totalBudget', base_budget + home_bonus + win_bonus_value + event_total,
      'spentTotal', spent_total,
      'remainingBudget', base_budget + home_bonus + win_bonus_value + event_total - spent_total
    )
  ), '{}'::jsonb)
  from reconciled;
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
  v_max_active integer := 2;
begin
  select id, display_name
    into v_manager
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
  from public.sponsorship_contracts c
  where c.manager_id = v_manager.id
    and c.status = 'active';

  select count(*)
    into v_active_count
  from public.sponsorship_contracts c
  where c.manager_id = v_manager.id
    and c.status = 'active';

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
      c.sponsor_name,
      c.category,
      c.title
    from public.sponsorship_rewards r
    join public.sponsorship_contracts c on c.id = r.contract_id
    where r.manager_id = v_manager.id
    order by r.created_at desc
    limit 5
  ) r;

  select coalesce(jsonb_agg(offers.offer order by offers.offer ->> 'category', offers.offer ->> 'riskLevel', offers.offer ->> 'sponsorName'), '[]'::jsonb)
    into v_offers
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where not exists (
    select 1
    from public.sponsorship_contracts c
    where c.manager_id = v_manager.id
      and c.status = 'active'
      and (c.sponsor_id = offers.offer ->> 'id' or c.category = coalesce(offers.offer ->> 'category', 'Patrocinio'))
  )
  and v_active_count < v_max_active;

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
