-- v103 - Backend: lock/idempotência + trilha de auditoria em RPCs críticas (resultados, transferências, patrocínio)

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.backend_operation_audits (
  id bigserial primary key,
  operation_name text not null,
  operation_key text not null,
  actor_manager_id text,
  actor_manager_name text,
  actor_club text,
  payload_version integer not null default 1,
  request_payload jsonb not null default '{}'::jsonb,
  request_hash text,
  response_payload jsonb,
  status text not null default 'running',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  last_error text
);

create unique index if not exists ux_backend_operation_audits_key on public.backend_operation_audits (operation_name, operation_key);
create index if not exists ix_backend_operation_audits_created on public.backend_operation_audits (created_at desc);

create or replace function public.app_begin_operation_audit(
  p_operation_name text,
  p_operation_key text,
  p_actor_manager_id text,
  p_actor_manager_name text,
  p_actor_club text,
  p_request_payload jsonb default '{}'::jsonb,
  p_payload_version integer default 1,
  p_replay_ttl_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint;
  v_existing public.backend_operation_audits%rowtype;
  v_audit_id bigint;
  v_hash text;
  v_ttl interval;
begin
  v_lock_key := hashtext(format('op-audit|%s|%s|%s', coalesce(p_operation_name, ''), coalesce(p_operation_key, ''), coalesce(p_actor_manager_id, '')));
  perform pg_advisory_xact_lock(v_lock_key);

  v_hash := encode(extensions.digest(coalesce(p_request_payload::text, ''), 'sha256'), 'hex');
  v_ttl := make_interval(secs => greatest(coalesce(p_replay_ttl_seconds, 600), 30));

  select * into v_existing
    from public.backend_operation_audits
    where operation_name = p_operation_name
      and operation_key = p_operation_key
    limit 1
    for update;

  if v_existing.id is not null then
    if v_existing.finished_at is null then
      return jsonb_build_object(
        'status', 'in_progress',
        'auditId', v_existing.id,
        'message', 'Operacao em andamento. Aguarde finalizacao e tente novamente.'
      );
    end if;

    if v_existing.finished_at >= now() - v_ttl and v_existing.response_payload is not null then
      return jsonb_build_object(
        'status', 'replay',
        'auditId', v_existing.id,
        'response', v_existing.response_payload
      );
    end if;

    update public.backend_operation_audits
      set status = 'running',
          actor_manager_name = coalesce(nullif(trim(p_actor_manager_name), ''), actor_manager_name),
          actor_club = coalesce(nullif(trim(p_actor_club), ''), actor_club),
          request_payload = coalesce(p_request_payload, '{}'::jsonb),
          request_hash = v_hash,
          payload_version = coalesce(p_payload_version, 1),
          response_payload = null,
          last_error = null,
          updated_at = now(),
          finished_at = null
      where id = v_existing.id
      returning id into v_audit_id;

    return jsonb_build_object('status', 'run', 'auditId', v_audit_id);
  end if;

  insert into public.backend_operation_audits (
    operation_name,
    operation_key,
    actor_manager_id,
    actor_manager_name,
    actor_club,
    payload_version,
    request_payload,
    request_hash,
    status
  )
  values (
    p_operation_name,
    p_operation_key,
    nullif(trim(p_actor_manager_id), ''),
    nullif(trim(p_actor_manager_name), ''),
    nullif(trim(p_actor_club), ''),
    coalesce(p_payload_version, 1),
    coalesce(p_request_payload, '{}'::jsonb),
    v_hash,
    'running'
  )
  returning id into v_audit_id;

  return jsonb_build_object('status', 'run', 'auditId', v_audit_id);
end;
$$;

create or replace function public.app_finalize_operation_audit(
  p_audit_id bigint,
  p_status text,
  p_response jsonb,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.backend_operation_audits
     set status = coalesce(p_status, 'completed'),
         response_payload = coalesce(p_response, '{}'::jsonb),
         last_error = p_error,
         updated_at = now(),
         finished_at = now()
   where id = p_audit_id;
end;
$$;

do $$
begin
  if to_regprocedure('public.app_add_result_v1(text, text, text, integer, text, text, text, integer, integer, text, text, text, text)') is null
     and to_regprocedure('public.app_add_result(text, text, text, integer, text, text, text, integer, integer, text, text, text, text)') is not null then
    execute
      'alter function public.app_add_result(text, text, text, integer, text, text, text, integer, integer, text, text, text, text) rename to app_add_result_v1';
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.app_accept_sponsorship_v1(text, text, text)') is null
     and to_regprocedure('public.app_accept_sponsorship(text, text, text)') is not null then
    execute 'alter function public.app_accept_sponsorship(text, text, text) rename to app_accept_sponsorship_v1';
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.app_create_external_transfer_proposal_v1(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric)') is null
     and to_regprocedure('public.app_create_external_transfer_proposal(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric)') is not null then
    execute 'alter function public.app_create_external_transfer_proposal(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric) rename to app_create_external_transfer_proposal_v1';
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.app_answer_external_transfer_proposal_v1(text, text, bigint, text, numeric)') is null
     and to_regprocedure('public.app_answer_external_transfer_proposal(text, text, bigint, text, numeric)') is not null then
    execute 'alter function public.app_answer_external_transfer_proposal(text, text, bigint, text, numeric) rename to app_answer_external_transfer_proposal_v1';
  end if;
end;
$$;

create or replace function public.app_add_result(
  p_manager_id text,
  p_access_code text,
  p_competition text,
  p_week integer,
  p_phase text,
  p_home text,
  p_away text,
  p_home_score integer,
  p_away_score integer,
  p_goal_details text default '',
  p_assist_details text default '',
  p_penalty_winner text default '',
  p_penalty_score text default '',
  p_submitted_by text default ''
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
  v_payload_version integer := 3;
  v_result jsonb;
  v_success boolean;
begin
  v_operation_key := encode(
    extensions.digest(
      format(
        'app_add_result|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
        coalesce(p_manager_id, ''),
        coalesce(p_access_code, ''),
        coalesce(lower(p_competition), ''),
        coalesce(p_week::text, ''),
        coalesce(lower(p_phase), ''),
        coalesce(lower(p_home), ''),
        coalesce(lower(p_away), ''),
        coalesce(p_home_score::text, ''),
        coalesce(p_away_score::text, ''),
        coalesce(lower(p_goal_details), ''),
        coalesce(lower(p_assist_details), '')
      ),
      'sha256'
    ),
    'hex'
  );

  v_audit := public.app_begin_operation_audit(
    'app_add_result',
    v_operation_key,
    p_manager_id,
    p_manager_id,
    null,
    to_jsonb(json_build_object(
      'competition', p_competition,
      'week', p_week,
      'phase', p_phase,
      'home', p_home,
      'away', p_away,
      'homeScore', p_home_score,
      'awayScore', p_away_score
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

  v_result := public.app_add_result_v1(
    p_manager_id,
    p_access_code,
    p_competition,
    p_week,
    p_phase,
    p_home,
    p_away,
    p_home_score,
    p_away_score,
    p_goal_details,
    p_assist_details,
    p_penalty_winner,
    p_penalty_score,
    p_submitted_by
  );

  v_result := coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', v_audit_id);

  v_success :=
    CASE
      WHEN v_result ? 'ok' THEN coalesce((v_result ->> 'ok')::boolean, false)
      WHEN lower(coalesce(v_result ->> 'status', '')) IN ('aprovado', 'aprovada', 'aprovado', 'success', 'ok', 'completed') THEN true
      ELSE false
    END;

  perform public.app_finalize_operation_audit(
    v_audit_id,
    CASE WHEN v_success THEN 'completed' ELSE 'failed' END,
    v_result,
    CASE WHEN v_success THEN null ELSE coalesce(v_result ->> 'message', 'Resultado rejeitado') END
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
  v_audit jsonb;
  v_audit_id bigint;
  v_operation_key text;
  v_payload_version integer := 3;
  v_result jsonb;
  v_success boolean;
begin
  v_operation_key := encode(
    extensions.digest(
      format('app_accept_sponsorship|%s|%s', coalesce(p_manager_id, ''), coalesce(p_offer_id, '')),
      'sha256'
    ),
    'hex'
  );

  v_audit := public.app_begin_operation_audit(
    'app_accept_sponsorship',
    v_operation_key,
    p_manager_id,
    p_manager_id,
    null,
    to_jsonb(json_build_object('offerId', p_offer_id)),
    v_payload_version
  );

  if coalesce(v_audit ->> 'status', '') = 'replay' then
    return coalesce(v_audit -> 'response', '{}'::jsonb)
      || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', (v_audit ->> 'auditId')::bigint);
  end if;

  if coalesce(v_audit ->> 'status', '') = 'in_progress' then
    return jsonb_build_object(
      'ok', false,
      'message', coalesce(v_audit ->> 'message', 'Operacao em andamento.'),
      'payloadVersion', v_payload_version,
      'operationAuditId', (v_audit ->> 'auditId')::bigint
    );
  end if;

  v_audit_id := (v_audit ->> 'auditId')::bigint;

  v_result := public.app_accept_sponsorship_v1(p_manager_id, p_access_code, p_offer_id);
  v_result := coalesce(v_result, '{}'::jsonb) || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', v_audit_id);

  v_success :=
    CASE
      WHEN v_result ? 'ok' THEN coalesce((v_result ->> 'ok')::boolean, false)
      WHEN lower(coalesce(v_result ->> 'status', '')) IN ('aprovado', 'aprovada', 'aprovado', 'success', 'ok', 'completed') THEN true
      ELSE false
    END;

  perform public.app_finalize_operation_audit(
    v_audit_id,
    CASE WHEN v_success THEN 'completed' ELSE 'failed' END,
    v_result,
    CASE WHEN v_success THEN null ELSE coalesce(v_result ->> 'message', 'Assinatura rejeitada') END
  );

  return v_result;
exception
  when others then
    v_result := jsonb_build_object(
      'ok', false,
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

create or replace function public.app_create_external_transfer_proposal(
  p_manager_id text,
  p_access_code text,
  p_buyer text,
  p_player text,
  p_from_club text,
  p_overall integer,
  p_reference_value numeric,
  p_offer_value numeric,
  p_weekly_salary_eur numeric,
  p_salary_source_name text,
  p_salary_source_url text,
  p_trade_in_player text default '',
  p_trade_in_credit numeric default 0
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
  v_payload_version integer := 3;
  v_result jsonb;
  v_success boolean;
begin
  v_operation_key := encode(
    extensions.digest(
      format(
        'app_create_external_transfer_proposal|%s|%s|%s|%s|%s|%s|%s|%s',
        coalesce(p_manager_id, ''),
        coalesce(lower(trim(p_buyer)), ''),
        coalesce(lower(trim(p_player)), ''),
        coalesce(lower(trim(p_from_club)), ''),
        coalesce(p_overall::text, '0'),
        coalesce(p_reference_value::text, '0'),
        coalesce(p_offer_value::text, '0'),
        coalesce(p_trade_in_player, '')
      ),
      'sha256'
    ),
    'hex'
  );

  v_audit := public.app_begin_operation_audit(
    'app_create_external_transfer_proposal',
    v_operation_key,
    p_manager_id,
    p_manager_id,
    null,
    to_jsonb(json_build_object(
      'buyer', p_buyer,
      'player', p_player,
      'fromClub', p_from_club,
      'overall', p_overall,
      'referenceValue', p_reference_value,
      'offerValue', p_offer_value
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

  v_result := public.app_create_external_transfer_proposal_v1(
    p_manager_id,
    p_access_code,
    p_buyer,
    p_player,
    p_from_club,
    p_overall,
    p_reference_value,
    p_offer_value,
    p_weekly_salary_eur,
    p_salary_source_name,
    p_salary_source_url,
    p_trade_in_player,
    p_trade_in_credit
  );

  v_result := coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object('payloadVersion', v_payload_version, 'operationAuditId', v_audit_id);

  v_success :=
    CASE
      WHEN v_result ? 'ok' THEN coalesce((v_result ->> 'ok')::boolean, false)
      WHEN lower(coalesce(v_result ->> 'status', '')) IN ('ok', 'aprovado', 'aprovada', 'aceito', 'aceita', 'aceito com sucesso', 'success', 'completed') THEN true
      ELSE false
    END;

  perform public.app_finalize_operation_audit(
    v_audit_id,
    CASE WHEN v_success THEN 'completed' ELSE 'failed' END,
    v_result,
    CASE WHEN v_success THEN null ELSE coalesce(v_result ->> 'message', 'Proposta rejeitada') END
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
  v_audit jsonb;
  v_audit_id bigint;
  v_operation_key text;
  v_payload_version integer := 3;
  v_result jsonb;
  v_success boolean;
begin
  v_operation_key := encode(
    extensions.digest(
      format(
        'app_answer_external_transfer_proposal|%s|%s|%s|%s',
        coalesce(p_manager_id, ''),
        coalesce(p_proposal_id::text, ''),
        coalesce(lower(trim(p_decision)), ''),
        coalesce(p_counter_value::text, '')
      ),
      'sha256'
    ),
    'hex'
  );

  v_audit := public.app_begin_operation_audit(
    'app_answer_external_transfer_proposal',
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

  v_result := public.app_answer_external_transfer_proposal_v1(
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
      WHEN lower(coalesce(v_result ->> 'status', '')) IN ('aceito', 'aceita', 'aceito com sucesso', 'accepted', 'success', 'ok', 'completed') THEN true
      ELSE false
    END;

  perform public.app_finalize_operation_audit(
    v_audit_id,
    CASE WHEN v_success THEN 'completed' ELSE 'failed' END,
    v_result,
    CASE WHEN v_success THEN null ELSE coalesce(v_result ->> 'message', 'Decisão não aplicada') END
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

do $$
begin
  if to_regprocedure('public.app_add_result_v1(text, text, text, integer, text, text, text, integer, integer, text, text, text, text)') is not null then
    revoke execute on function public.app_add_result_v1(text, text, text, integer, text, text, text, integer, integer, text, text, text, text) from anon, authenticated;
  end if;

  if to_regprocedure('public.app_accept_sponsorship_v1(text, text, text)') is not null then
    revoke execute on function public.app_accept_sponsorship_v1(text, text, text) from anon, authenticated;
  end if;

  if to_regprocedure('public.app_create_external_transfer_proposal_v1(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric)') is not null then
    revoke execute on function public.app_create_external_transfer_proposal_v1(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric) from anon, authenticated;
  end if;

  if to_regprocedure('public.app_answer_external_transfer_proposal_v1(text, text, bigint, text, numeric)') is not null then
    revoke execute on function public.app_answer_external_transfer_proposal_v1(text, text, bigint, text, numeric) from anon, authenticated;
  end if;
end;
$$;

grant execute on function public.app_begin_operation_audit(text, text, text, text, text, jsonb, integer, integer) to anon, authenticated;
grant execute on function public.app_finalize_operation_audit(bigint, text, jsonb, text) to anon, authenticated;
grant execute on function public.app_add_result(text, text, text, integer, text, text, text, integer, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.app_accept_sponsorship(text, text, text) to anon, authenticated;
grant execute on function public.app_create_external_transfer_proposal(text, text, text, text, text, integer, numeric, numeric, numeric, text, text, text, numeric) to anon, authenticated;
grant execute on function public.app_answer_external_transfer_proposal(text, text, bigint, text, numeric) to anon, authenticated;

commit;
