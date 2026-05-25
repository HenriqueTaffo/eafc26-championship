-- v83 - Squad management and realistic Championship budgets - 25/05/2026.
-- Seeds EA SPORTS FC 26 roster ratings for the five managed clubs and uses
-- Capology 2025-2026 weekly payroll totals as the salary baseline.

begin;

create table if not exists public.league_finance_rules (
  id text primary key default 'default',
  base_weekly_salary numeric not null default 45000,
  market_value_salary_rate numeric not null default 0.006,
  max_payroll_to_budget_ratio numeric not null default 0.22,
  warning_payroll_to_budget_ratio numeric not null default 0.18,
  minimum_runway_weeks integer not null default 3,
  updated_at timestamptz not null default now()
);

alter table public.league_finance_rules
  add column if not exists salary_debt_grace_weeks integer not null default 1,
  add column if not exists salary_debt_penalty numeric not null default 1000000;

create table if not exists public.club_roster_players (
  id bigserial primary key,
  club_name text not null,
  manager_name text not null,
  ea_id text not null,
  ea_rank integer,
  player_name text not null,
  position text,
  position_label text,
  overall integer not null default 0,
  estimated_weekly_salary_eur numeric not null default 0,
  source_weekly_payroll_eur numeric not null default 0,
  avatar_url text,
  shield_url text,
  nation text,
  source_name text not null default 'EA SPORTS FC 26 ratings + Capology payroll estimate',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_roster_players_unique_ea unique (club_name, ea_id)
);

alter table public.club_roster_players enable row level security;
revoke all on table public.club_roster_players from anon, authenticated;

create index if not exists club_roster_players_manager_idx
  on public.club_roster_players (manager_name, club_name, overall desc);

create index if not exists club_roster_players_player_idx
  on public.club_roster_players ((lower(player_name)), club_name);

create table if not exists public.manager_squad_lineups (
  id bigserial primary key,
  manager_id text not null references public.managers(id),
  manager_name text not null,
  club_name text not null,
  formation text not null default '4-2-3-1',
  lineup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manager_squad_lineups_manager_unique unique (manager_id)
);

alter table public.manager_squad_lineups enable row level security;
revoke all on table public.manager_squad_lineups from anon, authenticated;

create index if not exists manager_squad_lineups_club_idx
  on public.manager_squad_lineups (club_name, updated_at desc);

