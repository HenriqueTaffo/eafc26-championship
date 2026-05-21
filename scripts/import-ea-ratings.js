#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const EA_RATINGS_URL = "https://www.ea.com/games/ea-sports-fc/ratings";
const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

function getConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function toInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapPlayer(player) {
  const name = player.commonName || [player.firstName, player.lastName].filter(Boolean).join(" ");
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
    source_name: "EA SPORTS FC official ratings"
  };
}

async function main() {
  const configSource = fs.readFileSync(path.join(ROOT_DIR, "js/config.js"), "utf8");
  const supabaseUrl = process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL/key não encontrados.");
  }

  const response = await fetch(EA_RATINGS_URL);
  if (!response.ok) throw new Error(`EA respondeu ${response.status}`);

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
  if (!match) throw new Error("Não encontrei __NEXT_DATA__ na página oficial da EA.");

  const pageData = JSON.parse(match[1]);
  const items = pageData?.props?.pageProps?.ratingDetails?.items || [];
  const players = items
    .filter(player => Number(player.gender?.id) === 0 || String(player.gender?.label || "").toLowerCase().startsWith("men"))
    .map(mapPlayer)
    .filter(player => player.name && player.overall);

  if (!players.length) {
    throw new Error("Nenhum jogador encontrado no payload oficial da EA.");
  }

  if (DRY_RUN) {
    const preview = players.slice(0, 5).map(player => ({
      name: player.name,
      overall: player.overall,
      club: player.club,
      photo: Boolean(player.avatar_url)
    }));
    console.log(JSON.stringify({ ok: true, found: players.length, preview }, null, 2));
    return;
  }

  let rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/app_replace_ea_player_ratings`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_players: players,
      p_source_name: "EA SPORTS FC official ratings"
    })
  });

  if (rpcResponse.status === 404) {
    rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/app_upsert_ea_player_ratings`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_players: players })
    });
  }

  const text = await rpcResponse.text();
  if (!rpcResponse.ok) {
    throw new Error(text || `Supabase respondeu ${rpcResponse.status}`);
  }

  console.log(text || JSON.stringify({ ok: true, upserted: players.length }));
  console.log(`Importados ${players.length} jogadores da EA oficial com fotos.`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
