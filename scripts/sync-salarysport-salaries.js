#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { JSDOM } = require("jsdom");

const ROOT_DIR = path.resolve(__dirname, "..");
const SALARYSPORT_BASE_URL = "https://salarysport.com";
const SALARYSPORT_SITEMAP_INDEX_URL =
  `${SALARYSPORT_BASE_URL}/sitemap/sitemap-index.xml`;
const SALARYSPORT_SEARCH_PAGE_DATA_URL =
  `${SALARYSPORT_BASE_URL}/page-data/search/page-data.json`;
const DEFAULT_SQL_PATH = path.join(
  ROOT_DIR,
  "supabase",
  ".temp",
  "salarysport-salary-sync.sql",
);
const DEFAULT_JSON_PATH = path.join(
  ROOT_DIR,
  "supabase",
  ".temp",
  "salarysport-salary-sync.json",
);
const DEFAULT_FETCH_CONCURRENCY = 4;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 1200;
const DEFAULT_MIN_MARKET_VALUE = 3000000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const SUPABASE_CLI_COMMAND =
  process.platform === "win32" ? "supabase.cmd" : "supabase";

const htmlDecoder = new JSDOM("").window.document;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    applyRest: false,
    clubFilters: [],
    concurrency: DEFAULT_FETCH_CONCURRENCY,
    dryRun: false,
    forceRefresh: false,
    limit: 0,
    minMarketValue: DEFAULT_MIN_MARKET_VALUE,
    offset: 0,
    playerFilters: [],
    retryCount: DEFAULT_RETRY_COUNT,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    sqlOut: DEFAULT_SQL_PATH,
    jsonOut: DEFAULT_JSON_PATH,
  };

  argv.forEach((arg, index) => {
    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }
    if (arg === "--apply-rest") {
      options.applyRest = true;
      return;
    }
    if (arg === "--force-refresh") {
      options.forceRefresh = true;
      return;
    }
    if (arg.startsWith("--club=")) {
      options.clubFilters.push(arg.split("=", 2)[1] || "");
      return;
    }
    if (arg === "--club" && argv[index + 1]) {
      options.clubFilters.push(argv[index + 1]);
      return;
    }
    if (arg.startsWith("--player=")) {
      options.playerFilters.push(arg.split("=", 2)[1] || "");
      return;
    }
    if (arg === "--player" && argv[index + 1]) {
      options.playerFilters.push(argv[index + 1]);
      return;
    }
    if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.split("=", 2)[1] || 0) || 0;
      return;
    }
    if (arg.startsWith("--offset=")) {
      options.offset = Number(arg.split("=", 2)[1] || 0) || 0;
      return;
    }
    if (arg.startsWith("--min-market-value=")) {
      options.minMarketValue =
        Number(arg.split("=", 2)[1] || DEFAULT_MIN_MARKET_VALUE) ||
        DEFAULT_MIN_MARKET_VALUE;
      return;
    }
    if (arg.startsWith("--concurrency=")) {
      options.concurrency =
        Number(arg.split("=", 2)[1] || DEFAULT_FETCH_CONCURRENCY) ||
        DEFAULT_FETCH_CONCURRENCY;
      return;
    }
    if (arg.startsWith("--retry-count=")) {
      options.retryCount =
        Number(arg.split("=", 2)[1] || DEFAULT_RETRY_COUNT) ||
        DEFAULT_RETRY_COUNT;
      return;
    }
    if (arg.startsWith("--retry-delay-ms=")) {
      options.retryDelayMs =
        Number(arg.split("=", 2)[1] || DEFAULT_RETRY_DELAY_MS) ||
        DEFAULT_RETRY_DELAY_MS;
      return;
    }
    if (arg.startsWith("--sql-out=")) {
      options.sqlOut = path.resolve(ROOT_DIR, arg.split("=", 2)[1] || "");
      return;
    }
    if (arg.startsWith("--json-out=")) {
      options.jsonOut = path.resolve(ROOT_DIR, arg.split("=", 2)[1] || "");
    }
  });

  return options;
}

