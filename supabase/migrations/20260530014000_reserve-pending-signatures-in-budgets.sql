-- Reserve pending external signatures in the manager budget shown to the app.
--
-- Approved transfers remain the committed spend. Signature-pending external
-- offers are exposed as reserved budget and reduce the available balance, so a
-- manager cannot appear to have unspent cash while contracts are awaiting the
-- signature deadline.
begin;

do $$
declare
  v_sql text;
  v_before text;
begin
  select pg_get_functiondef('public.app_get_budget_reconciliation()'::regprocedure)
    into v_sql;

  if v_sql not like '%pending_signature_reservations%' then
    v_before := v_sql;

    v_sql := replace(
      v_sql,
      E'  transfer_spend as (\n    select public.app_get_transfer_spend_breakdown() as totals\n  ),\n',
      E'  transfer_spend as (\n    select public.app_get_transfer_spend_breakdown() as totals\n  ),\n  pending_signature_reservations as (\n    select\n      p.buyer as manager_name,\n      coalesce(sum(greatest(\n        0::numeric,\n        greatest(100000::numeric, coalesce(p.proposed_value, p.buyer_offer_value, p.cash_offer_value, 0::numeric))\n          - coalesce(p.trade_in_credit, 0::numeric)\n      )), 0)::numeric as pending_signature_total\n    from public.internal_transfer_proposals p\n    where coalesce(p.proposal_type, '''') = ''external_market''\n      and coalesce(p.status, '''') = ''signature_pending''\n      and coalesce(p.signature_status, '''') = ''requested''\n    group by p.buyer\n  ),\n'
    );

    if v_sql = v_before then
      raise exception 'Nao foi possivel inserir reservas de assinatura pendente no reconciliador de orcamento.';
    end if;

    v_before := v_sql;

    v_sql := replace(
      v_sql,
      E'      coalesce((ts.totals -> t.manager_name ->> ''nonApprovedMarketTotal'')::numeric, 0) as non_approved_market_total,\n      greatest(0, coalesce((rb.budget ->> ''spentTotal'')::numeric, 0)) as spent_total,\n',
      E'      coalesce((ts.totals -> t.manager_name ->> ''nonApprovedMarketTotal'')::numeric, 0) as non_approved_market_total,\n      coalesce(psr.pending_signature_total, 0) as pending_signature_total,\n      greatest(0, coalesce((rb.budget ->> ''spentTotal'')::numeric, 0)) as spent_total,\n'
    );

    v_sql := replace(
      v_sql,
      E'    cross join transfer_spend ts\n    left join raw_budgets rb on rb.manager_name = t.manager_name\n',
      E'    cross join transfer_spend ts\n    left join pending_signature_reservations psr on lower(psr.manager_name) = lower(t.manager_name)\n    left join raw_budgets rb on rb.manager_name = t.manager_name\n'
    );

    v_sql := replace(
      v_sql,
      E'  final_rows as (\n    select\n      *,\n      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total as total_budget,\n      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total as remaining_budget\n    from reconciled\n  )\n',
      E'  final_rows as (\n    select\n      *,\n      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total as total_budget,\n      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total as approved_remaining_budget,\n      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total - pending_signature_total as remaining_budget\n    from reconciled\n  )\n'
    );

    v_sql := replace(
      v_sql,
      E'      ''nonApprovedMarketTotal'', non_approved_market_total,\n      ''spentTotal'', spent_total,\n      ''remainingBudget'', remaining_budget,\n',
      E'      ''nonApprovedMarketTotal'', non_approved_market_total,\n      ''pendingSignatureTotal'', pending_signature_total,\n      ''reservedBudget'', pending_signature_total,\n      ''spentTotal'', spent_total,\n      ''approvedRemainingBudget'', approved_remaining_budget,\n      ''availableBudget'', remaining_budget,\n      ''remainingBudget'', remaining_budget,\n'
    );

    v_sql := replace(
      v_sql,
      E'      ''salaryDebtAmount'', coalesce(salary_debt_amount, case when remaining_budget < 0 then abs(remaining_budget) else 0 end),\n',
      E'      ''salaryDebtAmount'', coalesce(salary_debt_amount, case when approved_remaining_budget < 0 then abs(approved_remaining_budget) else 0 end),\n'
    );

    v_sql := replace(
      v_sql,
      E'      ''marketEmbargo'', remaining_budget < 0 or salary_debt_amount is not null,\n      ''transferLimit'', case when remaining_budget < 0 or salary_debt_amount is not null then 0 else raw_transfer_limit end,\n',
      E'      ''marketEmbargo'', approved_remaining_budget < 0 or salary_debt_amount is not null,\n      ''transferLimit'', case when approved_remaining_budget < 0 or salary_debt_amount is not null then 0 else raw_transfer_limit end,\n'
    );

    if v_sql not like '%pendingSignatureTotal%' or v_sql not like '%approved_remaining_budget%' then
      raise exception 'Patch de reservas pendentes incompleto no reconciliador de orcamento.';
    end if;

    execute v_sql;
  end if;
end $$;

do $$
declare
  v_sql text;
  v_before text;
begin
  select pg_get_functiondef(
    'public.app_finalize_external_transfer_signature(bigint, boolean)'::regprocedure
  )
    into v_sql;

  if v_sql not like '%public remaining budget reserves pending signatures%' then
    v_before := v_sql;

    v_sql := replace(
      v_sql,
      E'  v_remaining := coalesce((v_budget ->> ''remainingBudget'')::numeric, 0);\n  v_total_budget := coalesce((v_budget ->> ''totalBudget'')::numeric, 22000000);\n',
      E'  v_remaining := coalesce((v_budget ->> ''remainingBudget'')::numeric, 0);\n\n  -- The public remaining budget reserves pending signatures. Add this proposal\n  -- back so finalization validates the current signature without double counting it.\n  if coalesce(v_proposal.status, '''') = ''signature_pending''\n     and coalesce(v_proposal.signature_status, '''') = ''requested'' then\n    v_remaining := v_remaining + v_signed_cash_value;\n  end if;\n\n  v_total_budget := coalesce((v_budget ->> ''totalBudget'')::numeric, 22000000);\n'
    );

    if v_sql = v_before then
      raise exception 'Nao foi possivel ajustar a finalizacao para reservas pendentes.';
    end if;

    execute v_sql;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
