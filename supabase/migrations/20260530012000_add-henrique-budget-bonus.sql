-- Adds a commissioner-approved one-off budget bonus only to Henrique.
begin;

select public.app_insert_financial_event(
  'Henrique',
  'Ajuste de orcamento do comissario',
  'Credito extraordinario solicitado pelo tecnico para ajuste pontual do saldo.',
  '+8.000.000 no orcamento de mercado de Henrique.',
  'budget_adjustment',
  8000000
)
where not exists (
  select 1
  from public.events e
  where e.manager_id = 'henrique'
    and e.type = 'budget_adjustment'
    and e.financial_impact = 8000000
    and e.title = 'Ajuste de orcamento do comissario'
    and e.status in ('active', 'applied', 'generated')
);

notify pgrst, 'reload schema';

commit;
