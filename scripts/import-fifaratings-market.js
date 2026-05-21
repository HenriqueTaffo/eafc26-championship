#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE_NAME = "FIFA Ratings normal FC ratings";

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

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

  if (!overall || !avatarUrl || /women|femin/i.test(html)) return null;

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
  const response = await fetch(
    `${supabaseUrl}/rest/v1/players_market?select=name,club,position,market_value_eur&order=market_value_eur.desc.nullslast&limit=${limit}`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function fetchRatingForPlayer(player) {
  const slug = slugify(player.name);
  if (!slug) return null;
  const url = `https://www.fifaratings.com/${slug}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const html = await response.text();
  if (!html.includes("FC 26 Rating")) return null;
  return parseFifaRatingsPage(html, player.name, url);
}

async function main() {
  const limit = Math.max(1, Math.min(Number(getArg("--limit", "80")) || 80, 300));
  const configSource = fs.readFileSync(path.join(ROOT_DIR, "js/config.js"), "utf8");
  const supabaseUrl = process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");
  const marketPlayers = await fetchMarketPlayers(supabaseUrl, supabaseKey, limit);
  const players = [];

  for (const player of marketPlayers) {
    const rating = await fetchRatingForPlayer(player);
    if (rating) players.push(rating);
  }

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
