window.App = window.App || {};

App.clubs = {
  fallbackColors: {
    "Coventry City": ["#3b82f6", "#ffffff"],
    "Ipswich Town": ["#2563eb", "#ffffff"],
    "Birmingham City": ["#2563eb", "#ffffff"],
    "Middlesbrough": ["#dc2626", "#ffffff"],
    "Southampton": ["#ef4444", "#ffffff"],
    "Bristol City": ["#dc2626", "#ffffff"],
    "Hull City": ["#f59e0b", "#111827"],
    "Leicester City": ["#2563eb", "#ffffff"],
    "Millwall": ["#2563eb", "#ffffff"],
    "Sheffield United": ["#dc2626", "#ffffff"],
    "Swansea City": ["#64748b", "#ffffff"],
    "Wrexham": ["#dc2626", "#ffffff"],
    "Derby County": ["#94a3b8", "#111827"],
    "Norwich City": ["#22c55e", "#facc15"],
    "Preston North End": ["#94a3b8", "#111827"],
    "Queens Park Rangers": ["#3b82f6", "#ffffff"],
    "Stoke City": ["#ef4444", "#ffffff"],
    "Watford": ["#eab308", "#111827"],
    "West Bromwich Albion": ["#60a5fa", "#ffffff"],
    "Blackburn Rovers": ["#60a5fa", "#ffffff"],
    "Charlton Athletic": ["#ef4444", "#ffffff"],
    "Oxford United": ["#eab308", "#2563eb"],
    "Portsmouth": ["#2563eb", "#ffffff"],
    "Sheffield Wednesday": ["#3b82f6", "#ffffff"],
    "Manchester City": ["#6cabdd", "#ffffff"],
    "Manchester United": ["#da291c", "#fbe122"],
    "Liverpool": ["#c8102e", "#ffffff"],
    "Arsenal": ["#ef0107", "#ffffff"],
    "Chelsea": ["#034694", "#ffffff"],
    "Tottenham Hotspur": ["#132257", "#ffffff"],
    "Newcastle United": ["#111827", "#ffffff"],
    "Aston Villa": ["#670e36", "#95bfe5"]
  },

  getClubByTeamName(teamName) {
    const clubs = App.state.apiClubs || [];
    const found = clubs.find(club => App.utils.sameTeamName(club.Time, teamName));

    if (found) {
      return found;
    }

    const team = App.utils.getTeamByName(teamName);
    const colors = App.clubs.fallbackColors[team?.team || teamName] || ["#64748b", "#ffffff"];

    return {
      Time: team?.team || String(teamName || "").trim(),
      Dono: team?.owner || "CPU",
      LogoUrl: "",
      CorPrimaria: colors[0],
      CorSecundaria: colors[1],
      Status: "Fallback"
    };
  },

  isPlaceholder(teamName) {
    return App.utils.normalizeText(teamName).startsWith("vencedor") || App.utils.normalizeText(teamName).includes("aguardando");
  },

  getInitials(teamName) {
    if (App.clubs.isPlaceholder(teamName)) return "—";

    const map = {
      "Coventry City": "CC",
      "Ipswich Town": "IPS",
      "Birmingham City": "BIR",
      "Middlesbrough": "MID",
      "Southampton": "SOU",
      "Bristol City": "BRC",
      "Hull City": "HUL",
      "Leicester City": "LEI",
      "Millwall": "MIL",
      "Sheffield United": "SHU",
      "Swansea City": "SWA",
      "Wrexham": "WRE",
      "Derby County": "DER",
      "Norwich City": "NOR",
      "Preston North End": "PNE",
      "Queens Park Rangers": "QPR",
      "Stoke City": "STK",
      "Watford": "WAT",
      "West Bromwich Albion": "WBA",
      "Blackburn Rovers": "BLB",
      "Charlton Athletic": "CHA",
      "Oxford United": "OXF",
      "Portsmouth": "POR",
      "Sheffield Wednesday": "SHW",
      "Manchester City": "MCI",
      "Manchester United": "MUN",
      "Liverpool": "LIV",
      "Arsenal": "ARS",
      "Chelsea": "CHE",
      "Tottenham Hotspur": "TOT",
      "Newcastle United": "NEW",
      "Aston Villa": "AVL"
    };

    const resolved = App.utils.resolveTeamName(teamName);
    return map[resolved] || String(teamName || "")
      .split(" ")
      .filter(Boolean)
      .map(part => part[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
  },

  getTeamBadgeHtml(teamName, extraClass = "") {
    const club = App.clubs.getClubByTeamName(teamName);
    const primary = club.CorPrimaria || "#64748b";
    const secondary = club.CorSecundaria || "#ffffff";
    const logo = String(club.LogoUrl || "").trim();

    if (logo && !App.clubs.isPlaceholder(teamName) && !App.clubs.isDuplicateLogoUrl(teamName, logo)) {
      return `
        <span class="club-badge has-logo ${extraClass}" style="--club-primary:${primary}; --club-secondary:${secondary}">
          <img src="${App.utils.escapeHtml(logo)}" alt="${App.utils.escapeHtml(teamName)}" loading="lazy" referrerpolicy="no-referrer" />
        </span>
      `;
    }

    return `
      <span class="club-badge fallback ${extraClass}" style="--club-primary:${primary}; --club-secondary:${secondary}">
        <span>${App.clubs.getInitials(teamName)}</span>
      </span>
    `;
  },

  isDuplicateLogoUrl(teamName, logoUrl) {
    const normalizedLogo = String(logoUrl || "").trim().toLowerCase();
    if (!normalizedLogo) return false;

    const teamsWithSameLogo = (App.state.apiClubs || [])
      .filter(club => String(club.LogoUrl || "").trim().toLowerCase() === normalizedLogo)
      .map(club => App.utils.normalizeTeamName(club.Time));

    const uniqueTeams = [...new Set(teamsWithSameLogo)];

    return uniqueTeams.length > 1;
  },

  getTeamIdentityHtml(teamName, extraClass = "") {
    return `
      <span class="team-identity ${extraClass}">
        ${App.clubs.getTeamBadgeHtml(teamName)}
        <span class="team-identity-name">${App.utils.escapeHtml(teamName)}</span>
      </span>
    `;
  },

  getMatchupHtml(home, away, extraClass = "") {
    return `
      <span class="matchup ${extraClass}">
        <span class="matchup-side home">
          <span class="matchup-name">${App.utils.escapeHtml(home)}</span>
          ${App.clubs.getTeamBadgeHtml(home, "small")}
        </span>
        <strong class="matchup-x">x</strong>
        <span class="matchup-side away">
          ${App.clubs.getTeamBadgeHtml(away, "small")}
          <span class="matchup-name">${App.utils.escapeHtml(away)}</span>
        </span>
      </span>
    `;
  }
};
