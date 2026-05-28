#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const EA_RATINGS_URL = "https://www.ea.com/games/ea-sports-fc/ratings";
const EA_RATINGS_LOCALE = "en";
const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const PAGE_SIZE = 100;
const PAGE_FETCH_CONCURRENCY = 6;
const UPSERT_BATCH_SIZE = 400;

function getConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function toInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isMensPlayer(player) {
  return (
    Number(player?.gender?.id) === 0 ||
    String(player?.gender?.label || "").toLowerCase().startsWith("men")
  );
}

function mapPlayer(player) {
  const name =
    player.commonName ||
    [player.firstName, player.lastName].filter(Boolean).join(" ");
  const stats = player.stats || {};

  return {
    ea_id: String(player.id || ""),
    rank: toInt(player.rank),
    name,
    nation: player.nationality?.label || "",
    club: player.team?.label || "",
    position: player.position?.shortLabel || player.position?.label || "",
    overall: toInt(player.overallRating),
    pace: toInt(stats.pac?.value),
    shooting: toInt(stats.sho?.value),
    passing: toInt(stats.pas?.value),
    dribbling: toInt(stats.dri?.value),
    defending: toInt(stats.def?.value),
    physical: toInt(stats.phy?.value),
    avatar_url: player.avatarUrl || "",
    shield_url: player.shieldUrl || "",
    card_type: "Normal",
    gender: player.gender?.label || "",
    source_url: EA_RATINGS_URL,
    source_name: "EA SPORTS FC official ratings",
  };
}

async function fetchInitialPageData() {
  const response = await fetch(EA_RATINGS_URL);
  if (!response.ok) throw new Error(`EA respondeu ${response.status}`);

  const html = await response.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/,
  );
  if (!match) {
    throw new Error("NÃ£o encontrei __NEXT_DATA__ na pÃ¡gina oficial da EA.");
  }

  return JSON.parse(match[1]);
}

async function fetchRatingsPage(buildId, pageNumber) {
  const url = new URL(
    `https://www.ea.com/_next/data/${buildId}/${EA_RATINGS_LOCALE}/games/ea-sports-fc/ratings.json`,
  );
  if (pageNumber > 1) {
    url.searchParams.set("page", String(pageNumber));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EA respondeu ${response.status} na página ${pageNumber}`);
  }
  const payload = await response.json();
  return payload?.pageProps?.ratingDetails?.items || [];
}

async function collectAllRatings(pageData) {
  const firstItems = pageData?.props?.pageProps?.ratingDetails?.items || [];
  const totalItems = Number(
    pageData?.props?.pageProps?.ratingDetails?.totalItems ||
      firstItems.length ||
      0,
  );
  const buildId = pageData?.buildId;
  if (!buildId) throw new Error("Build ID da página de ratings não encontrado.");

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const allItems = [...firstItems];

  for (
    let pageStart = 2;
    pageStart <= totalPages;
    pageStart += PAGE_FETCH_CONCURRENCY
  ) {
    const batch = [];
    for (
      let pageNumber = pageStart;
      pageNumber < pageStart + PAGE_FETCH_CONCURRENCY &&
      pageNumber <= totalPages;
      pageNumber += 1
    ) {
      batch.push(pageNumber);
    }

    const groups = await Promise.all(
      batch.map((pageNumber) => fetchRatingsPage(buildId, pageNumber)),
    );
    allItems.push(...groups.flat());
  }

  const byId = allItems.reduce((acc, player) => {
    const key = String(player?.id || "");
    if (key && !acc[key]) acc[key] = player;
    return acc;
  }, {});

  return Object.values(byId);
}

async function upsertRatingsBatch(supabaseUrl, supabaseKey, players) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/app_upsert_ea_player_ratings`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_players: players }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase respondeu ${response.status}`);
  }

  return text;
}

async function main() {
  const configSource = fs.readFileSync(
    path.join(ROOT_DIR, "js/config.js"),
    "utf8",
  );
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    getConfigValue(configSource, "SUPABASE_URL");
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL/key nÃ£o encontrados.");
  }

  const pageData = await fetchInitialPageData();
  const items = await collectAllRatings(pageData);
  const players = items
    .filter(isMensPlayer)
    .map(mapPlayer)
    .filter((player) => player.name && player.overall);

  if (!players.length) {
    throw new Error("Nenhum jogador encontrado no payload oficial da EA.");
  }

  if (DRY_RUN) {
    const preview = players.slice(0, 5).map((player) => ({
      name: player.name,
      overall: player.overall,
      club: player.club,
      photo: Boolean(player.avatar_url),
    }));
    console.log(
      JSON.stringify({ ok: true, found: players.length, preview }, null, 2),
    );
    return;
  }

  let uploaded = 0;
  let lastResponse = "";
  for (let index = 0; index < players.length; index += UPSERT_BATCH_SIZE) {
    const batch = players.slice(index, index + UPSERT_BATCH_SIZE);
    lastResponse = await upsertRatingsBatch(supabaseUrl, supabaseKey, batch);
    uploaded += batch.length;
    console.error(`Upsert EA ratings: ${uploaded}/${players.length}`);
  }

  console.log(
    lastResponse || JSON.stringify({ ok: true, upserted: players.length }),
  );
  console.log(`Importados ${players.length} jogadores da EA oficial com fotos.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
