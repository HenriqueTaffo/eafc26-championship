-- v104 - Idempotência/lock/auditoria para APIs de transferência interna.
-- Extende a trilha de operações para criação e resposta de propostas internas.

begin;

create extension if not exists pgcrypto with schema extensions;

-- 1) Renomeia funções legadas para preservar assinatura original
--    antes de sobrescrever pelos wrappers.
do $$
begin
  if to_regprocedure('public.app_create_internal_transfer_proposal_v1(text, text, text, text, text, text, integer, numeric)') is null
     and to_regprocedure('public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric)') is not null then
    execute
      'alter function public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric) rename to app_create_internal_transfer_proposal_v1';
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal_v1(text, text, bigint, text, numeric)') is null
     and to_regprocedure('public.app_answer_internal_transfer_proposal(text, text, bigint, text, numeric)') is not null then
    execute
      'alter function public.app_answer_internal_transfer_proposal(text, text, bigint, text, numeric) rename to app_answer_internal_transfer_proposal_v1';
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal_v1(text, text, bigint, text)') is null
     and to_regprocedure('public.app_answer_internal_transfer_proposal(text, text, bigint, text)') is not null then
    execute
      'alter function public.app_answer_internal_transfer_proposal(text, text, bigint, text) rename to app_answer_internal_transfer_proposal_v1';
  end if;
end;
$$;

