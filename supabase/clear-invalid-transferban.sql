-- Limpeza pontual de transfer ban criado fora da janela comercial atual.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode o SELECT de pre-visualizacao primeiro.
-- 3. Se os eventos listados forem os transfer bans indevidos, rode o UPDATE.
-- 4. Recarregue o app.

-- Pre-visualizacao: transfer bans ativos fora dos horarios 09/12/15/18.
select
  id,
  event_date,
  slot_hour,
  manager_id,
  type,
  title,
  effect,
  transfer_modifier,
  status,
  created_at,
  updated_at
from public.events
where coalesce(transfer_modifier, 0) < 0
  and coalesce(slot_hour, -1) not in (9, 12, 15, 18)
  and lower(coalesce(status, '')) in ('active', 'ativo', 'applied', 'aplicado', 'generated', 'gerado')
order by created_at desc;

-- Limpeza: encerra apenas os transfer bans indevidos.
update public.events
   set status = 'recovered',
       transfer_modifier = 0,
       expires_at = coalesce(expires_at, now()),
       updated_at = now()
 where coalesce(transfer_modifier, 0) < 0
   and coalesce(slot_hour, -1) not in (9, 12, 15, 18)
   and lower(coalesce(status, '')) in ('active', 'ativo', 'applied', 'aplicado', 'generated', 'gerado');

-- Conferencia: deve voltar vazio.
select
  id,
  event_date,
  slot_hour,
  manager_id,
  type,
  title,
  transfer_modifier,
  status
from public.events
where coalesce(transfer_modifier, 0) < 0
  and coalesce(slot_hour, -1) not in (9, 12, 15, 18)
  and lower(coalesce(status, '')) in ('active', 'ativo', 'applied', 'aplicado', 'generated', 'gerado')
order by created_at desc;
