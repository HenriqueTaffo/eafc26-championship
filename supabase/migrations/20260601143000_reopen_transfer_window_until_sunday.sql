-- Reopen the transfer window until Sunday 2026-06-07 23:59 BRT.

begin;

insert into public.league_config (key, value, description, updated_at) values
  (
    'transfer_window_locked',
    'false'::jsonb,
    'Janela de transferencias reaberta ate domingo, 07/06/2026 23:59 BRT.',
    now()
  ),
  (
    'transfer_window_open_until',
    '"2026-06-08T02:59:59Z"'::jsonb,
    'Encerramento automatico da janela de transferencias em domingo, 07/06/2026 23:59 BRT.',
    now()
  ),
  (
    'daily_transfer_limit',
    '3'::jsonb,
    'Limite diario ativo enquanto a janela de transferencias estiver aberta ate 07/06/2026.',
    now()
  )
on conflict (key) do update
   set value = excluded.value,
       description = excluded.description,
       updated_at = now();

commit;
