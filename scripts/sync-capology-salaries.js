#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const { JSDOM } = require("jsdom");

const ROOT_DIR = path.resolve(__dirname, "..");
const CAPOLOGY_BASE_URL = "https://www.capology.com";
const CAPOLOGY_SEARCH_URL = `${CAPOLOGY_BASE_URL}/search_players/?query=a`;
const DEFAULT_SQL_PATH = path.join(
  ROOT_DIR,
  "supabase",
  ".temp",
  "capology-salary-sync.sql",
);
const DEFAULT_JSON_PATH = path.join(
  ROOT_DIR,
  "supabase",
  ".temp",
  "capology-salary-sync.json",
);
const FETCH_CONCURRENCY = 12;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const SUPABASE_CLI_COMMAND =
  process.platform === "win32" ? "supabase.cmd" : "supabase";

const htmlDecoder = new JSDOM("").window.document;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    allClubs: false,
    applyRest: false,
    clubFilters: [],
    dryRun: false,
    limit: 0,
    sqlOut: DEFAULT_SQL_PATH,
    jsonOut: DEFAULT_JSON_PATH,
  };

  argv.forEach((arg, index) => {
    if (arg === "--all-clubs") {
      options.allClubs = true;
      return;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }
    if (arg === "--apply-rest") {
      options.applyRest = true;
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
    if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.split("=", 2)[1] || 0) || 0;
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

  if (!options.allClubs && !options.clubFilters.length) {
    options.allClubs = true;
  }

  return options;
}

function decodeHtml(value = "") {
  const textarea = htmlDecoder.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function stripTags(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function normalizeKey(value = "") {
  return decodeHtml(String(value || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeSqlString(value = "") {
  return String(value || "").replace(/'/g, "''");
}

function getConfigValue(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
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
    throw new Error(`Capology respondeu ${response.status} para ${url}`);
  }

  return response.text();
}

async function fetchClubDirectory() {
  const html = await fetchText(CAPOLOGY_SEARCH_URL);
  const dom = new JSDOM(html);
  const options = [...dom.window.document.querySelectorAll("option")]
    .map((option) => ({
      value: option.getAttribute("value") || "",
      label: option.textContent.trim(),
    }))
    .filter(
      (option) =>
        /^\/club\/.+\/(finances|salaries)\/?$/i.test(option.value) &&
        option.label &&
        normalizeKey(option.label) !== "all",
    );

  const seen = new Set();
  return options
    .map((option) => {
      const slug = option.value
        .replace(/^\/club\//i, "")
        .replace(/\/(finances|salaries)\/?$/i, "");
      return {
        slug,
        label: decodeHtml(option.label),
        salaryPageUrl: `${CAPOLOGY_BASE_URL}/club/${slug}/salaries/`,
      };
    })
    .filter((club) => {
      const key = `${club.slug}|${normalizeKey(club.label)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractPlayerPath(value = "") {
  const match = String(value || "").match(/href=['"]([^'"]+)['"]/i);
  return match ? match[1] : "";
}

function extractPlayerName(value = "") {
  const clean = decodeHtml(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
  return clean;
}

function extractDataArrayFromHtml(html = "", club = {}) {
  const match = html.match(/var\s+data\s*=\s*(\[[\s\S]*?\])\s*;/i);
  if (!match) {
    throw new Error(`Nao encontrei var data na pagina ${club.salaryPageUrl}`);
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

  const sandbox = {
    data: [],
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

  vm.runInNewContext(`data = ${match[1]};`, sandbox, {
    timeout: 5000,
    displayErrors: true,
  });

  return Array.isArray(sandbox.data) ? sandbox.data : [];
}

function mapSalaryRow(club, row = {}) {
  const playerName = extractPlayerName(row.name);
  const playerPath = extractPlayerPath(row.name);
  const weeklySalary = Math.round(Number(row.weekly_gross_eur || 0) || 0);
  if (!playerName || weeklySalary <= 0 || !playerPath) return null;

  const isVerified = /verified-green/i.test(String(row.verified || ""));
  const sourceUrl = `${CAPOLOGY_BASE_URL}${playerPath}`;

  return {
    playerName,
    clubName: club.label,
    weeklySalary,
    sourceName: `Capology ${club.label} public salary page`,
    sourceUrl,
    referenceType: "public_capology",
    verified: isVerified,
    sourcePageUrl: club.salaryPageUrl,
    notes: `Capology sync ${new Date().toISOString()} | verified=${isVerified} | page=${club.salaryPageUrl}`,
  };
}

async function fetchClubSalaryReferences(club) {
  const html = await fetchText(club.salaryPageUrl);
  const rows = extractDataArrayFromHtml(html, club);
  const refs = rows
    .map((row) => mapSalaryRow(club, row))
    .filter(Boolean);

  return {
    club,
    refs,
  };
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

function dedupeReferences(refs = []) {
  const unique = new Map();
  refs.forEach((ref) => {
    const key = [
      normalizeKey(ref.playerName),
      normalizeKey(ref.clubName),
      ref.sourceUrl,
    ].join("|");
    const existing = unique.get(key);
    if (!existing || (!existing.verified && ref.verified)) {
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
  salary_reference_type = ref.resolved_reference_type,
  updated_at = now()
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

async function fetchAllRows(supabaseUrl, serviceRoleKey, table, select) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
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
    const playerKey = normalizeKey(ref.playerName);
    const clubKey = normalizeKey(ref.clubName);
    const array = byPlayer.get(playerKey) || [];
    array.push(ref);
    byPlayer.set(playerKey, array);
    byPlayerClub.set(`${playerKey}|${clubKey}`, ref);
  });

  byPlayer.forEach((entries, key) => {
    byPlayer.set(
      key,
      [...entries].sort((left, right) => {
        const leftVerified = left.verified ? 0 : 1;
        const rightVerified = right.verified ? 0 : 1;
        if (leftVerified !== rightVerified) return leftVerified - rightVerified;
        return left.playerName.localeCompare(right.playerName, "pt-BR");
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
  const clubDirectory = await fetchClubDirectory();
  const filters = options.clubFilters.map(normalizeKey).filter(Boolean);
  const targetClubs = clubDirectory
    .filter((club) => {
      if (options.allClubs) return true;
      const key = normalizeKey(club.label);
      return filters.some((filter) => key.includes(filter));
    })
    .slice(0, options.limit > 0 ? options.limit : undefined);

  if (!targetClubs.length) {
    throw new Error("Nenhum clube encontrado para sincronizar.");
  }

  const results = await mapWithConcurrency(
    targetClubs,
    FETCH_CONCURRENCY,
    async (club) => {
      try {
        const result = await fetchClubSalaryReferences(club);
        console.error(
          `[capology] ${club.label}: ${result.refs.length} referencias`,
        );
        return result;
      } catch (error) {
        console.error(`[capology] ${club.label}: ${error.message}`);
        return {
          club,
          refs: [],
          error: error.message,
        };
      }
    },
  );

  const refs = dedupeReferences(results.flatMap((entry) => entry.refs || []));
  const failed = results.filter((entry) => entry.error);
  const summary = {
    ok: true,
    fetchedClubs: targetClubs.length,
    failedClubs: failed.length,
    references: refs.length,
    sample: refs.slice(0, 10),
    failed: failed.slice(0, 20).map((entry) => ({
      club: entry.club.label,
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