-- 2) Wrapper com auditoria/idempotência para criação de proposta interna.
create or replace function public.app_create_internal_transfer_proposal(
  p_manager_id text,
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
set search_path = public
as $$
declare
  v_audit jsonb;
  v_audit_id bigint;
  v_operation_key text;
  v_payload_version integer := 4;
  v_result jsonb;
  v_success boolean;
begin
  v_operation_key := encode(
    extensions.digest(
      format(
        'app_create_internal_transfer_proposal|%s|%s|%s|%s|%s|%s|%s|%s',
        coalesce(p_manager_id, ''),
        coalesce(p_access_code, ''),
        coalesce(lower(trim(p_buyer)), ''),
        coalesce(lower(trim(p_seller)), ''),
        coalesce(lower(trim(p_player)), ''),
        coalesce(lower(trim(p_from_club)), ''),
        coalesce(p_overall::text, '0'),
        coalesce(p_market_value::text, '0')
      ),
      'sha256'
    ),
    'hex'
  );

  v_audit := public.app_begin_operation_audit(
    'app_create_internal_transfer_proposal',
    v_operation_key,
    p_manager_id,
    p_manager_id,
    null,
    to_jsonb(json_build_object(
      'buyer', p_buyer,
      'seller', p_seller,
      'player', p_player,
      'fromClub', p_from_club,
      'overall', p_overall,
      'marketValue', p_market_value
    )),
    v_payload_version
  );

  if coalesce(v_audit ->> 'status', '') = 'replay' then
    return coalesce(v_audit -> 'response', '{}'::jsonb)
      || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', (v_audit ->> 'auditId')::bigint);
  end if;

  if coalesce(v_audit ->> 'status', '') = 'in_progress' then
    return jsonb_build_object(
      'ok', false,
      'status', 'Rejeitado',
      'message', coalesce(v_audit ->> 'message', 'Operacao em andamento.'),
      'payloadVersion', v_payload_version,
      'operationAuditId', (v_audit ->> 'auditId')::bigint
    );
  end if;

  v_audit_id := (v_audit ->> 'auditId')::bigint;

  if to_regprocedure('public.app_create_internal_transfer_proposal_v1(text, text, text, text, text, text, integer, numeric)') is null then
    raise exception 'app_create_internal_transfer_proposal_v1 nao encontrado';
  end if;

  v_result := public.app_create_internal_transfer_proposal_v1(
    p_manager_id,
    p_access_code,
    p_buyer,
    p_seller,
    p_player,
    p_from_club,
    p_overall,
    p_market_value
  );

  v_result := coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', v_audit_id);

  v_success :=
    CASE
      WHEN v_result ? 'ok' THEN coalesce((v_result ->> 'ok')::boolean, false)
      WHEN lower(coalesce(v_result ->> 'status', '')) IN ('aprovado', 'aprovada', 'aceito', 'aceita', 'success', 'ok', 'completed') THEN true
      ELSE false
    END;

  perform public.app_finalize_operation_audit(
    v_audit_id,
    CASE WHEN v_success THEN 'completed' ELSE 'failed' END,
    v_result,
    CASE WHEN v_success THEN null ELSE coalesce(v_result ->> 'message', 'Falha ao criar proposta.') END
  );

  return v_result;
exception
  when others then
    v_result := jsonb_build_object(
      'ok', false,
      'status', 'Rejeitado',
      'message', sqlerrm,
      'payloadVersion', v_payload_version,
      'operationAuditId', v_audit_id
    );
    if v_audit_id is not null then
      perform public.app_finalize_operation_audit(v_audit_id, 'failed', v_result, sqlerrm);
    end if;
    return v_result;
end;
$$;

-- 3) Wrapper com auditoria/idempotência para resposta de proposta interna.
create or replace function public.app_answer_internal_transfer_proposal(
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
  v_audit jsonb;
  v_audit_id bigint;
  v_operation_key text;
  v_payload_version integer := 4;
  v_result jsonb;
  v_success boolean;
begin
  v_operation_key := encode(
    extensions.digest(
      format(
        'app_answer_internal_transfer_proposal|%s|%s|%s|%s|%s',
        coalesce(p_manager_id, ''),
        coalesce(p_proposal_id::text, ''),
        coalesce(lower(trim(p_decision)), ''),
        coalesce(p_counter_value::text, ''),
        coalesce(p_access_code, '')
      ),
      'sha256'
    ),
    'hex'
  );

  v_audit := public.app_begin_operation_audit(
    'app_answer_internal_transfer_proposal',
    v_operation_key,
    p_manager_id,
    p_manager_id,
    null,
    to_jsonb(json_build_object(
      'proposalId', p_proposal_id,
      'decision', p_decision,
      'counterValue', p_counter_value
    )),
    v_payload_version
  );

  if coalesce(v_audit ->> 'status', '') = 'replay' then
    return coalesce(v_audit -> 'response', '{}'::jsonb)
      || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', (v_audit ->> 'auditId')::bigint);
  end if;

  if coalesce(v_audit ->> 'status', '') = 'in_progress' then
    return jsonb_build_object(
      'ok', false,
      'status', 'Rejeitado',
      'message', coalesce(v_audit ->> 'message', 'Operacao em andamento.'),
      'payloadVersion', v_payload_version,
      'operationAuditId', (v_audit ->> 'auditId')::bigint
    );
  end if;

  v_audit_id := (v_audit ->> 'auditId')::bigint;

  if to_regprocedure('public.app_answer_internal_transfer_proposal_v1(text, text, bigint, text, numeric)') is null then
    raise exception 'app_answer_internal_transfer_proposal_v1 nao encontrado';
  end if;

  v_result := public.app_answer_internal_transfer_proposal_v1(
    p_manager_id,
    p_access_code,
    p_proposal_id,
    p_decision,
    p_counter_value
  );

  v_result := coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', v_audit_id);

  v_success :=
    CASE
      WHEN v_result ? 'ok' THEN coalesce((v_result ->> 'ok')::boolean, false)
      WHEN lower(coalesce(v_result ->> 'status', '')) IN ('accepted', 'aprovado', 'aprovada', 'rejected', 'rejeitado', 'pending', 'buyer_review', 'ok', 'success', 'completed') THEN true
      ELSE false
    END;

  perform public.app_finalize_operation_audit(
    v_audit_id,
    CASE WHEN v_success THEN 'completed' ELSE 'failed' END,
    v_result,
    CASE WHEN v_success THEN null ELSE coalesce(v_result ->> 'message', 'Falha ao responder proposta.') END
  );

  return v_result;
exception
  when others then
    v_result := jsonb_build_object(
      'ok', false,
      'status', 'Rejeitado',
      'message', sqlerrm,
      'payloadVersion', v_payload_version,
      'operationAuditId', v_audit_id
    );
    if v_audit_id is not null then
      perform public.app_finalize_operation_audit(v_audit_id, 'failed', v_result, sqlerrm);
    end if;
    return v_result;
end;
$$;

-- 4) Sobrecarga de compatibilidade do assinante.
create or replace function public.app_answer_internal_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_proposal_id bigint,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.app_answer_internal_transfer_proposal(
    p_manager_id,
    p_access_code,
    p_proposal_id,
    p_decision,
    null
  );
end;
$$;

-- 5) Ajustes de privilegios para manter o contrato das novas RPCs.
do $$
begin
  if to_regprocedure('public.app_create_internal_transfer_proposal_v1(text, text, text, text, text, text, integer, numeric)') is not null then
    revoke execute on function public.app_create_internal_transfer_proposal_v1(text, text, text, text, text, text, integer, numeric) from anon, authenticated;
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal_v1(text, text, bigint, text, numeric)') is not null then
    revoke execute on function public.app_answer_internal_transfer_proposal_v1(text, text, bigint, text, numeric) from anon, authenticated;
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal_v1(text, text, bigint, text)') is not null then
    revoke execute on function public.app_answer_internal_transfer_proposal_v1(text, text, bigint, text) from anon, authenticated;
  end if;
end;
$$;

grant execute on function public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric) to anon, authenticated;
grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text) to anon, authenticated;
grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
