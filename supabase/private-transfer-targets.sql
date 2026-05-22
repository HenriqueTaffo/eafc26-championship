-- Private transfer shortlist per manager. Access is only through RPCs that validate the manager PIN.
create table if not exists public.private_transfer_targets (
  id uuid primary key default gen_random_uuid(),
  manager_id text not null,
  player_name text not null,
  club text,
  max_value numeric,
  priority text not null default 'Monitorar',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists private_transfer_targets_manager_idx
  on public.private_transfer_targets (manager_id, updated_at desc);

alter table public.private_transfer_targets enable row level security;

create or replace function public.app_get_private_transfer_targets(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false or coalesce((v_login ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'player', player_name,
        'club', coalesce(club, ''),
        'value', coalesce(max_value, 0),
        'priority', priority,
        'note', coalesce(note, ''),
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by updated_at desc)
      from public.private_transfer_targets
      where manager_id = p_manager_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.app_upsert_private_transfer_target(
  p_manager_id text,
  p_access_code text,
  p_target_id text default '',
  p_player text default '',
  p_club text default '',
  p_value numeric default 0,
  p_priority text default 'Monitorar',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_id uuid;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false or coalesce((v_login ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  if coalesce(trim(p_player), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Informe o jogador.');
  end if;

  if coalesce(trim(p_target_id), '') <> '' then
    update public.private_transfer_targets
       set player_name = trim(p_player),
           club = nullif(trim(p_club), ''),
           max_value = greatest(coalesce(p_value, 0), 0),
           priority = coalesce(nullif(trim(p_priority), ''), 'Monitorar'),
           note = nullif(trim(p_note), ''),
           updated_at = now()
     where id = p_target_id::uuid
       and manager_id = p_manager_id
     returning id into v_id;
  end if;

  if v_id is null then
    insert into public.private_transfer_targets (manager_id, player_name, club, max_value, priority, note)
    values (
      p_manager_id,
      trim(p_player),
      nullif(trim(p_club), ''),
      greatest(coalesce(p_value, 0), 0),
      coalesce(nullif(trim(p_priority), ''), 'Monitorar'),
      nullif(trim(p_note), '')
    )
    returning id into v_id;
  end if;

  return public.app_get_private_transfer_targets(p_manager_id, p_access_code);
end;
$$;

create or replace function public.app_delete_private_transfer_target(
  p_manager_id text,
  p_access_code text,
  p_target_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false or coalesce((v_login ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  delete from public.private_transfer_targets
   where id = p_target_id::uuid
     and manager_id = p_manager_id;

  return public.app_get_private_transfer_targets(p_manager_id, p_access_code);
end;
$$;

grant execute on function public.app_get_private_transfer_targets(text, text) to anon, authenticated;
grant execute on function public.app_upsert_private_transfer_target(text, text, text, text, text, numeric, text, text) to anon, authenticated;
grant execute on function public.app_delete_private_transfer_target(text, text, text) to anon, authenticated;
