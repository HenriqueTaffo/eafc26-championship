-- Restore canonical transfer transaction values - 23/05/2026.
--
-- The canonical ledger migration must preserve the values already charged by
-- the app. This normalizes overall_rate so generated final_value matches the
-- transfer facts that were visible before legacy columns were removed.

begin;

with expected_values(manager_name, player_name, expected_final_value) as (
  values
    ('Bruno Silva', 'Theo Hernández', 32200000::numeric),
    ('Bruno Silva', 'Davinson Sánchez', 20700000::numeric),
    ('Bruno Silva', 'Heung-min Son', 20400000::numeric),
    ('Bruno Silva', 'Jayden Oosterwolde', 18900000::numeric),
    ('Bruno Silva', 'Rodrigo De Paul', 17250000::numeric),

    ('Henrique', 'Barış Alper Yılmaz', 26000000::numeric),
    ('Henrique', 'Thibaut Courtois', 18000000::numeric),
    ('Henrique', 'Federico Chiesa', 17250000::numeric),
    ('Henrique', 'Iñaki Williams', 11500000::numeric),
    ('Henrique', 'Antonio Rüdiger', 10800000::numeric),
    ('Henrique', 'Neymar', 10000000::numeric),
    ('Henrique', 'Antoine Griezmann', 10000000::numeric),
    ('Henrique', 'Lucas Torreira', 10000000::numeric),
    ('Henrique', 'N''Golo Kanté', 5400003.6::numeric),
    ('Henrique', 'Emre Can', 4600000::numeric),
    ('Henrique', 'David de Gea', 4200000::numeric),
    ('Henrique', 'Pierre-Emerick Aubameyang', 3450000::numeric),
    ('Henrique', 'Stephan El Shaarawy', 2625000::numeric),
    ('Henrique', 'Johan Mojica', 1890000::numeric),

    ('Rafael', 'Marcos Llorente', 22000000::numeric),
    ('Rafael', 'Lionel Messi', 18000000::numeric),
    ('Rafael', 'De bruyne', 12000000::numeric),
    ('Rafael', 'João cancelo', 10800000::numeric),
    ('Rafael', 'Memphis depay', 9200000::numeric),
    ('Rafael', 'Sadio Mané', 7000000::numeric),
    ('Rafael', 'Fred', 6900000::numeric),
    ('Rafael', 'Ayoze Pérez', 6000000::numeric),
    ('Rafael', 'Nicolas Pépé', 6000000::numeric),
    ('Rafael', 'Reinildo Mandava', 5750000::numeric),
    ('Rafael', 'Neuer', 4800000::numeric),
    ('Rafael', 'Isco ', 4000000::numeric),
    ('Rafael', 'Lukas Klostermann', 3500000::numeric),
    ('Rafael', 'Jeremiah St. Juste', 3150000::numeric),
    ('Rafael', 'DI Maria', 2300000::numeric),
    ('Rafael', 'Nacho Fernández', 2070000::numeric),
    ('Rafael', 'Álvaro García', 1800000::numeric),
    ('Rafael', 'Henrikh Mkhitaryan', 4025000::numeric),

    ('Renato', 'Mohamed Salah', 30000000::numeric),
    ('Renato', 'Malcom', 23000000::numeric),
    ('Renato', 'Virgil van Dijk', 18000000::numeric),
    ('Renato', 'Cristiano ronaldo', 14400000::numeric),
    ('Renato', 'Talisca', 9200000::numeric),
    ('Renato', 'Marcel Sabitzer', 8050000::numeric),
    ('Renato', 'Dybala', 6000000::numeric),
    ('Renato', 'Koulibaly', 5750000::numeric),
    ('Renato', 'Modric', 4800000::numeric),
    ('Renato', 'Marc-André ter Stegen', 4800000::numeric),
    ('Renato', 'Stefan de Vrij', 3500000::numeric),
    ('Renato', 'Leonardo Spinazzola', 3500000::numeric),
    ('Renato', 'Kyle Walker', 2625000::numeric),
    ('Renato', 'Al Dawari', 1495000::numeric),

    ('Willian', 'Ronald Araujo', 20000000::numeric),
    ('Willian', 'Roger Ibañez', 19550000::numeric),
    ('Willian', 'Alisson', 17000000::numeric),
    ('Willian', 'Sergej Milinković-Savić', 15000000::numeric),
    ('Willian', 'Almiron', 9450000::numeric),
    ('Willian', 'Casemiro', 9200000::numeric),
    ('Willian', 'Daniel Carvajal', 7200000::numeric),
    ('Willian', 'Karim Benzema', 7200000::numeric),
    ('Willian', 'Ferland Mendy', 6900000::numeric),
    ('Willian', 'Carrasco', 6900000::numeric),
    ('Willian', 'Rafa Silva', 5750000::numeric),
    ('Willian', 'Leandro Paredes', 4025000::numeric),
    ('Willian', 'Luis Suarez', 1575000::numeric),
    ('Willian', 'Marcelo Grohe', 300000::numeric)
)
update public.transfers t
   set overall_rate = case
         when coalesce(t.market_value, 0) > 0
           then greatest(0, (ev.expected_final_value / t.market_value) - 1)
         else 0
       end,
       updated_at = now()
  from expected_values ev
  join public.managers m
    on lower(m.display_name) = lower(ev.manager_name)
 where t.buyer_id = m.id
   and lower(t.player_name) = lower(ev.player_name)
   and t.status = 'approved'
   and t.transfer_type <> 'internal';

commit;