function decodeHtml(value = "") {
  const textarea = htmlDecoder.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function normalizeKey(value = "") {
  return decodeHtml(String(value || ""))
    .replace(/&#8217;|&#x2019;|&#39;|&apos;/gi, "'")
    .replace(/[’‘`´]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeSqlString(value = "") {
  return String(value || "").replace(/'/g, "''");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getConfigValue(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function isRegulatorySalaryReference(sourceName = "", sourceUrl = "") {
  const sourceKey = normalizeKey(sourceName);
  const sourceUrlKey = normalizeKey(sourceUrl);
  return (
    sourceKey.includes("estimativa regulatoria") ||
    sourceUrlKey.includes("salary regulatory model")
  );
}

function isPublicSalaryUrl(url = "") {
  const cleanUrl = String(url || "").trim().toLowerCase();
  return /^https?:\/\//.test(cleanUrl) && !cleanUrl.includes("#salary-regulatory-model");
}

function hasTrustedPublicSalaryRef(row = {}) {
  const weeklySalary = Number(
    row.weekly_salary_eur ??
      row.estimated_weekly_salary_eur ??
      row.weeklySalary ??
      row.salaryWeekly ??
      0,
  );
  const sourceName =
    row.salary_source_name ||
    row.salarySourceName ||
    row.source_name ||
    row.sourceName ||
    "";
  const sourceUrl =
    row.salary_source_url ||
    row.salarySourceUrl ||
    row.source_url ||
    row.sourceUrl ||
    "";

  return (
    weeklySalary > 0 &&
    String(sourceName || "").trim() &&
    isPublicSalaryUrl(sourceUrl) &&
    !isRegulatorySalaryReference(sourceName, sourceUrl)
  );
}

function parseEuroMoney(value = "") {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      referer: SALARYSPORT_BASE_URL,
    },
    redirect: "follow",
  });

  if (!response.ok) {
    const error = new Error(`SalarySport respondeu ${response.status} para ${url}`);
    error.status = response.status;
    throw error;
  }

  return response.text();
}

async function fetchTextWithRetry(url, options = {}) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= Number(options.retryCount || 0)) {
    try {
      return await fetchText(url);
    } catch (error) {
      lastError = error;
      const isRetryable = [403, 408, 429, 500, 502, 503, 504].includes(
        Number(error?.status || 0),
      );
      if (!isRetryable || attempt >= Number(options.retryCount || 0)) break;
      const waitMs =
        Number(options.retryDelayMs || DEFAULT_RETRY_DELAY_MS) *
        Math.max(1, attempt + 1);
      await sleep(waitMs);
      attempt += 1;
    }
  }

  throw lastError;
}

async function mapWithConcurrency(items, concurrency, iteratee) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await iteratee(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function isTrustedNameMatch(aliasKey, candidateKey) {
  if (!aliasKey || !candidateKey) return false;
  if (aliasKey === candidateKey) return true;

  const aliasTokens = aliasKey.split(" ").filter(Boolean);
  const candidateTokens = candidateKey.split(" ").filter(Boolean);
  const shorter =
    aliasTokens.length <= candidateTokens.length ? aliasTokens : candidateTokens;
  const longer =
    aliasTokens.length <= candidateTokens.length ? candidateTokens : aliasTokens;
  const shorterKey = shorter.join(" ");
  const longerKey = longer.join(" ");

  if (!shorterKey || !longerKey.startsWith(`${shorterKey} `)) return false;
  return shorter.length >= 2 || (shorter.length === 1 && shorter[0].length >= 6);
}

function getPlayerAliasVariants(playerName = "") {
  const clean = decodeHtml(String(playerName || ""))
    .replace(/&#8217;|&#x2019;|&#39;|&apos;/gi, "'")
    .replace(/[’‘`´]/g, "'")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeKey(clean);
  const aliases = {
    neymar: ["Neymar Jr"],
    "neymar jr": ["Neymar"],
    "vinicius junior": [
      "Vinicius Jose Paixao de Oliveira Junior",
      "Vinicius Jr",
      "Vini Jr",
    ],
    "vinicius jr": [
      "Vinicius Jose Paixao de Oliveira Junior",
      "Vinicius Junior",
      "Vini Jr",
    ],
    rodrygo: ["Rodrygo Silva de Goes"],
    "kylian mbappe": ["Kylian Mbappe", "Kylian Mbappe Lottin"],
    "federico valverde": ["Federico Santiago Valverde Dipetta"],
    "thibaut courtois": ["Thibaut Nicolas Marc Courtois"],
    "david alaba": ["David Olatukunbo Alaba"],
    "eduardo camavinga": ["Eduardo Celmi Camavinga"],
    "aurelien tchouameni": ["Aurelien Tchouameni"],
    kante: ["N'Golo Kante", "N'Golo Kanté", "Ngolo Kante"],
    "n golo kante": ["N'Golo Kante", "N'Golo Kanté", "Ngolo Kante"],
    "n'golo kante": ["N'Golo Kanté", "Ngolo Kante"],
  };

  const variants = new Set([clean]);
  const withoutSuffix = clean.replace(/\b(jr|junior|sr|ii|iii|iv)\.?$/i, "").trim();
  if (withoutSuffix && withoutSuffix !== clean) variants.add(withoutSuffix);
  const withoutApostrophes = clean.replace(/'/g, " ").replace(/\s+/g, " ").trim();
  if (withoutApostrophes) variants.add(withoutApostrophes);
  const compactApostrophes = clean.replace(/'/g, "").replace(/\s+/g, " ").trim();
  if (compactApostrophes) variants.add(compactApostrophes);

  (aliases[normalized] || []).forEach((alias) => variants.add(alias));

  return [...variants].filter(Boolean);
}

function normalizeClubAlias(value = "") {
  const normalized = normalizeKey(value);
  const aliases = new Map([
    ["r madrid", "real madrid"],
    ["real madrid", "real madrid"],
    ["psg", "paris saint germain"],
    ["paris sg", "paris saint germain"],
    ["paris saint germain", "paris saint germain"],
    ["atl madrid", "atletico madrid"],
    ["atleti", "atletico madrid"],
    ["man utd", "manchester united"],
    ["man united", "manchester united"],
    ["man city", "manchester city"],
    ["inter", "internazionale milano"],
    ["juve", "juventus"],
    ["spurs", "tottenham hotspur"],
    ["vallecano", "rayo vallecano madrid"],
    ["mallorca", "real club deportivo mallorca"],
    ["vigo", "celta vigo"],
    ["san", "santos futebol clube"],
    ["sep", "sociedade esportiva palmeiras"],
  ]);
  return aliases.get(normalized) || normalized;
}

function getClubComparableTokens(value = "") {
  const normalized = normalizeClubAlias(value)
    .replace(/\bsaint\b/g, "st")
    .replace(/\batletico\b/g, "atl")
    .replace(/\binternazionale\b/g, "inter")
    .replace(/\bhotspur\b/g, "")
    .trim();

  const stopwords = new Set([
    "a",
    "association",
    "as",
    "athletic",
    "calcio",
    "cf",
    "club",
    "clube",
    "da",
    "de",
    "del",
    "des",
    "do",
    "e",
    "fc",
    "football",
    "futbol",
    "futebol",
    "la",
    "los",
    "of",
    "s",
    "sa",
    "sad",
    "spa",
    "sport",
    "sporting",
    "sportiva",
    "sv",
    "the",
    "verein",
  ]);

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !stopwords.has(token));
}

function clubTextsLookCompatible(requestedClub = "", candidateClub = "") {
  const requestedKey = normalizeKey(requestedClub);
  const candidateKey = normalizeKey(candidateClub);
  if (!requestedKey || !candidateKey) return false;
  if (requestedKey === candidateKey) return true;
  if (
    Math.min(requestedKey.length, candidateKey.length) >= 4 &&
    (requestedKey.includes(candidateKey) || candidateKey.includes(requestedKey))
  ) {
    return true;
  }

  const requestedTokens = getClubComparableTokens(requestedClub);
  const candidateTokens = getClubComparableTokens(candidateClub);
  if (!requestedTokens.length || !candidateTokens.length) return false;

  const shorter =
    requestedTokens.length <= candidateTokens.length ? requestedTokens : candidateTokens;
  const longerSet = new Set(
    requestedTokens.length <= candidateTokens.length ? candidateTokens : requestedTokens,
  );

  if (shorter.every((token) => longerSet.has(token))) {
    return true;
  }

  if (shorter.length === 1 && shorter[0].length >= 5 && longerSet.has(shorter[0])) {
    return true;
  }

  return false;
}

function getSupabaseConfig() {
  const configSource = fs.readFileSync(
    path.join(ROOT_DIR, "js", "config.js"),
    "utf8",
  );
  return {
    supabaseUrl:
      process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL"),
    projectRef:
      process.env.SUPABASE_PROJECT_REF ||
      fs.readFileSync(path.join(ROOT_DIR, "supabase", ".temp", "project-ref"), "utf8").trim(),
  };
}

function getSupabaseServiceRoleKey(projectRef) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

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
  if (!serviceRoleEntry?.api_key) {
    throw new Error("Service role key nao encontrada no projeto Supabase.");
  }
  return serviceRoleEntry.api_key;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Supabase respondeu ${response.status} para ${url}`,
    );
  }
  return payload;
}

async function callSupabaseRpc(supabaseUrl, serviceRoleKey, rpcName, payload) {
  return fetchJson(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload || {}),
  });
}

async function fetchAllRows(supabaseUrl, serviceRoleKey, table, select, extra = "") {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}${extra}`;
    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : [];
    if (!response.ok) {
      throw new Error(
        payload?.message ||
          payload?.error ||
          `Supabase respondeu ${response.status} para ${table}`,
      );
    }
    rows.push(...payload);
    if (!Array.isArray(payload) || payload.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function buildReferenceIndex(refs = []) {
  const byPlayer = new Map();
  const byPlayerClub = new Map();

  refs.forEach((ref) => {
    if (!hasTrustedPublicSalaryRef(ref)) return;
    const playerKey = normalizeKey(ref.playerName || ref.player_name);
    const clubKey = normalizeKey(ref.clubName || ref.club_name);
    const array = byPlayer.get(playerKey) || [];
    array.push(ref);
    byPlayer.set(playerKey, array);
    byPlayerClub.set(`${playerKey}|${clubKey}`, ref);
  });

  return {
    byPlayer,
    byPlayerClub,
  };
}

function targetAlreadyHasPublicRef(refIndex, playerName = "", clubName = "") {
  const playerKey = normalizeKey(playerName);
  const clubKey = normalizeKey(clubName);
  if (!playerKey) return false;
  if (refIndex.byPlayerClub.has(`${playerKey}|${clubKey}`)) return true;
  const entries = refIndex.byPlayer.get(playerKey) || [];
  return entries.length === 1;
}

function matchesFilters(target, options = {}) {
  const playerFilters = (options.playerFilters || []).map(normalizeKey).filter(Boolean);
  const clubFilters = (options.clubFilters || []).map(normalizeKey).filter(Boolean);
  const haystackPlayer = normalizeKey(
    [...(target.playerNames || []), target.playerName].filter(Boolean).join(" "),
  );
  const haystackClub = normalizeKey(target.clubName);

  if (
    playerFilters.length &&
    !playerFilters.some((filter) => haystackPlayer.includes(filter))
  ) {
    return false;
  }

  if (
    clubFilters.length &&
    !clubFilters.some((filter) => haystackClub.includes(filter))
  ) {
    return false;
  }

  return true;
}

function pushTarget(targets, target) {
  const playerKey = normalizeKey(target.playerName);
  const clubKey = normalizeKey(target.clubName);
  if (!playerKey || !clubKey) return;
  const key = `${playerKey}|${clubKey}`;
  const existing = targets.get(key);
  if (!existing) {
    targets.set(key, {
      ...target,
      playerNames: new Set([target.playerName, ...(target.playerNames || [])].filter(Boolean)),
      reasons: new Set([target.reason].filter(Boolean)),
    });
    return;
  }

  existing.sourcePriority = Math.min(
    Number(existing.sourcePriority || 99),
    Number(target.sourcePriority || 99),
  );
  existing.marketValue = Math.max(
    Number(existing.marketValue || 0),
    Number(target.marketValue || 0),
  );
  existing.playerNames.add(target.playerName);
  (target.playerNames || []).forEach((name) => existing.playerNames.add(name));
  if (target.reason) existing.reasons.add(target.reason);
}

async function loadTargets(supabaseUrl, serviceRoleKey, options = {}) {
  const refs = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "player_salary_references",
    "player_name,club_name,weekly_salary_eur,source_name,source_url",
  );
  const refIndex = buildReferenceIndex(refs);
  const targets = new Map();

  const rosterRows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "club_roster_players",
    "player_name,club_name,estimated_weekly_salary_eur,salary_source_name,salary_source_url",
  );
  rosterRows
    .filter((row) => !hasTrustedPublicSalaryRef(row))
    .forEach((row) => {
      if (
        !options.forceRefresh &&
        targetAlreadyHasPublicRef(refIndex, row.player_name, row.club_name)
      ) {
        return;
      }
      pushTarget(targets, {
        playerName: row.player_name,
        clubName: row.club_name,
        sourcePriority: 0,
        marketValue: 0,
        reason: "roster_missing_public_salary",
      });
    });

  const transferRows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "transfers",
    "player_name,from_club,market_value,weekly_salary_eur,salary_source_name,salary_source_url,transfer_type,status",
  );
  transferRows
    .filter(
      (row) =>
        String(row.transfer_type || "").toLowerCase() !== "cpu_sale" &&
        String(row.status || "").toLowerCase() === "approved" &&
        !hasTrustedPublicSalaryRef(row),
    )
    .forEach((row) => {
      if (
        !options.forceRefresh &&
        targetAlreadyHasPublicRef(refIndex, row.player_name, row.from_club)
      ) {
        return;
      }
      pushTarget(targets, {
        playerName: row.player_name,
        clubName: row.from_club,
        sourcePriority: 1,
        marketValue: Number(row.market_value || 0),
        reason: "approved_transfer_missing_public_salary",
      });
    });

  const proposalRows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "internal_transfer_proposals",
    "player,from_club,reference_value,weekly_salary_eur,salary_source_name,salary_source_url,proposal_type,status",
  );
  proposalRows
    .filter(
      (row) =>
        String(row.proposal_type || "").toLowerCase() === "external_market" &&
        ["pending", "buyer_review", "signature_pending"].includes(
          String(row.status || "").toLowerCase(),
        ) &&
        !hasTrustedPublicSalaryRef(row),
    )
    .forEach((row) => {
      if (
        !options.forceRefresh &&
        targetAlreadyHasPublicRef(refIndex, row.player, row.from_club)
      ) {
        return;
      }
      pushTarget(targets, {
        playerName: row.player,
        clubName: row.from_club,
        sourcePriority: 2,
        marketValue: Number(row.reference_value || 0),
        reason: "external_proposal_missing_public_salary",
      });
    });

  const marketRows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "players_market",
    "name,club,market_value_eur",
    `&market_value_eur=gte.${Math.max(0, Number(options.minMarketValue || 0))}&order=market_value_eur.desc.nullslast,name.asc`,
  );
  marketRows.forEach((row) => {
    if (
      !options.forceRefresh &&
      targetAlreadyHasPublicRef(refIndex, row.name, row.club)
    ) {
      return;
    }
    pushTarget(targets, {
      playerName: row.name,
      clubName: row.club,
      sourcePriority: 3,
      marketValue: Number(row.market_value_eur || 0),
      reason: "market_player_missing_public_salary",
    });
  });

  return [...targets.values()]
    .map((target) => ({
      ...target,
      playerNames: [...target.playerNames].filter(Boolean),
      reasons: [...target.reasons].filter(Boolean),
    }))
    .filter((target) => matchesFilters(target, options))
    .sort((left, right) => {
      const byPriority =
        Number(left.sourcePriority || 99) - Number(right.sourcePriority || 99);
      if (byPriority !== 0) return byPriority;
      const byValue = Number(right.marketValue || 0) - Number(left.marketValue || 0);
      if (byValue !== 0) return byValue;
      return String(left.playerName || "").localeCompare(
        String(right.playerName || ""),
        "pt-BR",
      );
    });
}

