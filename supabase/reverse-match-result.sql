-- Administrative reversal for a wrongly submitted match result.
-- Run this in Supabase SQL editor, then commissioners can undo finished matches
-- from the app and submit the corrected score again.

create or replace function public.app_reverse_match_result(
  p_manager_id text,
  p_access_code text,
  p_competition text,
  p_phase text,
  p_home text,
  p_away text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_match record;
  v_winner_club_id bigint;
  v_sponsorship_result_key text;
  v_match_deleted integer := 0;
  v_cup_events_deleted integer := 0;
  v_adjustment_events_deleted integer := 0;
  v_sponsorship_rewards_deleted integer := 0;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  if coalesce((v_login ->> 'isCommissioner')::boolean, false) is false then
    return jsonb_build_object('ok', false, 'message', 'Apenas o comissario pode desfazer resultados.');
  end if;

  select
    m.*,
    hc.name as home_name,
    ac.name as away_name
    into v_match
  from public.matches m
  join public.clubs hc on hc.id = m.home_club_id
  join public.clubs ac on ac.id = m.away_club_id
  where lower(m.competition) = lower(trim(p_competition))
    and lower(m.phase) = lower(trim(p_phase))
    and (
      (
        public.app_security_same_team(hc.name, p_home)
        and public.app_security_same_team(ac.name, p_away)
      )
      or (
        public.app_security_same_team(hc.name, p_away)
        and public.app_security_same_team(ac.name, p_home)
      )
    )
  order by m.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Resultado nao encontrado para desfazer.');
  end if;

  if coalesce(v_match.status, '') <> 'approved' then
    return jsonb_build_object('ok', false, 'message', 'Este jogo ainda nao tem resultado aprovado.');
  end if;

  v_winner_club_id := case
    when coalesce(v_match.home_score, 0) > coalesce(v_match.away_score, 0) then v_match.home_club_id
    when coalesce(v_match.away_score, 0) > coalesce(v_match.home_score, 0) then v_match.away_club_id
    else v_match.penalty_winner_club_id
  end;

  v_sponsorship_result_key := concat_ws(
    '|',
    coalesce(v_match.home_name, ''),
    coalesce(v_match.away_name, ''),
    coalesce(v_match.home_score::text, ''),
    coalesce(v_match.away_score::text, '')
  );

  with deleted_rewards as (
    delete from public.sponsorship_rewards
    where result_key = v_sponsorship_result_key
    returning contract_id
  ),
  reward_counts as (
    select contract_id, count(*)::integer as removed_count
    from deleted_rewards
    group by contract_id
  ),
  updated_contracts as (
    update public.sponsorship_contracts c
       set claims_used = greatest(coalesce(c.claims_used, 0) - rc.removed_count, 0),
           status = case
             when c.status = 'completed' then 'active'
             else c.status
           end
      from reward_counts rc
      where c.id = rc.contract_id
      returning rc.removed_count
  )
  select coalesce(sum(removed_count), 0)::integer
    into v_sponsorship_rewards_deleted
  from updated_contracts;

  if coalesce(p_competition, '') <> 'Championship' and v_winner_club_id is not null then
    delete from public.events
    where club_id = v_winner_club_id
      and lower(type) = lower('Premiação de copa')
      and lower(title) = lower('Premiação por avanço - ' || p_competition)
      and description ilike '%' || p_phase || '%';
    get diagnostics v_cup_events_deleted = row_count;
  end if;

  delete from public.events
  where title = 'Estorno de premiação - ' || p_competition
    and description ilike '%' || p_phase || '%';
  get diagnostics v_adjustment_events_deleted = row_count;

  delete from public.matches
  where id = v_match.id;
  get diagnostics v_match_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'message', 'Resultado desfeito. O jogo voltou a ficar disponivel para novo preenchimento.',
    'matchId', v_match.id,
    'matchesDeleted', v_match_deleted,
    'cupPrizeEventsDeleted', v_cup_events_deleted,
    'adjustmentEventsDeleted', v_adjustment_events_deleted,
    'sponsorshipRewardsDeleted', v_sponsorship_rewards_deleted
  );
end;
$$;

grant execute on function public.app_reverse_match_result(text, text, text, text, text, text) to anon, authenticated;

-- One-off correction for the current wrong result:
-- select public.app_reverse_match_result(
--   'comissario',
--   '<codigo-do-comissario>',
--   'Copa da Liga',
--   'Quartas - Jogo 1',
--   'Coventry City',
--   'Birmingham City'
-- );
