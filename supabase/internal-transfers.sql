-- Ajuste para habilitar transferencias entre tecnicos.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro.
-- 3. Teste uma negociacao interna pela aba "Enviar dados".
--
-- Fluxo:
-- 1. comprador cria proposta com app_create_internal_transfer_proposal;
-- 2. vendedor logado consulta com app_get_my_internal_transfer_proposals;
-- 3. vendedor aceita/recusa com app_answer_internal_transfer_proposal;
-- 4. apenas no aceite app_add_internal_transfer registra a venda e impactos.
--
-- Este script tenta localizar automaticamente a tabela de transferencias usando
-- as colunas expostas pelo app: Comprador, Jogador, ClubeOrigem, Overall,
-- ValorTransfermarkt, Status e Timestamp.

create or replace function public.app_add_internal_transfer(
  p_pin text,
  p_buyer text,
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_transfer_table regclass;
  v_event_table regclass;
  v_current_owner text;
  v_rate numeric := 0;
  v_final_value numeric := 0;
  v_from_club text;
  v_today text := to_char(now(), 'DD/MM/YYYY');
  v_time text := to_char(now(), 'HH24:MI');
begin
  if p_pin is distinct from 'eafc26' then
    return jsonb_build_object('ok', false, 'message', 'PIN invalido.');
  end if;

  if coalesce(trim(p_buyer), '') = '' or coalesce(trim(p_seller), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe comprador e vendedor.');
  end if;

  if lower(trim(p_buyer)) = lower(trim(p_seller)) then
    return jsonb_build_object('ok', false, 'message', 'Comprador e vendedor precisam ser tecnicos diferentes.');
  end if;

  if coalesce(trim(p_player), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o jogador negociado.');
  end if;

  select c.oid::regclass
    into v_transfer_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname = 'public'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Comprador' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Jogador' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'ClubeOrigem' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Overall' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'ValorTransfermarkt' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Status' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Timestamp' and not a.attisdropped)
  order by c.relname
  limit 1;

  if v_transfer_table is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Nao encontrei a tabela de transferencias. Confira os nomes das colunas no Supabase.'
    );
  end if;

  execute format('alter table %s add column if not exists "TipoTransferencia" text default ''market''', v_transfer_table);
  execute format('alter table %s add column if not exists "Vendedor" text', v_transfer_table);
  execute format('alter table %s add column if not exists "ValorNegociado" numeric', v_transfer_table);
  execute format('alter table %s add column if not exists "ValorFinal" numeric', v_transfer_table);

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

  if v_event_table is not null then
    execute format('alter table %s add column if not exists "Descricao" text', v_event_table);
    execute format('alter table %s add column if not exists "Efeito" text', v_event_table);
    execute format('alter table %s add column if not exists "Tipo" text', v_event_table);
    execute format('alter table %s add column if not exists "Status" text', v_event_table);
    execute format('alter table %s add column if not exists "Timestamp" timestamptz', v_event_table);
    execute format('alter table %s add column if not exists "Data" text', v_event_table);
    execute format('alter table %s add column if not exists "Horario" text', v_event_table);
    execute format('alter table %s add column if not exists "ModificadorTransferencias" numeric default 0', v_event_table);
  end if;

  execute format(
    'select "Comprador"::text
       from %s
      where lower("Jogador"::text) = lower($1)
        and lower("Status"::text) = lower(''aprovado'')
      order by "Timestamp" desc nulls last
      limit 1',
    v_transfer_table
  )
  into v_current_owner
  using p_player;

  if v_current_owner is null then
    return jsonb_build_object('ok', false, 'message', 'Jogador nao encontrado entre as transferencias aprovadas.');
  end if;

  if lower(trim(v_current_owner)) <> lower(trim(p_seller)) then
    return jsonb_build_object(
      'ok', false,
      'message', format('Este jogador pertence atualmente a %s, nao a %s.', v_current_owner, p_seller)
    );
  end if;

  v_rate := 0;
  v_final_value := coalesce(p_market_value, 0);
  v_from_club := coalesce(nullif(trim(p_from_club), ''), 'Negociacao interna: ' || p_seller);

  execute format(
    'insert into %s (
       "Comprador",
       "Jogador",
       "ClubeOrigem",
       "Overall",
       "ValorTransfermarkt",
       "ValorFinal",
       "Status",
       "Timestamp",
       "TipoTransferencia",
       "Vendedor",
       "ValorNegociado"
     ) values (%L, %L, %L, %s, %s, %s, ''aprovado'', now(), ''internal'', %L, %s)',
    v_transfer_table,
    p_buyer,
    p_player,
    v_from_club,
    coalesce(p_overall, 0),
    coalesce(p_market_value, 0),
    v_final_value,
    p_seller,
    coalesce(p_market_value, 0)
  );

  if v_event_table is not null then
    execute format(
      'insert into %s (
         "Jogador",
         "Titulo",
         "Descricao",
         "Efeito",
         "Tipo",
         "ImpactoFinanceiro",
         "ModificadorTransferencias",
         "Status",
         "Timestamp",
         "Data",
         "Horario"
       ) values (%L, %L, %L, %L, ''Negociacao interna'', %s, 0, ''aplicado'', now(), %L, %L)',
      v_event_table,
      p_seller,
      'Venda interna: ' || p_player,
      p_seller || ' vendeu ' || p_player || ' para ' || p_buyer || '.',
      '+' || v_final_value::text || ' creditado ao orcamento.',
      v_final_value,
      v_today,
      v_time
    );

    execute format(
      'insert into %s (
         "Jogador",
         "Titulo",
         "Descricao",
         "Efeito",
         "Tipo",
         "ImpactoFinanceiro",
         "ModificadorTransferencias",
         "Status",
         "Timestamp",
         "Data",
         "Horario"
       ) values (%L, %L, %L, %L, ''Negociacao interna'', %s, 0, ''aplicado'', now(), %L, %L)',
      v_event_table,
      p_buyer,
      'Compra interna: ' || p_player,
      p_buyer || ' comprou ' || p_player || ' de ' || p_seller || '.',
      '-' || v_final_value::text || ' descontado do orcamento.',
      -v_final_value,
      v_today,
      v_time
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', format('%s negociado de %s para %s.', p_player, p_seller, p_buyer),
    'transferType', 'internal',
    'seller', p_seller,
    'buyer', p_buyer,
    'player', p_player,
    'value', v_final_value,
    'budgetEventsCreated', v_event_table is not null
  );
