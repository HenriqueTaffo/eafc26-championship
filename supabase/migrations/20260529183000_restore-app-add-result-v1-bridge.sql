-- v112 - Restore the authenticated result bridge expected by the audited
-- app_add_result wrapper.
--
-- The audit migration introduced app_add_result -> app_add_result_v1 delegation,
-- but some environments never got app_add_result_v1 because the historical
-- rename check used the wrong signature. This bridge recreates the missing
-- authenticated wrapper on top of app_internal_add_result.

begin;

create or replace function public.app_add_result_v1(
  p_manager_id text,
  p_access_code text,
  p_competition text,
  p_week integer,
  p_phase text,
  p_home text,
  p_away text,
  p_home_score integer,
  p_away_score integer,
  p_goal_details text default '',
  p_assist_details text default '',
  p_penalty_winner text default '',
  p_penalty_score text default '',
  p_submitted_by text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_club text;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);
  v_club := coalesce(v_login ->> 'clubName', '');

  if not v_is_commissioner
     and not public.app_security_same_team(v_club, p_home)
     and not public.app_security_same_team(v_club, p_away) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Voce so pode enviar resultado de jogos do seu clube.'
    );
  end if;

  return public.app_internal_add_result(
    p_competition,
    p_week,
    p_phase,
    p_home,
    p_away,
    p_home_score,
    p_away_score,
    p_goal_details,
    p_assist_details,
    p_penalty_winner,
    p_penalty_score,
    coalesce(nullif(trim(p_submitted_by), ''), v_login ->> 'managerName')
  );
end;
$$;

revoke execute on function public.app_add_result_v1(
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

comment on function public.app_add_result_v1(
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) is 'Authenticated legacy result RPC used internally by the audited app_add_result wrapper.';

commit;
