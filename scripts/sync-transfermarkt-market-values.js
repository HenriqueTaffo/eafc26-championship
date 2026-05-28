#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_LIMIT = 250;
const DEFAULT_DELAY_MS = 850;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 1200;
const REQUEST_TIMEOUT_MS = 15000;
const SUPABASE_CLI_COMMAND =
  process.platform === "win32" ? "supabase.cmd" : "supabase";

function getConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function getArg(name, fallback = "") {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function getMultiArg(name) {
  const values = [];
  process.argv.forEach((arg, index) => {
    if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1));
      return;
    }
    if (arg === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
    }
  });
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&#8217;|&#x2019;|&#39;|&apos;/gi, "'")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function parseMarketValue(raw) {
  const text = String(raw || "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();
  const match = text.match(/€([\d.,]+)(bn|m|k|th\.)?/i);
  if (!match) return 0;

  const normalizedNumber =
    match[1].includes(",") && match[1].includes(".")
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
    /valor de mercado atual[\s\S]{0,500}?(€\s*[\d.,]+\s*(?:bn|m|k|th\.)?)/i,
  ];

  for (const pattern of focusedPatterns) {
    const value = parseMarketValue(html.match(pattern)?.[1] || "");
    if (value > 0) return value;
  }

  const candidates = [...html.matchAll(/€\s*[\d.,]+\s*(?:bn|m|k|th\.)?/gi)]
    .map((match) => parseMarketValue(match[0]))
    .filter(Boolean);

  return candidates[0] || 0;
}

function extractLastUpdate(html) {
  const text = html
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return (
    text.match(/Last update:\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)?.[1] ||
    text.match(/Última alteração:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i)?.[1] ||
    ""
  );
}

async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT_MS) {
  return await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeout),
  });
}

function getSupabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function getProjectRef() {
  const filePath = path.join(ROOT_DIR, "supabase", ".temp", "project-ref");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "";
}

function getSupabaseServiceRoleKey(projectRef) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (process.env.SUPABASE_SERVICE_KEY) {
    return process.env.SUPABASE_SERVICE_KEY;
  }
  if (!projectRef) return "";

  const cli = spawnSync(
    SUPABASE_CLI_COMMAND,
    ["projects", "api-keys", "--project-ref", projectRef, "--output", "json"],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      shell: process.platform === "win32",
      windowsHide: true,
    },
  );
  if (cli.status !== 0) {
    throw new Error(
      String(cli.stderr || cli.stdout || "").trim() ||
        "Nao consegui ler a service_role key.",
    );
  }

  const payload = JSON.parse(cli.stdout || "[]");
  const serviceRoleEntry = payload.find(
    (entry) =>
      entry?.name === "service_role" ||
      entry?.id === "service_role" ||
      entry?.description?.includes("service_role"),
  );
  return serviceRoleEntry?.api_key || "";
}

function getOptions() {
  const limit = Math.max(
    1,
    Math.min(Number(getArg("--limit", DEFAULT_LIMIT)) || DEFAULT_LIMIT, 5000),
  );
  const offset = Math.max(0, Number(getArg("--offset", 0)) || 0);
  const delayMs = Math.max(0, Number(getArg("--delay-ms", DEFAULT_DELAY_MS)) || DEFAULT_DELAY_MS);
  const retryCount = Math.max(
    0,
    Math.min(Number(getArg("--retry-count", DEFAULT_RETRY_COUNT)) || DEFAULT_RETRY_COUNT, 8),
  );
  const retryDelayMs = Math.max(
    250,
    Number(getArg("--retry-delay-ms", DEFAULT_RETRY_DELAY_MS)) || DEFAULT_RETRY_DELAY_MS,
  );
  const staleDays = Math.max(0, Number(getArg("--stale-days", 0)) || 0);

  return {
    clubFilters: getMultiArg("--club"),
    delayMs,
    limit,
    offset,
    playerQuery: String(getArg("--player", "")).trim(),
    retryCount,
    retryDelayMs,
    staleDays,
  };
}

function matchesPlayerQuery(player, query = "") {
  const normalizedQuery = normalizeKey(query);
  if (!normalizedQuery) return true;
  return normalizeKey(
    [
      player.name,
      player.normalized_name,
      player.club,
      player.position,
      player.league,
    ]
      .filter(Boolean)
      .join(" "),
  ).includes(normalizedQuery);
}

function matchesClubFilters(player, filters = []) {
  if (!filters.length) return true;
  const clubKey = normalizeKey(player.club || "");
  return filters.some((filter) => clubKey.includes(normalizeKey(filter)));
}

function matchesStaleWindow(player, staleBeforeIso = "") {
  if (!staleBeforeIso) return true;
  const lastSyncedAt = String(player.last_synced_at || "").trim();
  return !lastSyncedAt || lastSyncedAt <= staleBeforeIso;
}

