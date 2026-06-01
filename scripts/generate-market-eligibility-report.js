#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT_DIR, "reports");

function getConfigValue(source, key) {
  const match = String(source || "").match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function getSupabaseConfig() {
  const configSource = fs.readFileSync(
    path.join(ROOT_DIR, "js", "config.js"),
    "utf8",
  );
  const supabaseUrl =
    process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase URL/key nao encontrados.");
  }

  return { supabaseUrl, publishableKey };
}

async function loadEligibilityPage({ supabaseUrl, publishableKey, limit, offset }) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/app_get_market_eligibility_page`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_limit: limit,
        p_offset: offset,
      }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      text || `Supabase respondeu ${response.status} ao paginar elegibilidade.`,
    );
  }

  const parsed = text ? JSON.parse(text) : [];
  return Array.isArray(parsed) ? parsed : [];
}

async function loadAllEligibilityRows(pageSize = 500) {
  const config = getSupabaseConfig();
  const rows = [];
  let offset = 0;

  for (;;) {
    const page = await loadEligibilityPage({
      ...config,
      limit: pageSize,
      offset,
    });
    if (!page.length) break;
    rows.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }

  return rows;
}

function toCsv(rows = [], columns = []) {
  const escape = (value) => {
    const text =
      value === null || value === undefined ? "" : String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => escape(row[column])).join(","),
    ),
  ].join("\n");
}

function writeText(fileName, contents) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, fileName), contents, "utf8");
}

function numberValue(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function main() {
  const rows = await loadAllEligibilityRows();
  const normalizedRows = rows.map((row) => ({
    id: row.id,
    name: row.name || "",
    normalized_name: row.normalized_name || "",
    club: row.club || "",
    league: row.league || "",
    country: row.country || "",
    position: row.position || "",
    age: numberValue(row.age),
    market_value_eur: numberValue(row.market_value_eur),
    transfermarkt_url: row.transfermarkt_url || "",
    source: row.source || "",
    last_synced_at: row.last_synced_at || "",
    transfermarkt_verified: Boolean(row.transfermarkt_verified),
    weekly_salary_eur: numberValue(row.weekly_salary_eur),
    salary_source_name: row.salary_source_name || "",
    salary_source_url: row.salary_source_url || "",
    salary_checked_at: row.salary_checked_at || "",
    salary_reference_type: row.salary_reference_type || "",
    salary_eligibility_mode: row.salary_eligibility_mode || "",
    salary_eligibility_source: row.salary_eligibility_source || "",
    catalog_eligible: Boolean(row.catalog_eligible),
    ineligibility_reason: row.ineligibility_reason || "",
    has_official_duplicate: Boolean(row.has_official_duplicate),
  }));

  const eligibleRows = normalizedRows.filter((row) => row.catalog_eligible);
  const historicalRows = eligibleRows.filter(
    (row) => row.salary_eligibility_mode === "historical_public",
  );
  const ineligibleRows = normalizedRows.filter((row) => !row.catalog_eligible);
  const ineligibleByReason = ineligibleRows.reduce((acc, row) => {
    const reason = row.ineligibility_reason || "unknown";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});

  const summary = {
    generatedAt: new Date().toISOString(),
    totalRows: normalizedRows.length,
    eligibleRows: eligibleRows.length,
    currentPublicRows: eligibleRows.filter(
      (row) => row.salary_eligibility_mode === "current_public",
    ).length,
    historicalPublicRows: historicalRows.length,
    ineligibleRows: ineligibleRows.length,
    missingValue: ineligibleByReason.missing_value || 0,
    missingTransfermarktUrl: ineligibleByReason.missing_transfermarkt_url || 0,
    missingPublic: ineligibleByReason.missing_public || 0,
    duplicateLegacy: ineligibleByReason.duplicate_legacy || 0,
    eligibleWithoutTransfermarkt: eligibleRows.filter(
      (row) => !row.transfermarkt_verified,
    ).length,
    eligibleWithoutPublicSalary: eligibleRows.filter(
      (row) =>
        !["current_public", "historical_public"].includes(
          row.salary_eligibility_mode,
        ),
    ).length,
  };

  const baseColumns = [
    "id",
    "name",
    "club",
    "league",
    "position",
    "age",
    "market_value_eur",
    "transfermarkt_url",
    "weekly_salary_eur",
    "salary_reference_type",
    "salary_eligibility_mode",
    "salary_eligibility_source",
    "salary_source_url",
    "salary_checked_at",
    "source",
    "last_synced_at",
  ];

  writeText(
    "market-eligible-players.csv",
    toCsv(eligibleRows, baseColumns),
  );
  writeText(
    "market-ineligible-players.csv",
    toCsv(ineligibleRows, [
      ...baseColumns,
      "ineligibility_reason",
      "has_official_duplicate",
      "transfermarkt_verified",
    ]),
  );
  writeText(
    "market-historical-public-players.csv",
    toCsv(historicalRows, baseColumns),
  );
  writeText(
    "market-eligibility-summary.json",
    JSON.stringify(summary, null, 2),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...summary,
        reports: [
          path.join(REPORTS_DIR, "market-eligible-players.csv"),
          path.join(REPORTS_DIR, "market-ineligible-players.csv"),
          path.join(REPORTS_DIR, "market-historical-public-players.csv"),
          path.join(REPORTS_DIR, "market-eligibility-summary.json"),
        ],
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
