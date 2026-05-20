window.App = window.App || {};

App.players = {
  getPlayerTeams() {
    return App.data.teams.filter(team => team.status === "Nosso");
  },

  getApprovedTransfersForBuyer(buyer) {
    return App.transfers.getTransfersWithStats().filter(item => item.buyer === buyer && !item.isBlockedDuplicate);
  },

  getSpentByBuyer(buyer) {
    return App.players.getApprovedTransfersForBuyer(buyer).reduce((sum, item) => sum + item.totalCost, 0);
  },

  getMatchesForTeam(teamName) {
    return App.calendar.getCalendarEvents().filter(event => App.utils.sameTeamName(event.home, teamName) || App.utils.sameTeamName(event.away, teamName));
  },

  getPlayedResultsForTeam(teamName) {
    return App.standings.getApprovedApiResults()
      .filter(row => App.utils.normalizeText(row.Competicao) === "championship")
      .filter(row => App.utils.sameTeamName(row.Mandante, teamName) || App.utils.sameTeamName(row.Visitante, teamName));
  },

  getNextMatchForTeam(teamName) {
    const playedKeys = new Set(App.standings.getApprovedApiResults().map(row =>
      `${App.utils.normalizeText(row.Competicao)}|${App.utils.normalizeText(row.RodadaFase)}|${App.utils.normalizeTeamName(row.Mandante)}|${App.utils.normalizeTeamName(row.Visitante)}`
    ));

    return App.players.getMatchesForTeam(teamName).find(event => {
      const key = `${App.utils.normalizeText(event.competition)}|${App.utils.normalizeText(event.phase)}|${App.utils.normalizeTeamName(event.home)}|${App.utils.normalizeTeamName(event.away)}`;
      return !playedKeys.has(key);
    });
  },

  parsePlayerStatText(text) {
    const rows = [];
    const source = String(text || "").trim();
    if (!source) return rows;

    source.split("|").forEach(teamBlock => {
      const parts = teamBlock.split(":");
      const teamPart = parts[0];
      const playersPart = parts.slice(1).join(":");
      if (!playersPart) return;
      const teamName = App.utils.resolveTeamName(teamPart);

      playersPart.split(",").forEach(entry => {
        const clean = entry.trim();
        if (!clean) return;
        const match = clean.match(/(.+?)\s+(\d+)$/);
        const count = match ? Number(match[2]) : 1;
        rows.push({ team: teamName, count: Number.isNaN(count) ? 1 : count });
      });
    });

    return rows;
  },

  getTeamLeaderboards() {
    const goalMap = {};
    const assistMap = {};

    function addStat(map, teamName, count) {
      const resolvedTeam = App.utils.resolveTeamName(teamName);
      const key = App.utils.normalizeTeamName(resolvedTeam);
      map[key] = map[key] || { name: resolvedTeam, detail: "Total acumulado", count: 0 };
      map[key].count += Number(count || 0);
    }

    App.standings.getApprovedApiResults().forEach(row => {
      addStat(goalMap, row.Mandante, Number(row.GolsMandante));
      addStat(goalMap, row.Visitante, Number(row.GolsVisitante));
      App.players.parsePlayerStatText(row.AssistenciasDetalhes).forEach(item => addStat(assistMap, item.team, item.count));
    });

    const sortStats = data => Object.values(data).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10);
    return { goals: sortStats(goalMap), assists: sortStats(assistMap) };
  },

  renderLeaderboard(container, data, label) {
    if (!container) return;
    if (!data.length) {
      container.innerHTML = `<p class="calendar-muted">Sem dados de ${label} ainda.</p>`;
      return;
    }

    container.innerHTML = data.map((item, index) => `
      <div class="leaderboard-row">
        <div><strong>${index + 1}. ${item.name}</strong><br><span>${item.detail}</span></div>
        <strong>${item.count}</strong>
      </div>
    `).join("");
  },

  render() {
    const summary = document.getElementById("playersSummary");
    const grid = document.getElementById("playersGrid");
    if (!summary || !grid) return;

    const search = App.utils.normalizeText(document.getElementById("playersSearchInput")?.value);
    const filter = document.getElementById("playersFilter")?.value || "all";
    const standings = App.standings.getStandings();
    const budgetInfo = App.transfers.getBudgetInfoByBuyer();

    const cards = App.players.getPlayerTeams()
      .filter(team => filter === "all" || team.owner === filter)
      .filter(team => {
        if (!search) return true;
        const next = App.players.getNextMatchForTeam(team.team);
        const transfersText = App.players.getApprovedTransfersForBuyer(team.owner).map(item => item.player).join(" ");
        return App.utils.normalizeText(`${team.owner} ${team.team} ${next?.home || ""} ${next?.away || ""} ${transfersText}`).includes(search);
      });

    summary.innerHTML = `
      <article class="summary-card"><span>Jogadores</span><strong>${App.players.getPlayerTeams().length}</strong></article>
      <article class="summary-card"><span>Resultados aprovados</span><strong>${App.standings.getApprovedApiResults().length}</strong></article>
      <article class="summary-card"><span>Transferências</span><strong>${App.transfers.getTransfersWithStats().filter(item => !item.isBlockedDuplicate).length}</strong></article>
      <article class="summary-card"><span>Limite base</span><strong>3 por dia</strong></article>
    `;

    grid.innerHTML = cards.map(team => {
      const standing = standings.find(item => App.utils.sameTeamName(item.team, team.team));
      const budget = budgetInfo[team.owner] || { totalBudget: App.config.transferBudget, homeMatches: 0, wins: 0, homeBonus: 0, winBonusValue: 0, eventTotal: 0, eventCount: 0, transferLimit: App.config.baseDailyTransferLimit, activeInjuries: 0 };
      const spent = App.players.getSpentByBuyer(team.owner);
      const remaining = budget.totalBudget - spent;
      const transfersList = App.players.getApprovedTransfersForBuyer(team.owner).slice(0, 5);
      const next = App.players.getNextMatchForTeam(team.team);
      const lastResults = App.players.getPlayedResultsForTeam(team.team).slice(-3).reverse();
      const todayCount = App.transfers.getTodayTransferCountByBuyer(team.owner);
      const color = App.data.ownerColors[team.owner];

      return `
        <article class="player-card" style="--player-color:${color}">
          <div class="player-card-header">
            <div><h2>${team.owner}</h2><div class="team-name">${team.team}</div></div>
            <span class="owner" style="background:${color}">${standing?.position || "-"}º</span>
          </div>
          <div class="player-stats-grid">
            <div class="player-stat"><span>Campanha</span><strong>${standing?.wins || 0}/${standing?.draws || 0}/${standing?.losses || 0}</strong></div>
            <div class="player-stat"><span>Pontos</span><strong>${standing?.points || 0}</strong></div>
            <div class="player-stat"><span>Saldo gols</span><strong>${App.utils.formatGoalDifference(standing?.goalDifference || 0)}</strong></div>
            <div class="player-stat"><span>Orçamento base</span><strong>${App.utils.formatCurrency(App.config.transferBudget)}</strong></div>
            <div class="player-stat"><span>+ Bônus mando</span><strong>${App.utils.formatCurrency(budget.homeBonus || 0)}</strong></div>
            <div class="player-stat"><span>+ Bônus vitória</span><strong>${App.utils.formatCurrency(budget.winBonusValue || 0)}</strong></div>
            <div class="player-stat"><span>+ Eventos</span><strong>${App.utils.formatCurrency(budget.eventTotal || 0)}</strong></div>
            <div class="player-stat"><span>Orçamento atual</span><strong>${App.utils.formatCurrency(budget.totalBudget)}</strong></div>
            <div class="player-stat"><span>- Gasto</span><strong>${App.utils.formatCurrency(spent)}</strong></div>
            <div class="player-stat"><span>Saldo livre</span><strong>${App.utils.formatCurrency(remaining)}</strong></div>
            <div class="player-stat"><span>Mandos</span><strong>${budget.homeMatches}</strong></div>
            <div class="player-stat"><span>Vitórias</span><strong>${budget.wins}</strong></div>
            <div class="player-stat"><span>Eventos</span><strong>${budget.eventCount || 0}</strong></div>
            <div class="player-stat"><span>Lesões ativas</span><strong>${budget.activeInjuries || 0}</strong></div>
            <div class="player-stat"><span>Limite transf.</span><strong>${budget.transferLimit || App.config.baseDailyTransferLimit}/dia</strong></div>
            <div class="player-stat"><span>Transfers hoje</span><strong>${todayCount}/${budget.transferLimit || App.config.baseDailyTransferLimit}</strong></div>
          </div>
          <p class="calendar-muted"><strong>Próximo jogo:</strong> ${next ? `${App.utils.formatDate(next.date)} - ${next.competition} - ${next.home} x ${next.away}` : "A definir"}</p>
          ${App.events.renderActiveInjuriesForBuyer(team.owner)}
          <p class="legend-title">Contratações</p>
          <ul class="player-list">${transfersList.length ? transfersList.map(item => `<li>${item.player} - ${App.utils.formatCurrency(item.totalCost)}</li>`).join("") : "<li>Nenhuma contratação aprovada.</li>"}</ul>
          <p class="legend-title" style="margin-top:12px;">Últimos jogos</p>
          <ul class="player-list">${lastResults.length ? lastResults.map(row => `<li>${row.RodadaFase}: ${row.Mandante} ${row.GolsMandante} x ${row.GolsVisitante} ${row.Visitante}</li>`).join("") : "<li>Nenhum jogo aprovado ainda.</li>"}</ul>
        </article>
      `;
    }).join("");

    const leaderboards = App.players.getTeamLeaderboards();
    App.players.renderLeaderboard(document.getElementById("topScorers"), leaderboards.goals, "gols por time");
    App.players.renderLeaderboard(document.getElementById("topAssists"), leaderboards.assists, "assistências por time");
  }
};
