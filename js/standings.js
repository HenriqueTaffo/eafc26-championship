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

  getTeamEmblemHtml(teamName, extraClass = "") {
    return App.clubs.getTeamBadgeHtml(teamName, extraClass);
  },

  getTeamIdentityHtml(teamName) {
    return App.clubs.getTeamIdentityHtml(teamName);
  },

  getHomeNextEvents() {
    if (!App.calendar?.getCalendarEvents) return [];

    const events = App.calendar.getCalendarEvents()
      .filter(event => App.calendar.getStatusClass(event) === "pending")
      .sort((a, b) => a.date - b.date);

    const humanEvents = events.filter(event => App.calendar.involvesOurTeam(event));
    const source = humanEvents.length >= 3 ? humanEvents : events;

    return source.slice(0, 3);
  },

  formatHomeDate(date) {
    if (!date) return "A definir";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit"
    }).format(date instanceof Date ? date : new Date(date));
  },

  getHomeKickoff(index) {
    return ["16:00", "15:00", "17:30"][index % 3];
  },

  bindHomeActions() {
    document.querySelectorAll("[data-view-target]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const target = button.dataset.viewTarget;
        const tab = document.querySelector(`.tab-button[data-view="${target}"]`);
        if (tab) {
          tab.click();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    document.querySelectorAll("[data-scroll-target]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.scrollTarget);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  },

  renderSummaryCards(standings, summary) {
    const leader = standings[0];
    const bestCoach = standings.filter(team => team.status === "Nosso")[0];
    const played = App.standings.getApprovedApiResults()
      .filter(row => App.utils.normalizeText(row.Competicao) === "championship").length;

    summary.innerHTML = `
      <article class="summary-card home-metric leader-metric">
        <div class="metric-icon leader-club-icon">
          ${leader ? App.standings.getTeamEmblemHtml(leader.team, "metric-club-badge") : "♜"}
        </div>
        <div>
          <span>Líder</span>
          <strong>${leader?.team || "-"}</strong>
          <small>${leader ? `${leader.points} pts` : ""}</small>
        </div>
      </article>
      <article class="summary-card home-metric">
        <div class="metric-icon person">●</div>
        <div>
          <span>Melhor técnico</span>
          <strong>${bestCoach ? `${bestCoach.owner} (${bestCoach.position}º)` : "-"}</strong>
          <small>${bestCoach ? `${bestCoach.points} pts` : ""}</small>
        </div>
      </article>
      <article class="summary-card home-metric">
        <div class="metric-icon games">✓</div>
        <div>
          <span>Jogos aprovados</span>
          <strong>${played}</strong>
          <small>Esta temporada</small>
        </div>
      </article>
      <article class="summary-card home-metric">
        <div class="metric-icon teams">♟</div>
        <div>
          <span>Times</span>
          <strong>${standings.length}</strong>
          <small>Na competição</small>
        </div>
      </article>
    `;
  },

  renderHomeStandings(standings) {
    const homeTable = document.getElementById("homeStandingsTable");
    if (!homeTable) return;

    homeTable.innerHTML = standings.slice(0, 5).map(row => `
      <tr class="${row.position === 1 ? "home-leader-row" : ""}">
        <td class="numeric">${row.position}</td>
        <td>${App.standings.getTeamIdentityHtml(row.team)}</td>
        <td class="numeric"><strong>${row.points}</strong></td>
        <td class="numeric">${row.played}</td>
        <td class="numeric">${row.wins}</td>
        <td class="numeric">${row.draws}</td>
        <td class="numeric">${row.losses}</td>
        <td class="numeric">${App.utils.formatGoalDifference(row.goalDifference)}</td>
      </tr>
    `).join("");
  },

  renderHomeNextGames() {
    const target = document.getElementById("homeNextGames");
    if (!target) return;

    const events = App.standings.getHomeNextEvents();

    if (!events.length) {
      target.innerHTML = `<div class="next-game-empty">Nenhum jogo pendente encontrado.</div>`;
      return;
    }

    target.innerHTML = events.map((event, index) => `
      <article class="next-game-card">
        <div class="next-game-date">
          <strong>${App.standings.formatHomeDate(event.date)}</strong>
          <span>${App.standings.getHomeKickoff(index)}</span>
        </div>
        <div class="next-game-teams">
          <span class="next-team">
            <span>${event.home}</span>
            ${App.standings.getTeamEmblemHtml(event.home, "small")}
          </span>
          <strong class="match-x">x</strong>
          <span class="next-team away">
            ${App.standings.getTeamEmblemHtml(event.away, "small")}
            <span>${event.away}</span>
          </span>
        </div>
        <span class="round-pill">${event.phase}</span>
      </article>
    `).join("");
  },

  render() {
    const standings = App.standings.getStandings();
    const table = document.getElementById("standingsTable");
    const mobile = document.getElementById("standingsMobile");
    const summary = document.getElementById("standingsSummary");
    if (!table || !mobile || !summary) return;

    App.standings.renderSummaryCards(standings, summary);
    App.standings.renderHomeStandings(standings);
    App.standings.renderHomeNextGames();
    App.standings.bindHomeActions();

    table.innerHTML = standings.map(row => `
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
    `).join("");

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