update public.clubs
   set owner_id = 'bruno-silva',
       is_human = true,
       updated_at = now()
 where lower(name) = lower('Wrexham');

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
  source_url
) values
('Coventry City', 'Henrique', '251690', 2412, 'Jack Rudoni', 'CAM', 'Center Attacking Midfielder', 74, 22000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p251690.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/251690.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '251626', 2440, 'Milan van Ewijk', 'RB', 'Right Back', 74, 19750, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p251626.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/251626.png?width=265', 'Holland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '212118', 2594, 'Matt Grimes', 'CDM', 'Center Defensive Midfielder', 74, 20500, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p212118.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/212118.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '238743', 3310, 'Haji Wright', 'ST', 'Striker', 73, 21000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p238743.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/238743.png?width=265', 'United States', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '240500', 3489, 'Luke Woolfenden', 'CB', 'Center Back', 73, 18750, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p240500.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/240500.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '263339', 3705, 'Carl Rushworth', 'GK', 'Goalkeeper', 72, 16750, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p263339.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/263339.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '254910', 3790, 'Tatsuhiro Sakamoto', 'RM', 'Right Midfielder', 72, 18500, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p254910.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/254910.png?width=265', 'Japan', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '261335', 3827, 'Kaine Kesler-Hayden', 'RB', 'Right Back', 72, 17750, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p261335.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/261335.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '236784', 4622, 'Ephron Mason-Clark', 'LM', 'Left Midfielder', 71, 17500, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p236784.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/236784.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '257253', 4974, 'Bobby Thomas', 'CB', 'Center Back', 71, 17000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p257253.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/257253.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '241645', 5213, 'Victor Torp', 'CM', 'Center Midfielder', 70, 16750, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p241645.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/241645.png?width=250', 'Denmark', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '251555', 5297, 'Josh Eccles', 'CDM', 'Center Defensive Midfielder', 70, 16750, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p251555.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/251555.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '255976', 5403, 'Oliver Dovin', 'GK', 'Goalkeeper', 70, 15000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p255976.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/255976.png?width=250', 'Sweden', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '251198', 5741, 'Ellis Simms', 'ST', 'Striker', 70, 18000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p251198.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/251198.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '246873', 5886, 'Liam Kitching', 'CB', 'Center Back', 70, 16000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p246873.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/246873.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '235744', 6327, 'Brandon Thomas-Asante', 'ST', 'Striker', 69, 17000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p235744.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/235744.png?width=265', 'Ghana', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '232755', 6462, 'Jay Dasilva', 'LB', 'Left Back', 69, 15000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p232755.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/232755.png?width=265', 'Wales', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '233047', 6895, 'Joel Latibeaudiere', 'CB', 'Center Back', 69, 15000, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p233047.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/233047.png?width=250', 'Jamaica', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '213147', 7049, 'Jamie Allen', 'CM', 'Center Midfielder', 68, 14750, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p213147.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/213147.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '204825', 7490, 'Ben Wilson', 'GK', 'Goalkeeper', 68, 13250, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p204825.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/204825.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '196952', 7508, 'Jake Bidwell', 'LB', 'Left Back', 68, 14250, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p196952.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/196952.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '72423', 7526, 'Brau', 'LB', 'Left Back', 68, 14250, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p72423.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/72423.png?width=250', 'Spain', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Coventry City', 'Henrique', '277657', 14727, 'Kai Andrews', 'CM', 'Center Midfielder', 60, 8260, 383760, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p277657.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/277657.png?width=250', 'Wales', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/coventry-city/1800'),
('Birmingham City', 'Willian', '227884', 1585, 'Bright Osayi-Samuel', 'RB', 'Right Back', 76, 24000, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p227884.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/227884.png?width=265', 'Nigeria', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '197031', 1848, 'Marvin Ducksch', 'ST', 'Striker', 76, 26750, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p197031.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/197031.png?width=265', 'Germany', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '245538', 2086, 'Kyogo Furuhashi', 'ST', 'Striker', 75, 25500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p245538.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/245538.png?width=265', 'Japan', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '257899', 2699, 'Kanya Fujimoto', 'CAM', 'Center Attacking Midfielder', 74, 24250, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p257899.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/257899.png?width=265', 'Japan', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '254120', 3192, 'Tommy Doyle', 'CM', 'Center Midfielder', 73, 21500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p254120.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/254120.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '236217', 3309, 'Phil Neumann', 'CB', 'Center Back', 73, 20750, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p236217.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/236217.png?width=265', 'Germany', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '263914', 3511, 'Eíran Cashin', 'CB', 'Center Back', 73, 20750, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p263914.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/263914.png?width=265', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '246444', 3636, 'Tomoki Iwata', 'CDM', 'Center Defensive Midfielder', 72, 20500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p246444.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/246444.png?width=265', 'Japan', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '237424', 3645, 'Paik Seung Ho', 'CDM', 'Center Defensive Midfielder', 72, 20500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p237424.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/237424.png?width=265', 'Korea Republic', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '220633', 4027, 'Demarai Gray', 'LM', 'Left Midfielder', 72, 20500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p220633.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/220633.png?width=265', 'Jamaica', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '243589', 4033, 'Alex Cochrane', 'LB', 'Left Back', 72, 19750, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p243589.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/243589.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '221982', 4235, 'Patrick Roberts', 'RM', 'Right Midfielder', 72, 20500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p221982.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/221982.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '242386', 4247, 'Christoph Klarer', 'CB', 'Center Back', 72, 19750, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p242386.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/242386.png?width=265', 'Austria', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '199027', 4971, 'Jack Robinson', 'CB', 'Center Back', 71, 18500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p199027.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/199027.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '227686', 5264, 'Keshi Anderson', 'LM', 'Left Midfielder', 70, 18250, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p227686.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/227686.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '270578', 5363, 'Willum Þór Willumsson', 'CAM', 'Center Attacking Midfielder', 70, 19750, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p270578.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/270578.png?width=265', 'Iceland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '273621', 5375, 'James Beadle', 'GK', 'Goalkeeper', 70, 16500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p273621.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/273621.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '237511', 5532, 'Alfons Sampsted', 'RB', 'Right Back', 70, 17500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p237511.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/237511.png?width=265', 'Iceland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '247385', 5799, 'Lee Buchanan', 'LB', 'Left Back', 70, 17500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p247385.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/247385.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '246159', 6095, 'Ethan Laird', 'RB', 'Right Back', 69, 16500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p246159.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/246159.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '264139', 6203, 'Marc Leonard', 'CM', 'Center Midfielder', 69, 17250, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p264139.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/264139.png?width=265', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '255206', 6598, 'Jay Stansfield', 'ST', 'Striker', 69, 18500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p255206.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/255206.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '224915', 6791, 'Scott Wright', 'RM', 'Right Midfielder', 69, 17250, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p224915.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/224915.png?width=265', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '70994', 6798, 'Lewis Koumas', 'RM', 'Right Midfielder', 69, 17250, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p70994.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/70994.png?width=250', 'Wales', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '199812', 7367, 'Ryan Allsop', 'GK', 'Goalkeeper', 68, 14750, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p199812.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/199812.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '247279', 7817, 'Lyndon Dykes', 'ST', 'Striker', 68, 17500, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p247279.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/247279.png?width=265', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Birmingham City', 'Willian', '70780', 17223, 'Brad Mayo', 'GK', 'Goalkeeper', 54, 3970, 515970, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p70780.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/70780.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/birmingham-city/88'),
('Middlesbrough', 'Rafael', '253054', 3095, 'Hayden Hackney', 'CDM', 'Center Defensive Midfielder', 73, 24000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p253054.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/253054.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '255145', 3146, 'Aidan Morris', 'CDM', 'Center Defensive Midfielder', 73, 24000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p255145.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/255145.png?width=265', 'United States', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '252796', 3283, 'Morgan Whittaker', 'RM', 'Right Midfielder', 73, 24000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p252796.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/252796.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '216464', 3605, 'Alan Browne', 'CM', 'Center Midfielder', 72, 22750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p216464.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/216464.png?width=265', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '233487', 3617, 'Riley McGree', 'LM', 'Left Midfielder', 72, 22750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p233487.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/233487.png?width=250', 'Australia', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '232185', 3802, 'Callum Brittain', 'RB', 'Right Back', 72, 22000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p232185.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/232185.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '229682', 4291, 'Dael Fry', 'CB', 'Center Back', 72, 22000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p229682.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/229682.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '186156', 4732, 'Luke Ayling', 'RB', 'Right Back', 71, 20750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p186156.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/186156.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '218659', 4849, 'Matt Targett', 'LB', 'Left Back', 71, 20750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p218659.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/218659.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '211009', 4911, 'Darragh Lenihan', 'CB', 'Center Back', 71, 20750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p211009.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/211009.png?width=265', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '236315', 4939, 'Alfie Jones', 'CB', 'Center Back', 71, 20750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p236315.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/236315.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '239358', 5514, 'Seny Dieng', 'GK', 'Goalkeeper', 70, 18500, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p239358.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/239358.png?width=250', 'Senegal', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '261283', 5870, 'Tommy Conway', 'ST', 'Striker', 70, 22000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p261283.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/261283.png?width=265', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '228888', 5872, 'George Edmundson', 'CB', 'Center Back', 70, 19750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p228888.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/228888.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '262255', 6310, 'Alex Bangura', 'LB', 'Left Back', 69, 18500, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p262255.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/262255.png?width=265', 'Sierra Leone', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '259268', 6395, 'Kaly Sène', 'ST', 'Striker', 69, 20750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p259268.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/259268.png?width=265', 'Senegal', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '268737', 6502, 'Sverre Nypan', 'CM', 'Center Midfielder', 69, 19250, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p268737.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/268737.png?width=265', 'Norway', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '243619', 6544, 'Delano Burgzorg', 'LM', 'Left Midfielder', 69, 19250, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p243619.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/243619.png?width=265', 'Holland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '254752', 6667, 'Sontje Hansen', 'LM', 'Left Midfielder', 69, 19250, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p254752.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/254752.png?width=265', 'Holland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '276827', 9860, 'Abdoulaye Kanté', 'CDM', 'Center Defensive Midfielder', 66, 16000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p276827.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/276827.png?width=250', 'Côte d''Ivoire', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '242853', 9897, 'Sol Brynn', 'GK', 'Goalkeeper', 66, 14500, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p242853.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/242853.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '251176', 10826, 'Samuel Silvera', 'LM', 'Left Midfielder', 65, 15000, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p251176.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/251176.png?width=250', 'Australia', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '70035', 11889, 'Micah Hamilton', 'LM', 'Left Midfielder', 64, 13750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p70035.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/70035.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Middlesbrough', 'Rafael', '260402', 12082, 'Alex Gilbert', 'LM', 'Left Midfielder', 64, 13750, 474750, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p260402.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/260402.png?width=250', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/middlesbrough/12'),
('Southampton', 'Renato', '252066', 2503, 'Finn Azaz', 'CAM', 'Center Attacking Midfielder', 74, 33000, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p252066.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/252066.png?width=265', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '240097', 2537, 'Flynn Downes', 'CM', 'Center Midfielder', 74, 30500, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p240097.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/240097.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '252793', 2859, 'Taylor Harwood-Bellis', 'CB', 'Center Back', 74, 29500, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p252793.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/252793.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '231044', 3001, 'Joe Aribo', 'CM', 'Center Midfielder', 73, 29000, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p231044.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/231044.png?width=265', 'Nigeria', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '243585', 3092, 'Gavin Bazunu', 'GK', 'Goalkeeper', 73, 26250, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p243585.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/243585.png?width=250', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '265195', 3108, 'Elias Jelert', 'RB', 'Right Back', 73, 28000, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p265195.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/265195.png?width=265', 'Denmark', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '226012', 3155, 'Ryan Manning', 'LB', 'Left Back', 73, 28000, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p226012.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/226012.png?width=265', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '266422', 3226, 'Caspar Jander', 'CM', 'Center Midfielder', 73, 29000, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p266422.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/266422.png?width=265', 'Germany', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '221841', 3335, 'Adam Armstrong', 'ST', 'Striker', 73, 31250, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p221841.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/221841.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '238157', 3353, 'Mads Roerslev', 'RB', 'Right Back', 73, 28000, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p238157.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/238157.png?width=250', 'Denmark', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '269964', 3476, 'Léo Scienza', 'LM', 'Left Midfielder', 73, 29000, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p269964.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/269964.png?width=265', 'Brazil', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '276695', 3754, 'Shea Charles', 'CM', 'Center Midfielder', 72, 27750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p276695.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/276695.png?width=265', 'Northern Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '264371', 3907, 'Tom Fellows', 'RM', 'Right Midfielder', 72, 27750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p264371.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/264371.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '265993', 3969, 'Welington', 'LB', 'Left Back', 72, 26500, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p265993.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/265993.png?width=250', 'Brazil', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '258930', 4163, 'Cameron Archer', 'ST', 'Striker', 72, 29750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p258930.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/258930.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '263953', 4197, 'Samuel Edozie', 'LW', 'Left Wing', 72, 29750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p263953.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/263953.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '202697', 4284, 'Jack Stephens', 'CB', 'Center Back', 72, 26500, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p202697.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/202697.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '244319', 5010, 'Ross Stewart', 'ST', 'Striker', 71, 28250, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p244319.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/244319.png?width=265', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '189324', 5473, 'Alex McCarthy', 'GK', 'Goalkeeper', 70, 22500, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p189324.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/189324.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '207807', 5671, 'Ryan Fraser', 'LM', 'Left Midfielder', 70, 24750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p207807.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/207807.png?width=250', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '258167', 5863, 'Ronnie Edwards', 'CB', 'Center Back', 70, 23750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p258167.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/258167.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '274944', 5947, 'Damion Downs', 'ST', 'Striker', 70, 26750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p274944.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/274944.png?width=250', 'United States', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '272497', 6830, 'Joshua Quarshie', 'CB', 'Center Back', 69, 22500, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p272497.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/272497.png?width=265', 'Germany', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '245153', 8073, 'Nathan Wood', 'CB', 'Center Back', 68, 21250, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p245153.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/245153.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '266312', 8170, 'Kuryu Matsuki', 'CM', 'Center Midfielder', 67, 20750, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p266312.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/266312.png?width=250', 'Japan', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '202199', 9743, 'George Long', 'GK', 'Goalkeeper', 66, 17500, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p202199.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/202199.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Southampton', 'Renato', '78184', 15690, 'Jay Robinson', 'ST', 'Striker', 59, 12105, 709605, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p78184.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/78184.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/southampton/17'),
('Wrexham', 'Bruno Silva', '225779', 2718, 'Ben Sheaf', 'CDM', 'Center Defensive Midfielder', 74, 19250, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p225779.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/225779.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '253052', 3272, 'Issa Kaboré', 'RB', 'Right Back', 73, 17750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p253052.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/253052.png?width=265', 'Burkina Faso', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '232545', 3307, 'Nathan Broadhead', 'LM', 'Left Midfielder', 73, 18500, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p232545.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/232545.png?width=250', 'Wales', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '242429', 3697, 'Liberato Cacace', 'LB', 'Left Back', 72, 16750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p242429.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/242429.png?width=250', 'New Zealand', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '236530', 3722, 'Lewis O''Brien', 'CM', 'Center Midfielder', 72, 17500, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p236530.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/236530.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '219216', 3883, 'Josh Windass', 'CAM', 'Center Attacking Midfielder', 72, 18750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p219216.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/219216.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '216627', 4154, 'Kieffer Moore', 'ST', 'Striker', 72, 18750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p216627.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/216627.png?width=265', 'Wales', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '202048', 4167, 'Conor Coady', 'CB', 'Center Back', 72, 16750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p202048.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/202048.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '221281', 5071, 'Dominic Hyam', 'CB', 'Center Back', 71, 16000, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p221281.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/221281.png?width=265', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '207998', 5416, 'Danny Ward', 'GK', 'Goalkeeper', 70, 14250, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p207998.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/207998.png?width=250', 'Wales', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '235496', 6031, 'Oliver Rathbone', 'CM', 'Center Midfielder', 69, 14750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p235496.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/235496.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '246671', 6405, 'Arthur Okonkwo', 'GK', 'Goalkeeper', 69, 13250, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p246671.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/246671.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '225769', 6459, 'George Dobson', 'CDM', 'Center Defensive Midfielder', 69, 14750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p225769.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/225769.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '226084', 6760, 'Ryan Hardie', 'ST', 'Striker', 69, 16000, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p226084.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/226084.png?width=250', 'Scotland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '198489', 7126, 'James McClean', 'LB', 'Left Back', 68, 13500, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p198489.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/198489.png?width=265', 'Republic of Ireland', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '186139', 7434, 'Matty James', 'CDM', 'Center Defensive Midfielder', 68, 14000, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p186139.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/186139.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '235247', 7455, 'Sam Smith', 'ST', 'Striker', 68, 15000, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p235247.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/235247.png?width=265', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '262523', 7984, 'Max Cleworth', 'CB', 'Center Back', 68, 13500, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p262523.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/262523.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '250825', 8199, 'Ryan Longman', 'LM', 'Left Midfielder', 67, 13000, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p250825.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/250825.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '210108', 8212, 'Elliot Lee', 'CM', 'Center Midfielder', 67, 13000, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p210108.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/210108.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '246392', 8293, 'Lewis Brunt', 'CB', 'Center Back', 67, 12500, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p246392.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/246392.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '237036', 9417, 'Ryan Barnett', 'RB', 'Right Back', 66, 11750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p237036.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/237036.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '255913', 9423, 'George Thomason', 'CM', 'Center Midfielder', 66, 12250, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p255913.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/255913.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '169792', 10015, 'Jay Rodriguez', 'ST', 'Striker', 66, 13250, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p169792.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/169792.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '237943', 10198, 'Dan Scarr', 'CB', 'Center Back', 66, 11750, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p237943.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/237943.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '224361', 11367, 'Andy Cannon', 'CM', 'Center Midfielder', 64, 10500, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p224361.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/224361.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '222095', 13505, 'Callum Burton', 'GK', 'Goalkeeper', 62, 8250, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p222095.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/222095.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '271854', 17218, 'Aaron James', 'CB', 'Center Back', 54, 3500, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p271854.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/271854.png?width=250', 'England', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947'),
('Wrexham', 'Bruno Silva', '73943', 17462, 'Harry Ashfield', 'CM', 'Center Midfielder', 52, 3204, 401954, 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p73943.png?padding=0.7', 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/73943.png?width=250', 'Wales', 'https://www.ea.com/en/games/ea-sports-fc/ratings/teams-ratings/wrexham/1947')
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
  updated_at = now();

insert into public.league_finance_rules (
  id,
  base_weekly_salary,
  market_value_salary_rate,
  max_payroll_to_budget_ratio,
  warning_payroll_to_budget_ratio,
  salary_debt_grace_weeks,
  salary_debt_penalty
) values (
  'default',
  7000,
  0.0011,
  0.36,
  0.24,
  1,
  500000
)
on conflict (id) do update set
  base_weekly_salary = excluded.base_weekly_salary,
  market_value_salary_rate = excluded.market_value_salary_rate,
  max_payroll_to_budget_ratio = excluded.max_payroll_to_budget_ratio,
  warning_payroll_to_budget_ratio = excluded.warning_payroll_to_budget_ratio,
  salary_debt_grace_weeks = excluded.salary_debt_grace_weeks,
  salary_debt_penalty = excluded.salary_debt_penalty,
  updated_at = now();

create or replace function public.app_get_finance_rules()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select to_jsonb(r)
  from public.league_finance_rules r
  where r.id = 'default';
$$;

insert into public.league_config (key, value, description, updated_at) values
  ('transfer_budget', '22000000'::jsonb, 'Orcamento base realista de segunda divisao.', now()),
  ('home_match_bonus', '400000'::jsonb, 'Bonus por mando em nivel Championship.', now()),
  ('win_bonus', '250000'::jsonb, 'Bonus por vitoria em nivel Championship.', now())
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

create or replace function public.app_get_budget_reconciliation()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with data as (
    select public.app_get_data()::jsonb as j
  ),
  config as (
    select
      coalesce((j ->> 'budget')::numeric, 22000000) as base_budget_default,
      coalesce((j ->> 'homeMatchBonus')::numeric, 400000) as home_match_bonus,
      coalesce((j ->> 'winBonus')::numeric, 250000) as win_bonus,
      coalesce((j ->> 'dailyTransferLimit')::integer, 3) as daily_transfer_limit
    from data
  ),
  teams as (
    select
      m.display_name as manager_name,
      c.name as club_name
    from public.managers m
    join public.clubs c on c.owner_id = m.id
    where c.is_human is true
  ),
  results as (
    select *
    from jsonb_to_recordset(coalesce((select j -> 'results' from data), '[]'::jsonb)) as r(
      "Mandante" text,
      "Visitante" text,
      "GolsMandante" integer,
      "GolsVisitante" integer,
      "Status" text,
      "Competicao" text
    )
    where lower(coalesce("Status", '')) = 'aprovado'
      and lower(coalesce("Competicao", '')) = 'championship'
  ),
  stats as (
    select
      t.manager_name,
      count(r."Mandante") filter (where lower(r."Mandante") = lower(t.club_name))::integer as home_matches,
      count(r."Mandante") filter (
        where (
          lower(r."Mandante") = lower(t.club_name)
          and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0)
        ) or (
          lower(r."Visitante") = lower(t.club_name)
          and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0)
        )
      )::integer as wins,
      count(r."Mandante")::integer as matches_played,
      coalesce(sum(
        case
          when lower(r."Mandante") = lower(t.club_name) and coalesce(r."GolsMandante", 0) > coalesce(r."GolsVisitante", 0) then 3
          when lower(r."Visitante") = lower(t.club_name) and coalesce(r."GolsVisitante", 0) > coalesce(r."GolsMandante", 0) then 3
          when coalesce(r."GolsMandante", -1) = coalesce(r."GolsVisitante", -2) then 1
          else 0
        end
      ), 0)::integer as points
    from teams t
    left join results r
      on lower(r."Mandante") = lower(t.club_name)
      or lower(r."Visitante") = lower(t.club_name)
    group by t.manager_name
  ),
  reward_totals as (
    select
      manager_name,
      sum(reward_value)::numeric as reward_total
    from public.sponsorship_rewards
    group by manager_name
  ),
  sponsorship_payout_events as (
    select
      "Jogador" as manager_name,
      sum(coalesce("ImpactoFinanceiro", 0))::numeric as event_reward_total
    from jsonb_to_recordset(coalesce((select j -> 'events' from data), '[]'::jsonb)) as e(
      "Jogador" text,
      "Titulo" text,
      "Tipo" text,
      "ImpactoFinanceiro" numeric
    )
    where coalesce("ImpactoFinanceiro", 0) > 0
      and (
        lower(coalesce("Tipo", '')) = 'patrocinio'
        or lower(coalesce("Titulo", '')) like '%patrocinio%'
      )
    group by "Jogador"
  ),
  raw_budgets as (
    select key as manager_name, value as budget
    from jsonb_each(coalesce((select j -> 'budgets' from data), '{}'::jsonb))
  ),
  transfer_spend as (
    select public.app_get_transfer_spend_breakdown() as totals
  ),
  active_debts as (
    select distinct on (manager_name)
      manager_name,
      debt_amount,
      missed_weeks,
      payroll_weekly,
      last_period_key
    from public.manager_salary_debts
    where status = 'active'
    order by manager_name, updated_at desc
  ),
  reconciled as (
    select
      t.manager_name,
      config.base_budget_default as base_budget,
      coalesce(s.matches_played, 0) as matches_played,
      coalesce(s.points, 0) as points,
      coalesce(s.home_matches, 0) as home_matches,
      coalesce(s.wins, 0) as wins,
      coalesce((rb.budget ->> 'weeklyIncome')::numeric, 0) as weekly_income_value,
      coalesce(s.home_matches, 0) * config.home_match_bonus as home_bonus,
      coalesce(s.wins, 0) * config.win_bonus as win_bonus_value,
      coalesce((rb.budget ->> 'formBonus')::numeric, 0) as form_bonus,
      coalesce((rb.budget ->> 'cupRebalanceBonus')::numeric, 0) as cup_rebalance_bonus,
      coalesce((rb.budget ->> 'eventTotal')::numeric, 0)
        - coalesce(spe.event_reward_total, 0)
        + coalesce(rt.reward_total, 0) as event_total,
      coalesce(rt.reward_total, 0) as sponsorship_rewards,
      coalesce((rb.budget ->> 'spentTotal')::numeric, 0) as legacy_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'marketTotal')::numeric, 0) as secure_market_total,
      coalesce((ts.totals -> t.manager_name ->> 'finalTotal')::numeric, 0) as secure_spent_total,
      coalesce((ts.totals -> t.manager_name ->> 'deltaTotal')::numeric, 0) as secure_delta_total,
      coalesce((ts.totals -> t.manager_name ->> 'nonApprovedMarketTotal')::numeric, 0) as non_approved_market_total,
      greatest(0, coalesce((rb.budget ->> 'spentTotal')::numeric, 0)) as spent_total,
      coalesce((rb.budget ->> 'transferModifier')::integer, 0) as transfer_modifier,
      coalesce((rb.budget ->> 'transferLimit')::integer, config.daily_transfer_limit) as raw_transfer_limit,
      ad.debt_amount as salary_debt_amount,
      ad.missed_weeks as salary_debt_weeks,
      ad.payroll_weekly as salary_debt_payroll,
      ad.last_period_key as salary_debt_period
    from teams t
    cross join config
    cross join transfer_spend ts
    left join raw_budgets rb on rb.manager_name = t.manager_name
    left join stats s on s.manager_name = t.manager_name
    left join reward_totals rt on rt.manager_name = t.manager_name
    left join sponsorship_payout_events spe on spe.manager_name = t.manager_name
    left join active_debts ad on lower(ad.manager_name) = lower(t.manager_name)
  ),
  final_rows as (
    select
      *,
      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total as total_budget,
      base_budget + weekly_income_value + home_bonus + win_bonus_value + form_bonus + event_total - spent_total as remaining_budget
    from reconciled
  )
  select coalesce(jsonb_object_agg(
    manager_name,
    jsonb_build_object(
      'baseBudget', base_budget,
      'matchesPlayed', matches_played,
      'homeMatches', home_matches,
      'wins', wins,
      'points', points,
      'weeklyIncome', weekly_income_value,
      'homeBonus', home_bonus,
      'winBonusValue', win_bonus_value,
      'formBonus', form_bonus,
      'cupRebalanceBonus', cup_rebalance_bonus,
      'eventTotal', event_total,
      'sponsorshipRewards', sponsorship_rewards,
      'totalBudget', total_budget,
      'legacySpentTotal', legacy_spent_total,
      'secureMarketTotal', secure_market_total,
      'secureSpentTotal', secure_spent_total,
      'secureDeltaTotal', secure_delta_total,
      'nonApprovedMarketTotal', non_approved_market_total,
      'spentTotal', spent_total,
      'remainingBudget', remaining_budget,
      'transferModifier', transfer_modifier,
      'salaryDebtActive', salary_debt_amount is not null,
      'salaryDebtAmount', coalesce(salary_debt_amount, case when remaining_budget < 0 then abs(remaining_budget) else 0 end),
      'salaryDebtWeeks', coalesce(salary_debt_weeks, 0),
      'salaryDebtPayroll', coalesce(salary_debt_payroll, 0),
      'salaryDebtPeriod', coalesce(salary_debt_period, ''),
      'marketEmbargo', remaining_budget < 0 or salary_debt_amount is not null,
      'transferLimit', case when remaining_budget < 0 or salary_debt_amount is not null then 0 else raw_transfer_limit end,
      'transfersToday', public.app_get_external_transfer_today_count(manager_name)
    )
  ), '{}'::jsonb)
  from final_rows;
