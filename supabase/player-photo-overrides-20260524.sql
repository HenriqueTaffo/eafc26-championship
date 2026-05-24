-- Correcoes pontuais de retratos em cards de transferencia - 24/05/2026.
-- Usa identidade jogador + clube para evitar colisao entre homonimos.

update public.players_market
   set avatar_url = 'https://img.a.transfermarkt.technology/portrait/big/484547-1689710682.jpg?lm=1',
       last_synced_at = now()
 where transfermarkt_url like '%/spieler/484547'
    or (
      lower(coalesce(name, '')) = lower('Jeremie Frimpong')
      and lower(coalesce(club, '')) = lower('Liverpool Football Club')
    );

update public.players_market
   set avatar_url = 'https://img.a.transfermarkt.technology/portrait/big/1006454-1771959088.jpg?lm=1',
       last_synced_at = now()
 where transfermarkt_url like '%/spieler/1006454'
    or (
      lower(coalesce(name, '')) = lower('Gabriel Silva')
      and lower(coalesce(club, '')) = lower('Sporting Clube de Portugal')
    );
