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
    "Aston Villa": ["#670e36", "#95bfe5"],
    "Bournemouth": ["#da291c", "#111827"],
    "Brentford": ["#e30613", "#ffffff"],
    "Brighton": ["#0057b8", "#ffffff"],
    "Burnley": ["#6c1d45", "#99d6ea"],
    "Crystal Palace": ["#1b458f", "#c4122e"],
    "Everton": ["#003399", "#ffffff"],
    "Fulham": ["#ffffff", "#111827"],
    "Leeds United": ["#ffcd00", "#1d428a"],
    "Nottingham Forest": ["#dd0000", "#ffffff"],
    "Sunderland": ["#eb172b", "#ffffff"],
    "West Ham United": ["#7a263a", "#1bb1e7"],
    "Wolverhampton": ["#fdb913", "#231f20"],
    "Bolton Wanderers": ["#ffffff", "#001489"],
    "Reading": ["#0055a4", "#ffffff"],
    "Wigan Athletic": ["#005cab", "#ffffff"],
    "Barnsley": ["#dd0000", "#ffffff"],
    "Stockport County": ["#005baa", "#ffffff"],
    "Bradford City": ["#fbbf24", "#7f1d1d"],
    "Lincoln City": ["#d71920", "#ffffff"],
    "Peterborough United": ["#0057b8", "#ffffff"]
  },

  fallbackLogoUrls: {
    "Arsenal": "https://en.wikipedia.org/wiki/Special:FilePath/Arsenal_FC.svg?width=160",
    "Aston Villa": "https://en.wikipedia.org/wiki/Special:FilePath/Aston_Villa_FC_new_crest.svg?width=160",
    "Bournemouth": "https://en.wikipedia.org/wiki/Special:FilePath/AFC_Bournemouth_(2013).svg?width=160",
    "Brentford": "https://en.wikipedia.org/wiki/Special:FilePath/Brentford_FC_crest.svg?width=160",
    "Brighton": "https://en.wikipedia.org/wiki/Special:FilePath/Brighton_%26_Hove_Albion_logo.svg?width=160",
    "Burnley": "https://en.wikipedia.org/wiki/Special:FilePath/Burnley_FC_Logo.svg?width=160",
    "Chelsea": "https://en.wikipedia.org/wiki/Special:FilePath/Chelsea_FC.svg?width=160",
    "Crystal Palace": "https://en.wikipedia.org/wiki/Special:FilePath/Crystal_Palace_FC_logo.svg?width=160",
    "Everton": "https://en.wikipedia.org/wiki/Special:FilePath/Everton_FC_logo.svg?width=160",
    "Fulham": "https://en.wikipedia.org/wiki/Special:FilePath/Fulham_FC_(shield).svg?width=160",
    "Leeds United": "https://en.wikipedia.org/wiki/Special:FilePath/Leeds_United_F.C._logo.svg?width=160",
    "Liverpool": "https://en.wikipedia.org/wiki/Special:FilePath/Liverpool_FC.svg?width=160",
    "Manchester City": "https://en.wikipedia.org/wiki/Special:FilePath/Manchester_City_FC_badge.svg?width=160",
    "Manchester United": "https://en.wikipedia.org/wiki/Special:FilePath/Manchester_United_FC_crest.svg?width=160",
    "Newcastle United": "https://en.wikipedia.org/wiki/Special:FilePath/Newcastle_United_Logo.svg?width=160",
    "Nottingham Forest": "https://en.wikipedia.org/wiki/Special:FilePath/Nottingham_Forest_F.C._logo.svg?width=160",
    "Sunderland": "https://en.wikipedia.org/wiki/Special:FilePath/Sunderland_AFC.svg?width=160",
    "Tottenham Hotspur": "https://en.wikipedia.org/wiki/Special:FilePath/Tottenham_Hotspur.svg?width=160",
    "West Ham United": "https://en.wikipedia.org/wiki/Special:FilePath/West_Ham_United_FC_logo.svg?width=160",
    "Wolverhampton": "https://en.wikipedia.org/wiki/Special:FilePath/Wolverhampton_Wanderers.svg?width=160",
    "Bolton Wanderers": "https://en.wikipedia.org/wiki/Special:FilePath/Bolton_Wanderers_FC_logo.svg?width=160",
    "Reading": "https://en.wikipedia.org/wiki/Special:FilePath/Reading_FC.svg?width=160",
    "Wigan Athletic": "https://en.wikipedia.org/wiki/Special:FilePath/Wigan_Athletic.svg?width=160",
    "Barnsley": "https://en.wikipedia.org/wiki/Special:FilePath/Barnsley_FC.svg?width=160",
    "Stockport County": "https://en.wikipedia.org/wiki/Special:FilePath/Stockport_County_FC.svg?width=160",
    "Bradford City": "https://en.wikipedia.org/wiki/Special:FilePath/Bradford_City_AFC.svg?width=160",
    "Lincoln City": "https://en.wikipedia.org/wiki/Special:FilePath/Lincoln_City_FC_logo.svg?width=160",
    "Peterborough United": "https://en.wikipedia.org/wiki/Special:FilePath/Peterborough_United.svg?width=160"
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
      LogoUrl: App.clubs.fallbackLogoUrls[team?.team || teamName] || "",
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
      "Aston Villa": "AVL",
      "Bournemouth": "BOU",
      "Brentford": "BRE",
      "Brighton": "BHA",
      "Burnley": "BUR",
      "Crystal Palace": "CRY",
      "Everton": "EVE",
      "Fulham": "FUL",
      "Leeds United": "LEE",
      "Nottingham Forest": "NFO",
      "Sunderland": "SUN",
      "West Ham United": "WHU",
      "Wolverhampton": "WOL",
      "Bolton Wanderers": "BOL",
      "Reading": "REA",
      "Wigan Athletic": "WIG",
      "Barnsley": "BAR",
      "Stockport County": "STO",
      "Bradford City": "BRA",
      "Lincoln City": "LIN",
      "Peterborough United": "PET"
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
          <span class="logo-fallback">${App.clubs.getInitials(teamName)}</span>
          <img src="${App.utils.escapeHtml(logo)}" alt="${App.utils.escapeHtml(teamName)}" loading="lazy" referrerpolicy="no-referrer" onload="this.previousElementSibling.style.display='none'" onerror="this.remove()" />
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
