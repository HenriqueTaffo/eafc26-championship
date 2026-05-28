const fs = require("fs/promises");
const path = require("path");

const EA_RATINGS_URL = "https://www.ea.com/games/ea-sports-fc/ratings";
const OUTPUT_FILE = path.resolve(
  __dirname,
  "..",
  "src",
  "data",
  "greece-market-fallback.json",
);
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const TARGET_GROUP_KEY = "hellas liga";
const TARGET_COUNTRY = "Greece";

function repairBrokenUtf8(value = "") {
  const input = String(value || "");
  if (!input) return input;

  const suspiciousPattern =
    /[ÃƒÆ’Ãƒâ€šÃƒÂ¢ÃƒÂ°Ãƒâ€™]|[\u0192\u2018\u2019\u201c\u201d\u2013\u2014\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]|ÃƒÂ¯Ã‚Â¿Ã‚Â½|Ã¯Â¿Â½/;
  if (!suspiciousPattern.test(input)) return input;

  try {
    const windows1252Map = new Map([
      [0x20ac, 0x80],
      [0x201a, 0x82],
      [0x0192, 0x83],
      [0x201e, 0x84],
      [0x2026, 0x85],
      [0x2020, 0x86],
      [0x2021, 0x87],
      [0x02c6, 0x88],
      [0x2030, 0x89],
      [0x0160, 0x8a],
      [0x2039, 0x8b],
      [0x0152, 0x8c],
      [0x017d, 0x8e],
      [0x2018, 0x91],
      [0x2019, 0x92],
      [0x201c, 0x93],
      [0x201d, 0x94],
      [0x2022, 0x95],
      [0x2013, 0x96],
      [0x2014, 0x97],
      [0x02dc, 0x98],
      [0x2122, 0x99],
      [0x0161, 0x9a],
      [0x203a, 0x9b],
      [0x0153, 0x9c],
      [0x017e, 0x9e],
      [0x0178, 0x9f],
    ]);

    const bytes = Uint8Array.from(
      Array.from(input, (char) => {
        const codePoint = char.codePointAt(0) || 0;
        if (codePoint <= 0xff) return codePoint;
        return windows1252Map.get(codePoint) ?? 0x3f;
      }),
    );

    return new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/\u00ad/g, "")
      .replace(/\uFFFD/g, "");
  } catch (_) {
    return input;
  }
}

function normalizeText(value = "") {
  return repairBrokenUtf8(String(value || ""))
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanText(value = "") {
  return repairBrokenUtf8(String(value || "").trim());
}

function getAge(birthdate) {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && now.getDate() < born.getDate())
  ) {
    age -= 1;
  }
  return age;
}

function roundMarketValue(value) {
  return Math.max(100000, Math.round(Number(value || 0) / 50000) * 50000);
}

function estimateMarketValue(item = {}, teamLabel = "") {
  const overall = Number(item.overallRating || 0);
  const age = Number(getAge(item.birthdate) || 0);
  const position = cleanText(item.position?.shortLabel || "").toUpperCase();

  const performanceBase = Math.max(0, overall - 58);
  let value = performanceBase * performanceBase * 15500;

  if (["ST", "CF", "CAM", "LW", "RW"].includes(position)) value *= 1.08;
  else if (["CB", "CDM", "CM"].includes(position)) value *= 1.03;
  else if (position === "GK") value *= 0.84;

  if (age && age <= 20) value *= 1.36;
  else if (age && age <= 23) value *= 1.2;
  else if (age && age <= 27) value *= 1.04;
  else if (age && age >= 31 && age <= 33) value *= 0.78;
  else if (age && age > 33) value *= 0.56;

  if (
    /olympiacos|panathinaikos|aek athens|paok/.test(
      normalizeText(teamLabel),
    )
  ) {
    value *= 1.1;
  }

  return roundMarketValue(value);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`EA ratings request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function fetchNextData(url) {
  const html = await fetchHtml(url);
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error(`NEXT_DATA not found for ${url}`);
  }
  return JSON.parse(match[1]);
}

function getGreekTeams(nextData) {
  const groups = nextData?.props?.pageProps?.ratingsFilters?.teamGroups || [];
  const group = groups.find(
    (item) => normalizeText(cleanText(item?.label || "")) === TARGET_GROUP_KEY,
  );

  if (!group?.teams?.length) {
    throw new Error("Hellas Liga team group was not found on EA.");
  }

  return group.teams.map((team) => ({
    id: Number(team.id),
    label: cleanText(team.label || ""),
    imageUrl: String(team.imageUrl || ""),
  }));
}

async function fetchTeamPlayers(team) {
  const url = `${EA_RATINGS_URL}?team=${team.id}`;
  const nextData = await fetchNextData(url);
  const items = nextData?.props?.pageProps?.ratingDetails?.items || [];
  return items.map((item) => {
    const playerName = cleanText(
      item.commonName ||
        [item.firstName, item.lastName].filter(Boolean).join(" "),
    );
    return {
      id: `greece-${team.id}-${item.id}`,
      ea_id: Number(item.id),
      team_id: team.id,
      name: playerName,
      normalized_name: normalizeText(playerName),
      club: team.label,
      league: "Hellas Liga",
      country: TARGET_COUNTRY,
      position: cleanText(item.position?.shortLabel || ""),
      age: getAge(item.birthdate),
      overall: Number(item.overallRating || 0),
      market_value_eur: estimateMarketValue(item, team.label),
      transfermarkt_url: "",
      avatar_url: item.avatarUrl || "",
      shield_url: item.shieldUrl || team.imageUrl || "",
      source: "ea_fc26_greece_fallback",
      last_synced_at: new Date().toISOString(),
    };
  });
}

async function main() {
  const rootData = await fetchNextData(EA_RATINGS_URL);
  const teams = getGreekTeams(rootData);
  const players = [];

  for (const team of teams) {
    const teamPlayers = await fetchTeamPlayers(team);
    players.push(...teamPlayers);
    console.log(`Synced ${teamPlayers.length} players from ${team.label}`);
  }

  const deduped = Object.values(
    players.reduce((acc, item) => {
      const key = `${item.normalized_name}|${normalizeText(item.club)}`;
      acc[key] = item;
      return acc;
    }, {}),
  ).sort(
    (a, b) =>
      b.overall - a.overall ||
      String(a.club).localeCompare(String(b.club)) ||
      String(a.name).localeCompare(String(b.name)),
  );

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(deduped, null, 2)}\n`);

  console.log(`Saved ${deduped.length} Greece fallback players to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
