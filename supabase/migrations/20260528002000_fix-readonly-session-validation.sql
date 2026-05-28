begin;

create or replace function public.app_validate_manager_session_token(
  p_manager_id text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.app_manager_sessions%rowtype;
  v_is_read_only boolean := coalesce(current_setting('transaction_read_only', true), 'off') = 'on';
begin
  if coalesce(trim(p_manager_id), '') = '' or coalesce(trim(p_session_token), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Sessao obrigatoria.');
  end if;

  select *
    into v_session
  from public.app_manager_sessions
  where token_hash = public.app_hash_manager_session_token(p_session_token)
    and manager_id = p_manager_id
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Sessao expirada. Faca login novamente.');
  end if;

  if not v_is_read_only then
    update public.app_manager_sessions
       set last_seen_at = now()
     where id = v_session.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'managerId', v_session.manager_id,
    'managerName', v_session.manager_name,
    'clubName', v_session.club_name,
    'isCommissioner', v_session.is_commissioner,
    'expiresAt', v_session.expires_at
  );
end;
$$;

commit;