async function fetchPlayerSitemapIndex(options = {}) {
  const sitemapIndex = await fetchTextWithRetry(
    SALARYSPORT_SITEMAP_INDEX_URL,
    options,
  );
  const sitemapUrls = [...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => /\/sitemap\/sitemap-\d+\.xml$/i.test(url));

  const sitemapPayloads = await mapWithConcurrency(
    sitemapUrls,
    2,
    async (url) => fetchTextWithRetry(url, options),
  );

  const byLookupKey = new Map();
  const allEntries = [];
  const seenUrls = new Set();

  sitemapPayloads.forEach((xml) => {
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].forEach((match) => {
      const rawUrl = decodeHtml(match[1]);
      const url = new URL(rawUrl);
      const slugMatch = url.pathname.match(
        /^\/(?:[a-z-]+\/)?football\/player\/([^/]+)\/?$/i,
      );
      if (!slugMatch) return;

      const slug = decodeURIComponent(slugMatch[1]);
      const canonicalUrl = `${SALARYSPORT_BASE_URL}/football/player/${slugMatch[1]}/`;
      if (seenUrls.has(canonicalUrl)) return;
      seenUrls.add(canonicalUrl);

      const deUrl = `${SALARYSPORT_BASE_URL}/de/football/player/${slugMatch[1]}/`;
      const lookupKey = normalizeKey(slug.replace(/-/g, " "));
      const entry = {
        slug,
        lookupKey,
        canonicalUrl,
        deUrl,
      };
      allEntries.push(entry);
      const bucket = byLookupKey.get(lookupKey) || [];
      bucket.push(entry);
      byLookupKey.set(lookupKey, bucket);
    });
  });

  return {
    allEntries,
    byLookupKey,
  };
}

