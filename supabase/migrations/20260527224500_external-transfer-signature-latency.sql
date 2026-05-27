-- v100 - Make external transfer signature a staged process with delay.

begin;

alter table if exists public.internal_transfer_proposals
  add column if not exists signature_status text,
  add column if not exists signature_requested_at timestamptz,
  add column if not exists signature_expires_at timestamptz,
  add column if not exists signature_message text;

create or replace function public.app_finalize_external_transfer_signature(
  p_proposal_id bigint,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.internal_transfer_proposals%rowtype;
  v_buyer_id text;
  v_rate numeric := 0;
  v_offer_value numeric := 0;
  v_signed_cash_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
  v_purchase_id bigint;
  v_trade record;
  v_trade_sale_id bigint;
  v_signature_deadline timestamptz;
  v_failed_reason text;
  v_cash_value numeric := 0;
begin
  select *
    into v_proposal
  from public.internal_transfer_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', 'Proposta nao encontrada.');
  end if;

  if coalesce(v_proposal.proposal_type, '') <> 'external_market' then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', 'Esta proposta nao e de mercado externo.');
  end if;

  if coalesce(v_proposal.status, '') <> 'signature_pending' then
    return jsonb_build_object(
      'ok', false,
      'status', coalesce(v_proposal.status, 'pending'),
      'message', format('Proposta nao esta aguardando assinatura. Status atual: %s.', coalesce(v_proposal.status, 'Pendente'))
    );
  end if;

  v_signature_deadline := coalesce(v_proposal.signature_expires_at, v_proposal.expires_at);
  if not p_force and v_signature_deadline is not null and v_signature_deadline > now() then
    return jsonb_build_object(
      'ok', false,
      'status', 'signature_pending',
      'message',
      format(
        'Assinatura ainda em prazo. Prazo ate %s.',
        to_char(v_signature_deadline, 'DD/MM/YYYY HH24:MI')
      )
    );
  end if;

  select id
    into v_buyer_id
  from public.managers
  where lower(display_name) = lower(trim(v_proposal.buyer))
  limit 1;

  if v_buyer_id is null then
    v_failed_reason := format('Nao encontrei o comprador %s.', v_proposal.buyer);
    update public.internal_transfer_proposals
       set status = 'rejected',
           signature_status = 'failed',
           signature_message = v_failed_reason,
           response_message = v_failed_reason,
           answered_at = now()
     where id = p_proposal_id;

    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', v_failed_reason);
  end if;

  v_rate := case
    when coalesce(v_proposal.overall, 0) >= 89 then 0.25
    when coalesce(v_proposal.overall, 0) >= 84 then 0.15
    when coalesce(v_proposal.overall, 0) >= 80 then 0.10
    when coalesce(v_proposal.overall, 0) >= 75 then 0.05
    else 0
  end;

  v_offer_value := greatest(100000, coalesce(v_proposal.proposed_value, v_proposal.buyer_offer_value, 0));
  v_signed_cash_value := greatest(0, v_offer_value - coalesce(v_proposal.trade_in_credit, 0));

  if coalesce(trim(v_proposal.trade_in_player), '') <> '' then
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      t.market_value,
      t.final_value,
      t.negotiated_value,
      t.transfer_type,
      m.display_name as current_owner
      into v_trade
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.status = 'approved'
      and lower(t.player_name) = lower(trim(v_proposal.trade_in_player))
    order by t.created_at desc nulls last, t.id desc
    limit 1;

    if v_trade.id is null then
      v_failed_reason := 'Jogador de troca nao encontrado no elenco atual.';
      update public.internal_transfer_proposals
         set status = 'rejected',
             signature_status = 'failed',
             signature_message = v_failed_reason,
             response_message = v_failed_reason,
             answered_at = now()
       where id = p_proposal_id;

      return jsonb_build_object('ok', false, 'status', 'rejected', 'message', v_failed_reason);
    end if;

    if v_trade.transfer_type = 'cpu_sale' or lower(v_trade.current_owner) <> lower(trim(v_proposal.buyer)) then
      v_failed_reason := format('%s nao pertence atualmente a %s.', v_proposal.trade_in_player, v_proposal.buyer);
      update public.internal_transfer_proposals
         set status = 'rejected',
             signature_status = 'failed',
             signature_message = v_failed_reason,
             response_message = v_failed_reason,
             answered_at = now()
       where id = p_proposal_id;

      return jsonb_build_object('ok', false, 'status', 'rejected', 'message', v_failed_reason);
    end if;
  end if;

  if exists (
    with latest as (
      select
        t.*,
        row_number() over (
          partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
          order by t.created_at desc nulls last, t.id desc
        ) as rn
      from public.transfers t
      where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
        and lower(trim(coalesce(t.player_key, t.player_name, ''))) = lower(trim(v_proposal.player))
    )
    select 1
    from latest
    where rn = 1
      and lower(coalesce(transfer_type, 'market')) <> 'cpu_sale'
  ) then
    v_failed_reason := 'Jogador ja possui contrato ativo na liga.';
    update public.internal_transfer_proposals
       set status = 'rejected',
           signature_status = 'failed',
           signature_message = v_failed_reason,
           response_message = v_failed_reason,
           answered_at = now()
     where id = p_proposal_id;

    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', v_failed_reason);
  end if;

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> v_proposal.buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 22000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(v_proposal.buyer);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(
    v_proposal.buyer,
    case when coalesce(v_proposal.trade_in_credit, 0) > 0 then coalesce(v_trade.player_name, '') else '' end
  );

  if v_market_embargo or v_remaining < 0 then
    v_failed_reason := format('Mercado bloqueado para %s por divida salarial ou saldo negativo.', v_proposal.buyer);
  elsif v_transfer_limit <= 0 then
    v_failed_reason := format('Transferencias externas bloqueadas hoje para %s.', v_proposal.buyer);
  elsif v_transfers_today >= v_transfer_limit then
    v_failed_reason := format('%s ja atingiu o limite diario.', v_proposal.buyer);
  elsif v_signed_cash_value > v_remaining then
    v_failed_reason := format('Saldo insuficiente: faltam %s.', trim(to_char(v_signed_cash_value - v_remaining, 'FM999G999G999G999G990')));
  elsif (v_current_payroll + coalesce(v_proposal.weekly_salary_eur, 0)) * 4 > v_total_budget * v_max_ratio then
    v_failed_reason := 'Folha projetada acima do teto financeiro da liga. O salario de folha do jogador inviabiliza a contratacao.';
  end if;

  if v_failed_reason is not null then
    update public.internal_transfer_proposals
       set status = 'rejected',
           signature_status = 'failed',
           signature_message = v_failed_reason,
           response_message = v_failed_reason,
           answered_at = now()
     where id = p_proposal_id;

    return jsonb_build_object('ok', false, 'status', 'rejected', 'message', v_failed_reason);
  end if;

  if coalesce(v_proposal.salary_reference_type, 'regulatory_estimate') <> 'regulatory_estimate' then
    perform public.app_upsert_player_salary_reference(
      v_proposal.player,
      coalesce(v_proposal.from_club, ''),
      coalesce(v_proposal.weekly_salary_eur, 0),
      coalesce(v_proposal.salary_source_name, ''),
      coalesce(v_proposal.salary_source_url, ''),
      'Criado automaticamente a partir de transferencia assinada.'
    );
  end if;

  insert into public.transfers (
    buyer_id,
    player_name,
    from_club,
    overall,
    market_value,
    overall_rate,
    weekly_salary_eur,
    salary_source_name,
    salary_source_url,
    salary_reference_type,
    salary_checked_at,
    status,
    reason,
    transfer_type,
    negotiated_value,
    trade_in_player_name,
    trade_in_credit,
    created_at,
    updated_at
  ) values (
    v_buyer_id,
    trim(v_proposal.player),
    nullif(trim(coalesce(v_proposal.from_club, '')), ''),
    coalesce(v_proposal.overall, 0),
    coalesce(v_proposal.reference_value, 0),
    v_rate,
    coalesce(v_proposal.weekly_salary_eur, 0),
    coalesce(v_proposal.salary_source_name, ''),
    coalesce(v_proposal.salary_source_url, ''),
    coalesce(v_proposal.salary_reference_type, 'regulatory_estimate'),
    now(),
    'approved',
    'OK',
    'market',
    v_offer_value,
    nullif(trim(coalesce(v_proposal.trade_in_player, '')), ''),
    coalesce(v_proposal.trade_in_credit, 0),
    now(),
    now()
  )
  returning id into v_purchase_id;

  if coalesce(v_proposal.trade_in_credit, 0) > 0 and v_trade.id is not null then
    insert into public.transfers (
      buyer_id,
      seller_id,
      player_name,
      from_club,
      overall,
      market_value,
      overall_rate,
      status,
      reason,
      transfer_type,
      negotiated_value,
      destination_club,
      created_at,
      updated_at
    ) values (
      v_buyer_id,
      v_buyer_id,
      v_trade.player_name,
      coalesce(nullif(v_trade.from_club, ''), 'Elenco de ' || v_proposal.buyer),
      coalesce(v_trade.overall, 0),
      0,
      0,
      'approved',
      'Troca usada na compra de ' || trim(v_proposal.player),
      'cpu_sale',
      0,
      coalesce(nullif(trim(v_proposal.from_club), ''), 'Clube vendedor'),
      now(),
      now()
    )
    returning id into v_trade_sale_id;

    update public.transfers
       set trade_in_transfer_id = v_trade_sale_id,
           updated_at = now()
     where id = v_purchase_id;
  end if;

  update public.internal_transfer_proposals
     set status = 'accepted',
         signature_status = 'signed',
         signature_requested_at = coalesce(signature_requested_at, now()),
         signature_expires_at = coalesce(signature_expires_at, now()),
         answered_at = now(),
         answered_by = v_proposal.buyer,
         cash_offer_value = v_signed_cash_value,
         response_message = 'Comprador aceitou e a assinatura foi processada. Transferencia registrada na liga.',
         signature_message = null
   where id = p_proposal_id;

  update public.internal_transfer_proposals
     set status = 'rejected',
         answered_at = now(),
         answered_by = 'Sistema',
         signature_status = 'failed',
         signature_message = 'Encerrada porque o jogador foi contratado em outra negociacao.',
         response_message = 'Encerrada porque o jogador foi contratado em outra negociacao.'
   where id <> p_proposal_id
     and proposal_type = 'external_market'
     and status in ('pending', 'buyer_review', 'signature_pending')
     and lower(player) = lower(v_proposal.player);

  return jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'message', format('Contrato assinado e fechado. %s agora foi registrado para %s.', v_proposal.player, v_proposal.buyer),
    'transferId', v_purchase_id,
    'tradeSaleTransferId', v_trade_sale_id,
    'buyer', v_proposal.buyer,
    'player', v_proposal.player,
    'fromClub', v_proposal.from_club,
    'referenceValue', v_proposal.reference_value,
    'sellerValue', v_offer_value,
    'cashValue', v_signed_cash_value,
    'weeklySalary', v_proposal.weekly_salary_eur,
    'salarySourceName', v_proposal.salary_source_name,
    'salarySourceUrl', v_proposal.salary_source_url
  );
