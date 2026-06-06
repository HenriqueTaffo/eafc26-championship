-- Include Bruno Silva/Wrexham in the FA Cup bracket with a persisted pending match.
-- The static bracket uses the same teams, so this row hydrates the UI and is visible
-- to commissioner simulation/audit flows that read public.matches.

insert into public.matches (
  competition,
  week,
  phase,
  match_order,
  match_date,
  home_club_id,
  away_club_id,
  home_score,
  away_score,
  penalty_winner_club_id,
  penalty_score,
  submitted_by,
  status,
  reason,
  unique_key,
  goals_details,
  assists_details
)
select
  'FA Cup',
  5,
  '3a fase - Jogo 8',
  8,
  date '2026-06-27',
  home.id,
  away.id,
  null,
  null,
  null,
  '',
  null,
  'pending',
  null,
  public.normalize_key('FA Cup') || '|' || public.normalize_key('3a fase - Jogo 8') || '|' || home.id || '|' || away.id,
  '',
  ''
from public.clubs home
join public.clubs away on away.name = 'Preston North End'
where home.name = 'Wrexham'
  and not exists (
    select 1
    from public.matches existing
    where existing.competition = 'FA Cup'
      and existing.week = 5
      and (
        existing.unique_key = public.normalize_key('FA Cup') || '|' || public.normalize_key('3a fase - Jogo 8') || '|' || home.id || '|' || away.id
        or (
          existing.home_club_id = home.id
          and existing.away_club_id = away.id
          and lower(existing.phase) like '3%fase%'
        )
      )
  );
