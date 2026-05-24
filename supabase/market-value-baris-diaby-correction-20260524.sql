-- Correção pontual de troca - 24/05/2026.
--
-- Barış Alper Yılmaz foi usado como abatimento na compra de Moussa Diaby.
-- O valor usado na negociação estava em €26.000.000, mas o Transfermarkt
-- atualizou o atleta para €30.000.000 em 21/05/2026.
--
-- Regra de troca: 85% do valor de mercado.
-- Crédito antigo: €22.100.000.
-- Crédito correto: €25.500.000.
-- Diferença devolvida no orçamento do Henrique: €3.400.000.

begin;

update public.players_market
   set market_value_eur = 30000000,
       source = 'transfermarkt_profile_sync',
       last_synced_at = now()
 where id = 407
   and lower(name) = lower('Barış Alper Yılmaz');

update public.transfers
   set trade_in_credit = 25500000,
       negotiated_value = 6700000,
       reason = 'OK - Troca: Barış Alper Yılmaz (valor TM corrigido para €30 mi em 21/05/2026)',
       updated_at = now()
 where id = 99
   and buyer_id = 'henrique'
   and lower(player_name) = lower('Moussa Diaby');

update public.transfers
   set market_value = 30000000,
       reason = 'Troca usada na compra de Moussa Diaby (base TM corrigida para €30 mi em 21/05/2026)',
       updated_at = now()
 where id = 100
   and seller_id = 'henrique'
   and lower(player_name) = lower('Barış Alper Yılmaz');

commit;

select public.app_get_budget_reconciliation() -> 'Henrique' as henrique_budget;
