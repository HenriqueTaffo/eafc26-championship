-- v99 - Move external transfer response copy from hub language to office e-mail.

begin;

do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(
    'public.app_external_transfer_seller_response(numeric,numeric,integer,integer)'::regprocedure
  )
    into v_sql;

  if v_sql is null then
    raise exception 'app_external_transfer_seller_response function not found';
  end if;

  v_sql := replace(
    v_sql,
    'Clube vendedor respondeu com contraoferta. Revise no hub antes de confirmar.',
    'Clube vendedor respondeu com contraproposta. Revise este e-mail antes de assinar.'
  );

  execute v_sql;
end $$;

update public.internal_transfer_proposals
   set response_message = replace(
         replace(
           response_message,
           'contraoferta',
           'contraproposta'
         ),
         'Revise no hub antes de confirmar.',
         'Revise este e-mail antes de assinar.'
       )
 where proposal_type = 'external_market'
   and (
     response_message like '%Revise no hub antes de confirmar.%'
     or response_message like '%contraoferta%'
   );

notify pgrst, 'reload schema';

commit;
