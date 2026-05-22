-- Seed pending League Cup quarterfinals that are generated in the bracket but missing from public.matches.
-- Without these rows, the commissioner simulation/audit cannot see the CPU x CPU cup tie.

update public.matches
   set phase = 'Quartas - Jogo 4',
       unique_key = 'copa da liga|quartas - jogo 4|10|12',
       match_date = coalesce(match_date, date '2026-06-13'),
       match_order = coalesce(match_order, 4),
       updated_at = now()
 where competition = 'Copa da Liga'
   and week = 4
   and home_club_id = 10
   and away_club_id = 12;

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
  item.competition,
  item.week,
  item.phase,
  item.match_order,
  item.match_date,
  item.home_club_id,
  item.away_club_id,
  null,
  null,
  null,
  '',
  null,
  'pending',
  null,
  item.unique_key,
  '',
  ''
from (
  values
    ('Copa da Liga', 4, 'Quartas - Jogo 2', 2, date '2026-06-13', 4, 5, 'copa da liga|quartas - jogo 2|4|5'),
    ('Copa da Liga', 4, 'Quartas - Jogo 3', 3, date '2026-06-13', 14, 19, 'copa da liga|quartas - jogo 3|14|19')
) as item(competition, week, phase, match_order, match_date, home_club_id, away_club_id, unique_key)
where not exists (
  select 1
  from public.matches m
  where m.competition = item.competition
    and m.week = item.week
    and (
      m.unique_key = item.unique_key
      or (
        m.home_club_id = item.home_club_id
        and m.away_club_id = item.away_club_id
        and lower(m.phase) like 'quartas%'
      )
    )
);
