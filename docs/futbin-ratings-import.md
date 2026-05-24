# FUTBIN Ratings Import

Use this flow only with a CSV/export you are allowed to use. Do not scrape FUTBIN pages automatically.

Expected CSV columns are flexible. The importer accepts common headers such as:

- `name`, `player`, `player name`
- `overall`, `ovr`, `rating`
- `club`, `team`
- `position`, `pos`
- `nation`, `nationality`, `country`
- `version`, `card_type`, `card type`, `rarity`, `quality`
- `avatar_url`, `image_url`, `photo_url`

Only base/normal/gold cards are imported by default. Special cards such as TOTW, TOTY, TOTS, Hero, Icon, SBC and Evolutions are ignored so league overalls stay grounded.

Dry run:

```bash
npm run sync:futbin-ratings:dry -- --file data/futbin-ratings.csv
```

Import and replace the current FUTBIN source snapshot:

```bash
npm run sync:futbin-ratings -- --file data/futbin-ratings.csv
```

Append/update without removing older FUTBIN rows:

```bash
npm run sync:futbin-ratings -- --file data/futbin-ratings.csv --append
```

After import, `app_search_ea_player_ratings` prioritizes sources in this order:

1. FUTBIN
2. EA FC official ratings
3. SoFIFA
4. FIFA Ratings
5. Other imported ratings