async function fetchTeamSearchIndex(options = {}) {
  const payload = JSON.parse(
    await fetchTextWithRetry(SALARYSPORT_SEARCH_PAGE_DATA_URL, options),
  );
  const nodes =
    payload?.result?.data?.postgres?.sportwages?.nodes || [];

  const byLookupKey = new Map();
  const allEntries = [];
  const seenUrls = new Set();

  nodes.forEach((node) => {
    const rawUrl = decodeHtml(String(node?.url || "")).trim();
    const rawName = decodeHtml(String(node?.name || "")).trim();
    if (!rawUrl || !rawName) return;
    if (!/^football\/[^/]+\/[^/]+\/?$/i.test(rawUrl)) return;
    if (node?.pageType && String(node.pageType).toLowerCase() !== "fm") return;

    const canonicalPath = `/${rawUrl.replace(/^\/+/, "").replace(/\/?$/, "/")}`;
    const canonicalUrl = `${SALARYSPORT_BASE_URL}${canonicalPath}`;
    const euroUrl = `${SALARYSPORT_BASE_URL}/es${canonicalPath}`;
    if (seenUrls.has(euroUrl)) return;
    seenUrls.add(euroUrl);

    const slug = canonicalPath
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .pop();
    const slugKey = normalizeKey(decodeURIComponent(String(slug || "").replace(/-/g, " ")));
    const lookupKeys = new Set([
      normalizeKey(rawName),
      normalizeClubAlias(rawName),
      slugKey,
    ]);

    const entry = {
      canonicalUrl,
      euroUrl,
      lookupKey: normalizeKey(rawName),
      name: rawName,
      slugKey,
    };
    allEntries.push(entry);
    lookupKeys.forEach((lookupKey) => {
      if (!lookupKey) return;
      const bucket = byLookupKey.get(lookupKey) || [];
      bucket.push(entry);
      byLookupKey.set(lookupKey, bucket);
    });
  });

  return {
    allEntries,
    byLookupKey,
  };
}

function getCandidatePages(index, playerName = "") {
  const aliasKeys = getPlayerAliasVariants(playerName)
    .map((name) => normalizeKey(name))
    .filter(Boolean);
  const candidates = new Map();

  aliasKeys.forEach((aliasKey) => {
    (index.byLookupKey.get(aliasKey) || []).forEach((entry) => {
      candidates.set(entry.deUrl, {
        ...entry,
        nameScore: 0,
      });
    });
  });

  if (candidates.size) {
    return [...candidates.values()];
  }

  aliasKeys.forEach((aliasKey) => {
    index.allEntries.forEach((entry) => {
      if (
        isTrustedNameMatch(aliasKey, entry.lookupKey) ||
        isTrustedNameMatch(entry.lookupKey, aliasKey)
      ) {
        const existing = candidates.get(entry.deUrl);
        const nameScore = 1;
        if (!existing || existing.nameScore > nameScore) {
          candidates.set(entry.deUrl, {
            ...entry,
            nameScore,
          });
        }
      }
    });
  });

  return [...candidates.values()].slice(0, 12);
}

function getTeamCandidateUrl(entry = {}) {
  return entry.euroUrl || entry.canonicalUrl || "";
}

function getCandidateTeamPages(index, clubName = "") {
  const directKeys = new Set([
    normalizeKey(clubName),
    normalizeClubAlias(clubName),
  ]);
  const candidates = new Map();

  directKeys.forEach((lookupKey) => {
    (index.byLookupKey.get(lookupKey) || []).forEach((entry) => {
      candidates.set(getTeamCandidateUrl(entry), {
        ...entry,
        teamScore: 0,
      });
    });
  });

  if (candidates.size) {
    return [...candidates.values()];
  }

  index.allEntries.forEach((entry) => {
    if (
      clubTextsLookCompatible(clubName, entry.name) ||
      clubTextsLookCompatible(clubName, entry.slugKey)
    ) {
      candidates.set(getTeamCandidateUrl(entry), {
        ...entry,
        teamScore: 1,
      });
    }
  });

  return [...candidates.values()]
    .sort((left, right) => {
      if (left.teamScore !== right.teamScore) {
        return left.teamScore - right.teamScore;
      }
      return String(left.name || "").localeCompare(String(right.name || ""), "pt-BR");
    })
    .slice(0, 8);
}

