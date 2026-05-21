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

create table if not exists public.sponsorship_contracts (
  id bigserial primary key,
  manager_id bigint not null,
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

create unique index if not exists sponsorship_contracts_active_unique
  on public.sponsorship_contracts (manager_id, sponsor_id)
  where status = 'active';

create unique index if not exists sponsorship_contracts_active_category_unique
  on public.sponsorship_contracts (manager_id, category)
  where status = 'active';

create table if not exists public.sponsorship_rewards (
  id bigserial primary key,
  contract_id bigint not null references public.sponsorship_contracts(id) on delete cascade,
  manager_id bigint not null,
  manager_name text not null,
  result_key text not null,
  reward_value numeric not null,
  created_at timestamptz not null default now()
);

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
      'description', 'Fornecedor paga alto quando a equipe vence com autoridade e faz a camisa aparecer.',
      'conditionType', 'win_by_2',
      'conditionLabel', 'Vencer por 2+ gols',
      'signingBonus', 5500000,
      'rewardValue', 2500000,
      'maxClaims', 5
    ),
    jsonb_build_object(
      'id', 'horizonte_arena',
      'sponsorName', 'Banco Horizonte',
      'category', 'Naming Rights de Estadio',
      'title', 'Horizonte Arena',
      'description', 'Contrato gordo para transformar mando de campo em receita recorrente.',
      'conditionType', 'home_win',
      'conditionLabel', 'Vencer como mandante',
      'signingBonus', 9000000,
      'rewardValue', 3000000,
      'maxClaims', 4
    ),
    jsonb_build_object(
      'id', 'neurofit_ct',
      'sponsorName', 'NeuroFit Performance',
      'category', 'Naming Rights de CT',
      'title', 'CT NeuroFit',
      'description', 'Centro de treinamento premia organizacao defensiva em partidas aprovadas.',
      'conditionType', 'clean_sheet',
      'conditionLabel', 'Nao sofrer gols',
      'signingBonus', 6500000,
      'rewardValue', 2200000,
      'maxClaims', 5
    ),
    jsonb_build_object(
      'id', 'atlas_master',
      'sponsorName', 'Atlas Bank',
      'category', 'Patrocinador master',
      'title', 'Camisa pesada',
      'description', 'Patrocinador master quer placares elasticos e paga por jogos de alta exposicao.',
      'conditionType', 'three_goals',
      'conditionLabel', 'Marcar 3+ gols',
      'signingBonus', 7500000,
      'rewardValue', 3500000,
      'maxClaims', 4
    ),
    jsonb_build_object(
      'id', 'voasul_logistics',
      'sponsorName', 'VoaSul',
      'category', 'Logistica e viagens',
      'title', 'Milhas da delegacao',
      'description', 'Parceiro de logistica banca deslocamentos e bonifica vitorias fora de casa.',
      'conditionType', 'away_win',
      'conditionLabel', 'Vencer como visitante',
      'signingBonus', 4500000,
      'rewardValue', 2200000,
      'maxClaims', 5
    ),
    jsonb_build_object(
      'id', 'streamplay_media',
      'sponsorName', 'StreamPlay Sports',
      'category', 'Midia e conteudo',
      'title', 'Serie de bastidores',
      'description', 'A plataforma quer narrativas de vitoria e paga por cada resultado positivo.',
      'conditionType', 'any_win',
      'conditionLabel', 'Vencer qualquer partida',
      'signingBonus', 3500000,
      'rewardValue', 1500000,
      'maxClaims', 6
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

create or replace function public.app_accept_sponsorship(
  p_manager_id bigint,
  p_access_code text,
  p_offer_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_manager record;
  v_offer jsonb;
  v_contract_id bigint;
begin
  select id, name, club
    into v_manager
  from public.managers
  where id = p_manager_id
    and access_code = p_access_code;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  select offers.offer
    into v_offer
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where offers.offer ->> 'id' = p_offer_id;

  if v_offer is null then
    return jsonb_build_object('ok', false, 'message', 'Patrocinador nao encontrado.');
  end if;

  insert into public.sponsorship_contracts (
    manager_id, manager_name, club_name, sponsor_id, sponsor_name, category, title,
    description, condition_type, signing_bonus, reward_value, max_claims
  ) values (
    v_manager.id,
    v_manager.name,
    coalesce(v_manager.club, ''),
    v_offer ->> 'id',
    v_offer ->> 'sponsorName',
    coalesce(v_offer ->> 'category', 'Patrocinio'),
    v_offer ->> 'title',
    v_offer ->> 'description',
    v_offer ->> 'conditionType',
    coalesce((v_offer ->> 'signingBonus')::numeric, 0),
    coalesce((v_offer ->> 'rewardValue')::numeric, 0),
    coalesce((v_offer ->> 'maxClaims')::integer, 3)
  )
  on conflict do nothing
  returning id into v_contract_id;

  if v_contract_id is null then
    return jsonb_build_object('ok', false, 'message', 'Voce ja tem um patrocinio ativo nessa categoria.');
  end if;

  perform public.app_insert_financial_event(
    v_manager.name,
    'Patrocinio assinado: ' || (v_offer ->> 'sponsorName'),
    coalesce(v_offer ->> 'category', 'Patrocinio') || ' fechado por ' || v_manager.name || '.',
    '+' || (v_offer ->> 'signingBonus') || ' creditado como bonus de assinatura.',
    'Patrocinio',
    coalesce((v_offer ->> 'signingBonus')::numeric, 0)
  );

  return jsonb_build_object('ok', true, 'message', 'Patrocinio assinado com sucesso.');
end;
$$;

create or replace function public.app_process_sponsorship_rewards(
  p_manager_id bigint,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_manager record;
  v_result_table regclass;
  v_contract record;
  v_result record;
  v_result_key text;
  v_gf integer;
  v_ga integer;
  v_is_home boolean;
  v_hit boolean;
  v_created integer := 0;
begin
  select id, name, club
    into v_manager
  from public.managers
  where id = p_manager_id
    and access_code = p_access_code;

  if v_manager.id is null then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  select c.oid::regclass
    into v_result_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname = 'public'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Mandante' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Visitante' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'GolsMandante' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'GolsVisitante' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Status' and not a.attisdropped)
  order by c.relname
  limit 1;

  if v_result_table is null then
    return jsonb_build_object('ok', false, 'message', 'Tabela de resultados nao encontrada.');
  end if;

  for v_contract in
    select *
    from public.sponsorship_contracts
    where manager_id = v_manager.id
      and status = 'active'
      and claims_used < max_claims
  loop
    for v_result in execute format(
      'select *, concat_ws(''|'', coalesce("Competicao"::text, ''''), coalesce("RodadaFase"::text, ''''), "Mandante"::text, "Visitante"::text) as result_key
         from %s
        where lower("Status"::text) = lower(''aprovado'')
          and (lower("Mandante"::text) = lower($1) or lower("Visitante"::text) = lower($1))',
      v_result_table
    ) using v_contract.club_name
    loop
      exit when v_contract.claims_used >= v_contract.max_claims;

      v_result_key := v_result.result_key;
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
         set claims_used = claims_used + 1
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

create or replace function public.app_get_my_sponsorships(
  p_manager_id bigint,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_manager record;
  v_active jsonb;
  v_rewards jsonb;
  v_offers jsonb;
begin
  select id, name, club
    into v_manager
  from public.managers
  where id = p_manager_id
    and access_code = p_access_code;

  if v_manager.id is null then
    return jsonb_build_object('active', '[]'::jsonb, 'offers', '[]'::jsonb, 'recentRewards', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
    into v_active
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

  select coalesce(jsonb_agg(offers.offer), '[]'::jsonb)
    into v_offers
  from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
  where not exists (
    select 1
    from public.sponsorship_contracts c
    where c.manager_id = v_manager.id
      and c.status = 'active'
      and (c.sponsor_id = offers.offer ->> 'id' or c.category = coalesce(offers.offer ->> 'category', 'Patrocinio'))
  );

  return jsonb_build_object(
    'active', v_active,
    'offers', v_offers,
    'recentRewards', v_rewards
  );
end;
$$;
