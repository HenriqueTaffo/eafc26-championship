begin;

create or replace function public.app_get_my_sponsorships(
  p_manager_id text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_active jsonb;
  v_rewards jsonb;
  v_offers jsonb;
  v_active_count integer := 0;
  v_max_active integer := 3;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object(
      'active', '[]'::jsonb,
      'offers', '[]'::jsonb,
      'recentRewards', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
    into v_active
  from (
    select
      c.*,
      public.app_sponsorship_termination_fee(c.signing_bonus, c.reward_value, c.max_claims, c.claims_used) as termination_fee,
      coalesce(o.offer ->> 'conditionLabel',
        case c.condition_type
          when 'win_by_2' then 'Vencer por 2+ gols'
          when 'any_win' then 'Vencer qualquer partida'
          when 'home_win' then 'Vencer como mandante'
          when 'clean_sheet' then 'Nao sofrer gols'
          when 'three_goals' then 'Marcar 3+ gols'
          when 'away_win' then 'Vencer como visitante'
          when 'weekly_payment' then 'Pagamento semanal fixo'
          when 'monthly_payment' then 'Pagamento mensal fixo'
          else 'Meta comercial cumprida'
        end
      ) as condition_label,
      coalesce(o.offer ->> 'riskLevel', 'Contrato ativo') as risk_level,
      coalesce(o.offer ->> 'dealStyle', 'Marca parceira') as deal_style,
      coalesce(o.offer ->> 'paymentCadence',
        case
          when c.condition_type = 'weekly_payment' then 'weekly'
          when c.condition_type = 'monthly_payment' then 'monthly'
          else 'goal'
        end
      ) as payment_cadence,
      coalesce(rr.paid_total, 0) as paid_total,
      rr.last_reward_at,
      rr.last_installment_at,
      rr.signing_paid_at,
      case
        when c.condition_type = 'weekly_payment' and c.claims_used < c.max_claims
          then coalesce(c.payout_start_at, c.created_at + interval '7 days') + (c.claims_used * interval '7 days')
        when c.condition_type = 'monthly_payment' and c.claims_used < c.max_claims
          then coalesce(c.payout_start_at, c.created_at + interval '30 days') + (c.claims_used * interval '30 days')
        else null
      end as next_payment_at,
      c.signing_bonus + (c.reward_value * c.max_claims) as total_contract_value
    from public.sponsorship_contracts c
    left join jsonb_array_elements(public.app_sponsorship_offers()) as o(offer)
      on o.offer ->> 'id' = c.sponsor_id
    left join lateral (
      select
        coalesce(sum(r.reward_value), 0) as paid_total,
        max(r.created_at) as last_reward_at,
        max(r.created_at) filter (where r.result_key like 'periodic|%') as last_installment_at,
        max(r.created_at) filter (where r.result_key like 'signing_bonus|%') as signing_paid_at
      from public.sponsorship_rewards r
      where r.contract_id = c.id
    ) rr on true
    where c.manager_id = p_manager_id
      and c.status = 'active'
  ) c;

  select count(*) into v_active_count
  from public.sponsorship_contracts c
  where c.manager_id = p_manager_id and c.status = 'active';

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v_rewards
  from (
    select
      r.id,
      r.contract_id,
      r.manager_id,
      r.manager_name,
      r.result_key,
      r.reward_value,
      r.created_at,
      case
        when r.result_key like 'signing_bonus|%' then 'Luva'
        when r.result_key like 'periodic|%' then 'Parcela'
        else 'Meta'
      end as reward_kind,
      c.sponsor_name,
      c.category,
      c.title
    from public.sponsorship_rewards r
    join public.sponsorship_contracts c on c.id = r.contract_id
    where r.manager_id = p_manager_id
    order by r.created_at desc
    limit 10
  ) r;

  select coalesce(
    jsonb_agg(
      offer_with_context
      order by offer_with_context ->> 'category',
        offer_with_context ->> 'riskLevel',
        offer_with_context ->> 'sponsorName'
    ),
    '[]'::jsonb
  )
    into v_offers
  from (
    select
      offers.offer
      || jsonb_build_object(
        'isReplacement', c.id is not null,
        'currentSponsorName', coalesce(c.sponsor_name, ''),
        'currentTitle', coalesce(c.title, ''),
        'terminationFee',
          coalesce(
            public.app_sponsorship_termination_fee(
              c.signing_bonus,
              c.reward_value,
              c.max_claims,
              c.claims_used
            ),
            0
          ),
        'canSign', (c.id is not null or v_active_count < v_max_active),
        'totalContractValue',
          coalesce((offers.offer ->> 'signingBonus')::numeric, 0)
          + coalesce((offers.offer ->> 'rewardValue')::numeric, 0)
          * coalesce((offers.offer ->> 'maxClaims')::integer, 0)
      ) as offer_with_context
    from jsonb_array_elements(public.app_sponsorship_offers()) as offers(offer)
    left join public.sponsorship_contracts c
      on c.manager_id = p_manager_id
     and c.status = 'active'
     and c.category = coalesce(offers.offer ->> 'category', 'Patrocinio')
    where not exists (
      select 1
      from public.sponsorship_contracts same
      where same.manager_id = p_manager_id
        and same.status = 'active'
        and same.sponsor_id = offers.offer ->> 'id'
    )
    and (c.id is not null or v_active_count < v_max_active)
  ) offers_with_context;

  return jsonb_build_object(
    'active', v_active,
    'offers', v_offers,
    'recentRewards', v_rewards,
    'activeCount', v_active_count,
    'maxActiveContracts', v_max_active,
    'activeSlotsLeft', greatest(v_max_active - v_active_count, 0)
  );
end;
$$;

grant execute on function public.app_get_my_sponsorships(text, text) to anon, authenticated;

commit;
