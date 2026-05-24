-- Corrige foto do Talisca no mercado e nas movimentacoes - 24/05/2026.

update public.players_market
   set avatar_url = 'https://img.a.transfermarkt.technology/portrait/big/258626-1738664288.jpg?lm=1',
       last_synced_at = now()
 where lower(normalized_name) = 'talisca'
   and transfermarkt_url like '%/spieler/258626%';
