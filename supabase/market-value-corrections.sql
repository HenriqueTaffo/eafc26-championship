-- Correcoes pontuais da base players_market.
--
-- Como aplicar:
-- 1. Abra Supabase > SQL Editor.
-- 2. Rode este arquivo inteiro.
-- 3. Recarregue o app.

update public.players_market
   set market_value_eur = 10000000,
       last_synced_at = now()
 where lower(name) = lower('Lucas Torreira');

notify pgrst, 'reload schema';
