-- Finalizacao de assinatura nao deve consumir/revalidar limite diario.
--
-- O limite diario ja e validado quando o comprador aceita a base comercial e
-- a proposta entra em signature_pending. Revalidar no processamento automatico
-- derruba contratos que ficaram aguardando o prazo da assinatura.

begin;

do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(
    'public.app_finalize_external_transfer_signature(bigint, boolean)'::regprocedure
  )
    into v_sql;

  v_sql := replace(
    v_sql,
    E'  v_transfer_limit integer := 0;\n  v_transfers_today integer := 0;\n',
    ''
  );

  v_sql := replace(
    v_sql,
    E'  v_transfer_limit := coalesce((v_budget ->> ''transferLimit'')::integer, 3);\n',
    ''
  );

  v_sql := replace(
    v_sql,
    E'  v_transfers_today := public.app_get_external_transfer_today_count(v_proposal.buyer);\n',
    ''
  );

  v_sql := replace(
    v_sql,
    E'  elsif v_transfer_limit <= 0 then\n    v_failed_reason := format(''Transferencias externas bloqueadas hoje para %s.'', v_proposal.buyer);\n  elsif v_transfers_today >= v_transfer_limit then\n    v_failed_reason := format(''%s ja atingiu o limite diario.'', v_proposal.buyer);\n',
    ''
  );

  if v_sql like '%v_transfer_limit%' or v_sql like '%v_transfers_today%' then
    raise exception 'Nao foi possivel remover a validacao de limite diario da finalizacao de assinatura.';
  end if;

  execute v_sql;
end $$;

update public.internal_transfer_proposals
   set status = 'signature_pending',
       signature_status = 'requested',
       signature_message = null,
       response_message = 'Assinatura reprocessada: limite diario ja havia sido validado antes da etapa de assinatura.'
 where id in (23, 24)
   and buyer = 'Rafael'
   and lower(player) in ('dante', 'advincula')
   and proposal_type = 'external_market'
   and status = 'rejected'
   and signature_status = 'failed'
   and lower(coalesce(response_message, '')) like '%limite diario%';

select public.app_finalize_external_transfer_signature(id, true)
  from public.internal_transfer_proposals
 where id in (23, 24)
   and buyer = 'Rafael'
   and lower(player) in ('dante', 'advincula')
   and proposal_type = 'external_market'
   and status = 'signature_pending';

notify pgrst, 'reload schema';

commit;