exception when others then
  if v_proposal.id is not null then
    update public.internal_transfer_proposals
       set status = 'rejected',
           signature_status = 'failed',
           signature_message = sqlerrm,
           response_message = sqlerrm,
           answered_at = now()
     where id = v_proposal.id;
  end if;
  return jsonb_build_object('ok', false, 'status', 'rejected', 'message', sqlerrm);
end;
$$;

create or replace function public.app_process_due_external_transfer_signatures()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_result jsonb;
  v_processed integer := 0;
  v_accepted integer := 0;
  v_rejected integer := 0;
begin
  for v_entry in
    select id
    from public.internal_transfer_proposals
    where proposal_type = 'external_market'
      and status = 'signature_pending'
      and coalesce(signature_expires_at, expires_at) is not null
      and coalesce(signature_expires_at, expires_at) <= now()
    for update skip locked
  loop
    v_result := public.app_finalize_external_transfer_signature(v_entry.id, true);
    v_processed := v_processed + 1;
    if coalesce((v_result ->> 'ok')::boolean, false) then
      if coalesce(v_result ->> 'status', 'rejected') = 'accepted' then
        v_accepted := v_accepted + 1;
      else
        v_rejected := v_rejected + 1;
      end if;
    else
      v_rejected := v_rejected + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'processed', v_processed,
    'accepted', v_accepted,
    'rejected', v_rejected
  );
