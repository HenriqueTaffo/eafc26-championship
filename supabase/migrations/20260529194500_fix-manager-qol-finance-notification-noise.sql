begin;

delete from public.manager_notifications
where unique_key like 'finance-risk-%';

create or replace function public.app_generate_manager_notifications(
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
  v_forecast jsonb;
  v_row jsonb;
  v_risk text;
  v_targets_count integer := 0;
begin
  v_session := public.app_validate_manager_session(p_manager_id, p_access_code);
  if coalesce((v_session ->> 'ok')::boolean, false) is false then
    return v_session;
  end if;

  v_manager_name := v_session ->> 'managerName';
  v_forecast := public.app_get_manager_finance_forecast();

  select item
    into v_row
  from jsonb_array_elements(v_forecast) as item
  where lower(item ->> 'manager_name') = lower(v_manager_name)
  limit 1;

  delete from public.manager_notifications
  where manager_id = p_manager_id
    and unique_key like 'finance-risk-%';

  v_risk := coalesce(v_row ->> 'risk', '');

  if v_row is null or lower(v_risk) in ('saudavel', 'saudável') then
    delete from public.manager_notifications
    where manager_id = p_manager_id
      and unique_key = 'finance-risk';
  else
    insert into public.manager_notifications (
      manager_id,
      manager_name,
      title,
      body,
      tone,
      unique_key
    )
    values (
      p_manager_id,
      v_manager_name,
      'Atenção financeira',
      'Risco atual: ' || v_risk || '. Folha semanal: ' || coalesce(v_row ->> 'payroll_weekly', '0') || '.',
      case
        when lower(v_risk) in ('critico', 'crítico') then 'critical'
        else 'warn'
      end,
      'finance-risk'
    )
    on conflict (manager_id, unique_key) do update
      set manager_name = excluded.manager_name,
          title = excluded.title,
          body = excluded.body,
          tone = excluded.tone,
          is_read = case
            when public.manager_notifications.title is distinct from excluded.title
              or public.manager_notifications.body is distinct from excluded.body
              or public.manager_notifications.tone is distinct from excluded.tone
            then false
            else public.manager_notifications.is_read
          end,
          created_at = case
            when public.manager_notifications.title is distinct from excluded.title
              or public.manager_notifications.body is distinct from excluded.body
              or public.manager_notifications.tone is distinct from excluded.tone
            then now()
            else public.manager_notifications.created_at
          end;
  end if;

  select count(*)::integer
    into v_targets_count
  from public.private_transfer_targets
  where manager_id = p_manager_id;

  if v_targets_count >= 3 then
    insert into public.manager_notifications (
      manager_id,
      manager_name,
      title,
      body,
      tone,
      unique_key
    )
    values (
      p_manager_id,
      v_manager_name,
      'Shortlist carregada',
      v_targets_count::text || ' alvo(s) privados no radar. Revise prioridade antes do deadline.',
      'info',
      'targets-' || current_date::text
    )
    on conflict (manager_id, unique_key) do nothing;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

notify pgrst, 'reload schema';

commit;