$$;

create or replace function public.app_get_manager_current_payroll(
  p_buyer text,
  p_exclude_player text default ''
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with manager_match as (
    select
      m.id,
      m.display_name,
      c.name as club_name
    from public.managers m
    left join public.clubs c on c.owner_id = m.id
    where lower(m.display_name) = lower(trim(p_buyer))
       or lower(m.id) = lower(trim(p_buyer))
    limit 1
  ),
  base_roster as (
    select coalesce(sum(r.estimated_weekly_salary_eur), 0)::numeric as payroll_weekly
    from public.club_roster_players r
    join manager_match mm on lower(r.club_name) = lower(mm.club_name)
    where (
      coalesce(trim(p_exclude_player), '') = ''
      or lower(trim(r.player_name)) <> lower(trim(p_exclude_player))
    )
  ),
  latest as (
    select
      t.*,
      row_number() over (
        partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
      and coalesce(t.player_key, t.player_name, '') <> ''
  ),
  transfer_payroll as (
    select coalesce(sum(public.app_estimate_weekly_salary(
      l.overall,
      l.market_value,
      greatest(
        coalesce(l.final_value, 0),
        coalesce(l.negotiated_value, 0),
        coalesce(l.market_value, 0)
      )
    )), 0)::numeric as payroll_weekly
    from latest l
    join manager_match mm on mm.id = l.buyer_id
    where l.rn = 1
      and lower(coalesce(l.transfer_type, 'market')) not in ('internal', 'cpu_sale')
      and (
        coalesce(trim(p_exclude_player), '') = ''
        or lower(trim(l.player_name)) <> lower(trim(p_exclude_player))
      )
      and not exists (
        select 1
        from public.club_roster_players r
        where lower(r.club_name) = lower(mm.club_name)
          and lower(r.player_name) = lower(l.player_name)
      )
  )
  select coalesce((select payroll_weekly from base_roster), 0)
       + coalesce((select payroll_weekly from transfer_payroll), 0);
$$;

create or replace function public.app_get_manager_finance_forecast()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with budgets as materialized (
    select public.app_get_budget_reconciliation()::jsonb as j
  ),
  rules as (
    select *
    from public.league_finance_rules
    where id = 'default'
  ),
  manager_clubs as (
    select
      m.id as manager_id,
      m.display_name as manager_name,
      c.name as club_name
    from public.managers m
    join public.clubs c on c.owner_id = m.id
    where c.is_human is true
  ),
  base_roster as (
    select
      mc.manager_id,
      count(r.id)::integer as roster_count,
      coalesce(sum(r.estimated_weekly_salary_eur), 0)::numeric as base_roster_weekly
    from manager_clubs mc
    left join public.club_roster_players r on lower(r.club_name) = lower(mc.club_name)
    group by mc.manager_id
  ),
  latest as (
    select
      t.*,
      row_number() over (
        partition by lower(trim(coalesce(t.player_key, t.player_name, '')))
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    where lower(coalesce(t.status, '')) in ('approved', 'aprovado')
      and coalesce(t.player_key, t.player_name, '') <> ''
  ),
  transfer_payroll as (
    select
      mc.manager_id,
      count(*)::integer as transfer_count,
      coalesce(sum(public.app_estimate_weekly_salary(
        l.overall,
        l.market_value,
        greatest(
          coalesce(l.final_value, 0),
          coalesce(l.negotiated_value, 0),
          coalesce(l.market_value, 0)
        )
      )), 0)::numeric as transfer_payroll_weekly
    from manager_clubs mc
    join latest l on l.buyer_id = mc.manager_id
    where l.rn = 1
      and lower(coalesce(l.transfer_type, 'market')) not in ('internal', 'cpu_sale')
      and not exists (
        select 1
        from public.club_roster_players r
        where lower(r.club_name) = lower(mc.club_name)
          and lower(r.player_name) = lower(l.player_name)
      )
    group by mc.manager_id
  ),
  rows as (
    select
      mc.manager_name,
      mc.club_name,
      coalesce((budgets.j -> mc.manager_name ->> 'totalBudget')::numeric, 22000000) as total_budget,
      coalesce((budgets.j -> mc.manager_name ->> 'remainingBudget')::numeric, 22000000) as remaining_budget,
      coalesce((budgets.j -> mc.manager_name ->> 'spentTotal')::numeric, 0) as spent_total,
      coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtActive')::boolean, false) as salary_debt_active,
      coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtAmount')::numeric, 0) as salary_debt_amount,
      coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtWeeks')::integer, 0) as salary_debt_weeks,
      coalesce((budgets.j -> mc.manager_name ->> 'marketEmbargo')::boolean, false) as market_embargo,
      coalesce(br.roster_count, 0) + coalesce(tp.transfer_count, 0) as player_count,
      coalesce(br.base_roster_weekly, 0) as base_roster_weekly,
      coalesce(tp.transfer_payroll_weekly, 0) as transfer_payroll_weekly,
      coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0) as payroll_weekly,
      (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)) * 4 as payroll_monthly,
      case
        when coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0) <= 0 then null
        else floor(greatest(coalesce((budgets.j -> mc.manager_name ->> 'remainingBudget')::numeric, 0), 0) / (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)))::integer
      end as runway_weeks,
      case
        when coalesce((budgets.j -> mc.manager_name ->> 'salaryDebtActive')::boolean, false) then 'Divida salarial'
        when coalesce((budgets.j -> mc.manager_name ->> 'remainingBudget')::numeric, 0) < 0 then 'Divida salarial'
        when (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)) * 4 > coalesce((budgets.j -> mc.manager_name ->> 'totalBudget')::numeric, 22000000) * coalesce((select max_payroll_to_budget_ratio from rules), 0.36) then 'Folha acima do teto'
        when (coalesce(br.base_roster_weekly, 0) + coalesce(tp.transfer_payroll_weekly, 0)) * 4 > coalesce((budgets.j -> mc.manager_name ->> 'totalBudget')::numeric, 22000000) * coalesce((select warning_payroll_to_budget_ratio from rules), 0.24) then 'Atencao'
        else 'Saudavel'
      end as risk
    from manager_clubs mc
    cross join budgets
    left join base_roster br on br.manager_id = mc.manager_id
    left join transfer_payroll tp on tp.manager_id = mc.manager_id
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by payroll_weekly desc), '[]'::jsonb)
  from rows;