async function loadMarketPlayers(supabaseUrl, key, options) {
  if (options.playerQuery && !options.clubFilters.length) {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/rpc/app_search_market_players`,
      {
        method: "POST",
        headers: getSupabaseHeaders(key),
        body: JSON.stringify({
          p_query: options.playerQuery,
          p_show_contracted: true,
          p_limit: Math.max(options.limit * 6, 24),
        }),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Supabase respondeu ${response.status}`);
    }
    const payload = text ? JSON.parse(text) : [];
    return (Array.isArray(payload) ? payload : [])
      .filter((player) => matchesPlayerQuery(player, options.playerQuery))
      .slice(0, options.limit);
  }

  const select =
    "id,name,normalized_name,club,league,position,market_value_eur,transfermarkt_url,source,last_synced_at";
  const headers = getSupabaseHeaders(key);
  const pageSize = Math.min(1000, Math.max(options.limit, 200));
  const rows = [];
  let offset = options.offset;
  const staleBeforeIso =
    options.staleDays > 0
      ? new Date(Date.now() - options.staleDays * 24 * 60 * 60 * 1000).toISOString()
      : "";

  while (rows.length < options.limit) {
    const useServerPlayerFilter =
      Boolean(options.playerQuery) && !options.clubFilters.length;
    const queryFilter = useServerPlayerFilter
      ? `&or=(${[
          `name.ilike.*${options.playerQuery}*`,
          `normalized_name.ilike.*${normalizeKey(options.playerQuery)}*`,
          `club.ilike.*${options.playerQuery}*`,
        ]
          .map((item) => encodeURIComponent(item))
          .join(",")})`
      : "";
    const orderClause = useServerPlayerFilter
      ? "market_value_eur.desc.nullslast,name.asc"
      : "last_synced_at.asc.nullsfirst,name.asc";
    const url = `${supabaseUrl}/rest/v1/players_market?select=${select}&transfermarkt_url=not.is.null${queryFilter}&order=${orderClause}&limit=${pageSize}&offset=${offset}`;
    const response = await fetchWithTimeout(url, { headers });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Supabase respondeu ${response.status}`);
    }

    const page = text ? JSON.parse(text) : [];
    if (!Array.isArray(page) || !page.length) break;

    const filtered = page.filter(
      (player) =>
        matchesPlayerQuery(player, options.playerQuery) &&
        matchesClubFilters(player, options.clubFilters) &&
        matchesStaleWindow(player, staleBeforeIso),
    );
    rows.push(...filtered);

    if (page.length < pageSize) break;
    offset += page.length;
  }

  return rows.slice(0, options.limit);
}

async function fetchTransfermarktValue(player, options) {
  const response = await fetchWithTimeout(
    player.transfermarkt_url,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; 4LinhasBot/1.0; +https://henriquetaffo.github.io/eafc26-championship/)",
        "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8",
      },
    },
    REQUEST_TIMEOUT_MS,
  );

  if (!response.ok) {
    const error = new Error(`Transfermarkt respondeu ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const html = await response.text();
  return {
    marketValue: extractMarketValue(html),
    lastUpdate: extractLastUpdate(html),
  };
}

async function fetchTransfermarktValueWithRetry(player, options) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= options.retryCount) {
    try {
      return await fetchTransfermarktValue(player, options);
    } catch (error) {
      lastError = error;
      const isRetryable =
        error?.name === "AbortError" ||
        [403, 408, 429, 500, 502, 503, 504].includes(Number(error?.status || 0));
      if (!isRetryable || attempt >= options.retryCount) break;
      const waitMs = options.retryDelayMs * Math.max(1, attempt + 1);
      await sleep(waitMs);
      attempt += 1;
    }
  }

  throw lastError;
}

async function updateMarketValue(supabaseUrl, key, player, marketValue) {
  const response = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/players_market?id=eq.${player.id}`,
    {
      method: "PATCH",
      headers: {
        ...getSupabaseHeaders(key),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        market_value_eur: marketValue,
        source: "transfermarkt_profile_sync",
        last_synced_at: new Date().toISOString(),
      }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase respondeu ${response.status}`);
  }
}

async function main() {
  const options = getOptions();
  const configSource = fs.readFileSync(path.join(ROOT_DIR, "js/config.js"), "utf8");
  const supabaseUrl =
    process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const readKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");
  const writeKey = getSupabaseServiceRoleKey(getProjectRef());

  if (!supabaseUrl || !readKey) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.");
  }
  if (!DRY_RUN && !writeKey) {
    throw new Error(
      "Para gravar valores, configure SUPABASE_SERVICE_ROLE_KEY. Use --dry-run para apenas conferir.",
    );
  }

  const players = await loadMarketPlayers(supabaseUrl, readKey, options);
  const summary = {
    ok: true,
    dryRun: DRY_RUN,
    checked: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    limit: options.limit,
    offset: options.offset,
    nextOffset: options.offset + players.length,
    playerQuery: options.playerQuery,
    clubFilters: options.clubFilters,
    staleDays: options.staleDays,
    updates: [],
  };

  for (const player of players) {
    if (options.delayMs > 0) await sleep(options.delayMs);
    summary.checked += 1;

    try {
      const live = await fetchTransfermarktValueWithRetry(player, options);
      if (!live.marketValue) {
        throw new Error("Valor de mercado nao encontrado no perfil.");
      }

      const currentValue = Number(player.market_value_eur || 0);
      const changed = currentValue !== live.marketValue;
      summary.updates.push({
        id: player.id,
        name: player.name,
        club: player.club,
        previous: currentValue,
        next: live.marketValue,
        changed,
        lastUpdate: live.lastUpdate,
      });

      if (changed) {
        summary.changed += 1;
        if (!DRY_RUN) {
          await updateMarketValue(supabaseUrl, writeKey, player, live.marketValue);
        }
      } else {
        summary.unchanged += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.updates.push({
        id: player.id,
        name: player.name,
        club: player.club,
        error: error.message,
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0 && summary.failed === summary.checked) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
