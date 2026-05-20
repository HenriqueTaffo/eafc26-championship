window.App = window.App || {};

App.standings = {
  getApprovedApiResults() {
    return App.state.apiResults.filter(row => App.utils.normalizeText(row.Status) === "aprovado");
  },

  getResultStatsForTeam(teamName) {
    const stats = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };

    App.standings.getApprovedApiResults()
      .filter(row => App.utils.normalizeText(row.Competicao) === "championship")
      .forEach(row => {
        const isHome = App.utils.sameTeamName(row.Mandante, teamName);
        const isAway = App.utils.sameTeamName(row.Visitante, teamName);
        if (!isHome && !isAway) return;

        const homeScore = Number(row.GolsMandante);
        const awayScore = Number(row.GolsVisitante);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

        const goalsFor = isHome ? homeScore : awayScore;
        const goalsAgainst = isHome ? awayScore : homeScore;

        stats.goalsFor += goalsFor;
        stats.goalsAgainst += goalsAgainst;
        if (goalsFor > goalsAgainst) stats.wins += 1;
        else if (goalsFor === goalsAgainst) stats.draws += 1;
        else stats.losses += 1;
      });

    return stats;
  },

  getStandings() {
    const rows = App.data.teams.map((team, originalIndex) => {
      const stats = App.standings.getResultStatsForTeam(team.team);
      const played = stats.wins + stats.draws + stats.losses;
      const goalDifference = stats.goalsFor - stats.goalsAgainst;
      const points = stats.wins * 3 + stats.draws;

      return {
        ...team,
        originalIndex,
        ...stats,
        played,
        goalDifference,
        points
      };
    }).sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team)
    );

    return rows.map((row, index) => ({ ...row, position: index + 1 }));
  },

  getPositionClass(position) {
    if (position <= 2) return "promotion-row";
    if (position <= 6) return "playoff-row";
    if (position >= 22) return "relegation-row";
    return "";
  },

  getPositionBadgeClass(position) {
    if (position <= 2) return "promotion";
    if (position <= 6) return "playoff";
    if (position >= 22) return "relegation";
    return "neutral";
  },

  getTeamInitials(teamName) {
    const map = {
      "Coventry City": "CC",
      "Ipswich Town": "IT",
      "Birmingham City": "BC",
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
      "Sheffield Wednesday": "SWD"
    };
    return map[teamName] || teamName.split(" ").map(part => part[0]).join("").slice(0, 3).toUpperCase();
  },

  getTeamAccent(teamName) {
    const map = {
      "Coventry City": "#3b82f6",
      "Ipswich Town": "#2563eb",
      "Birmingham City": "#2563eb",
      "Middlesbrough": "#dc2626",
      "Southampton": "#ef4444",
      "Bristol City": "#dc2626",
      "Hull City": "#f59e0b",
      "Leicester City": "#2563eb",
      "Millwall": "#2563eb",
      "Sheffield United": "#dc2626",
      "Swansea City": "#64748b",
      "Wrexham": "#dc2626",
      "Derby County": "#94a3b8",
      "Norwich City": "#22c55e",
      "Preston North End": "#94a3b8",
      "Queens Park Rangers": "#3b82f6",
      "Stoke City": "#ef4444",
      "Watford": "#eab308",
      "West Bromwich Albion": "#60a5fa",
      "Blackburn Rovers": "#60a5fa",
      "Charlton Athletic": "#ef4444",
      "Oxford United": "#eab308",
      "Portsmouth": "#2563eb",
      "Sheffield Wednesday": "#3b82f6"
    };
    return map[teamName] || "#64748b";
  },

  getTeamIdentityHtml(teamName) {
    const initials = App.standings.getTeamInitials(teamName);
    const accent = App.standings.getTeamAccent(teamName);
    return `
      <span class="team-cell">
        <span class="team-emblem" style="--team-accent:${accent}">${initials}</span>
        <span class="team-name">${teamName}</span>
      </span>
    `;
  },

  render() {
    const standings = App.standings.getStandings();
    const table = document.getElementById("standingsTable");
    const mobile = document.getElementById("standingsMobile");
    const summary = document.getElementById("standingsSummary");
    if (!table || !mobile || !summary) return;

    const leader = standings[0];
    const bestHuman = standings.filter(team => team.status === "Nosso")[0];
    const played = App.standings.getApprovedApiResults().filter(row => App.utils.normalizeText(row.Competicao) === "championship").length;

    summary.innerHTML = `
      <article class="summary-card"><span>Líder</span><strong>${leader?.team || "-"}</strong></article>
      <article class="summary-card"><span>Melhor humano</span><strong>${bestHuman ? `${bestHuman.owner} (${bestHuman.position}º)` : "-"}</strong></article>
      <article class="summary-card"><span>Jogos aprovados</span><strong>${played}</strong></article>
      <article class="summary-card"><span>Times</span><strong>${standings.length}</strong></article>
    `;

    table.innerHTML = standings.map(row => {
      return `
        <tr class="${App.standings.getPositionClass(row.position)} ${row.status === "Nosso" ? "standings-human-row" : ""}">
          <td class="numeric">${row.position}</td>
          <td class="calendar-match">${App.standings.getTeamIdentityHtml(row.team)}</td>
          <td><span class="owner-name">${row.owner}</span></td>
          <td class="numeric">${row.played}</td>
          <td class="numeric">${row.wins}</td>
          <td class="numeric">${row.draws}</td>
          <td class="numeric">${row.losses}</td>
          <td class="numeric">${row.goalsFor}</td>
          <td class="numeric">${row.goalsAgainst}</td>
          <td class="numeric">${App.utils.formatGoalDifference(row.goalDifference)}</td>
          <td class="numeric"><strong>${row.points}</strong></td>
        </tr>
      `;
    }).join("");

    mobile.innerHTML = standings.map(row => {
      const classificationClass = App.standings.getPositionClass(row.position);
      const badgeClass = App.standings.getPositionBadgeClass(row.position);
      return `
        <article class="calendar-card standings-mobile-card ${classificationClass} ${row.status === "Nosso" ? "standings-human-card" : ""}">
          <div class="calendar-card-header">
            <span class="position-badge ${badgeClass}">${row.position}º</span>
            <span class="calendar-muted">${row.points} pts</span>
          </div>
          <h3 class="standings-team-title">${App.standings.getTeamIdentityHtml(row.team)}</h3>
          <div class="mobile-owner-line">
            <span class="calendar-muted owner-plain">${row.owner}</span>
          </div>
          <p class="calendar-muted">J ${row.played} · V ${row.wins} · E ${row.draws} · D ${row.losses} · SG ${App.utils.formatGoalDifference(row.goalDifference)}</p>
        </article>
      `;
    }).join("");
  }
};
