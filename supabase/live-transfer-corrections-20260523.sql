-- Correcoes pontuais de mercado - 23/05/2026.
-- 1) Garante que desfazer transferencia atualize as colunas novas e legadas.
-- 2) Corrige Theo Hernandez: OVR 84, taxa 15%, custo final 32.200.000.

create or replace function public.app_reverse_transfer(
  p_manager_id text,
  p_access_code text,
  p_transfer_id bigint default null,
  p_buyer text default '',
  p_player text default '',
  p_from_club text default '',
  p_timestamp text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_rows integer := 0;
  v_actor text;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_login ->> 'ok')::boolean, false) is false
    or coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o Comissario da Liga pode desfazer transferencias.');
  end if;

  v_actor := coalesce(v_login ->> 'managerName', 'Comissario da Liga');

  update public.transfers
     set status = 'reversed',
         "Status" = 'desfeito',
         "RevertidaEm" = now(),
         "RevertidaPor" = v_actor,
         updated_at = now()
   where (
       (coalesce(p_transfer_id, 0) > 0 and id = p_transfer_id)
       or (
         lower(coalesce("Comprador", '')) = lower(coalesce(p_buyer, ''))
         and lower(coalesce("Jogador", '')) = lower(coalesce(p_player, ''))
         and (
           coalesce(p_from_club, '') = ''
           or lower(coalesce("ClubeOrigem", '')) = lower(coalesce(p_from_club, ''))
           or lower(coalesce(from_club, '')) = lower(coalesce(p_from_club, ''))
         )
         and (
           coalesce(p_timestamp, '') = ''
           or coalesce("Timestamp"::text, '') = p_timestamp
           or coalesce(created_at::text, '') = p_timestamp
         )
       )
     )
     and lower(coalesce(status, "Status", '')) in ('approved', 'aprovado');

  get diagnostics v_rows = row_count;

  if v_rows = 0 and coalesce(p_buyer, '') <> '' and coalesce(p_player, '') <> '' then
    update public.transfers
       set status = 'reversed',
           "Status" = 'desfeito',
           "RevertidaEm" = now(),
           "RevertidaPor" = v_actor,
           updated_at = now()
     where id = (
       select id
         from public.transfers
        where lower(coalesce("Comprador", '')) = lower(coalesce(p_buyer, ''))
          and lower(coalesce("Jogador", '')) = lower(coalesce(p_player, ''))
          and lower(coalesce(status, "Status", '')) in ('approved', 'aprovado')
        order by created_at desc nulls last, "Timestamp" desc nulls last
        limit 1
     );

    get diagnostics v_rows = row_count;
  end if;

  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'message', 'Transferencia aprovada nao encontrada para desfazer.');
  end if;

  delete from public.events
   where lower(coalesce(title, '')) in (
       lower('Compra interna: ' || coalesce(p_player, '')),
       lower('Venda interna: ' || coalesce(p_player, ''))
     )
     and coalesce(status, '') in ('applied', 'aplicado', 'ativo', 'gerado');

  return jsonb_build_object(
    'ok', true,
    'message', 'Transferencia desfeita. O jogador foi liberado e o orcamento sera recalculado.',
    'rowsUpdated', v_rows
  );
end;
$$;

grant execute on function public.app_reverse_transfer(text, text, bigint, text, text, text, text) to anon, authenticated;

update public.transfers
   set overall = 84,
       "Overall" = 84,
       overall_rate = 0.15,
       final_value = 32200000,
       "ValorFinal" = 32200000,
       updated_at = now()
 where id = 73
   and lower(coalesce("Comprador", '')) = lower('Bruno Silva')
   and lower(coalesce("Jogador", '')) = lower('Theo Hernández');

select
  id,
  "Comprador",
  "Jogador",
  overall,
  "Overall",
  market_value,
  "ValorTransfermarkt",
  overall_rate,
  final_value,
  "ValorFinal",
  status,
  "Status"
from public.transfers
where id = 73;

select public.app_get_budget_reconciliation() -> 'Rafael' as rafael_budget;
select public.app_get_budget_reconciliation() -> 'Bruno Silva' as bruno_silva_budget;
