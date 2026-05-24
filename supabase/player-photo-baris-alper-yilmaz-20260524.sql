-- Corrige foto do Baris Alper Yilmaz no mercado - 24/05/2026.

update public.players_market
   set avatar_url = 'https://cdn.sofifa.net/players/263/205/26_240.png',
       last_synced_at = now()
 where lower(normalized_name) in ('barış alper yılmaz', 'baris alper yilmaz')
   and transfermarkt_url like '%/spieler/541537%';
