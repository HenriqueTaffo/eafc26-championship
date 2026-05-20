window.App = window.App || {};

App.players = {
  getPlayerTeams() {
    return App.data.teams.filter(team => team.status === "Nosso");
  },

  getHumanTeamNames() {
    return App.players.getPlayerTeams().map(team => team.team);
  },

  getApprovedTransfersForBuyer(buyer) {
    return App.transfers.getTransfersWithStats().filter(item => item.buyer === buyer && !item.isBlockedDuplicate);
  },

  getSpentByBuyer(buyer) {
    return App.players.getApprovedTransfersForBuyer(buyer).reduce((sum, item) => sum + item.totalCost, 0);
  },

  getBudgetBreakdown(budget, spent) {
    const base = Number(budget.baseBudget ?? App.config.transferBudget);
    const homeBonus = Number(budget.homeBonus || 0);
    const winBonus = Number(budget.winBonusValue || budget.winBonus || 0);
    const eventBonus = Number(budget.eventTotal || budget.eventBonus || 0);
    const totalAccumulated = base + homeBonus + winBonus + eventBonus;
    const spentValue = Number(spent || 0);
    const available = totalAccumulated - spentValue;

    return {
      base,
      homeBonus,
      winBonus,
      eventBonus,
      totalAccumulated,
      spent: spentValue,
      available
    };
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

  getGoalsByHumanTeams() {
    const humanTeams = App.players.getHumanTeamNames();
    const goalsMap = {};

    humanTeams.forEach(team => {
      goalsMap[App.utils.normalizeTeamName(team)] = {
        name: team,
        detail: App.utils.getTeamByName(team)?.owner || "Jogador humano",
        count: 0
      };
    });

    App.standings.getApprovedApiResults().forEach(row => {
      const homeKey = App.utils.normalizeTeamName(row.Mandante);
      const awayKey = App.utils.normalizeTeamName(row.Visitante);

      if (goalsMap[homeKey]) goalsMap[homeKey].count += Number(row.GolsMandante || 0);
      if (goalsMap[awayKey]) goalsMap[awayKey].count += Number(row.GolsVisitante || 0);
    });

    return Object.values(goalsMap)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },

  getTopExpensiveTransfers(limit = 5) {
    return App.transfers.getTransfersWithStats()
      .filter(item => !item.isBlockedDuplicate)
      .sort((a, b) => b.totalCost - a.totalCost || a.player.localeCompare(b.player))
      .slice(0, limit)
      .map(item => ({
        name: item.player,
        detail: `${item.buyer} • ${item.fromClub || "Clube não informado"}`,
        count: App.utils.formatCurrency(item.totalCost)
      }));
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

  renderBudgetPanel(breakdown) {
    const availableClass = breakdown.available < 0 ? "negative" : breakdown.available < 10000000 ? "warning" : "positive";

    return `
      <section class="budget-panel ${availableClass}">
        <div class="budget-hero">
          <span>Disponível para contratar</span>
          <strong>${App.utils.formatCurrency(breakdown.available)}</strong>
          <small>Total acumulado ${App.utils.formatCurrency(breakdown.totalAccumulated)} • Gasto ${App.utils.formatCurrency(breakdown.spent)}</small>
        </div>
        <div class="budget-breakdown-grid">
          <div class="budget-row"><span>Orçamento base</span><strong>${App.utils.formatCurrency(breakdown.base)}</strong></div>
          <div class="budget-row income"><span>+ Bônus por mando</span><strong>${App.utils.formatCurrency(breakdown.homeBonus)}</strong></div>
          <div class="budget-row income"><span>+ Bônus por vitória</span><strong>${App.utils.formatCurrency(breakdown.winBonus)}</strong></div>
          <div class="budget-row ${breakdown.eventBonus < 0 ? "expense" : "income"}"><span>+/- Eventos</span><strong>${App.utils.formatCurrency(breakdown.eventBonus)}</strong></div>
          <div class="budget-row total"><span>= Total acumulado</span><strong>${App.utils.formatCurrency(breakdown.totalAccumulated)}</strong></div>
          <div class="budget-row expense"><span>- Gasto em transferências</span><strong>${App.utils.formatCurrency(breakdown.spent)}</strong></div>
          <div class="budget-row final"><span>= Disponível para contratar</span><strong>${App.utils.formatCurrency(breakdown.available)}</strong></div>
        </div>
      </section>
    `;
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
      const budget = budgetInfo[team.owner] || { totalBudget: App.config.transferBudget, baseBudget: App.config.transferBudget, homeMatches: 0, wins: 0, homeBonus: 0, winBonusValue: 0, eventTotal: 0, eventCount: 0, transferLimit: App.config.baseDailyTransferLimit, activeInjuries: 0 };
      const spent = App.players.getSpentByBuyer(team.owner);
      const breakdown = App.players.getBudgetBreakdown(budget, spent);
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

          ${App.players.renderBudgetPanel(breakdown)}

          <div class="player-stats-grid compact">
            <div class="player-stat"><span>Campanha</span><strong>${standing?.wins || 0}/${standing?.draws || 0}/${standing?.losses || 0}</strong></div>
            <div class="player-stat"><span>Pontos</span><strong>${standing?.points || 0}</strong></div>
            <div class="player-stat"><span>Saldo gols</span><strong>${App.utils.formatGoalDifference(standing?.goalDifference || 0)}</strong></div>
            <div class="player-stat"><span>Mandos</span><strong>${budget.homeMatches}</strong></div>
            <div class="player-stat"><span>Vitórias</span><strong>${budget.wins}</strong></div>
            <div class="player-stat"><span>Eventos</span><strong>${budget.eventCount || 0}</strong></div>
            <div class="player-stat"><span>Lesões ativas</span><strong>${budget.activeInjuries || 0}</strong></div>
            <div class="player-stat"><span>Limite atual</span><strong>${budget.transferLimit ?? App.config.baseDailyTransferLimit}/dia</strong></div>
            <div class="player-stat ${todayCount > (budget.transferLimit ?? App.config.baseDailyTransferLimit) ? "warning-stat" : ""}"><span>Usadas hoje</span><strong>${todayCount}</strong></div>
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

    App.players.renderLeaderboard(document.getElementById("topScorers"), App.players.getGoalsByHumanTeams(), "gols por time");
    App.players.renderLeaderboard(document.getElementById("topAssists"), App.players.getTopExpensiveTransfers(5), "transferências caras");
  }
};
