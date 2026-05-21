-- Ajuste pontual de eventos: janela comercial e mutirao do DM.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro uma vez.
-- 3. Recarregue o app.
--
-- O que faz:
-- - Limita os eventos automaticos aos horarios 09:00, 12:00, 15:00 e 18:00.
-- - Recupera apenas as lesoes/eventos ativos atuais com jogador afetado.
-- - Registra um evento surpresa de hoje para explicar a recuperacao coletiva.

update public.league_config
   set value = '[9, 12, 15, 18]'::jsonb,
       description = 'Horarios dos eventos automaticos em horario comercial.',
       updated_at = now()
 where key = 'event_slots';

insert into public.league_config (key, value, description, updated_at)
select
  'event_slots',
  '[9, 12, 15, 18]'::jsonb,
  'Horarios dos eventos automaticos em horario comercial.',
  now()
where not exists (
  select 1
  from public.league_config
  where key = 'event_slots'
);

update public.events
   set status = 'recovered',
       matches_remaining = 0,
       expires_at = coalesce(expires_at, now()),
       updated_at = now()
 where status = 'active'
   and nullif(trim(coalesce(affected_player, '')), '') is not null;

insert into public.events (
  event_date,
  slot_hour,
  manager_id,
  club_id,
  type,
  title,
  description,
  effect,
  financial_impact,
  transfer_modifier,
  affected_player,
  duration_type,
  duration_value,
  matches_remaining,
  expires_at,
  status,
  unique_key,
  created_at,
  updated_at
)
select
  current_date,
  null,
  m.id,
  null,
  'Evento surpresa',
  'Mutirao do DM',
  'A liga abriu uma janela emergencial de recuperacao e liberou os jogadores que estavam no departamento medico.',
  'Todas as lesoes ativas foram encerradas hoje.',
  0,
  0,
  null,
  null,
  null,
  null,
  null,
  'applied',
  current_date::text || '|injury-reset|' || m.id,
  now(),
  now()
from public.managers m
where exists (
  select 1
  from public.events e
  where e.manager_id = m.id
    and e.status = 'recovered'
    and nullif(trim(coalesce(e.affected_player, '')), '') is not null
    and e.updated_at >= now() - interval '5 minutes'
)
and not exists (
  select 1
  from public.events existing
  where existing.unique_key = current_date::text || '|injury-reset|' || m.id
);
