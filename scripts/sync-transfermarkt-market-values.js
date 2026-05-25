#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_LIMIT = 250;
const REQUEST_DELAY_MS = 850;
const REQUEST_TIMEOUT_MS = 15000;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseMarketValue(raw) {
  const text = String(raw || "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();
  const match = text.match(/€([\d.,]+)(bn|m|k|th\.)?/i);
  if (!match) return 0;

  const normalizedNumber = match[1].includes(",") && match[1].includes(".")
    ? match[1].replace(/,/g, "")
    : match[1].replace(",", ".");
  const amount = Number(normalizedNumber);
  if (!Number.isFinite(amount)) return 0;

  const suffix = match[2] || "";
  if (suffix === "bn") return Math.round(amount * 1000000000);
  if (suffix === "m") return Math.round(amount * 1000000);
  if (suffix === "k" || suffix === "th.") return Math.round(amount * 1000);
  return Math.round(amount);
}

function extractMarketValue(html) {
  const focusedPatterns = [
    /data-header=["']\s*(€[^"']+)["']/i,
    /data-header__market-value-wrapper[\s\S]{0,400}?>([^<]*€[^<]*)</i,
    /current market value[\s\S]{0,500}?(€\s*[\d.,]+\s*(?:bn|m|k|th\.)?)/i,
    /valor de mercado atual[\s\S]{0,500}?(€\s*[\d.,]+\s*(?:bn|m|k|th\.)?)/i
  ];

  for (const pattern of focusedPatterns) {
    const value = parseMarketValue(html.match(pattern)?.[1] || "");
    if (value > 0) return value;
  }

  const candidates = [...html.matchAll(/€\s*[\d.,]+\s*(?:bn|m|k|th\.)?/gi)]
    .map(match => parseMarketValue(match[0]))
    .filter(Boolean);

  return candidates[0] || 0;
}

function extractLastUpdate(html) {
  const text = html
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return text.match(/Last update:\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)?.[1]
    || text.match(/Última alteração:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i)?.[1]
    || "";
}

async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT_MS) {
  return await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeout)
  });
}

function getSupabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

async function loadMarketPlayers(supabaseUrl, key, limit, playerQuery) {
  const encodedSelect = "id,name,club,market_value_eur,transfermarkt_url,source,last_synced_at";
  const queryFilter = playerQuery
    ? `&or=(name.ilike.*${encodeURIComponent(playerQuery)}*,club.ilike.*${encodeURIComponent(playerQuery)}*)`
    : "";
  const url = `${supabaseUrl}/rest/v1/players_market?select=${encodedSelect}&transfermarkt_url=not.is.null${queryFilter}&order=last_synced_at.asc.nullsfirst&limit=${limit}`;
  const response = await fetchWithTimeout(url, { headers: getSupabaseHeaders(key) });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase respondeu ${response.status}`);
  return JSON.parse(text);
}

async function fetchTransfermarktValue(player) {
  const response = await fetchWithTimeout(player.transfermarkt_url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; 4LinhasBot/1.0; +https://henriquetaffo.github.io/eafc26-championship/)",
      "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`Transfermarkt respondeu ${response.status}`);
  const html = await response.text();
  return {
    marketValue: extractMarketValue(html),
    lastUpdate: extractLastUpdate(html)
  };
}

async function updateMarketValue(supabaseUrl, key, player, marketValue) {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/players_market?id=eq.${player.id}`, {
    method: "PATCH",
    headers: {
      ...getSupabaseHeaders(key),
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      market_value_eur: marketValue,
      source: "transfermarkt_profile_sync",
      last_synced_at: new Date().toISOString()
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase respondeu ${response.status}`);
}

async function main() {
  const configSource = fs.readFileSync(path.join(ROOT_DIR, "js/config.js"), "utf8");
  const supabaseUrl = process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const readKey = process.env.SUPABASE_PUBLISHABLE_KEY || getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");
  const writeKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const limit = Math.max(1, Math.min(Number(getArg("--limit", DEFAULT_LIMIT)) || DEFAULT_LIMIT, 1000));
  const playerQuery = getArg("--player", "").trim();

  if (!supabaseUrl || !readKey) throw new Error("Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.");
  if (!DRY_RUN && !writeKey) {
    throw new Error("Para gravar valores, configure SUPABASE_SERVICE_ROLE_KEY. Use --dry-run para apenas conferir.");
  }

  const players = await loadMarketPlayers(supabaseUrl, readKey, limit, playerQuery);
  const summary = {
    ok: true,
    dryRun: DRY_RUN,
    checked: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    updates: []
  };

  for (const player of players) {
    await sleep(REQUEST_DELAY_MS);
    summary.checked += 1;

    try {
      const live = await fetchTransfermarktValue(player);
      if (!live.marketValue) throw new Error("Valor de mercado não encontrado no perfil.");

      const currentValue = Number(player.market_value_eur || 0);
      const changed = currentValue !== live.marketValue;
      summary.updates.push({
        id: player.id,
        name: player.name,
        club: player.club,
        previous: currentValue,
        next: live.marketValue,
        changed,
        lastUpdate: live.lastUpdate
      });

      if (changed) {
        summary.changed += 1;
        if (!DRY_RUN) await updateMarketValue(supabaseUrl, writeKey, player, live.marketValue);
      } else {
        summary.unchanged += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.updates.push({
        id: player.id,
        name: player.name,
        club: player.club,
        error: error.message
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
