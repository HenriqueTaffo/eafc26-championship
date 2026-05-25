-- Add Birmingham City squad players that were missing from the EA FC 26 roster seed.
-- Sources:
-- - FIFACM public EA FC 26 player pages for overall, position and wage.
-- - Birmingham City team payroll is recalculated from the roster rows after the insert.

begin;

with missing_players as (
  select *
  from (
    values
      (
        'Birmingham City',
        'Willian',
        '244767',
        1490,
        'Carlos Vicente',
        'RM',
        'Right Midfielder',
        77,
        50000::numeric,
        'https://www.fifacm.com/player/244767/carlos-vicente-robles',
        'FIFACM EA FC 26 public player page',
        'Spain'
      ),
      (
        'Birmingham City',
        'Willian',
        '274516',
        3950,
        'Ibrahim Osman',
        'LM',
        'Left Midfielder',
        72,
        25000::numeric,
        'https://www.fifacm.com/player/274516/ibrahim-osman',
        'FIFACM EA FC 26 public player page',
        'Ghana'
      ),
      (
        'Birmingham City',
        'Willian',
        '267894',
        4980,
        'Jhon Solis',
        'CDM',
        'Center Defensive Midfielder',
        71,
        21500::numeric,
        'https://www.fifacm.com/player/267894/jhon-solis',
        'FIFACM EA FC 26 public player page',
        'Colombia'
      ),
      (
        'Birmingham City',
        'Willian',
        '277673',
        5060,
        'August Priske',
        'ST',
        'Striker',
        71,
        25500::numeric,
        'https://www.fifacm.com/player/277673/august-priske',
        'FIFACM EA FC 26 public player page',
        'Denmark'
      )
  ) as t(
    club_name,
    manager_name,
    ea_id,
    ea_rank,
    player_name,
    position,
    position_label,
    overall,
    estimated_weekly_salary_eur,
    source_url,
    source_name,
    nation
  )
),
new_payroll as (
  select
    coalesce(sum(r.estimated_weekly_salary_eur), 0) +
    coalesce((select sum(m.estimated_weekly_salary_eur) from missing_players m), 0) as weekly_payroll
  from public.club_roster_players r
  where lower(r.club_name) = lower('Birmingham City')
)
insert into public.club_roster_players (
  club_name,
  manager_name,
  ea_id,
  ea_rank,
  player_name,
  position,
  position_label,
  overall,
  estimated_weekly_salary_eur,
  source_weekly_payroll_eur,
  avatar_url,
  shield_url,
  nation,
  source_name,
  source_url,
  salary_source_name,
  salary_source_url,
  salary_reference_type,
  salary_checked_at
)
select
  m.club_name,
  m.manager_name,
  m.ea_id,
  m.ea_rank,
  m.player_name,
  m.position,
  m.position_label,
  m.overall,
  m.estimated_weekly_salary_eur,
  np.weekly_payroll,
  'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p' || m.ea_id || '.png?padding=0.7',
  'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/' || m.ea_id || '.png?width=265',
  m.nation,
  m.source_name,
  m.source_url,
  m.source_name,
  m.source_url,
  'public_player_salary_reference',
  now()
from missing_players m
cross join new_payroll np
on conflict (club_name, ea_id) do update set
  manager_name = excluded.manager_name,
  ea_rank = excluded.ea_rank,
  player_name = excluded.player_name,
  position = excluded.position,
  position_label = excluded.position_label,
  overall = excluded.overall,
  estimated_weekly_salary_eur = excluded.estimated_weekly_salary_eur,
  source_weekly_payroll_eur = excluded.source_weekly_payroll_eur,
  avatar_url = excluded.avatar_url,
  shield_url = excluded.shield_url,
  nation = excluded.nation,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  salary_source_name = excluded.salary_source_name,
  salary_source_url = excluded.salary_source_url,
  salary_reference_type = excluded.salary_reference_type,
  salary_checked_at = excluded.salary_checked_at,
  updated_at = now();

update public.club_roster_players
   set source_weekly_payroll_eur = (
         select weekly_payroll
         from (
           select coalesce(sum(estimated_weekly_salary_eur), 0) as weekly_payroll
           from public.club_roster_players
           where lower(club_name) = lower('Birmingham City')
         ) payroll
       ),
       updated_at = now()
 where lower(club_name) = lower('Birmingham City');

with missing_players as (
  select *
  from (
    values
      (
        'Birmingham City',
        'Carlos Vicente',
        50000::numeric,
        'https://www.fifacm.com/player/244767/carlos-vicente-robles',
        'FIFACM EA FC 26 public player page'
      ),
      (
        'Birmingham City',
        'Ibrahim Osman',
        25000::numeric,
        'https://www.fifacm.com/player/274516/ibrahim-osman',
        'FIFACM EA FC 26 public player page'
      ),
      (
        'Birmingham City',
        'Jhon Solis',
        21500::numeric,
        'https://www.fifacm.com/player/267894/jhon-solis',
        'FIFACM EA FC 26 public player page'
      ),
      (
        'Birmingham City',
        'August Priske',
        25500::numeric,
        'https://www.fifacm.com/player/277673/august-priske',
        'FIFACM EA FC 26 public player page'
      )
  ) as t(
    club_name,
    player_name,
    weekly_salary_eur,
    source_url,
    source_name
  )
)
insert into public.player_salary_references (
  player_name,
  club_name,
  weekly_salary_eur,
  source_name,
  source_url,
  notes,
  source_checked_at,
  updated_at
)
select
  player_name,
  club_name,
  weekly_salary_eur,
  source_name,
  source_url,
  'Public player wage reference used to complete the Birmingham City EA FC 26 base roster.',
  now(),
  now()
from missing_players
on conflict (
  lower(trim(player_name)),
  lower(trim(coalesce(club_name, ''))),
  lower(trim(source_url))
)
do update set
  weekly_salary_eur = excluded.weekly_salary_eur,
  source_name = excluded.source_name,
  notes = excluded.notes,
  source_checked_at = excluded.source_checked_at,
  updated_at = excluded.updated_at;

commit;
