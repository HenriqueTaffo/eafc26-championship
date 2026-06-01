begin;

insert into public.players_market (
  name,
  normalized_name,
  club,
  league,
  country,
  position,
  age,
  market_value_eur,
  transfermarkt_url,
  avatar_url,
  source,
  last_synced_at
)
select
  'Shaqiri',
  'shaqiri',
  'Basel',
  'super-league',
  'Switzerland',
  'Attacking Midfield',
  34,
  1800000,
  'https://www.transfermarkt.co.uk/xherdan-shaqiri/profil/spieler/86792',
  null,
  'manual_patch_v21',
  now()
where not exists (
  select 1
  from public.players_market p
  where public.app_search_text_key(coalesce(p.normalized_name, p.name, '')) = 'shaqiri'
);

notify pgrst, 'reload schema';

commit;
