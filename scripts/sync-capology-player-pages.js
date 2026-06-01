#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const { JSDOM } = require("jsdom");

const ROOT_DIR = path.resolve(__dirname, "..");
const CAPOLOGY_BASE_URL = "https://www.capology.com";
const CAPOLOGY_SITEMAP_URL = `${CAPOLOGY_BASE_URL}/sitemap.xml`;
const DEFAULT_SQL_PATH = path.join(
  ROOT_DIR,
  "supabase",
  ".temp",
  "capology-player-page-sync.sql",
);
const DEFAULT_JSON_PATH = path.join(
  ROOT_DIR,
  "supabase",
  ".temp",
  "capology-player-page-sync.json",
);
const DEFAULT_FETCH_CONCURRENCY = 4;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;
const DEFAULT_MIN_MARKET_VALUE = 0;
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
      options.limit = parseNumberArg(arg.split("=", 2)[1], 0);
      return;
    }
    if (arg.startsWith("--offset=")) {
      options.offset = parseNumberArg(arg.split("=", 2)[1], 0);
      return;
    }
    if (arg.startsWith("--min-market-value=")) {
      options.minMarketValue = parseNumberArg(
        arg.split("=", 2)[1],
        DEFAULT_MIN_MARKET_VALUE,
      );
      return;
    }
    if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseNumberArg(
        arg.split("=", 2)[1],
        DEFAULT_FETCH_CONCURRENCY,
      );
      return;
    }
    if (arg.startsWith("--retry-count=")) {
      options.retryCount = parseNumberArg(
        arg.split("=", 2)[1],
        DEFAULT_RETRY_COUNT,
      );
      return;
    }
    if (arg.startsWith("--retry-delay-ms=")) {
      options.retryDelayMs = parseNumberArg(
        arg.split("=", 2)[1],
        DEFAULT_RETRY_DELAY_MS,
      );
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

function parseNumberArg(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeHtml(value = "") {
  const textarea = htmlDecoder.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function stripTags(value = "") {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value = "") {
  return decodeHtml(String(value || ""))
    .replace(/&#8217;|&#x2019;|&#39;|&apos;/gi, "'")
    .replace(/[â€™â€˜`Â´]/g, "'")
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

function normalizeClubAlias(value = "") {
  const normalized = normalizeKey(value);
  const aliases = new Map([
    ["r madrid", "real madrid"],
    ["real madrid", "real madrid"],
    ["psg", "paris saint germain"],
    ["paris sg", "paris saint germain"],
    ["paris saint germain", "paris saint germain"],
    ["atl madrid", "atletico madrid"],
    ["a madrid", "atletico madrid"],
    ["atleti", "atletico madrid"],
    ["man utd", "manchester united"],
    ["man united", "manchester united"],
    ["man city", "manchester city"],
    ["inter", "internazionale milano"],
    ["inter milan", "internazionale milano"],
    ["inter miami", "club internacional de futbol miami"],
    ["inter miami cf", "club internacional de futbol miami"],
    ["lafc", "los angeles football club"],
    ["la fc", "los angeles football club"],
    ["sporting cp", "sporting clube de portugal"],
    ["sporting", "sporting clube de portugal"],
    ["juve", "juventus"],
    ["spurs", "tottenham hotspur"],
    ["cruzeiro", "cruzeiro esporte clube"],
    ["west ham", "west ham united"],
  ]);
  return aliases.get(normalized) || normalized;
}

function getClubComparableTokens(value = "") {
  const normalized = normalizeClubAlias(value)
    .replace(/\bsaint\b/g, "st")
    .replace(/\batletico\b/g, "atl")
    .replace(/\binternazionale\b/g, "inter")
    .replace(/\bhotspur\b/g, "")
    .replace(/\bund\b/g, "")
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
    "soccer",
    "sv",
    "the",
    "turn",
    "und",
    "verein",
  ]);

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !stopwords.has(token));
}

function getClubComparableKey(value = "") {
  return getClubComparableTokens(value).join(" ");
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
    .replace(/[â€™â€˜`Â´]/g, "'")
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
    "pedro goncalves": ["Pote"],
    "lucas paqueta": ["Lucas Paqueta"],
    "n golo kante": ["N'Golo Kante", "Ngolo Kante"],
    "n'golo kante": ["N'Golo Kante", "Ngolo Kante"],
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

function getMeaningfulNameTokens(value = "") {
  return normalizeKey(value)
    .split(" ")
    .filter((token) => token.length >= 4 && !/^(jr|sr|ii|iii|iv)$/.test(token));
}

function tokenSubsetMatch(leftValue = "", rightValue = "") {
  const leftTokens = getMeaningfulNameTokens(leftValue);
  const rightTokens = getMeaningfulNameTokens(rightValue);
  if (!leftTokens.length || !rightTokens.length) return false;

  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longerSet = new Set(leftTokens.length <= rightTokens.length ? rightTokens : leftTokens);
  return shorter.length >= 2 && shorter.every((token) => longerSet.has(token));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      referer: CAPOLOGY_BASE_URL,
    },
    redirect: "follow",
  });

  if (!response.ok) {
    const error = new Error(`Capology respondeu ${response.status} para ${url}`);
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

  byPlayer.forEach((entries, key) => {
    byPlayer.set(
      key,
      [...entries].sort((left, right) => {
        const leftCheckedAt =
          left.salary_checked_at || left.source_checked_at || left.salaryCheckedAt || "";
        const rightCheckedAt =
          right.salary_checked_at || right.source_checked_at || right.salaryCheckedAt || "";
        return String(rightCheckedAt).localeCompare(String(leftCheckedAt), "pt-BR");
      }),
    );
  });

  return {
    byPlayer,
    byPlayerClub,
  };
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

function targetAlreadyHasPublicRef(refIndex, playerName = "", clubName = "") {
  const playerKey = normalizeKey(playerName);
  const clubKey = normalizeKey(clubName);
  if (!playerKey) return false;
  if (refIndex.byPlayerClub.has(`${playerKey}|${clubKey}`)) return true;
  const entries = refIndex.byPlayer.get(playerKey) || [];
  if (
    entries.some((entry) =>
      clubTextsLookCompatible(clubName, entry.clubName || entry.club_name || ""),
    )
  ) {
    return true;
  }
  return entries.length === 1;
}

function matchesFilters(target, options = {}) {
  const playerFilters = (options.playerFilters || []).map(normalizeKey).filter(Boolean);
  const clubFilters = (options.clubFilters || []).map(normalizeKey).filter(Boolean);
  const haystackPlayer = normalizeKey(
    [...(target.playerNames || []), target.playerName].filter(Boolean).join(" "),
  );
  const haystackClub = normalizeKey(target.clubName);
  const haystackClubComparable = getClubComparableKey(target.clubName);

  if (
    playerFilters.length &&
    !playerFilters.some((filter) => haystackPlayer.includes(filter))
  ) {
    return false;
  }

  if (
    clubFilters.length &&
    !clubFilters.some((filter) => {
      const comparableFilter = getClubComparableKey(filter);
      if (comparableFilter && comparableFilter === haystackClubComparable) {
        return true;
      }
      if (filter === haystackClub) return true;
      const filterTokenCount = filter.split(" ").filter(Boolean).length;
      return filterTokenCount >= 2 && haystackClub.includes(filter);
    })
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

function extractJavascriptArray(source = "", variableName = "") {
  const match = new RegExp(`var\\s+${variableName}\\s*=\\s*\\[`, "i").exec(source);
  if (!match) return null;

  let cursor = match.index + match[0].length - 1;
  let depth = 0;
  let escaped = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (; cursor < source.length; cursor += 1) {
    const char = source[cursor];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (inSingle) {
      if (char === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (char === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (char === "`") inTemplate = false;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      continue;
    }
    if (char === "`") {
      inTemplate = true;
      continue;
    }
    if (char === "[") {
      depth += 1;
      continue;
    }
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(match.index + match[0].length - 1, cursor + 1);
      }
    }
  }

  return null;
}

function createMomentStub(value) {
  return {
    value,
    format() {
      return String(value || "");
    },
    fromNow() {
      return "";
    },
    diff() {
      return 0;
    },
    isValid() {
      return true;
    },
    unix() {
      return 0;
    },
    toDate() {
      return new Date(0);
    },
  };
}

function parsePlayerDataRowsFromHtml(html = "", url = "") {
  const extracted = extractJavascriptArray(html, "data_active");
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const playerHeading = document.querySelector("h1")?.textContent || "";
  const titleText = document.querySelector("title")?.textContent || "";
  const slugName = String(url || "")
    .replace(/^https:\/\/www\.capology\.com\/player\//i, "")
    .replace(/\/+$/g, "")
    .replace(/-\d+$/i, "")
    .replace(/-/g, " ");
  const pagePlayerName = decodeHtml(playerHeading || titleText || slugName)
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+Salary Profile.*$/i, "")
    .replace(/\s*\|.*$/, "")
    .trim();

  if (!extracted) {
    return {
      url,
      pagePlayerName,
      rows: [],
    };
  }

  const sandbox = {
    data_active: [],
    Math,
    accounting: {
      formatMoney(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      },
    },
    moment(value) {
      return createMomentStub(value);
    },
  };
  sandbox.moment.utc = (value) => createMomentStub(value);
  sandbox.moment.unix = (value) => createMomentStub(value);

  vm.runInNewContext(`data_active = ${extracted};`, sandbox, {
    timeout: 5000,
    displayErrors: true,
  });

  const rows = (Array.isArray(sandbox.data_active) ? sandbox.data_active : [])
    .map((row) => {
      const weeklySalary = Math.round(Number(row.weekly_gross_eur || 0) || 0);
      const clubName = stripTags(row.club);
      if (!clubName || weeklySalary <= 0) return null;

      return {
        clubName,
        weeklySalary,
        verified: /verified-green/i.test(String(row.verified || "")),
        status: stripTags(row.status),
        active: String(row.active || "").toLowerCase() === "true",
        loan: String(row.loan || "").toLowerCase() === "true",
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftState = left.active ? 0 : left.loan ? 1 : 2;
      const rightState = right.active ? 0 : right.loan ? 1 : 2;
      if (leftState !== rightState) return leftState - rightState;
      const leftVerified = left.verified ? 0 : 1;
      const rightVerified = right.verified ? 0 : 1;
      if (leftVerified !== rightVerified) return leftVerified - rightVerified;
      return Number(right.weeklySalary || 0) - Number(left.weeklySalary || 0);
    });

  return {
    url,
    pagePlayerName,
    rows,
    primaryRow: rows[0] || null,
  };
}

async function fetchPlayerSitemap(options = {}) {
  const xml = await fetchTextWithRetry(CAPOLOGY_SITEMAP_URL, options);
  const urls = [...xml.matchAll(/<loc>(https:\/\/www\.capology\.com\/player\/[^<]+)<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean);

  const byLookupKey = new Map();
  const byToken = new Map();
  const allEntries = [];
  const seenUrls = new Set();

  urls.forEach((rawUrl) => {
    const canonicalUrl = String(rawUrl || "").replace(/\/+$/, "/");
    if (seenUrls.has(canonicalUrl)) return;
    seenUrls.add(canonicalUrl);

    const slug = canonicalUrl
      .replace(/^https:\/\/www\.capology\.com\/player\//i, "")
      .replace(/\/+$/g, "");
    const slugName = decodeURIComponent(slug)
      .replace(/-\d+$/i, "")
      .replace(/-/g, " ");
    const lookupKey = normalizeKey(slugName);
    if (!lookupKey) return;

    const entry = {
      canonicalUrl,
      lookupKey,
      slug,
      slugName,
      tokens: getMeaningfulNameTokens(slugName),
    };
    allEntries.push(entry);

    const bucket = byLookupKey.get(lookupKey) || [];
    bucket.push(entry);
    byLookupKey.set(lookupKey, bucket);

    entry.tokens.forEach((token) => {
      const tokenBucket = byToken.get(token) || [];
      tokenBucket.push(entry);
      byToken.set(token, tokenBucket);
    });
  });

  return {
    allEntries,
    byLookupKey,
    byToken,
  };
}

function getCandidatePages(index, playerName = "") {
  const aliasKeys = getPlayerAliasVariants(playerName)
    .map((name) => normalizeKey(name))
    .filter(Boolean);
  const candidates = new Map();

  aliasKeys.forEach((aliasKey) => {
    (index.byLookupKey.get(aliasKey) || []).forEach((entry) => {
      candidates.set(entry.canonicalUrl, {
        ...entry,
        nameScore: 0,
        overlapCount: entry.tokens.length,
      });
    });
  });

  if (candidates.size) {
    return [...candidates.values()];
  }

  aliasKeys.forEach((aliasKey) => {
    const aliasTokens = getMeaningfulNameTokens(aliasKey);
    const tokenCandidates = new Map();

    aliasTokens.forEach((token) => {
      (index.byToken.get(token) || []).forEach((entry) => {
        const existing = tokenCandidates.get(entry.canonicalUrl) || {
          ...entry,
          overlapCount: 0,
        };
        existing.overlapCount += 1;
        tokenCandidates.set(entry.canonicalUrl, existing);
      });
    });

    tokenCandidates.forEach((entry) => {
      if (
        tokenSubsetMatch(aliasKey, entry.lookupKey) ||
        tokenSubsetMatch(entry.lookupKey, aliasKey) ||
        isTrustedNameMatch(aliasKey, entry.lookupKey) ||
        isTrustedNameMatch(entry.lookupKey, aliasKey)
      ) {
        const existing = candidates.get(entry.canonicalUrl);
        if (!existing || existing.nameScore > 1) {
          candidates.set(entry.canonicalUrl, {
            ...entry,
            nameScore: 1,
          });
        }
      }
    });
  });

  return [...candidates.values()]
    .sort((left, right) => {
      if (left.nameScore !== right.nameScore) {
        return left.nameScore - right.nameScore;
      }
      if (left.overlapCount !== right.overlapCount) {
        return Number(right.overlapCount || 0) - Number(left.overlapCount || 0);
      }
      return left.lookupKey.localeCompare(right.lookupKey, "pt-BR");
    })
    .slice(0, 12);
}

function scoreNameMatch(playerName = "", pagePlayerName = "") {
  const aliasKeys = getPlayerAliasVariants(playerName)
    .map((name) => normalizeKey(name))
    .filter(Boolean);
  const pageKey = normalizeKey(pagePlayerName);
  if (!pageKey) return 9;
  if (aliasKeys.includes(pageKey)) return 0;
  if (
    aliasKeys.some(
      (key) =>
        tokenSubsetMatch(key, pageKey) ||
        tokenSubsetMatch(pageKey, key) ||
        isTrustedNameMatch(key, pageKey) ||
        isTrustedNameMatch(pageKey, key),
    )
  ) {
    return 1;
  }
  return 9;
}

function scoreClubMatch(targetClub = "", rowClub = "") {
  return clubTextsLookCompatible(targetClub, rowClub) ? 0 : 9;
}

function buildResolvedReference(target, parsed, row, mode) {
  const weeklySalary = Number(row?.weeklySalary || 0);
  if (weeklySalary <= 0) return [];

  const resolvedClub = String(row?.clubName || target.clubName || "").trim();
  const notes = [
    `Capology player-page sync ${new Date().toISOString()}`,
    `mode=${mode}`,
    `requestedClub=${target.clubName || ""}`,
    `sourceClub=${resolvedClub}`,
    `pagePlayer=${parsed.pagePlayerName || target.playerName}`,
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
      sourceName: `Capology ${resolvedClub || "public"} public salary page`,
      sourceUrl: parsed.url,
      referenceType: "public_capology",
      notes,
    }));
}

async function resolveCapologyPlayerPages(index, targets = [], options = {}) {
  const pageCache = new Map();

  const loadPage = async (url) => {
    if (!pageCache.has(url)) {
      pageCache.set(
        url,
        fetchTextWithRetry(url, options).then((html) => parsePlayerDataRowsFromHtml(html, url)),
      );
    }
    return pageCache.get(url);
  };

  return mapWithConcurrency(
    targets,
    Math.max(1, Number(options.concurrency || DEFAULT_FETCH_CONCURRENCY)),
    async (target) => {
      const candidatePages = getCandidatePages(index, target.playerName);
      const attempts = [];

      for (const candidate of candidatePages.slice(0, 6)) {
        try {
          const parsed = await loadPage(candidate.canonicalUrl);
          const currentRow =
            parsed.rows.find((row) => scoreClubMatch(target.clubName, row.clubName) <= 1) ||
            parsed.primaryRow;
          attempts.push({
            candidate,
            parsed,
            row: currentRow || null,
            nameScore: scoreNameMatch(target.playerName, parsed.pagePlayerName),
            clubScore: currentRow ? scoreClubMatch(target.clubName, currentRow.clubName) : 99,
          });
        } catch (error) {
          attempts.push({
            candidate,
            error: error.message,
            row: null,
            nameScore: 99,
            clubScore: 99,
          });
        }
      }

      const bestCurrentMatch = attempts
        .filter((attempt) => attempt.parsed && attempt.row)
        .filter((attempt) => attempt.nameScore <= 1 && attempt.clubScore <= 1)
        .sort((left, right) => {
          if (left.nameScore !== right.nameScore) {
            return left.nameScore - right.nameScore;
          }
          const leftVerified = left.row?.verified ? 0 : 1;
          const rightVerified = right.row?.verified ? 0 : 1;
          if (leftVerified !== rightVerified) return leftVerified - rightVerified;
          return Number(right.row?.weeklySalary || 0) - Number(left.row?.weeklySalary || 0);
        })[0];

      if (bestCurrentMatch) {
        return {
          target,
          refs: buildResolvedReference(
            target,
            bestCurrentMatch.parsed,
            bestCurrentMatch.row,
            "current_public",
          ),
          page: bestCurrentMatch.candidate.canonicalUrl,
          player: bestCurrentMatch.parsed.pagePlayerName,
          requestedClub: target.clubName,
          sourceClub: bestCurrentMatch.row.clubName,
          weeklySalary: Number(bestCurrentMatch.row.weeklySalary || 0),
          mode: "current_public",
        };
      }

      const bestHistoricalMatch = attempts
        .filter((attempt) => attempt.parsed && attempt.row)
        .filter((attempt) => attempt.nameScore === 0)
        .sort((left, right) => {
          const leftVerified = left.row?.verified ? 0 : 1;
          const rightVerified = right.row?.verified ? 0 : 1;
          if (leftVerified !== rightVerified) return leftVerified - rightVerified;
          return Number(right.row?.weeklySalary || 0) - Number(left.row?.weeklySalary || 0);
        })[0];

      if (bestHistoricalMatch) {
        return {
          target,
          refs: buildResolvedReference(
            target,
            bestHistoricalMatch.parsed,
            bestHistoricalMatch.row,
            "historical_public",
          ),
          page: bestHistoricalMatch.candidate.canonicalUrl,
          player: bestHistoricalMatch.parsed.pagePlayerName,
          requestedClub: target.clubName,
          sourceClub: bestHistoricalMatch.row.clubName,
          weeklySalary: Number(bestHistoricalMatch.row.weeklySalary || 0),
          mode: "historical_public",
        };
      }

      return {
        target,
        refs: [],
        error:
          attempts.find((attempt) => attempt.error)?.error ||
          "Nao encontrei pagina publica do Capology compativel com nome/clube.",
      };
    },
  );
}

function dedupeReferences(refs = []) {
  const unique = new Map();
  refs.forEach((ref) => {
    const key = [
      normalizeKey(ref.playerName),
      normalizeKey(ref.clubName),
      String(ref.sourceUrl || "").trim().toLowerCase(),
    ].join("|");
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, ref);
      return;
    }
    if (String(existing.notes || "").includes("historical_public")) return;
    unique.set(key, ref);
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
        salary_reference_type: ref.referenceType || "public_capology",
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
        salary_reference_type: ref.referenceType || "public_capology",
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
        salary_reference_type: ref.referenceType || "public_capology",
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
  const patchedProposalCount = await patchRowsById(
    supabaseUrl,
    serviceRoleKey,
    "internal_transfer_proposals",
    proposalUpdates,
  );

  return {
    referencesUpserted: refs.length,
    rosterRowsUpdated: rosterCount,
    transferRowsUpdated: transferCount,
    proposalRowsUpdated: patchedProposalCount,
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
  const targetSlice = allTargets.slice(
    Math.max(0, Number(options.offset || 0)),
    options.limit > 0
      ? Math.max(0, Number(options.offset || 0)) + Number(options.limit)
      : undefined,
  );

  if (!targetSlice.length) {
    throw new Error("Nenhum jogador pendente encontrado para sincronizar.");
  }

  const sitemap = await fetchPlayerSitemap(options);
  const results = await resolveCapologyPlayerPages(sitemap, targetSlice, options);
  const refs = dedupeReferences(results.flatMap((entry) => entry.refs || []));
  const resolved = results.filter((entry) => (entry.refs || []).length);
  const failed = results.filter((entry) => !(entry.refs || []).length);

  const summary = {
    ok: true,
    fetchedTargets: targetSlice.length,
    totalTargets: allTargets.length,
    failedTargets: failed.length,
    concurrency: Math.max(
      1,
      Number(options.concurrency || DEFAULT_FETCH_CONCURRENCY),
    ),
    limit: Number(options.limit || 0),
    offset: Number(options.offset || 0),
    nextOffset: Number(options.offset || 0) + targetSlice.length,
    references: refs.length,
    currentPublicMatches: resolved.filter((entry) => entry.mode === "current_public").length,
    historicalPublicMatches: resolved.filter((entry) => entry.mode === "historical_public").length,
    sample: resolved.slice(0, 10).map((entry) => ({
      playerName: entry.target.playerName,
      requestedClub: entry.requestedClub,
      sourceClub: entry.sourceClub,
      weeklySalary: entry.weeklySalary,
      mode: entry.mode,
      page: entry.page,
    })),
    failed: failed.slice(0, 20).map((entry) => ({
      playerName: entry.target.playerName,
      clubName: entry.target.clubName,
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
