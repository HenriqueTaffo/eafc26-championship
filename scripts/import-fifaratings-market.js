#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE_NAME = "FIFA Ratings normal FC ratings";
const PLAYER_SLUG_ALIASES = {
  "vinicius-junior": ["vinicius-jose-de-oliveira-junior", "vini-jr"],
  "vinicius-jr": ["vinicius-jose-de-oliveira-junior", "vini-jr"],
  "vini-jr": ["vinicius-jose-de-oliveira-junior"],
  "mbappe": ["kylian-mbappe"],
  "dembele": ["ousmane-dembele"],
  "ruben-dias": ["ruben-santos-gato-alves-dias"],
  "rodrigo-de-paul": ["rodrigo-javier-de-paul"],
  "kyle-walker": ["kyle-andrew-walker"],
  "n-golo-kante": ["ngolo-kante"],
  "neymar": ["neymar-jr"],
  "ronaldo": ["cristiano-ronaldo"]
};
const PLAYER_SLUG_REJECTS = {
  "kyle-walker": ["kyle-walker-peters"]
};
const MANUAL_RATINGS = {
  "kyle-walker": {
    ea_id: "188377",
    rank: null,
    name: "Kyle Walker",
    nation: "England",
    club: "Burnley",
    position: "RB",
    overall: 79,
    pace: 80,
    shooting: 64,
    passing: 75,
    dribbling: 76,
    defending: 77,
    physical: 78,
    avatar_url: "https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p188377.png?padding=0.7",
    shield_url: "https://ratings-images-prod.pulse.ea.com/FC25/full/player-shields/en/188377.png?width=265",
    card_type: "Normal",
    gender: "Men's Football",
    source_url: "https://www.ea.com/games/ea-sports-fc/ratings/player-ratings/kyle-walker/188377",
    source_name: "EA SPORTS FC official ratings"
  }
};
const SUPABASE_PAGE_SIZE = 1000;
const RATING_FETCH_CONCURRENCY = 12;
const RATING_FETCH_TIMEOUT_MS = 8000;

function getConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function getArg(name, fallback = "") {
  const direct = process.argv.find(arg => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function similarity(a, b) {
  const left = slugify(a).split("-").filter(Boolean);
  const right = slugify(b).split("-").filter(Boolean);
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const overlap = right.filter(part => leftSet.has(part)).length;
  return overlap / Math.max(left.length, right.length);
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function toInt(value) {
  const number = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function extractBetween(html, pattern) {
  return htmlDecode(html.match(pattern)?.[1] || "").replace(/<[^>]+>/g, "").trim();
}

function parseFifaRatingsPage(html, fallbackName, url) {
  const title = extractBetween(html, /<h1[^>]*class="[^"]*header-title[^"]*"[^>]*>\s*([^<]+?)\s*<\/h1>/i) || fallbackName;
  const overall = toInt(html.match(/<span class="[\d.,]+ attribute-box-player[^"]*">(\d+)<\/span>/i)?.[1]);
  const avatarUrl = htmlDecode(html.match(/<img class="profile-photo" src="([^"]+)"/i)?.[1] || "");
  const club = extractBetween(html, /Team:\s*<a[^>]*>\s*([^<]+?)\s*<\/a>/i);
  const nation = extractBetween(html, /Nationality:\s*<a[^>]*>\s*([^<]+?)\s*<img/i);
  const position = extractBetween(html, /Position:\s*<a[^>]*>([^<]+?)<\/a>/i).replace(/\(([^)]+)\)/, "$1");
  const pace = toInt(html.match(/Pace Rating:\s*(\d+)/i)?.[1]);
  const shooting = toInt(html.match(/Shooting Rating:\s*(\d+)/i)?.[1]);
  const passing = toInt(html.match(/Passing Rating:\s*(\d+)/i)?.[1]);
  const dribbling = toInt(html.match(/Dribbling Rating:\s*(\d+)/i)?.[1]);
  const defending = toInt(html.match(/Defending Rating:\s*(\d+)/i)?.[1]);
  const physical = toInt(html.match(/Physicality Rating:\s*(\d+)/i)?.[1]);

  const fallbackSlug = slugify(fallbackName);
  const titleSlug = slugify(title);
  if (!overall || !avatarUrl || /women|femin/i.test(html)) return null;
  if ((PLAYER_SLUG_REJECTS[fallbackSlug] || []).includes(titleSlug)) return null;
  if (similarity(title, fallbackName) < 0.45) return null;

  return {
    ea_id: `fifaratings:${slugify(title)}`,
    name: title,
    nation,
    club,
    position,
    overall,
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    avatar_url: avatarUrl,
    card_type: "Normal",
    gender: "Men's Football",
    source_url: url,
    source_name: SOURCE_NAME
  };
}

async function fetchMarketPlayers(supabaseUrl, supabaseKey, limit) {
  const shouldImportAll = process.argv.includes("--all");
  const marketPlayers = [];
  let offset = 0;

  while (true) {
    const remaining = shouldImportAll ? SUPABASE_PAGE_SIZE : Math.min(SUPABASE_PAGE_SIZE, limit - marketPlayers.length);
    if (remaining <= 0) break;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/players_market?select=name,club,position,market_value_eur&order=market_value_eur.desc.nullslast&limit=${remaining}&offset=${offset}`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!response.ok) throw new Error(await response.text());
    const page = await response.json();
    marketPlayers.push(...page);
    if (page.length < remaining) break;
    offset += page.length;
  }

  const appDataResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/app_get_data`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: "{}"
  });
  const appData = appDataResponse.ok ? await appDataResponse.json() : {};
  const transferPlayers = (appData.transfers || []).map(item => ({
    name: item.Jogador,
    club: item.ClubeOrigem,
    position: "",
    market_value_eur: Number(item.ValorTransfermarkt || 0)
  }));

  const byName = [...marketPlayers, ...transferPlayers].reduce((acc, item) => {
    const key = slugify(item.name);
    if (key && !acc[key]) acc[key] = item;
    return acc;
  }, {});

  return Object.values(byName);
}

async function fetchRatingsForPlayers(marketPlayers) {
  const players = [];

  for (let index = 0; index < marketPlayers.length; index += RATING_FETCH_CONCURRENCY) {
    const batch = marketPlayers.slice(index, index + RATING_FETCH_CONCURRENCY);
    const ratings = await Promise.all(batch.map(player => fetchRatingForPlayer(player)));
    players.push(...ratings.filter(Boolean));
    const processed = Math.min(index + RATING_FETCH_CONCURRENCY, marketPlayers.length);
    if (processed % 120 === 0 || processed === marketPlayers.length) {
      console.error(`Processados ${processed}/${marketPlayers.length}; encontrados ${players.length}.`);
    }
  }

  return players;
}

async function fetchRatingForPlayer(player) {
  const slug = slugify(player.name);
  if (!slug) return null;
  if (MANUAL_RATINGS[slug]) return MANUAL_RATINGS[slug];
  const slugs = [...new Set([slug, ...(PLAYER_SLUG_ALIASES[slug] || [])])];

  for (const candidate of slugs) {
    const url = `https://www.fifaratings.com/${candidate}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(RATING_FETCH_TIMEOUT_MS) });
      if (!response.ok) continue;
      const html = await response.text();
      if (!html.includes("FC 26 Rating")) continue;
      const parsed = parseFifaRatingsPage(html, player.name, url);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }

  return null;
}

async function main() {
  const limit = Math.max(1, Math.min(Number(getArg("--limit", "80")) || 80, 2000));
  const configSource = fs.readFileSync(path.join(ROOT_DIR, "js/config.js"), "utf8");
  const supabaseUrl = process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");
  const marketPlayers = await fetchMarketPlayers(supabaseUrl, supabaseKey, limit);
  const players = await fetchRatingsForPlayers(marketPlayers);

  if (DRY_RUN) {
    console.log(JSON.stringify({
      ok: true,
      searched: marketPlayers.length,
      found: players.length,
      preview: players.slice(0, 10).map(player => ({
        name: player.name,
        overall: player.overall,
        club: player.club,
        photo: Boolean(player.avatar_url)
      }))
    }, null, 2));
    return;
  }

  if (!players.length) throw new Error("Nenhum jogador com foto/overall encontrado no FIFA Ratings.");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/app_upsert_ea_player_ratings`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_players: players })
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase respondeu ${response.status}`);
  console.log(text || JSON.stringify({ ok: true, upserted: players.length }));
  console.log(`Importados ${players.length} jogadores normais masculinos do FIFA Ratings.`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
