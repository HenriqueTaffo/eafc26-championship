begin;

update public.players_market
   set club = 'Kaiserslautern',
       league = '2-bundesliga',
       country = 'Germany',
       position = 'Centre-Back',
       age = 26,
       market_value_eur = 1000000,
       transfermarkt_url = 'https://www.transfermarkt.com/maxwell-gyamfi/profil/spieler/452078',
       avatar_url = coalesce(
         nullif(avatar_url, ''),
         'https://img.a.transfermarkt.technology/portrait/small/452078-1754511838.jpg?lm=1'
       ),
       source = 'transfermarkt_profile_sync',
       last_synced_at = now()
 where public.app_search_text_key(coalesce(normalized_name, name, '')) = 'maxwell gyamfi'
    or transfermarkt_url like '%/spieler/452078%';

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
  'Maxwell Gyamfi',
  'maxwell gyamfi',
  'Kaiserslautern',
  '2-bundesliga',
  'Germany',
  'Centre-Back',
  26,
  1000000,
  'https://www.transfermarkt.com/maxwell-gyamfi/profil/spieler/452078',
  'https://img.a.transfermarkt.technology/portrait/small/452078-1754511838.jpg?lm=1',
  'transfermarkt_profile_sync',
  now()
where not exists (
  select 1
  from public.players_market p
  where public.app_search_text_key(coalesce(p.normalized_name, p.name, '')) = 'maxwell gyamfi'
     or p.transfermarkt_url like '%/spieler/452078%'
);

notify pgrst, 'reload schema';

commit;
