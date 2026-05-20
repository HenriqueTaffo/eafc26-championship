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
      const color = App.data.ownerColors[row.owner] || App.data.ownerColors["Livre / CPU"];
      return `
        <tr class="${App.standings.getPositionClass(row.position)} ${row.status === "Nosso" ? "ours-row" : ""}">
          <td class="numeric">${row.position}</td>
          <td class="calendar-match">${row.team}</td>
          <td><span class="owner" style="background:${color}">${row.owner}</span></td>
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
      const color = App.data.ownerColors[row.owner] || App.data.ownerColors["Livre / CPU"];
      const classificationClass = App.standings.getPositionClass(row.position);
      const badgeClass = App.standings.getPositionBadgeClass(row.position);
      return `
        <article class="calendar-card standings-mobile-card ${classificationClass} ${row.status === "Nosso" ? "ours-row" : ""}">
          <div class="calendar-card-header">
            <span class="position-badge ${badgeClass}">${row.position}º</span>
            <span class="calendar-muted">${row.points} pts</span>
          </div>
          <h3>${row.team}</h3>
          <div class="mobile-owner-line">
            <span class="owner-dot" style="background:${color}"></span>
            <span class="calendar-muted">${row.owner}</span>
          </div>
          <p class="calendar-muted">J ${row.played} · V ${row.wins} · E ${row.draws} · D ${row.losses} · SG ${App.utils.formatGoalDifference(row.goalDifference)}</p>
        </article>
      `;
    }).join("");
  }
};
