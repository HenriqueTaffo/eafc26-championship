-- Correcao dos horarios validos de eventos automaticos.
--
-- Rode este arquivo se os horarios da tela ja aparecem como 09/12/15/18,
-- mas o gerador nao cria eventos no slot das 18h.

update public.league_config
   set value = '[9, 12, 15, 18]'::jsonb,
       description = 'Horarios dos eventos automaticos em horario comercial.',
       updated_at = now()
 where key = 'event_slots';

alter table public.events
  drop constraint if exists events_slot_check;

alter table public.events
  add constraint events_slot_check
  check (slot_hour is null or slot_hour in (9, 12, 15, 18))
  not valid;
