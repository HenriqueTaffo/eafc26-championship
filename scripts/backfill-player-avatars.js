#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_DELAY_MS = 350;

function getArg(name, fallback = null) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function readConfigValue(key) {
  const configPath = path.join(ROOT_DIR, "js", "config.js");
  const contents = fs.readFileSync(configPath, "utf8");
  const match = contents.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTransfermarktPlayerId(url) {
  const match = String(url || "").match(/\/spieler\/(\d+)/);
  return match ? match[1] : "";
}

function pickTransfermarktPortrait(html, playerId) {
  const urls = [
    ...String(html || "").matchAll(
      /https:\/\/img\.a\.transfermarkt\.technology\/portrait\/[^"'<> ]+/g,
    ),
  ].map((match) => match[0].replace(/&amp;/g, "&"));

  const matchingUrls = playerId
    ? urls.filter((url) => url.includes(`/${playerId}-`))
    : urls;

  return (
    matchingUrls.find((url) => url.includes("/portrait/big/")) ||
    matchingUrls.find((url) => url.includes("/portrait/header/")) ||
    matchingUrls.find((url) => url.includes("/portrait/medium/")) ||
    matchingUrls[0] ||
    ""
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.hint ||
      data?.details ||
      text ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function fetchPlayersMissingAvatars({ supabaseUrl, headers, batchSize }) {
  const select = "id,name,club,transfermarkt_url";
  const url = `${supabaseUrl}/rest/v1/players_market?select=${select}&avatar_url=is.null&transfermarkt_url=not.is.null&order=market_value_eur.desc.nullslast&limit=${batchSize}`;
  return fetchJson(url, { headers });
}

async function fetchTransfermarktAvatar(player) {
  const playerId = getTransfermarktPlayerId(player.transfermarkt_url);
  const response = await fetch(player.transfermarkt_url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (compatible; EAFC26ChampionshipAvatarBackfill/1.0)",
    },
  });

  if (!response.ok) throw new Error(`Transfermarkt HTTP ${response.status}`);
  const html = await response.text();
  return pickTransfermarktPortrait(html, playerId);
}

async function updatePlayerAvatar({
  supabaseUrl,
  headers,
  playerId,
  avatarUrl,
}) {
  const url = `${supabaseUrl}/rest/v1/players_market?id=eq.${encodeURIComponent(playerId)}`;
  await fetchJson(url, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ avatar_url: avatarUrl }),
  });
}

async function main() {
  const supabaseUrl =
    process.env.SUPABASE_URL || readConfigValue("SUPABASE_URL");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    readConfigValue("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";
  const apiKey = serviceKey || publishableKey;
  const batchSize = Math.max(
    1,
    Math.min(Number(getArg("--batch-size", DEFAULT_BATCH_SIZE)), 100),
  );
  const delayMs = Math.max(0, Number(getArg("--delay-ms", DEFAULT_DELAY_MS)));
  const maxPlayers = Math.max(1, Number(getArg("--limit", 1000)));

  if (!supabaseUrl || !apiKey)
    throw new Error("Configure SUPABASE_URL e uma chave Supabase.");
  if (!DRY_RUN && !serviceKey) {
    throw new Error(
      "Para gravar fotos, rode com SUPABASE_SERVICE_ROLE_KEY. Use --dry-run para testar sem gravar.",
    );
  }

  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  };

  let scanned = 0;
  let updated = 0;
  let missed = 0;

  while (scanned < maxPlayers) {
    const remaining = maxPlayers - scanned;
    const players = await fetchPlayersMissingAvatars({
      supabaseUrl,
      headers,
      batchSize: Math.min(batchSize, remaining),
    });

    if (!Array.isArray(players) || !players.length) break;

    for (const player of players) {
      scanned += 1;

      try {
        const avatarUrl = await fetchTransfermarktAvatar(player);
        if (!avatarUrl) {
          missed += 1;
          console.log(
            `sem foto: ${player.name} (${player.club || "sem clube"})`,
          );
        } else if (DRY_RUN) {
          updated += 1;
          console.log(`dry-run: ${player.name} -> ${avatarUrl}`);
        } else {
          await updatePlayerAvatar({
            supabaseUrl,
            headers,
            playerId: player.id,
            avatarUrl,
          });
          updated += 1;
          console.log(`ok: ${player.name} -> ${avatarUrl}`);
        }
      } catch (error) {
        missed += 1;
        console.warn(`erro: ${player.name}: ${error.message}`);
      }

      if (delayMs) await sleep(delayMs);
      if (scanned >= maxPlayers) break;
    }
  }

  console.log(
    JSON.stringify({ scanned, updated, missed, dryRun: DRY_RUN }, null, 2),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