function parsePlayerPage(html = "", url = "") {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const playerHeading = document.querySelector("h1")?.textContent || "";
  const pagePlayerName = decodeHtml(playerHeading)
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+.*$/, "")
    .trim();
  const breadcrumbAnchors = [
    ...document.querySelectorAll('nav[aria-label="breadcrumbs"] a'),
  ]
    .map((anchor) => decodeHtml(anchor.textContent).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const breadcrumbClub =
    breadcrumbAnchors.length >= 2
      ? breadcrumbAnchors[breadcrumbAnchors.length - 2]
      : "";
  const heroText =
    [...document.querySelectorAll("h3")]
      .map((node) => decodeHtml(node.textContent).replace(/\s+/g, " ").trim())
      .find(
        (text) =>
          /(verdient|earns|gana|gagne|ganha)/i.test(text) &&
          /[€£$]/.test(text),
      ) || "";
  const currentWeeklySalary = parseEuroMoney(
    heroText.match(/(?:verdient|earns|gana|gagne|ganha)\s*[^\d-]*(-?[\d.,]+)/i)?.[1] ||
      heroText.match(/[€£$]\s*(-?[\d.,]+)/)?.[1] ||
      "",
  );
  const rows = [...document.querySelectorAll("tbody tr")]
    .map((row) => {
      const cells = [...row.querySelectorAll("td")]
        .map((cell) => decodeHtml(cell.textContent).replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (cells.length < 8 || !/^\d{4}$/.test(cells[0])) return null;
      return {
        year: Number(cells[0]),
        weeklySalary: parseEuroMoney(cells[1]),
        annualSalary: parseEuroMoney(cells[2]),
        clubName: cells[3] || "",
        position: cells[4] || "",
        league: cells[5] || "",
        age: Number(cells[6] || 0) || 0,
        contractExpiry: cells[7] || "",
      };
    })
    .filter(Boolean);

  return {
    url,
    pagePlayerName,
    breadcrumbClub,
    currentWeeklySalary,
    latestRow: rows[0] || null,
    rows,
  };
}

function parseTeamPage(html = "", url = "") {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const pageHeading = decodeHtml(document.querySelector("h1")?.textContent || "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+\d{4}\s+.*$/, "")
    .trim();
  const rosterRows = [...document.querySelectorAll("tbody tr")]
    .map((row) => {
      const cells = [...row.querySelectorAll("td")];
      if (cells.length < 6) return null;
      const values = cells
        .map((cell) => decodeHtml(cell.textContent).replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (values.length < 6) return null;

      const playerName = values[0] || "";
      const weeklySalary = parseEuroMoney(values[1]);
      const annualSalary = parseEuroMoney(values[2]);
      if (!playerName || weeklySalary <= 0 || annualSalary <= 0) return null;

      const href = cells[0]
        ?.querySelector('a[href*="/football/player/"]')
        ?.getAttribute("href");

      return {
        playerName,
        weeklySalary,
        annualSalary,
        age: Number(values[3] || 0) || 0,
        position: values[4] || "",
        nationality: values[5] || "",
        playerUrl: href
          ? new URL(href, SALARYSPORT_BASE_URL).toString()
          : "",
      };
    })
    .filter(Boolean);

  return {
    url,
    pageHeading,
    rosterRows,
  };
}

function scoreClubMatch(targetClub = "", parsed = {}) {
  const requestedClub = String(targetClub || "").trim();
  if (!requestedClub) return 2;

  const currentCandidates = [
    parsed.breadcrumbClub,
    parsed.latestRow?.clubName,
  ].filter(Boolean);

  if (currentCandidates.some((club) => clubTextsLookCompatible(requestedClub, club))) {
    return 0;
  }

  const recentRows = (parsed.rows || []).slice(0, 3);
  const hasHistoricalExact = recentRows.some((row) =>
    clubTextsLookCompatible(requestedClub, row.clubName),
  );
  const currentLooksLikeAbbreviation = currentCandidates.some((club) =>
    /^[A-Z]{2,4}$/.test(String(club || "").trim()),
  );

  if (hasHistoricalExact && currentLooksLikeAbbreviation) {
    return 1;
  }

  return 9;
}

function scoreNameMatch(playerName = "", parsedPlayerName = "") {
  const aliasKeys = getPlayerAliasVariants(playerName)
    .map((name) => normalizeKey(name))
    .filter(Boolean);
  const parsedKey = normalizeKey(parsedPlayerName);
  if (!parsedKey) return 9;
  if (aliasKeys.includes(parsedKey)) return 0;
  if (
    aliasKeys.some(
      (key) =>
        isTrustedNameMatch(key, parsedKey) || isTrustedNameMatch(parsedKey, key),
    )
  ) {
    return 1;
  }
  return 9;
}

function buildResolvedReference(target, parsed) {
  const weeklySalary = Number(
    parsed.currentWeeklySalary || parsed.latestRow?.weeklySalary || 0,
  );
  if (weeklySalary <= 0) return [];

  const resolvedClub = String(target.clubName || "").trim();
  const notes = [
    `SalarySport sync ${new Date().toISOString()}`,
    `pagePlayer=${parsed.pagePlayerName || target.playerName}`,
    `breadcrumbClub=${parsed.breadcrumbClub || ""}`,
    `latestRowClub=${parsed.latestRow?.clubName || ""}`,
  ].join(" | ");

  const names = new Set([
    target.playerName,
    ...(target.playerNames || []),
    parsed.pagePlayerName,
    ...getPlayerAliasVariants(target.playerName),
  ]);

  return [...names]
    .filter(Boolean)
    .map((name) => ({
      playerName: name,
      clubName: resolvedClub,
      weeklySalary,
      sourceName: `SalarySport ${resolvedClub || "public"} salary page`,
      sourceUrl: parsed.url,
      referenceType: "public_salarysport",
      notes,
    }));
}

function buildResolvedReferenceFromTeamPage(target, parsed, matchedRow) {
  const weeklySalary = Number(matchedRow?.weeklySalary || 0);
  if (weeklySalary <= 0) return [];

  const resolvedClub = String(target.clubName || "").trim();
  const sourceUrl = parsed.url;
  const notes = [
    `SalarySport sync ${new Date().toISOString()}`,
    `teamPage=${parsed.pageHeading || resolvedClub || "public"}`,
    `rowPlayer=${matchedRow?.playerName || target.playerName}`,
  ].join(" | ");

  const names = new Set([
    target.playerName,
    ...(target.playerNames || []),
    matchedRow?.playerName,
    ...getPlayerAliasVariants(target.playerName),
  ]);

  return [...names]
    .filter(Boolean)
    .map((name) => ({
      playerName: name,
      clubName: resolvedClub,
      weeklySalary,
      sourceName: `SalarySport ${resolvedClub || "public"} salary page`,
      sourceUrl,
      referenceType: "public_salarysport",
      notes,
    }));
}

async function resolveSalarySportReferences(
  playerIndex,
  teamIndex,
  targets = [],
  options = {},
) {
  const playerPageCache = new Map();
  const teamPageCache = new Map();

  const loadPlayerPage = async (url) => {
    if (!playerPageCache.has(url)) {
      playerPageCache.set(
        url,
        fetchTextWithRetry(url, options).then((html) => parsePlayerPage(html, url)),
      );
    }
    return playerPageCache.get(url);
  };

  const loadTeamPage = async (url) => {
    if (!teamPageCache.has(url)) {
      teamPageCache.set(
        url,
        fetchTextWithRetry(url, options).then((html) => parseTeamPage(html, url)),
      );
    }
    return teamPageCache.get(url);
  };

  const results = await mapWithConcurrency(
    targets,
    Math.max(1, Number(options.concurrency || DEFAULT_FETCH_CONCURRENCY)),
    async (target) => {
      const pageAttempts = [];
      const candidatePages = getCandidatePages(playerIndex, target.playerName);
      for (const candidate of candidatePages.slice(0, 6)) {
        try {
          const parsed = await loadPlayerPage(candidate.deUrl);
          pageAttempts.push({
            candidate,
            parsed,
            clubScore: scoreClubMatch(target.clubName, parsed),
            nameScore: scoreNameMatch(target.playerName, parsed.pagePlayerName),
          });
        } catch (error) {
          pageAttempts.push({
            candidate,
            error: error.message,
            clubScore: 99,
            nameScore: 99,
          });
        }
      }

      const teamAttempts = [];
      const teamCandidates = getCandidateTeamPages(teamIndex, target.clubName);
      for (const candidate of teamCandidates.slice(0, 4)) {
        try {
          const parsed = await loadTeamPage(getTeamCandidateUrl(candidate));
          const matchedRow = (parsed.rosterRows || [])
            .map((row) => ({
              row,
              nameScore: scoreNameMatch(target.playerName, row.playerName),
            }))
            .filter((entry) => entry.nameScore <= 1)
            .sort((left, right) => {
              if (left.nameScore !== right.nameScore) {
                return left.nameScore - right.nameScore;
              }
              return Number(right.row?.weeklySalary || 0) - Number(left.row?.weeklySalary || 0);
            })[0];

          teamAttempts.push({
            candidate,
            parsed,
            matchedRow,
            nameScore: Number(matchedRow?.nameScore ?? 99),
          });
        } catch (error) {
          teamAttempts.push({
            candidate,
            error: error.message,
            nameScore: 99,
          });
        }
      }

      const bestTeamMatch = teamAttempts
        .filter((attempt) => attempt.parsed && attempt.matchedRow?.row)
        .sort((left, right) => {
          if (left.nameScore !== right.nameScore) {
            return left.nameScore - right.nameScore;
          }
          return Number(right.matchedRow?.row?.weeklySalary || 0) -
            Number(left.matchedRow?.row?.weeklySalary || 0);
        })[0];

      if (bestTeamMatch && bestTeamMatch.nameScore <= 1) {
        return {
          target,
          refs: buildResolvedReferenceFromTeamPage(
            target,
            bestTeamMatch.parsed,
            bestTeamMatch.matchedRow.row,
          ),
          page: getTeamCandidateUrl(bestTeamMatch.candidate),
          player: bestTeamMatch.matchedRow.row.playerName,
          currentClub: target.clubName,
          weeklySalary: Number(bestTeamMatch.matchedRow.row.weeklySalary || 0),
        };
      }

      const bestPlayerMatch = pageAttempts
        .filter((attempt) => attempt.parsed)
        .sort((left, right) => {
          if (left.nameScore !== right.nameScore) {
            return left.nameScore - right.nameScore;
          }
          if (left.clubScore !== right.clubScore) {
            return left.clubScore - right.clubScore;
          }
          const leftSalary = Number(left.parsed?.currentWeeklySalary || 0);
          const rightSalary = Number(right.parsed?.currentWeeklySalary || 0);
          return rightSalary - leftSalary;
        })[0];

      if (bestPlayerMatch && bestPlayerMatch.nameScore <= 1 && bestPlayerMatch.clubScore <= 1) {
        return {
          target,
          refs: buildResolvedReference(target, bestPlayerMatch.parsed),
          page: bestPlayerMatch.candidate.deUrl,
          player: bestPlayerMatch.parsed.pagePlayerName,
          currentClub:
            bestPlayerMatch.parsed.breadcrumbClub ||
            bestPlayerMatch.parsed.latestRow?.clubName ||
            "",
          weeklySalary: Number(bestPlayerMatch.parsed.currentWeeklySalary || 0),
        };
      }

      return {
        target,
        refs: [],
        error:
          bestPlayerMatch?.error ||
          "Nao encontrei pagina do SalarySport com nome e clube compativeis.",
      };
    },
  );

  return results;
}

function dedupeReferences(refs = []) {
  const unique = new Map();
  refs.forEach((ref) => {
    const key = [
      normalizeKey(ref.playerName),
      normalizeKey(ref.clubName),
      String(ref.sourceUrl || "").trim().toLowerCase(),
    ].join("|");
    if (!unique.has(key)) {
      unique.set(key, ref);
    }
  });
  return [...unique.values()].sort((left, right) => {
    const byPlayer = left.playerName.localeCompare(right.playerName, "pt-BR");
    if (byPlayer !== 0) return byPlayer;
    return left.clubName.localeCompare(right.clubName, "pt-BR");
  });
}

function buildUpsertSql(ref) {
  return `select public.app_upsert_player_salary_reference('${escapeSqlString(
    ref.playerName,
  )}', '${escapeSqlString(ref.clubName)}', ${Number(
    ref.weeklySalary || 0,
  )}, '${escapeSqlString(ref.sourceName)}', '${escapeSqlString(
    ref.sourceUrl,
  )}', '${escapeSqlString(ref.notes)}');`;
}

function buildNormalizationSql() {
  return `
with latest_salary_refs as (
  select
    r.id,
    r.player_name,
    coalesce(r.club_name, '') as club_name,
    r.weekly_salary_eur,
    r.source_name,
    r.source_url,
    r.source_checked_at,
    coalesce(r.reference_type, public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')) as resolved_reference_type,
    public.app_salary_lookup_key(r.player_name) as player_lookup_key,
    public.app_salary_lookup_key(coalesce(r.club_name, '')) as club_lookup_key,
    row_number() over (
      partition by public.app_salary_lookup_key(r.player_name), public.app_salary_lookup_key(coalesce(r.club_name, ''))
      order by r.source_checked_at desc nulls last, r.id desc
    ) as rn
  from public.player_salary_references r
),
dedup_salary_refs as (
  select *
  from latest_salary_refs
  where rn = 1
),
player_salary_ref_counts as (
  select
    player_lookup_key,
    count(*) as ref_count
  from dedup_salary_refs
  group by player_lookup_key
)
update public.club_roster_players as roster
set
  estimated_weekly_salary_eur = ref.weekly_salary_eur,
  salary_source_name = ref.source_name,
  salary_source_url = ref.source_url,
  salary_reference_type = ref.resolved_reference_type,
  salary_checked_at = coalesce(ref.source_checked_at, now()),
  updated_at = now()
from lateral (
  select
    dedup.*,
    counts.ref_count
  from dedup_salary_refs dedup
  join player_salary_ref_counts counts
    on counts.player_lookup_key = dedup.player_lookup_key
  where dedup.player_lookup_key = public.app_salary_lookup_key(roster.player_name)
    and (
      dedup.club_lookup_key = public.app_salary_lookup_key(roster.club_name)
      or counts.ref_count = 1
    )
  order by
    case
      when dedup.club_lookup_key = public.app_salary_lookup_key(roster.club_name) then 0
      else 1
    end,
    dedup.source_checked_at desc nulls last,
    dedup.id desc
  limit 1
) ref
where coalesce(ref.weekly_salary_eur, 0) > 0;

with latest_salary_refs as (
  select
    r.id,
    r.player_name,
    coalesce(r.club_name, '') as club_name,
    r.weekly_salary_eur,
    r.source_name,
    r.source_url,
    r.source_checked_at,
    coalesce(r.reference_type, public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')) as resolved_reference_type,
    public.app_salary_lookup_key(r.player_name) as player_lookup_key,
    public.app_salary_lookup_key(coalesce(r.club_name, '')) as club_lookup_key,
    row_number() over (
      partition by public.app_salary_lookup_key(r.player_name), public.app_salary_lookup_key(coalesce(r.club_name, ''))
      order by r.source_checked_at desc nulls last, r.id desc
    ) as rn
  from public.player_salary_references r
),
dedup_salary_refs as (
  select *
  from latest_salary_refs
  where rn = 1
),
player_salary_ref_counts as (
  select
    player_lookup_key,
    count(*) as ref_count
  from dedup_salary_refs
  group by player_lookup_key
)
update public.transfers as transfer_row
set
  weekly_salary_eur = ref.weekly_salary_eur,
  salary_source_name = ref.source_name,
  salary_source_url = ref.source_url,
  salary_reference_type = ref.resolved_reference_type,
  salary_checked_at = coalesce(ref.source_checked_at, now()),
  updated_at = now()
from lateral (
  select
    dedup.*,
    counts.ref_count
  from dedup_salary_refs dedup
  join player_salary_ref_counts counts
    on counts.player_lookup_key = dedup.player_lookup_key
  where dedup.player_lookup_key = public.app_salary_lookup_key(coalesce(transfer_row.player_key, transfer_row.player_name, ''))
    and (
      dedup.club_lookup_key = public.app_salary_lookup_key(coalesce(transfer_row.from_club, ''))
      or counts.ref_count = 1
    )
  order by
    case
      when dedup.club_lookup_key = public.app_salary_lookup_key(coalesce(transfer_row.from_club, '')) then 0
      else 1
    end,
    dedup.source_checked_at desc nulls last,
    dedup.id desc
  limit 1
) ref
where coalesce(ref.weekly_salary_eur, 0) > 0
  and coalesce(transfer_row.transfer_type, 'market') <> 'cpu_sale';

with latest_salary_refs as (
  select
    r.id,
    r.player_name,
    coalesce(r.club_name, '') as club_name,
    r.weekly_salary_eur,
    r.source_name,
    r.source_url,
    r.source_checked_at,
    coalesce(r.reference_type, public.app_salary_reference_type(r.source_name, r.source_url, 'public_other')) as resolved_reference_type,
    public.app_salary_lookup_key(r.player_name) as player_lookup_key,
    public.app_salary_lookup_key(coalesce(r.club_name, '')) as club_lookup_key,
    row_number() over (
      partition by public.app_salary_lookup_key(r.player_name), public.app_salary_lookup_key(coalesce(r.club_name, ''))
      order by r.source_checked_at desc nulls last, r.id desc
    ) as rn
  from public.player_salary_references r
),
dedup_salary_refs as (
  select *
  from latest_salary_refs
  where rn = 1
),
player_salary_ref_counts as (
  select
    player_lookup_key,
    count(*) as ref_count
  from dedup_salary_refs
  group by player_lookup_key
)
update public.internal_transfer_proposals as proposal
set
  weekly_salary_eur = ref.weekly_salary_eur,
  salary_source_name = ref.source_name,
  salary_source_url = ref.source_url,
  salary_reference_type = ref.resolved_reference_type
from lateral (
  select
    dedup.*,
    counts.ref_count
  from dedup_salary_refs dedup
  join player_salary_ref_counts counts
    on counts.player_lookup_key = dedup.player_lookup_key
  where dedup.player_lookup_key = public.app_salary_lookup_key(proposal.player)
    and (
      dedup.club_lookup_key = public.app_salary_lookup_key(coalesce(proposal.from_club, ''))
      or counts.ref_count = 1
    )
  order by
    case
      when dedup.club_lookup_key = public.app_salary_lookup_key(coalesce(proposal.from_club, '')) then 0
      else 1
    end,
    dedup.source_checked_at desc nulls last,
    dedup.id desc
  limit 1
) ref
where coalesce(ref.weekly_salary_eur, 0) > 0
  and coalesce(proposal.proposal_type, 'internal') = 'external_market';
`.trim();
}

function buildSqlFile(refs = []) {
  return [
    "begin;",
    ...refs.map(buildUpsertSql),
    buildNormalizationSql(),
    "commit;",
    "",
  ].join("\n");
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function patchRowsById(supabaseUrl, serviceRoleKey, table, rows = []) {
  if (!rows.length) return 0;
  for (const row of rows) {
    const { id, ...payload } = row;
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(String(id))}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Falha ao atualizar ${table}#${id}.`);
    }
  }
  return rows.length;
}

function getReferenceForPlayer(refIndex, playerName = "", clubName = "", options = {}) {
  const { requireUniquePlayerOnly = false } = options;
  const playerKey = normalizeKey(playerName);
  const clubKey = normalizeKey(clubName);
  if (!playerKey) return null;

  const exact = refIndex.byPlayerClub.get(`${playerKey}|${clubKey}`);
  if (exact) return exact;

  const matches = refIndex.byPlayer.get(playerKey) || [];
  if (!matches.length) return null;
  if (requireUniquePlayerOnly && matches.length > 1) return null;
  return matches[0] || null;
}

async function applyReferencesViaRest(refs = []) {
  const { supabaseUrl, projectRef } = getSupabaseConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey(projectRef);
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL ou service role key indisponiveis.");
  }

  await mapWithConcurrency(refs, 6, async (ref) =>
    callSupabaseRpc(supabaseUrl, serviceRoleKey, "app_upsert_player_salary_reference", {
      p_player_name: ref.playerName,
      p_club_name: ref.clubName,
      p_weekly_salary_eur: Number(ref.weeklySalary || 0),
      p_source_name: ref.sourceName,
      p_source_url: ref.sourceUrl,
      p_notes: ref.notes,
    }),
  );

  const refIndex = buildReferenceIndex(refs);
  const nowIso = new Date().toISOString();

  const rosterRows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "club_roster_players",
    "id,player_name,club_name",
  );
  const rosterUpdates = rosterRows
    .map((row) => {
      const ref = getReferenceForPlayer(refIndex, row.player_name, row.club_name, {
        requireUniquePlayerOnly: true,
      });
      if (!ref) return null;
      return {
        id: row.id,
        estimated_weekly_salary_eur: Number(ref.weeklySalary || 0),
        salary_source_name: ref.sourceName,
        salary_source_url: ref.sourceUrl,
        salary_reference_type: ref.referenceType || "public_salarysport",
        salary_checked_at: nowIso,
        updated_at: nowIso,
      };
    })
    .filter(Boolean);

  const transferRows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "transfers",
    "id,player_name,from_club,transfer_type",
  );
  const transferUpdates = transferRows
    .filter((row) => String(row.transfer_type || "").toLowerCase() !== "cpu_sale")
    .map((row) => {
      const ref = getReferenceForPlayer(refIndex, row.player_name, row.from_club);
      if (!ref) return null;
      return {
        id: row.id,
        weekly_salary_eur: Number(ref.weeklySalary || 0),
        salary_source_name: ref.sourceName,
        salary_source_url: ref.sourceUrl,
        salary_reference_type: ref.referenceType || "public_salarysport",
        salary_checked_at: nowIso,
        updated_at: nowIso,
      };
    })
    .filter(Boolean);

  const proposalRows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "internal_transfer_proposals",
    "id,player,from_club,proposal_type",
  );
  const proposalUpdates = proposalRows
    .filter((row) => String(row.proposal_type || "").toLowerCase() === "external_market")
    .map((row) => {
      const ref = getReferenceForPlayer(refIndex, row.player, row.from_club);
      if (!ref) return null;
      return {
        id: row.id,
        weekly_salary_eur: Number(ref.weeklySalary || 0),
        salary_source_name: ref.sourceName,
        salary_source_url: ref.sourceUrl,
        salary_reference_type: ref.referenceType || "public_salarysport",
      };
    })
    .filter(Boolean);

  const rosterCount = await patchRowsById(
    supabaseUrl,
    serviceRoleKey,
    "club_roster_players",
    rosterUpdates,
  );
  const transferCount = await patchRowsById(
    supabaseUrl,
    serviceRoleKey,
    "transfers",
    transferUpdates,
  );
  const proposalCount = await patchRowsById(
    supabaseUrl,
    serviceRoleKey,
    "internal_transfer_proposals",
    proposalUpdates,
  );

  return {
    referencesUpserted: refs.length,
    rosterRowsUpdated: rosterCount,
    transferRowsUpdated: transferCount,
    proposalRowsUpdated: proposalCount,
  };
}

