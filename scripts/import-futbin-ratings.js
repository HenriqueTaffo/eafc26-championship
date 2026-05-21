#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW_UNLABELED = process.argv.includes("--allow-unlabeled");
const DEFAULT_SOURCE_URL = "https://www.futbin.com/players?version=gold";
const SPECIAL_TERMS = [
  "totw", "toty", "tots", "ucl", "uel", "uwcl", "hero", "icon", "icono", "sbc",
  "objective", "objectives", "evolution", "evolutions", "evo", "special", "promo",
  "trailblazers", "thunderstruck", "centurions", "winter", "future stars", "showdown",
  "player moments", "moments", "inform", "if", "potm", "flashback", "ultimate scream",
  "path to glory", "road to", "primetime"
];
const BASE_TERMS = ["normal", "gold", "gold rare", "gold non-rare", "rare gold", "non-rare gold"];

function getArg(name) {
  const direct = process.argv.find(arg => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function getConfigValue(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1] : "";
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(item => item.some(value => String(value || "").trim()));
}

function pick(row, names) {
  for (const name of names) {
    const value = row[normalizeKey(name)];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function toInt(value) {
  const number = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function isBaseCard(cardType) {
  const normalized = String(cardType || "").trim().toLowerCase();
  if (!normalized) return ALLOW_UNLABELED;
  if (SPECIAL_TERMS.some(term => normalized.includes(term))) return false;
  return BASE_TERMS.some(term => normalized === term || normalized.includes(term));
}

function mapPlayer(row, index) {
  const cardType = pick(row, ["version", "card_type", "card type", "rarity", "quality", "revision"]) || "Normal";
  if (!isBaseCard(cardType)) return null;

  const name = pick(row, ["name", "player", "player name", "common name"]);
  const overall = toInt(pick(row, ["overall", "ovr", "rating"]));
  if (!name || !overall) return null;

  const futbinId = pick(row, ["id", "futbin id", "player id", "resource id"]);
  return {
    ea_id: futbinId ? `futbin:${futbinId}` : `futbin:${normalizeKey(name)}:${overall}:${index}`,
    rank: toInt(pick(row, ["rank"])),
    name,
    nation: pick(row, ["nation", "nationality", "country"]),
    club: pick(row, ["club", "team"]),
    position: pick(row, ["position", "pos"]),
    overall,
    pace: toInt(pick(row, ["pace", "pac"])),
    shooting: toInt(pick(row, ["shooting", "sho"])),
    passing: toInt(pick(row, ["passing", "pas"])),
    dribbling: toInt(pick(row, ["dribbling", "dri"])),
    defending: toInt(pick(row, ["defending", "def"])),
    physical: toInt(pick(row, ["physical", "phy"])),
    avatar_url: pick(row, ["avatar_url", "avatar", "image", "image_url", "photo", "photo_url", "player_image"]),
    shield_url: pick(row, ["shield_url", "shield", "club_image", "club_logo", "badge"]),
    card_type: cardType,
    source_url: pick(row, ["url", "futbin_url", "source_url"]) || DEFAULT_SOURCE_URL,
    source_name: "FUTBIN base gold ratings"
  };
}

async function main() {
  const file = getArg("--file") || getArg("-f") || "data/futbin-ratings.csv";
  const csvPath = path.resolve(ROOT_DIR, file);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV não encontrado: ${csvPath}. Use --file caminho/do/futbin.csv`);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const headers = rows[0].map(normalizeKey);
  const players = rows.slice(1)
    .map((values, index) => headers.reduce((acc, key, columnIndex) => {
      acc[key] = String(values[columnIndex] || "").trim();
      return acc;
    }, { _index: index }))
    .map((row, index) => mapPlayer(row, index))
    .filter(Boolean);

  if (!players.length) {
    throw new Error("Nenhum jogador base/normal encontrado. Confira as colunas e o filtro de versão.");
  }

  if (DRY_RUN) {
    console.log(JSON.stringify({
      ok: true,
      found: players.length,
      preview: players.slice(0, 8).map(player => ({
        name: player.name,
        overall: player.overall,
        club: player.club,
        card_type: player.card_type,
        photo: Boolean(player.avatar_url)
      }))
    }, null, 2));
    return;
  }

  const configSource = fs.readFileSync(path.join(ROOT_DIR, "js/config.js"), "utf8");
  const supabaseUrl = process.env.SUPABASE_URL || getConfigValue(configSource, "SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || getConfigValue(configSource, "SUPABASE_PUBLISHABLE_KEY");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/app_upsert_ea_player_ratings`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_players: players })
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase respondeu ${response.status}`);
  console.log(text || JSON.stringify({ ok: true, upserted: players.length }));
  console.log(`Importados ${players.length} jogadores base/normais do FUTBIN.`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