$$;

create or replace function public.app_get_squad_management_data()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with manager_clubs as (
    select
      m.id as manager_id,
      m.display_name as manager_name,
      c.id as club_id,
      c.name as club_name,
      c.logo_url,
      c.primary_color,
      c.secondary_color,
      c.strength
    from public.managers m
    join public.clubs c on c.owner_id = m.id
    where c.is_human is true
  )
  select jsonb_build_object(
    'ok', true,
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'managerId', manager_id,
        'managerName', manager_name,
        'clubId', club_id,
        'clubName', club_name,
        'logoUrl', logo_url,
        'primaryColor', primary_color,
        'secondaryColor', secondary_color,
        'strength', strength
      ) order by manager_name)
      from manager_clubs
    ), '[]'::jsonb),
    'rosters', coalesce((
      select jsonb_object_agg(mc.manager_name, coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'clubName', r.club_name,
          'managerName', r.manager_name,
          'eaId', r.ea_id,
          'rank', r.ea_rank,
          'name', r.player_name,
          'position', r.position,
          'positionLabel', r.position_label,
          'overall', r.overall,
          'weeklySalary', r.estimated_weekly_salary_eur,
          'sourceWeeklyPayroll', r.source_weekly_payroll_eur,
          'avatarUrl', r.avatar_url,
          'shieldUrl', r.shield_url,
          'nation', r.nation,
          'sourceName', r.source_name,
          'sourceUrl', r.source_url
        ) order by r.overall desc, r.ea_rank nulls last, r.player_name)
        from public.club_roster_players r
        where lower(r.club_name) = lower(mc.club_name)
      ), '[]'::jsonb))
      from manager_clubs mc
    ), '{}'::jsonb),
    'lineups', coalesce((
      select jsonb_object_agg(mc.manager_name, jsonb_build_object(
        'managerId', mc.manager_id,
        'managerName', mc.manager_name,
        'clubName', mc.club_name,
        'formation', coalesce(l.formation, '4-2-3-1'),
        'lineup', coalesce(l.lineup, '{}'::jsonb),
        'updatedAt', l.updated_at
      ))
      from manager_clubs mc
      left join public.manager_squad_lineups l on l.manager_id = mc.manager_id
    ), '{}'::jsonb),
    'finance', coalesce(public.app_get_manager_finance_forecast(), '[]'::jsonb),
    'sources', jsonb_build_object(
      'ratings', 'EA SPORTS FC 26 official team ratings',
      'salary', 'Capology 2025-2026 Championship fixed wage estimates',
      'currency', 'GBP payroll totals converted to EUR at 1.17 for league accounting'
    )
  );
