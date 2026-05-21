-- Ajuste para habilitar transferencias entre tecnicos.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro.
-- 3. Teste uma negociacao interna pela aba "Enviar dados".
--
-- O front chama:
--   rpc public.app_add_internal_transfer(
--     p_pin, p_buyer, p_seller, p_player, p_from_club, p_overall, p_market_value
--   )
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
