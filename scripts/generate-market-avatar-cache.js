#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "js", "market-avatars.js");
const DEFAULT_DELAY_MS = 300;
const DEFAULT_PAGE_SIZE = 1000;

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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

async function readTransfermarktPortraitFromStream(response, playerId) {
  const decoder = new TextDecoder();
  const reader = response.body?.getReader?.();
  if (!reader)
    return pickTransfermarktPortrait(await response.text(), playerId);

  let buffer = "";
  let scanned = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    scanned += buffer;

    const avatarUrl = pickTransfermarktPortrait(scanned, playerId);
    if (avatarUrl) {
      await reader.cancel().catch(() => {});
      return avatarUrl;
    }

    buffer = buffer.slice(-2000);
    scanned = scanned.slice(-12000);
  }

  scanned += decoder.decode();
  return pickTransfermarktPortrait(scanned, playerId);
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

async function rpc({ supabaseUrl, headers, functionName, payload = {} }) {
  return fetchJson(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function getTransferNames({ supabaseUrl, headers }) {
  const data = await rpc({
    supabaseUrl,
    headers,
    functionName: "app_get_data",
  });
  return [
    ...new Set(
      (data?.transfers || [])
        .map((item) => String(item.Jogador || item.player || "").trim())
        .filter(Boolean),
    ),
  ];
}

async function getTopMarketPlayers({ supabaseUrl, headers, limit }) {
  if (!limit) return [];
  const select = "id,name,club,transfermarkt_url,avatar_url,market_value_eur";
  const url = `${supabaseUrl}/rest/v1/players_market?select=${select}&transfermarkt_url=not.is.null&order=market_value_eur.desc.nullslast&limit=${limit}`;
  return fetchJson(url, { headers });
}

async function getAllMarketPlayers({ supabaseUrl, headers, limit = 0 }) {
  const players = [];
  const select = "id,name,club,transfermarkt_url,avatar_url,market_value_eur";

  for (let offset = 0; ; offset += DEFAULT_PAGE_SIZE) {
    const remaining = limit
      ? Math.max(0, limit - players.length)
      : DEFAULT_PAGE_SIZE;
    if (!remaining) break;

    const pageSize = Math.min(DEFAULT_PAGE_SIZE, remaining);
    const url = `${supabaseUrl}/rest/v1/players_market?select=${select}&transfermarkt_url=not.is.null&order=id.asc&limit=${pageSize}&offset=${offset}`;
    const page = await fetchJson(url, { headers });
    if (!Array.isArray(page) || !page.length) break;

    players.push(...page);
    if (page.length < pageSize) break;
  }

  return players;
}

async function getMarketPlayerByName({ supabaseUrl, headers, name }) {
  const rows = await rpc({
    supabaseUrl,
    headers,
    functionName: "app_search_market_players",
    payload: {
      p_query: name,
      p_show_contracted: true,
      p_limit: 5,
    },
  });
  const key = normalizeText(name);
  return (
    (Array.isArray(rows) ? rows : []).find(
      (item) => normalizeText(item.name) === key,
    ) ||
    (Array.isArray(rows) ? rows : [])[0] ||
    null
  );
}

async function fetchTransfermarktAvatar(player) {
  if (player.avatar_url) return player.avatar_url;

  const playerId = getTransfermarktPlayerId(player.transfermarkt_url);
  if (!playerId) return "";

  const response = await fetch(player.transfermarkt_url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (compatible; EAFC26ChampionshipAvatarCache/1.0)",
    },
  });
  if (!response.ok) throw new Error(`Transfermarkt HTTP ${response.status}`);

  return readTransfermarktPortraitFromStream(response, playerId);
}

function readExistingCache() {
  if (!fs.existsSync(OUTPUT_FILE)) return {};
  const contents = fs.readFileSync(OUTPUT_FILE, "utf8");
  const match = contents.match(
    /App\.data\.marketPlayerAvatars\s*=\s*(\{[\s\S]*?\});/,
  );
  if (!match) return {};

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return {};
  }
}

function writeCache(cache) {
  const sorted = Object.keys(cache)
    .sort((a, b) => Number(a) - Number(b))
    .reduce((acc, key) => {
      acc[key] = cache[key];
      return acc;
    }, {});

  const contents = `import App from "./app.js";\nApp.data = App.data || {};\n\nApp.data.marketPlayerAvatars = ${JSON.stringify(sorted, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, contents);
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
  const supabaseUrl =
    process.env.SUPABASE_URL || readConfigValue("SUPABASE_URL");
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    readConfigValue("SUPABASE_PUBLISHABLE_KEY");
  const delayMs = Math.max(0, Number(getArg("--delay-ms", DEFAULT_DELAY_MS)));
  const topLimit = Math.max(0, Number(getArg("--top-limit", 0)));
  const allPlayers = process.argv.includes("--all");
  const limit = Math.max(0, Number(getArg("--limit", 0)));
  const concurrency = Math.max(
    1,
    Math.min(Number(getArg("--concurrency", 4)), 12),
  );
  const quiet = process.argv.includes("--quiet");

  if (!supabaseUrl || !key)
    throw new Error("Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  const cache = readExistingCache();
  const transferNames = await getTransferNames({ supabaseUrl, headers });
  const transferPlayers = (
    await Promise.all(
      transferNames.map((name) =>
        getMarketPlayerByName({ supabaseUrl, headers, name }).catch((error) => {
          console.warn(`mercado indisponível para ${name}: ${error.message}`);
          return null;
        }),
      ),
    )
  ).filter(Boolean);
  const topPlayers = await getTopMarketPlayers({
    supabaseUrl,
    headers,
    limit: topLimit,
  });
  const fullMarketPlayers = allPlayers
    ? await getAllMarketPlayers({ supabaseUrl, headers, limit })
    : [];
  const playersById = [...transferPlayers, ...topPlayers].reduce(
    (acc, player) => {
      const id = getTransfermarktPlayerId(player.transfermarkt_url);
      if (id) acc[id] = player;
      return acc;
    },
    {},
  );
  fullMarketPlayers.forEach((player) => {
    const id = getTransfermarktPlayerId(player.transfermarkt_url);
    if (id) playersById[id] = player;
  });

  let updated = 0;
  let missed = 0;
  let scanned = 0;
  const entries = Object.entries(playersById).filter(
    ([playerId]) => !cache[playerId],
  );

  await runPool(
    entries,
    async ([playerId, player]) => {
      try {
        const avatarUrl = await fetchTransfermarktAvatar(player);
        if (avatarUrl) {
          cache[playerId] = avatarUrl;
          updated += 1;
          if (!quiet) console.log(`ok: ${player.name} -> ${avatarUrl}`);
        } else {
          missed += 1;
          if (!quiet) console.log(`sem foto: ${player.name}`);
        }
      } catch (error) {
        missed += 1;
        if (!quiet) console.warn(`erro: ${player.name}: ${error.message}`);
      }

      scanned += 1;
      if (quiet && scanned % 100 === 0) {
        console.log(
          `processados ${scanned}/${entries.length} | cache ${Object.keys(cache).length}`,
        );
        writeCache(cache);
      }
      if (delayMs) await sleep(delayMs);
    },
    concurrency,
  );

  writeCache(cache);
  console.log(
    JSON.stringify(
      { cached: Object.keys(cache).length, updated, missed },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
