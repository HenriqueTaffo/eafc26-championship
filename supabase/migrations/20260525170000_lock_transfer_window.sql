-- v84 - Clean accidental transfers and lock the transfer window - 25/05/2026.

begin;

delete from public.transfers
where id in (1, 2)
  and lower(coalesce(player_name, '')) in (
    lower('Lukas Klostermann'),
    lower('Jeremiah St. Juste')
  )
  and lower(coalesce(status, '')) = 'approved'
  and created_at >= timestamptz '2026-05-25 02:50:00+00'
  and created_at < timestamptz '2026-05-25 03:05:00+00';

do $$
declare
  v_sequence text;
begin
  if not exists (select 1 from public.transfers) then
    v_sequence := pg_get_serial_sequence('public.transfers', 'id');
    if v_sequence is not null then
      execute format('alter sequence %s restart with 1', v_sequence::regclass);
    end if;
  end if;
end;
$$;

insert into public.league_config (key, value, description, updated_at) values
  (
    'transfer_window_locked',
    'true'::jsonb,
    'Janela de transferencias fechada ate o app ser considerado pronto.',
    now()
  ),
  (
    'daily_transfer_limit',
    '0'::jsonb,
    'Limite zerado enquanto a janela de transferencias estiver fechada.',
    now()
  )
on conflict (key) do update
   set value = excluded.value,
       description = excluded.description,
       updated_at = now();

do $$
begin
  if to_regprocedure('public.app_add_transfer(text,text,text,text,text,integer,numeric)') is not null then
    revoke execute on function public.app_add_transfer(text, text, text, text, text, integer, numeric)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_add_transfer_with_trade(text,text,text,text,text,integer,numeric,text,numeric)') is not null then
    revoke execute on function public.app_add_transfer_with_trade(text, text, text, text, text, integer, numeric, text, numeric)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_create_internal_transfer_proposal(text,text,text,text,text,text,integer,numeric)') is not null then
    revoke execute on function public.app_create_internal_transfer_proposal(text, text, text, text, text, text, integer, numeric)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal(text,text,bigint,text)') is not null then
    revoke execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_answer_internal_transfer_proposal(text,text,bigint,text,numeric)') is not null then
    revoke execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text, numeric)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_record_internal_transfer(text,text,text,text,integer,numeric)') is not null then
    revoke execute on function public.app_record_internal_transfer(text, text, text, text, integer, numeric)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_upsert_transfer_sale_listing(text,text,text,numeric,text)') is not null then
    revoke execute on function public.app_upsert_transfer_sale_listing(text, text, text, numeric, text)
      from public, anon, authenticated;
  end if;

  if to_regprocedure('public.app_delete_transfer_sale_listing(text,text,uuid)') is not null then
    revoke execute on function public.app_delete_transfer_sale_listing(text, text, uuid)
      from public, anon, authenticated;
  end if;
end;
$$;

commit;