$$;

create or replace function public.app_save_manager_squad_lineup(
  p_manager_id text,
  p_access_code text,
  p_club_name text,
  p_formation text,
  p_lineup jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login jsonb;
  v_is_commissioner boolean;
  v_target_manager_id text;
  v_target_manager_name text;
  v_target_club_name text;
  v_total integer := 0;
  v_distinct integer := 0;
  v_invalid integer := 0;
begin
  v_login := public.app_security_login(p_manager_id, p_access_code);
  if coalesce((v_login ->> 'ok')::boolean, false) is false then
    return v_login;
  end if;

  v_is_commissioner := coalesce((v_login ->> 'isCommissioner')::boolean, false);

  if v_is_commissioner and coalesce(trim(p_club_name), '') <> '' then
    select c.owner_id, m.display_name, c.name
      into v_target_manager_id, v_target_manager_name, v_target_club_name
    from public.clubs c
    join public.managers m on m.id = c.owner_id
    where lower(c.name) = lower(trim(p_club_name))
    limit 1;
  else
    v_target_manager_id := coalesce(v_login ->> 'managerId', '');
    v_target_manager_name := coalesce(v_login ->> 'managerName', '');
    v_target_club_name := coalesce(v_login ->> 'clubName', '');
  end if;

  if coalesce(v_target_manager_id, '') = '' or coalesce(v_target_club_name, '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Clube do tecnico nao encontrado.');
  end if;

  if not v_is_commissioner and lower(v_target_manager_id) <> lower(p_manager_id) then
    return jsonb_build_object('ok', false, 'message', 'Voce so pode salvar a sua propria escalacao.');
  end if;

  if coalesce(trim(p_formation), '') not in ('4-4-2', '4-2-3-1', '4-3-3', '3-5-2', '5-3-2') then
    return jsonb_build_object('ok', false, 'message', 'Formacao invalida.');
  end if;

  with selected as (
    select nullif(trim(value #>> '{}'), '') as roster_id
    from jsonb_each(coalesce(p_lineup, '{}'::jsonb))
    where jsonb_typeof(value) in ('number', 'string')
      and lower(coalesce(value #>> '{}', '')) not in ('', 'null', 'undefined')
  ), numeric_selected as (
    select roster_id
    from selected
    where roster_id ~ '^[0-9]+$'
  )
  select
    (select count(*) from selected),
    (select count(distinct roster_id) from numeric_selected),
    (select count(*) from selected s where s.roster_id !~ '^[0-9]+$'
      or not exists (
        select 1
        from public.club_roster_players r
        where r.id = s.roster_id::bigint
          and lower(r.club_name) = lower(v_target_club_name)
      ))
    into v_total, v_distinct, v_invalid;

  if v_invalid > 0 then
    return jsonb_build_object('ok', false, 'message', 'A escalacao contem jogador fora deste elenco.');
  end if;

  if v_total > 11 then
    return jsonb_build_object('ok', false, 'message', 'A escalacao inicial pode ter no maximo 11 jogadores.');
  end if;

  if v_total <> v_distinct then
    return jsonb_build_object('ok', false, 'message', 'Nao repita o mesmo jogador na escalacao.');
  end if;

  insert into public.manager_squad_lineups (
    manager_id,
    manager_name,
    club_name,
    formation,
    lineup,
    updated_at
  ) values (
    v_target_manager_id,
    v_target_manager_name,
    v_target_club_name,
    trim(p_formation),
    coalesce(p_lineup, '{}'::jsonb),
    now()
  )
  on conflict (manager_id) do update set
    manager_name = excluded.manager_name,
    club_name = excluded.club_name,
    formation = excluded.formation,
    lineup = excluded.lineup,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'message', 'Escalacao salva.',
    'managerName', v_target_manager_name,
    'clubName', v_target_club_name,
    'formation', trim(p_formation),
    'lineup', coalesce(p_lineup, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.app_get_manager_current_payroll(text, text) to anon, authenticated;
grant execute on function public.app_get_finance_rules() to anon, authenticated;
grant execute on function public.app_get_manager_finance_forecast() to anon, authenticated;
grant execute on function public.app_get_squad_management_data() to anon, authenticated;
grant execute on function public.app_save_manager_squad_lineup(text, text, text, text, jsonb) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