end;
$$;

create or replace function public.app_answer_external_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_proposal_id bigint,
  p_decision text,
  p_counter_value numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_manager_name text;
  v_proposal public.internal_transfer_proposals%rowtype;
  v_decision text;
  v_buyer_id text;
  v_rate numeric := 0;
  v_offer_value numeric := 0;
  v_cash_value numeric := 0;
  v_budget jsonb;
  v_remaining numeric := 0;
  v_total_budget numeric := 0;
  v_transfer_limit integer := 0;
  v_transfers_today integer := 0;
  v_current_payroll numeric := 0;
  v_max_ratio numeric := 0.22;
  v_market_embargo boolean := false;
  v_response jsonb;
  v_status text;
  v_seller_value numeric := 0;
  v_purchase_id bigint;
  v_trade record;
  v_trade_sale_id bigint;
  v_signature_delay_seconds integer;
  v_signature_delay interval;
begin
  if public.app_transfer_window_is_locked() then
    return jsonb_build_object('ok', false, 'message', 'Janela de transferencias fechada enquanto consolidamos o app.');
  end if;

  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do comprador invalido.');
  end if;

  v_manager_name := coalesce(v_login ->> 'managerName', '');

  select *
    into v_proposal
  from public.internal_transfer_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Proposta nao encontrada.');
  end if;

  if coalesce(v_proposal.proposal_type, '') <> 'external_market' then
    return jsonb_build_object('ok', false, 'message', 'Esta resposta nao pertence a uma proposta de mercado externo.');
  end if;

  if lower(v_proposal.buyer) <> lower(v_manager_name) then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comprador pode responder esta proposta.');
  end if;

  if v_proposal.status not in ('pending', 'buyer_review') then
    return jsonb_build_object('ok', false, 'message', 'Esta proposta ja foi encerrada.');
  end if;

  v_decision := lower(coalesce(trim(p_decision), ''));
  v_decision := case
    when v_decision in ('accepted', 'accept', 'aceitar', 'aprovado') then 'accepted'
    when v_decision in ('counter', 'contraoferta', 'contra oferta') then 'counter'
    when v_decision in ('rejected', 'reject', 'recusar', 'desistir', 'cancel') then 'rejected'
    else 'rejected'
  end;

  if v_decision = 'rejected' then
    update public.internal_transfer_proposals
       set status = 'rejected',
           answered_at = now(),
           answered_by = v_manager_name,
           response_message = 'Comprador desistiu da negociacao antes da assinatura.'
     where id = p_proposal_id;

    return jsonb_build_object('ok', true, 'status', 'rejected', 'message', 'Negociacao encerrada sem contratacao.');
  end if;

  if v_decision = 'counter' then
    v_offer_value := coalesce(p_counter_value, 0);
    if v_offer_value <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Informe uma contraoferta maior que zero.');
    end if;

    v_offer_value := greatest(100000, round(v_offer_value / 100000, 0) * 100000);
    v_cash_value := greatest(0, v_offer_value - coalesce(v_proposal.trade_in_credit, 0));

    v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> v_proposal.buyer, '{}'::jsonb);
    v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
    if v_cash_value > v_remaining then
      return jsonb_build_object('ok', false, 'message', format('Contraoferta acima do saldo: faltam %s.', trim(to_char(v_cash_value - v_remaining, 'FM999G999G999G999G990'))));
    end if;

    v_response := public.app_external_transfer_seller_response(
      coalesce(v_proposal.reference_value, 0),
      v_offer_value,
      coalesce(v_proposal.overall, 0),
      coalesce(v_proposal.negotiation_round, 0) + 1
    );
    v_status := coalesce(v_response ->> 'status', 'buyer_review');
    v_seller_value := coalesce((v_response ->> 'sellerValue')::numeric, v_offer_value);

    update public.internal_transfer_proposals
       set status = v_status,
           proposed_value = v_seller_value,
           buyer_offer_value = v_offer_value,
           cash_offer_value = greatest(0, v_seller_value - coalesce(v_proposal.trade_in_credit, 0)),
           negotiation_round = coalesce(negotiation_round, 0) + 1,
           answered_at = now(),
           answered_by = coalesce(nullif(trim(v_proposal.from_club), ''), 'Clube vendedor'),
           response_message = coalesce(v_response ->> 'message', 'Clube vendedor respondeu a contraoferta.')
     where id = p_proposal_id;

    return jsonb_build_object(
      'ok', true,
      'status', v_status,
      'sellerDecision', v_response ->> 'sellerDecision',
      'message', coalesce(v_response ->> 'message', 'Contraoferta respondida.'),
      'sellerValue', v_seller_value,
      'cashValue', greatest(0, v_seller_value - coalesce(v_proposal.trade_in_credit, 0))
    );
  end if;

  select id into v_buyer_id
  from public.managers
  where lower(display_name) = lower(trim(v_proposal.buyer))
  limit 1;

  if v_buyer_id is null then
    return jsonb_build_object('ok', false, 'message', format('Nao encontrei o comprador %s.', v_proposal.buyer));
  end if;

  v_rate := case
    when coalesce(v_proposal.overall, 0) >= 89 then 0.25
    when coalesce(v_proposal.overall, 0) >= 84 then 0.15
    when coalesce(v_proposal.overall, 0) >= 80 then 0.10
    when coalesce(v_proposal.overall, 0) >= 75 then 0.05
    else 0
  end;

  v_offer_value := greatest(100000, coalesce(v_proposal.proposed_value, v_proposal.buyer_offer_value, 0));
  v_cash_value := greatest(0, v_offer_value - coalesce(v_proposal.trade_in_credit, 0));

  if coalesce(trim(v_proposal.trade_in_player), '') <> '' then
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      t.market_value,
      t.final_value,
      t.negotiated_value,
      t.transfer_type,
      m.display_name as current_owner
      into v_trade
    from public.transfers t
    join public.managers m on m.id = t.buyer_id
    where t.status = 'approved'
      and lower(t.player_name) = lower(trim(v_proposal.trade_in_player))
    order by t.created_at desc nulls last, t.id desc
    limit 1;

    if v_trade.id is null then
      return jsonb_build_object('ok', false, 'message', 'Jogador de troca nao encontrado no elenco atual.');
    end if;

    if v_trade.transfer_type = 'cpu_sale' or lower(v_trade.current_owner) <> lower(trim(v_proposal.buyer)) then
      return jsonb_build_object('ok', false, 'message', format('%s nao pertence atualmente a %s.', v_proposal.trade_in_player, v_proposal.buyer));
    end if;
  end if;

  if exists (
    with latest as (
      select
        t.*,
        row_number() over (
          partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
          order by t.created_at desc nulls last, t.id desc
        ) as rn
      from public.transfers t
      where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
        and lower(trim(coalesce(t.player_key, t.player_name, ''))) = lower(trim(v_proposal.player))
    )
    select 1
    from latest
    where rn = 1
      and lower(coalesce(transfer_type, 'market')) <> 'cpu_sale'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Jogador ja possui contrato ativo na liga.');
  end if;

  v_budget := coalesce(public.app_get_budget_reconciliation()::jsonb -> v_proposal.buyer, '{}'::jsonb);
  v_remaining := coalesce((v_budget ->> 'remainingBudget')::numeric, 0);
  v_total_budget := coalesce((v_budget ->> 'totalBudget')::numeric, 22000000);
  v_transfer_limit := coalesce((v_budget ->> 'transferLimit')::integer, 3);
  v_market_embargo := coalesce((v_budget ->> 'marketEmbargo')::boolean, false);
  v_transfers_today := public.app_get_external_transfer_today_count(v_proposal.buyer);
  v_max_ratio := coalesce((public.app_get_finance_rules() ->> 'max_payroll_to_budget_ratio')::numeric, 0.22);
  v_current_payroll := public.app_get_manager_current_payroll(
    v_proposal.buyer,
    case when coalesce(v_proposal.trade_in_credit, 0) > 0 then coalesce(v_trade.player_name, '') else '' end
  );

  if exists (
    select 1
    from public.internal_transfer_proposals
    where id = p_proposal_id and status = 'signature_pending'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Proposta com assinatura pendente encontrada para este contrato.');
  end if;

  if v_market_embargo or v_remaining < 0 then
    return jsonb_build_object('ok', false, 'message', format('Mercado bloqueado para %s por divida salarial ou saldo negativo.', v_proposal.buyer));
  end if;

  if v_transfer_limit <= 0 then
    return jsonb_build_object('ok', false, 'message', format('Transferencias externas bloqueadas hoje para %s.', v_proposal.buyer));
  end if;

  if v_transfers_today >= v_transfer_limit then
    return jsonb_build_object('ok', false, 'message', format('%s ja atingiu o limite diario.', v_proposal.buyer));
  end if;

  if v_cash_value > v_remaining then
    return jsonb_build_object('ok', false, 'message', format('Saldo insuficiente: faltam %s.', trim(to_char(v_cash_value - v_remaining, 'FM999G999G999G999G990'))));
  end if;

  if (v_current_payroll + coalesce(v_proposal.weekly_salary_eur, 0)) * 4 > v_total_budget * v_max_ratio then
    return jsonb_build_object('ok', false, 'message', 'Folha projetada acima do teto financeiro da liga. O salario de folha do jogador inviabiliza a contratacao.');
  end if;

  v_signature_delay_seconds := 3600 * (24 + floor(random() * 25)::int);
  v_signature_delay := make_interval(secs => v_signature_delay_seconds);

  update public.internal_transfer_proposals
     set status = 'signature_pending',
         signature_status = 'requested',
         signature_requested_at = now(),
         signature_expires_at = now() + v_signature_delay,
         expires_at = now() + v_signature_delay,
         answered_at = now(),
         answered_by = v_manager_name,
         response_message = 'Comprador aceitou base comercial. Aguardando assinatura no escritorio.'
   where id = p_proposal_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'signature_pending',
    'message', 'Proposta aceita. Aguarde a conclusao da assinatura do contrato.'
  );
exception when others then
  return jsonb_build_object('ok', false, 'status', 'rejected', 'message', sqlerrm);
end;
$$;

create or replace function public.app_get_my_internal_transfer_proposals(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return '[]'::jsonb;
  end if;

  v_manager_name := v_session ->> 'managerName';

  if to_regprocedure('public.app_process_due_external_transfer_signatures()') is not null then
    perform public.app_process_due_external_transfer_signatures();
  end if;

  return coalesce((
    select jsonb_agg(
      to_jsonb(p) ||
      jsonb_build_object(
        'proposal_role',
        case
          when lower(p.seller) = lower(v_manager_name) then 'received'
          else 'sent'
        end,
        'is_cpu_offer', coalesce(p.is_cpu_offer, false),
        'offer_source', coalesce(nullif(p.offer_source, ''), case when coalesce(p.is_cpu_offer, false) then 'cpu' else 'coach' end)
      )
      order by p.created_at desc
    )
    from public.internal_transfer_proposals p
    where lower(p.seller) = lower(v_manager_name)
       or lower(p.buyer) = lower(v_manager_name)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.app_run_due_maintenance(
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_key text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD-HH24-MI');
  v_run_id bigint;
  v_events jsonb := '{}'::jsonb;
  v_decisions jsonb := '{}'::jsonb;
  v_cpu jsonb := '{}'::jsonb;
  v_sponsor_goals jsonb := '{}'::jsonb;
  v_sponsor_periodic jsonb := '{}'::jsonb;
  v_external_signatures jsonb := '{}'::jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('mml_due_maintenance')) then
    return jsonb_build_object('ok', true, 'skipped', true, 'message', 'Manutencao ja em execucao.');
  end if;

  if not p_force and exists (
    select 1
    from public.app_maintenance_runs
    where started_at > now() - interval '10 minutes'
      and status = 'completed'
  ) then
    return jsonb_build_object('ok', true, 'skipped', true, 'message', 'Manutencao recente ja executada.');
  end if;

  insert into public.app_maintenance_runs (run_key)
  values (v_run_key)
  on conflict (run_key) do update
     set started_at = now(),
         finished_at = null,
         status = 'running',
         detail = '{}'::jsonb
  returning id into v_run_id;

  if to_regprocedure('public.app_internal_generate_due_events()') is not null then
    v_events := public.app_internal_generate_due_events();
  elsif to_regprocedure('public.app_generate_due_events(text)') is not null then
    v_events := public.app_generate_due_events('eafc26'::text);
  end if;

  if to_regprocedure('public.app_generate_due_decision_events()') is not null then
    v_decisions := public.app_generate_due_decision_events();
  end if;

  if to_regprocedure('public.app_generate_due_cpu_transfer_proposals(integer)') is not null then
    v_cpu := public.app_generate_due_cpu_transfer_proposals(4);
  end if;

  if to_regprocedure('public.app_process_due_external_transfer_signatures()') is not null then
    v_external_signatures := public.app_process_due_external_transfer_signatures();
  end if;

  if to_regprocedure('public.app_process_all_sponsorship_rewards()') is not null then
    v_sponsor_goals := public.app_process_all_sponsorship_rewards();
  end if;

  if to_regprocedure('public.app_process_periodic_sponsorships()') is not null then
    v_sponsor_periodic := public.app_process_periodic_sponsorships();
  end if;

  update public.app_maintenance_runs
     set finished_at = now(),
         status = 'completed',
         detail = jsonb_build_object(
           'events', v_events,
           'decisions', v_decisions,
           'cpuOffers', v_cpu,
           'externalSignatures', v_external_signatures,
           'sponsorshipGoals', v_sponsor_goals,
           'sponsorshipPeriodic', v_sponsor_periodic
         )
   where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'runKey', v_run_key,
    'events', v_events,
    'decisions', v_decisions,
    'cpuOffers', v_cpu,
    'externalSignatures', v_external_signatures,
    'sponsorshipGoals', v_sponsor_goals,
    'sponsorshipPeriodic', v_sponsor_periodic
  );
exception when others then
  if v_run_id is not null then
    update public.app_maintenance_runs
       set finished_at = now(),
           status = 'failed',
           detail = jsonb_build_object('error', sqlerrm)
     where id = v_run_id;
  end if;
  raise;
end;
$$;

do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(
    'public.app_create_external_transfer_proposal(text,text,text,text,text,integer,numeric,numeric,numeric,text,text,text,numeric)'::regprocedure
  )
    into v_sql;

  if v_sql is not null and position(
    'p.status in (''pending'', ''buyer_review'')',
    v_sql
  ) > 0 then
    v_sql := replace(
      v_sql,
      'p.status in (''pending'', ''buyer_review'')',
      'p.status in (''pending'', ''buyer_review'', ''signature_pending'')'
    );
    execute v_sql;
  end if;
end $$;

grant execute on function public.app_finalize_external_transfer_signature(bigint, boolean) to service_role, postgres;
grant execute on function public.app_process_due_external_transfer_signatures() to service_role, postgres;

notify pgrst, 'reload schema';

commit;