async function main() {
  const options = parseArgs();
  const { supabaseUrl, projectRef } = getSupabaseConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey(projectRef);
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL ou service role key indisponiveis.");
  }

  const allTargets = await loadTargets(supabaseUrl, serviceRoleKey, options);
  const slicedTargets = allTargets.slice(
    Math.max(0, Number(options.offset || 0)),
    options.limit > 0
      ? Math.max(0, Number(options.offset || 0)) + Number(options.limit)
      : undefined,
  );

  if (!slicedTargets.length) {
    throw new Error("Nenhum jogador pendente encontrado para sincronizar no SalarySport.");
  }

  const [playerIndex, teamIndex] = await Promise.all([
    fetchPlayerSitemapIndex(options),
    fetchTeamSearchIndex(options),
  ]);
  const results = await resolveSalarySportReferences(
    playerIndex,
    teamIndex,
    slicedTargets,
    options,
  );
  const refs = dedupeReferences(results.flatMap((entry) => entry.refs || []));
  const failed = results.filter((entry) => !entry.refs?.length);
  const summary = {
    ok: true,
    fetchedTargets: slicedTargets.length,
    totalTargets: allTargets.length,
    failedTargets: failed.length,
    concurrency: Math.max(
      1,
      Number(options.concurrency || DEFAULT_FETCH_CONCURRENCY),
    ),
    minMarketValue: Number(options.minMarketValue || 0),
    limit: Number(options.limit || 0),
    offset: Number(options.offset || 0),
    nextOffset: Number(options.offset || 0) + slicedTargets.length,
    references: refs.length,
    sample: refs.slice(0, 10),
    resolved: results
      .filter((entry) => entry.refs?.length)
      .slice(0, 20)
      .map((entry) => ({
        player: entry.target.playerName,
        club: entry.target.clubName,
        salary: entry.weeklySalary,
        page: entry.page,
      })),
    failed: failed.slice(0, 30).map((entry) => ({
      player: entry.target.playerName,
      club: entry.target.clubName,
      error: entry.error,
    })),
  };

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const sql = buildSqlFile(refs);
  ensureParentDir(options.sqlOut);
  ensureParentDir(options.jsonOut);
  fs.writeFileSync(options.sqlOut, sql, "utf8");
  if (options.applyRest) {
    summary.apply = await applyReferencesViaRest(refs);
  }
  fs.writeFileSync(options.jsonOut, JSON.stringify(summary, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        ...summary,
        sqlOut: path.relative(ROOT_DIR, options.sqlOut),
        jsonOut: path.relative(ROOT_DIR, options.jsonOut),
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