end;
$$;

comment on function public.app_add_internal_transfer(text, text, text, text, text, integer, numeric)
is 'Registra transferencia interna entre tecnicos. O historico mais recente define a posse atual do jogador.';

create table if not exists public.internal_transfer_proposals (
  id bigserial primary key,
  buyer text not null,
  seller text not null,
  player text not null,
  from_club text,
  overall integer,
  proposed_value numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by text,
  response_message text
);

create index if not exists internal_transfer_proposals_seller_status_idx
  on public.internal_transfer_proposals (seller, status, created_at desc);

create index if not exists internal_transfer_proposals_buyer_status_idx
  on public.internal_transfer_proposals (buyer, status, created_at desc);

create or replace function public.app_create_internal_transfer_proposal(
  p_manager_id bigint,
  p_access_code text,
  p_buyer text,
  p_seller text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_market_value numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_manager_name text;
  v_transfer_table regclass;
  v_current_owner text;
  v_existing_id bigint;
  v_proposal_id bigint;
begin
  select name
    into v_manager_name
  from public.managers
  where id = p_manager_id
    and access_code = p_access_code;

  if v_manager_name is null then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  if lower(trim(v_manager_name)) <> lower(trim(p_buyer)) then
    return jsonb_build_object('ok', false, 'message', 'A proposta precisa ser enviada pelo comprador logado.');
  end if;

  if lower(trim(p_buyer)) = lower(trim(p_seller)) then
    return jsonb_build_object('ok', false, 'message', 'Comprador e vendedor precisam ser diferentes.');
  end if;

  if coalesce(p_market_value, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Informe um valor de proposta maior que zero.');
  end if;

  select c.oid::regclass
    into v_transfer_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname = 'public'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Comprador' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Jogador' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Status' and not a.attisdropped)
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'Timestamp' and not a.attisdropped)
  order by c.relname
  limit 1;

  if v_transfer_table is null then
    return jsonb_build_object('ok', false, 'message', 'Nao encontrei a tabela de transferencias.');
  end if;

  execute format(
    'select "Comprador"::text
       from %s
      where lower("Jogador"::text) = lower($1)
        and lower("Status"::text) = lower(''aprovado'')
      order by "Timestamp" desc nulls last
      limit 1',
    v_transfer_table
  )
  into v_current_owner
  using p_player;

  if lower(coalesce(v_current_owner, '')) <> lower(trim(p_seller)) then
    return jsonb_build_object(
      'ok', false,
      'message', format('Este jogador pertence atualmente a %s, nao a %s.', coalesce(v_current_owner, 'ninguem'), p_seller)
    );
  end if;

  select id
    into v_existing_id
  from public.internal_transfer_proposals
  where lower(player) = lower(p_player)
    and lower(buyer) = lower(p_buyer)
    and lower(seller) = lower(p_seller)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok', false, 'message', 'Ja existe uma proposta pendente para este jogador entre estes tecnicos.');
  end if;

  insert into public.internal_transfer_proposals (
    buyer,
    seller,
    player,
    from_club,
    overall,
    proposed_value
  ) values (
    p_buyer,
    p_seller,
    p_player,
    p_from_club,
    p_overall,
    p_market_value
  )
  returning id into v_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta enviada para %s aprovar ou recusar.', p_seller),
    'proposalId', v_proposal_id
  );
