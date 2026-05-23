-- v57 - Commissioner fixes, transfer reversal and recurring sponsorships.
-- Run this file in Supabase SQL Editor after the base schema scripts.

create or replace function public.app_find_transfer_table_for_admin()
returns regclass
language plpgsql
stable
set search_path = public
as $$
declare
  v_transfer_table regclass;
begin
  if to_regprocedure('public.app_find_transfer_table()') is not null then
    execute 'select public.app_find_transfer_table()' into v_transfer_table;
    if v_transfer_table is not null then
      return v_transfer_table;
    end if;
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
  order by
    case when c.relname in ('transfers', 'transferencias') then 0 else 1 end,
    c.relname
  limit 1;

  return v_transfer_table;
end;
$$;

create or replace function public.app_reverse_transfer(
  p_manager_id text,
  p_access_code text,
  p_transfer_id bigint default null,
  p_buyer text default '',
  p_player text default '',
  p_from_club text default '',
  p_timestamp text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_transfer_table regclass;
  v_id_col text;
  v_rows integer := 0;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode desfazer transferencias.');
  end if;

  v_transfer_table := public.app_find_transfer_table_for_admin();
  if v_transfer_table is null then
    return jsonb_build_object('ok', false, 'message', 'Nao encontrei a tabela de transferencias.');
  end if;

  execute format('alter table %s add column if not exists "Status" text default ''pendente''', v_transfer_table);
  execute format('alter table %s add column if not exists "RevertidaEm" timestamptz', v_transfer_table);
  execute format('alter table %s add column if not exists "RevertidaPor" text', v_transfer_table);

  select quote_ident(a.attname)
    into v_id_col
  from pg_attribute a
  where a.attrelid = v_transfer_table
    and not a.attisdropped
    and a.attname in ('id', 'Id', 'ID')
  order by case a.attname when 'id' then 0 when 'Id' then 1 else 2 end
  limit 1;

  if p_transfer_id is not null and v_id_col is not null then
    execute format(
      'update %s
          set "Status" = ''desfeito'',
              "RevertidaEm" = now(),
              "RevertidaPor" = %L
        where %s = $1
          and lower(coalesce("Status"::text, '''')) in (''aprovado'', ''approved'')',
      v_transfer_table,
      coalesce(v_login ->> 'managerName', 'Comissario da Liga'),
      v_id_col
    )
    using p_transfer_id;
    get diagnostics v_rows = row_count;
  end if;

  if v_rows = 0 then
    execute format(
      'update %s
          set "Status" = ''desfeito'',
              "RevertidaEm" = now(),
              "RevertidaPor" = %L
        where lower(coalesce("Comprador"::text, '''')) = lower($1)
          and lower(coalesce("Jogador"::text, '''')) = lower($2)
          and ($3 = '''' or lower(coalesce("ClubeOrigem"::text, '''')) = lower($3))
          and ($4 = '''' or coalesce("Timestamp"::text, '''') = $4)
          and lower(coalesce("Status"::text, '''')) in (''aprovado'', ''approved'')',
      v_transfer_table,
      coalesce(v_login ->> 'managerName', 'Comissario da Liga')
    )
    using coalesce(p_buyer, ''), coalesce(p_player, ''), coalesce(p_from_club, ''), coalesce(p_timestamp, '');
    get diagnostics v_rows = row_count;
  end if;

  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'message', 'Transferencia aprovada nao encontrada para desfazer.');
  end if;

  delete from public.events
  where lower(coalesce(title, '')) in (
      lower('Compra interna: ' || coalesce(p_player, '')),
      lower('Venda interna: ' || coalesce(p_player, ''))
    )
    and coalesce(status, '') in ('applied', 'aplicado', 'ativo', 'gerado');

  return jsonb_build_object(
    'ok', true,
    'message', 'Transferencia desfeita. O jogador foi liberado e o orcamento sera recalculado.',
    'rowsUpdated', v_rows
  );
end;
$$;

create or replace function public.app_sponsorship_offers()
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(
    jsonb_build_object('id','nova_kits_weekly','sponsorName','Nova Sportswear','category','Fornecedor de material esportivo','title','Uniforme garantido','description','Pagamento fixo toda semana, bom para manter folha e pequenas compras vivas.','conditionType','weekly_payment','conditionLabel','Pagamento semanal fixo','riskLevel','Receita semanal','signingBonus',800000,'rewardValue',1200000,'maxClaims',8,'paymentCadence','weekly'),
    jsonb_build_object('id','dhl_weekly','sponsorName','DHL Express','category','Logistica e viagens','title','Entrega semanal','description','Contrato previsivel: dinheiro cai no fechamento semanal sem depender de placar.','conditionType','weekly_payment','conditionLabel','Pagamento semanal fixo','riskLevel','Receita semanal','signingBonus',1000000,'rewardValue',1500000,'maxClaims',8,'paymentCadence','weekly'),
    jsonb_build_object('id','streamplay_weekly','sponsorName','StreamPlay Sports','category','Midia e conteudo','title','Bastidores semanais','description','Conteudo recorrente com receita leve e constante para todos os perfis de elenco.','conditionType','weekly_payment','conditionLabel','Pagamento semanal fixo','riskLevel','Receita semanal','signingBonus',700000,'rewardValue',1000000,'maxClaims',10,'paymentCadence','weekly'),
    jsonb_build_object('id','redwood_monthly','sponsorName','Redwood Capital','category','Naming Rights de Estadio','title','Redwood Park mensal','description','Cheque mensal chamativo para clubes que querem impacto real no mercado.','conditionType','monthly_payment','conditionLabel','Pagamento mensal fixo','riskLevel','Receita mensal forte','signingBonus',2500000,'rewardValue',8500000,'maxClaims',3,'paymentCadence','monthly'),
    jsonb_build_object('id','emirates_monthly','sponsorName','Emirates','category','Patrocinador master','title','Global front shirt','description','Contrato master de alto impacto: poucos pagamentos, todos grandes.','conditionType','monthly_payment','conditionLabel','Pagamento mensal fixo','riskLevel','Receita mensal forte','signingBonus',4000000,'rewardValue',11000000,'maxClaims',3,'paymentCadence','monthly'),
    jsonb_build_object('id','sony_monthly','sponsorName','Sony Xperia','category','Parceiro premium','title','Tech mensal','description','Parceiro premium com parcela mensal alta para acelerar reconstrucoes.','conditionType','monthly_payment','conditionLabel','Pagamento mensal fixo','riskLevel','Receita mensal forte','signingBonus',3000000,'rewardValue',9500000,'maxClaims',3,'paymentCadence','monthly'),

    jsonb_build_object('id','aurora_kits','sponsorName','Aurora Kits','category','Fornecedor de material esportivo','title','Colecao campea','description','Linha premium: pouca luva e bonus alto por vitorias fortes.','conditionType','win_by_2','conditionLabel','Vencer por 2+ gols','riskLevel','Alta exigencia','signingBonus',800000,'rewardValue',1800000,'maxClaims',5),
    jsonb_build_object('id','fortress_arena','sponsorName','Fortress Telecom','category','Naming Rights de Estadio','title','Fortress Stadium','description','Oferta agressiva para clubes dominantes em casa.','conditionType','win_by_2','conditionLabel','Vencer por 2+ gols','riskLevel','Alta exigencia','signingBonus',900000,'rewardValue',2300000,'maxClaims',4),
    jsonb_build_object('id','atlas_master','sponsorName','Atlas Bank','category','Patrocinador master','title','Camisa pesada','description','Master de elite: teto alto e exigencia ofensiva.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Alta exigencia','signingBonus',1600000,'rewardValue',2200000,'maxClaims',5),
    jsonb_build_object('id','pioneer_master','sponsorName','Pioneer Motors','category','Patrocinador master','title','Frente da camisa','description','Contrato equilibrado para consistencia.','conditionType','any_win','conditionLabel','Vencer qualquer partida','riskLevel','Baixa exigencia','signingBonus',1800000,'rewardValue',1100000,'maxClaims',6),
    jsonb_build_object('id','voasul_logistics','sponsorName','VoaSul','category','Logistica e viagens','title','Milhas da delegacao','description','Ajuda viagens e paga quando o time ganha longe de casa.','conditionType','away_win','conditionLabel','Vencer como visitante','riskLevel','Media exigencia','signingBonus',900000,'rewardValue',1400000,'maxClaims',6),
    jsonb_build_object('id','primecam_media','sponsorName','PrimeCam','category','Midia e conteudo','title','Noite de gala','description','Transmissao paga melhor quando o time entrega gols.','conditionType','three_goals','conditionLabel','Marcar 3+ gols','riskLevel','Media exigencia','signingBonus',700000,'rewardValue',1500000,'maxClaims',5)
  );
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
        v_contract.id, v_contract.manager_id, v_contract.manager_name, v_result_key, v_contract.reward_value
      )
      on conflict (contract_id, result_key) do nothing;
      get diagnostics v_inserted = row_count;

      if v_inserted > 0 then
        update public.sponsorship_contracts
           set claims_used = claims_used + 1,
               status = case when claims_used + 1 >= max_claims then 'completed' else status end
         where id = v_contract.id;

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

        v_paid := v_paid + 1;
      end if;

      v_next_claim := v_next_claim + 1;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'paid', v_paid);
end;
$$;

create or replace function public.app_run_audit_action(
  p_manager_id text,
  p_access_code text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_periodic jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode executar auditoria.');
  end if;

  if p_action = 'process_sponsorships' then
    if to_regprocedure('public.app_process_all_sponsorship_rewards()') is not null then
      perform public.app_process_all_sponsorship_rewards();
    end if;
    v_periodic := public.app_process_periodic_sponsorships();
    return jsonb_build_object(
      'ok', true,
      'message', 'Patrocinios reprocessados. Parcelas recorrentes pagas: ' || coalesce(v_periodic ->> 'paid', '0') || '.'
    );
  elsif p_action = 'refresh_finance' then
    return jsonb_build_object(
      'ok', true,
      'message', 'Previsao financeira atualizada.',
      'forecast', public.app_get_manager_finance_forecast()
    );
  elsif p_action = 'expire_completed_sponsorships' then
    update public.sponsorship_contracts
       set status = 'completed'
     where status = 'active'
       and claims_used >= max_claims;
    return jsonb_build_object('ok', true, 'message', 'Patrocinios completos encerrados.');
  end if;

  return jsonb_build_object('ok', false, 'message', 'Acao de auditoria desconhecida.');
end;
$$;

grant execute on function public.app_find_transfer_table_for_admin() to anon, authenticated;
grant execute on function public.app_reverse_transfer(text, text, bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.app_process_periodic_sponsorships() to anon, authenticated;
grant execute on function public.app_run_audit_action(text, text, text, jsonb) to anon, authenticated;
