#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const EXTERNAL_PRIORITY_CLUBS = [
  "Fenerbahce",
  "Galatasaray",
  "Besiktas",
  "Al Ittihad",
  "Al Hilal",
  "Al Nassr",
  "Al Ahli",
];

function getConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(
    process.execPath,
    [scriptPath, ...args],
    {
      cwd: ROOT_DIR,
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Falha ao executar ${path.basename(scriptPath)}.`);
  }
}

async function loadCurrentLeagueClubs() {
  const configSource = fs.readFileSync(path.join(ROOT_DIR, "js/config.js"), "utf8");
  const supabaseUrl =
    process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase URL/key nao encontrados.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/app_get_data`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase respondeu ${response.status}`);
  }

  const payload = text ? JSON.parse(text) : {};
  const leagueClubs = [...new Set(
    (payload.clubs || [])
      .map((club) => String(club.Time || "").trim())
      .filter(Boolean),
  )];

  return [...new Set([...leagueClubs, ...EXTERNAL_PRIORITY_CLUBS])];
}

async function main() {
  const clubs = await loadCurrentLeagueClubs();
  const clubArgs = clubs.flatMap((club) => [`--club=${club}`]);

  runNodeScript(path.join(ROOT_DIR, "scripts", "import-ea-ratings.js"));
  runNodeScript(path.join(ROOT_DIR, "scripts", "sync-capology-salaries.js"), [
    "--apply-rest",
    "--concurrency=3",
    "--retry-count=4",
    "--retry-delay-ms=1500",
    ...clubArgs,
  ]);
  runNodeScript(path.join(ROOT_DIR, "scripts", "sync-salarysport-salaries.js"), [
    "--apply-rest",
    "--concurrency=4",
    "--retry-count=4",
    "--retry-delay-ms=1500",
    "--limit=400",
    "--min-market-value=2500000",
    ...clubArgs,
  ]);
  runNodeScript(path.join(ROOT_DIR, "scripts", "sync-transfermarkt-market-values.js"), [
    "--limit=1200",
    "--delay-ms=900",
    "--retry-count=3",
    "--retry-delay-ms=1200",
    ...clubArgs,
  ]);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
