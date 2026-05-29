-- Normalize Angel Di Maria's market record so searches by full name resolve.
begin;

update public.players_market
   set name = 'Angel Di Maria',
       normalized_name = 'angel di maria',
       club = 'Rosario Central',
       league = 'Argentina Primera Division',
       country = 'Argentina',
       position = 'RW',
       age = 38,
       market_value_eur = 5200000,
       avatar_url = 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p183898.png?padding=0.7',
       last_synced_at = now()
 where id = 8
   and source = 'transferencias_existentes'
   and lower(trim(coalesce(normalized_name, name, ''))) = 'di maria';

update public.internal_transfer_proposals
   set player = 'Angel Di Maria',
       from_club = 'Rosario Central',
       seller = 'Rosario Central'
 where id = 21
   and public.app_search_text_key(player) = 'di maria'
   and public.app_search_text_key(seller) = 'rosario central';

notify pgrst, 'reload schema';

commit;
