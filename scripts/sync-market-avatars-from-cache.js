#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const CACHE_FILE = path.join(ROOT_DIR, "js", "market-avatars.js");
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_CONCURRENCY = 8;
const DRY_RUN = process.argv.includes("--dry-run");

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

function readAvatarCache() {
  const contents = fs.readFileSync(CACHE_FILE, "utf8");
  const match = contents.match(/App\.data\.marketPlayerAvatars\s*=\s*(\{[\s\S]*?\});/);
  if (!match) throw new Error("Não consegui ler App.data.marketPlayerAvatars.");
  return JSON.parse(match[1]);
}

function getTransfermarktPlayerId(url) {
  const match = String(url || "").match(/\/spieler\/(\d+)/);
  return match ? match[1] : "";
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
      data?.message || data?.hint || data?.details || text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function fetchPlayersMissingAvatars({ supabaseUrl, headers, limit }) {
  const rows = [];
  const pageSize = Math.max(1, Math.min(Number(getArg("--page-size", DEFAULT_PAGE_SIZE)), 1000));
  const maxRows = Math.max(0, Number(limit || 0));

  for (let offset = 0; ; offset += pageSize) {
    const remaining = maxRows ? Math.max(0, maxRows - rows.length) : pageSize;
    if (!remaining) break;

    const currentLimit = Math.min(pageSize, remaining);
    const select = "id,name,club,transfermarkt_url,avatar_url";
    const url = `${supabaseUrl}/rest/v1/players_market?select=${select}&avatar_url=is.null&transfermarkt_url=not.is.null&order=id.asc&limit=${currentLimit}&offset=${offset}`;
    const page = await fetchJson(url, { headers });
    if (!Array.isArray(page) || !page.length) break;

    rows.push(...page);
    if (page.length < currentLimit) break;
  }

  return rows;
}

async function updateAvatarRow({ supabaseUrl, headers, row }) {
  await fetchJson(`${supabaseUrl}/rest/v1/players_market?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      avatar_url: row.avatar_url,
      last_synced_at: row.last_synced_at,
    }),
  });
}

async function runPool(items, worker, concurrency) {
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || readConfigValue("SUPABASE_URL");
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || readConfigValue("SUPABASE_PUBLISHABLE_KEY");
  const apiKey =
    serviceKey ||
    publishableKey;
  const limit = Math.max(0, Number(getArg("--limit", 0)));
  const concurrency = Math.max(
    1,
    Math.min(Number(getArg("--concurrency", DEFAULT_CONCURRENCY)), 16),
  );

  if (!supabaseUrl || !apiKey) throw new Error("Configure SUPABASE_URL e uma chave Supabase.");
  if (!DRY_RUN && !serviceKey) {
    throw new Error(
      "Para gravar fotos, rode com SUPABASE_SERVICE_ROLE_KEY. Use --dry-run para conferir sem gravar.",
    );
  }

  const cache = readAvatarCache();
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
  const players = await fetchPlayersMissingAvatars({ supabaseUrl, headers, limit });
  const updates = players
    .map((player) => {
      const transfermarktId = getTransfermarktPlayerId(player.transfermarkt_url);
      const avatarUrl = cache[transfermarktId];
      if (!transfermarktId || !avatarUrl) return null;
      return {
        id: player.id,
        avatar_url: avatarUrl,
        last_synced_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          scanned: players.length,
          matchedInCache: updates.length,
          dryRun: true,
          sample: updates.slice(0, 5),
        },
        null,
        2,
      ),
    );
    return;
  }

  let updated = 0;
  await runPool(updates, async (row) => {
    await updateAvatarRow({ supabaseUrl, headers, row });
    updated += 1;
    if (updated % 250 === 0 || updated === updates.length) {
      console.log(`sincronizadas ${updated}/${updates.length} fotos`);
    }
  }, concurrency);

  console.log(
    JSON.stringify(
      {
        scanned: players.length,
        matchedInCache: updates.length,
        updated,
        missed: players.length - updates.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
