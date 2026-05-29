-- Adds a commissioner-approved one-off budget bonus to every manager except Henrique.
begin;

with target_managers(manager_name, manager_id) as (
  values
    ('Bruno Silva', 'bruno-silva'),
    ('Rafael', 'rafael'),
    ('Renato', 'renato'),
    ('Willian', 'willian')
)
select public.app_insert_financial_event(
  tm.manager_name,
  'Ajuste de orcamento do comissario',
  'Credito extraordinario solicitado pelo comissario para ajuste pontual do saldo dos demais tecnicos.',
  '+5.000.000 no orcamento de mercado.',
  'budget_adjustment',
  5000000
)
from target_managers tm
where not exists (
  select 1
  from public.events e
  where e.manager_id = tm.manager_id
    and e.type = 'budget_adjustment'
    and e.financial_impact = 5000000
    and e.title = 'Ajuste de orcamento do comissario'
    and e.status in ('active', 'applied', 'generated')
);

notify pgrst, 'reload schema';

commit;
