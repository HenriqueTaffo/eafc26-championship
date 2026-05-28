begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.app_create_manager_session(
  p_manager_name text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_manager jsonb;
  v_token text;
  v_expires_at timestamptz := now() + interval '12 hours';
  v_manager_id text;
  v_manager_name text;
  v_club_name text;
  v_is_commissioner boolean;
begin
  if coalesce(trim(p_manager_name), '') = '' or coalesce(trim(p_access_code), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Login obrigatorio.');
  end if;

  if public.app_hash_manager_session_token(p_access_code) in (
    select token_hash
    from public.app_manager_sessions
    where revoked_at is null
      and expires_at > now()
  ) then
    return jsonb_build_object('ok', false, 'message', 'Use o PIN para criar uma nova sessao.');
  end if;

  if lower(trim(p_manager_name)) like '%comiss%' then
    v_login := public.app_login_commissioner(p_manager_name, p_access_code)::jsonb;
  else
    v_login := public.app_login_manager(p_manager_name, p_access_code)::jsonb;
  end if;

  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_manager := coalesce(v_login -> 'manager', '{}'::jsonb);
  v_manager_id := coalesce(v_manager ->> 'id', '');
  v_manager_name := coalesce(v_manager ->> 'name', trim(p_manager_name));
  v_club_name := coalesce(v_manager ->> 'club', '');
  v_is_commissioner := coalesce((v_manager ->> 'isCommissioner')::boolean, false);

  if v_manager_id = '' then
    return jsonb_build_object('ok', false, 'message', 'Sessao nao pode ser criada para este login.');
  end if;

  update public.app_manager_sessions
     set revoked_at = now()
   where manager_id = v_manager_id
     and revoked_at is null
     and expires_at <= now();

  v_token := 'mml_sess_' || encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.app_manager_sessions (
    token_hash,
    manager_id,
    manager_name,
    club_name,
    is_commissioner,
    expires_at
  ) values (
    public.app_hash_manager_session_token(v_token),
    v_manager_id,
    v_manager_name,
    v_club_name,
    v_is_commissioner,
    v_expires_at
  );

  return jsonb_build_object(
    'ok', true,
    'sessionToken', v_token,
    'expiresAt', v_expires_at,
    'manager', jsonb_build_object(
      'id', v_manager_id,
      'name', v_manager_name,
      'club', v_club_name,
      'isCommissioner', v_is_commissioner
    )
  );
end;
$$;

commit;