end;
$$;

create or replace function public.app_get_my_internal_transfer_proposals(
  p_manager_id bigint,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_manager_name text;
begin
  select name
    into v_manager_name
  from public.managers
  where id = p_manager_id
    and access_code = p_access_code;

  if v_manager_name is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      to_jsonb(p) ||
      jsonb_build_object(
        'proposal_role',
        case
          when lower(p.seller) = lower(v_manager_name) then 'received'
          else 'sent'
        end
      )
      order by p.created_at desc
    )
    from public.internal_transfer_proposals p
    where lower(p.seller) = lower(v_manager_name)
       or lower(p.buyer) = lower(v_manager_name)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.app_answer_internal_transfer_proposal(
  p_manager_id bigint,
  p_access_code text,
  p_proposal_id bigint,
  p_decision text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_manager_name text;
  v_proposal public.internal_transfer_proposals%rowtype;
  v_transfer_result jsonb;
  v_status text;
begin
  select name
    into v_manager_name
  from public.managers
  where id = p_manager_id
    and access_code = p_access_code;

  if v_manager_name is null then
    return jsonb_build_object('ok', false, 'message', 'Login do vendedor invalido.');
  end if;

  select *
    into v_proposal
  from public.internal_transfer_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Proposta nao encontrada.');
  end if;

  if lower(v_proposal.seller) <> lower(v_manager_name) then
    return jsonb_build_object('ok', false, 'message', 'Apenas o vendedor pode responder esta proposta.');
  end if;

  if v_proposal.status <> 'pending' then
    return jsonb_build_object('ok', false, 'message', 'Esta proposta ja foi respondida.');
  end if;

  v_status := case
    when lower(p_decision) in ('accepted', 'accept', 'aceitar', 'aprovado') then 'accepted'
    else 'rejected'
  end;

  if v_status = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Proposta recusada pelo vendedor.'
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'message', 'Proposta recusada.', 'status', 'rejected');
  end if;

  v_transfer_result := public.app_add_internal_transfer(
    'eafc26',
    v_proposal.buyer,
    v_proposal.seller,
    v_proposal.player,
    coalesce(v_proposal.from_club, 'Negociacao interna: ' || v_proposal.seller),
    coalesce(v_proposal.overall, 0),
    coalesce(v_proposal.proposed_value, 0)
  );

  if coalesce((v_transfer_result ->> 'ok')::boolean, false) is not true then
    return v_transfer_result;
  end if;

  update public.internal_transfer_proposals
     set status = 'accepted',
         answered_at = now(),
         answered_by = v_manager_name,
         response_message = 'Proposta aceita pelo vendedor.'
   where id = p_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'message', format('Proposta aceita. %s foi vendido para %s.', v_proposal.player, v_proposal.buyer),
    'status', 'accepted',
    'transfer', v_transfer_result
  );
end;
$$;

-- Orcamento:
-- O RPC registra dois eventos financeiros:
--   1. vendedor recebe +ValorNegociado;
--   2. comprador recebe -ValorNegociado.
-- Se o seu app_get_data ja soma ImpactoFinanceiro dos eventos no budget,
-- o saldo sera atualizado automaticamente depois do reload do app.
--
-- Posse:
-- A posse atual do jogador deve ser lida pela transferencia aprovada mais
-- recente de cada Jogador.
