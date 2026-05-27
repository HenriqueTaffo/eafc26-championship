-- v107 - Commissioner operation audit dashboard.
-- Read-only RPC for recent critical operations, replay/in-progress state and
-- reconciliation visibility without exposing raw request payloads to the UI.

begin;

create or replace function public.app_get_operation_audit_dashboard(
  p_manager_id text,
  p_access_code text,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_limit integer := greatest(5, least(coalesce(p_limit, 30), 100));
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object(
      'ok', false,
      'message', 'Apenas o Comissario da Liga pode abrir a auditoria operacional.',
      'summary', jsonb_build_object(),
      'recent', '[]'::jsonb
    );
  end if;

  return (
    with base as (
      select *
      from public.backend_operation_audits
      where created_at >= now() - interval '14 days'
    ),
    recent as (
      select
        id,
        operation_name,
        status,
        actor_manager_name,
        actor_club,
        payload_version,
        created_at,
        updated_at,
        finished_at,
        last_error,
        request_hash
      from public.backend_operation_audits
      order by created_at desc, id desc
      limit v_limit
    )
    select jsonb_build_object(
      'ok', true,
      'generatedAt', now(),
      'summary', jsonb_build_object(
        'total14d', coalesce((select count(*) from base), 0),
        'completed14d', coalesce((select count(*) from base where status = 'completed'), 0),
        'failed14d', coalesce((select count(*) from base where status = 'failed'), 0),
        'running14d', coalesce((select count(*) from base where status = 'running'), 0),
        'replayed14d', coalesce((select count(*) from base where response_payload is not null and finished_at >= now() - interval '10 minutes'), 0),
        'lastFailureAt', (select max(finished_at) from base where status = 'failed'),
        'lastOperationAt', (select max(created_at) from base)
      ),
      'byOperation', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'operation', operation_name,
              'total', total_count,
              'failed', failed_count,
              'running', running_count
            )
            order by failed_count desc, total_count desc, operation_name
          )
          from (
            select
              operation_name,
              count(*) as total_count,
              count(*) filter (where status = 'failed') as failed_count,
              count(*) filter (where status = 'running') as running_count
            from base
            group by operation_name
          ) grouped
        ),
        '[]'::jsonb
      ),
      'recent', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', id,
              'operation', operation_name,
              'status', status,
              'actor', coalesce(actor_manager_name, ''),
              'club', coalesce(actor_club, ''),
              'payloadVersion', payload_version,
              'createdAt', created_at,
              'updatedAt', updated_at,
              'finishedAt', finished_at,
              'error', coalesce(last_error, ''),
              'requestHash', coalesce(request_hash, '')
            )
            order by created_at desc, id desc
          )
          from recent
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

grant execute on function public.app_get_operation_audit_dashboard(text, text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
