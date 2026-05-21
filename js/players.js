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
    const totalAccumulated = Number(budget.totalBudget ?? (base + homeBonus + winBonus + eventBonus));
    const spentValue = Number(budget.spentTotal ?? spent ?? 0);
    const available = Number(budget.remainingBudget ?? (totalAccumulated - spentValue));

    return { base, homeBonus, winBonus, eventBonus, totalAccumulated, spent: spentValue, available };
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
    return App.players.getMatchesForTeam(teamName).find(event => {
      if (!event) return false;

      // Regra central:
      // O painel dos técnicos só pode mostrar jogos realmente pendentes.
      // Jogos de copa já finalizados/classificados não devem voltar para "Próximo compromisso",
      // mesmo quando o texto da fase no banco e no calendário tiver pequenas diferenças.
      return App.calendar.getStatusClass(event) === "pending";
    });
  },

  getGoalsByHumanTeams() {
    const humanTeams = App.players.getHumanTeamNames();
    const goalsMap = {};

    humanTeams.forEach(team => {
      goalsMap[App.utils.normalizeTeamName(team)] = {
        name: team,
        detail: App.utils.getTeamByName(team)?.owner || "Técnico",
        count: 0
      };
    });

    App.standings.getApprovedApiResults().forEach(row => {
      const homeKey = App.utils.normalizeTeamName(row.Mandante);
      const awayKey = App.utils.normalizeTeamName(row.Visitante);
      if (goalsMap[homeKey]) goalsMap[homeKey].count += Number(row.GolsMandante || 0);
      if (goalsMap[awayKey]) goalsMap[awayKey].count += Number(row.GolsVisitante || 0);
    });

    return Object.values(goalsMap).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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

  getCoachRanking() {
    const standings = App.standings.getStandings();
    return App.players.getPlayerTeams()
      .map(team => {
        const standing = standings.find(item => App.utils.sameTeamName(item.team, team.team));
        const budget = App.transfers.getSpendingSummary().find(item => item.buyer === team.owner);
        return { team, standing, budget };
      })
      .sort((a, b) =>
        Number(b.standing?.points || 0) - Number(a.standing?.points || 0) ||
        Number(b.standing?.goalDifference || 0) - Number(a.standing?.goalDifference || 0)
      );
  },

  getResultPerspective(row, teamName) {
    const isHome = App.utils.sameTeamName(row.Mandante, teamName);
    const gf = Number(isHome ? row.GolsMandante : row.GolsVisitante);
    const ga = Number(isHome ? row.GolsVisitante : row.GolsMandante);
    const opponent = isHome ? row.Visitante : row.Mandante;
    const result = gf > ga ? "V" : gf === ga ? "E" : "D";
    return { result, gf, ga, opponent, row };
  },

  getRecentForm(teamName, limit = 5) {
    return App.players.getPlayedResultsForTeam(teamName)
      .slice(-limit)
      .reverse()
      .map(row => App.players.getResultPerspective(row, teamName));
  },

  getCoachEvents(buyer, limit = 5) {
    return (App.state.apiEvents || [])
      .filter(event => App.utils.normalizeText(event.Jogador) === App.utils.normalizeText(buyer))
      .sort((a, b) => App.events.getEventDateTime(b) - App.events.getEventDateTime(a))
      .slice(0, limit);
  },

  getActiveInjuriesForCoach(buyer) {
    return App.events.getActiveEventsForBuyer(buyer)
      .filter(event => String(event.JogadorAfetado || "").trim())
      .filter(event => Number(event.PartidasRestantes || 0) > 0 || App.events.isActiveOrDurationEvent(event));
  },

  renderCoachAlertDeck(alerts) {
    if (!alerts.length) {
      return `
        <div class="coach-empty-state">
          <span>✅</span>
          <strong>Sala tranquila</strong>
          <p>Nenhum alerta urgente neste momento. O técnico pode focar no próximo jogo.</p>
        </div>
      `;
    }

    return `
      <div class="coach-alert-deck">
        ${alerts.map((alert, index) => {
          const icon = index === 0 ? "🚨" : "📌";
          return `
            <div class="coach-alert-card">
              <span>${icon}</span>
              <p>${App.utils.escapeHtml(alert)}</p>
            </div>
          `;
        }).join("")}
      </div>
    `;
  },

  renderCoachTransferDeck(transfers) {
    if (!transfers.length) {
      return `
        <div class="coach-empty-state">
          <span>🧾</span>
          <strong>Mercado silencioso</strong>
          <p>Nenhuma contratação aprovada para este técnico até agora.</p>
        </div>
      `;
    }

    const total = transfers.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
    const topTransfer = transfers.reduce((best, item) => Number(item.totalCost || 0) > Number(best?.totalCost || 0) ? item : best, transfers[0]);

    return `
      <div class="coach-market-header">
        <div>
          <span>Pacote recente</span>
          <strong>${transfers.length} jogador(es)</strong>
        </div>
        <div>
          <span>Maior compra</span>
          <strong>${App.utils.escapeHtml(topTransfer?.player || "-")}</strong>
        </div>
        <div>
          <span>Total exibido</span>
          <strong>${App.utils.formatCurrency(total)}</strong>
        </div>
      </div>

      <div class="coach-transfer-timeline">
        ${transfers.map((item, index) => `
          <div class="coach-transfer-item">
            <span class="transfer-rank">${index + 1}</span>
            <div>
              <strong>${App.utils.escapeHtml(item.player)}</strong>
              <small>${App.utils.escapeHtml(item.fromClub || "Clube não informado")}</small>
            </div>
            <b>${App.utils.formatCurrency(item.totalCost)}</b>
          </div>
        `).join("")}
      </div>
    `;
  },

  renderCoachEventDeck(events) {
    if (!events.length) {
      return `
        <div class="coach-empty-state">
          <span>🎲</span>
          <strong>Nada no radar</strong>
          <p>Nenhum evento recente registrado para este técnico.</p>
        </div>
      `;
    }

    return `
      <div class="coach-event-stack">
        ${events.map(event => {
          const presentation = App.events.getEventPresentation ? App.events.getEventPresentation(event) : {
            title: event.Titulo || "Evento",
            description: event.Descricao || "",
            categoryLabel: event.Tipo || "Evento",
            icon: "🎲"
          };
          const impact = App.events.getEventImpactLabel ? App.events.getEventImpactLabel(event) : "";
          const duration = App.events.getEventDurationLabel ? App.events.getEventDurationLabel(event) : "";
          return `
            <div class="coach-event-item">
              <span class="coach-event-icon">${presentation.icon}</span>
              <div>
                <strong>${App.utils.escapeHtml(presentation.title)}</strong>
                <small>${App.utils.escapeHtml(presentation.categoryLabel)}${duration ? ` · ${App.utils.escapeHtml(duration)}` : ""}</small>
              </div>
              <b>${App.utils.escapeHtml(impact)}</b>
            </div>
          `;
        }).join("")}
      </div>
    `;
  },

  getCoachAlerts(team, standing, budget, next, transfersToday) {
    const alerts = [];
    const activeEvents = App.events.getActiveEventsForBuyer(team.owner);
    const injuries = activeEvents.filter(event => String(event.JogadorAfetado || "").trim());
    const limit = Number(budget.transferLimit ?? App.config.baseDailyTransferLimit);
    const remaining = Number(budget.remainingBudget ?? App.config.transferBudget);

    if (next) alerts.push(`Próximo jogo pendente: ${next.home} x ${next.away}`);
    if (injuries.length) alerts.push(`${injuries.length} jogador(es) afetado(s) por evento.`);
    if (transfersToday >= limit) alerts.push("Limite diário de transferências atingido.");
    else if (transfersToday >= Math.max(1, limit - 1)) alerts.push("Limite diário de transferências quase atingido.");
    if (remaining < 10000000) alerts.push("Saldo de transferências baixo.");
    if (standing?.position <= 2) alerts.push("Zona de acesso direto.");
    else if (standing?.position <= 6) alerts.push("Zona de playoffs.");

    return alerts;
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

  renderCoachSelector(teams, activeOwner) {
    return `
      <div class="coach-selector">
        ${teams.map(team => `
          <button type="button" class="coach-chip ${team.owner === activeOwner ? "active" : ""}" data-coach-owner="${team.owner}">
            ${App.clubs.getTeamBadgeHtml(team.team, "small")}
            <span>${team.owner}</span>
          </button>
        `).join("")}
      </div>
    `;
  },

  renderFormDots(form) {
    if (!form.length) return `<span class="form-empty">Sem jogos aprovados</span>`;
    return form.map(item => `<span class="form-dot ${item.result.toLowerCase()}" title="${item.row.Mandante} ${item.row.GolsMandante} x ${item.row.GolsVisitante} ${item.row.Visitante}">${item.result}</span>`).join("");
  },

  renderCoachDashboard(activeTeam, standings, budgetInfo) {
    const standing = standings.find(item => App.utils.sameTeamName(item.team, activeTeam.team));
    const budget = budgetInfo[activeTeam.owner] || {};
    const spent = App.players.getSpentByBuyer(activeTeam.owner);
    const breakdown = App.players.getBudgetBreakdown(budget, spent);
    const transfers = App.players.getApprovedTransfersForBuyer(activeTeam.owner).slice(0, 6);
    const next = App.players.getNextMatchForTeam(activeTeam.team);
    const recentForm = App.players.getRecentForm(activeTeam.team);
    const todayCount = App.transfers.getTodayTransferCountByBuyer(activeTeam.owner);
    const transferLimit = Number(budget.transferLimit ?? App.config.baseDailyTransferLimit);
    const alerts = App.players.getCoachAlerts(activeTeam, standing, budget, next, todayCount);
    const events = App.players.getCoachEvents(activeTeam.owner);
    const injuries = App.players.getActiveInjuriesForCoach(activeTeam.owner);
    const color = App.data.ownerColors[activeTeam.owner] || "#2563eb";

    const nextMatchCard = `
      <article class="coach-panel-card coach-next-match">
        <div class="home-panel-header"><h2>Próximo compromisso</h2></div>
        ${next ? `
          <div class="coach-match-preview">
            ${App.clubs.getMatchupHtml(next.home, next.away, "card-match")}
            <p>${next.competition} · ${next.phase} · ${App.utils.formatDate(next.date)}</p>
            ${App.calendar.canSubmitResult(next) ? `<button class="mini-action-button" type="button" data-open-result-modal="${next.id}">Enviar resultado</button>` : `<span class="status-pill pending">${App.calendar.formatMatchResult(next)}</span>`}
          </div>
        ` : `<p class="calendar-muted">Nenhum compromisso pendente encontrado.</p>`}
      </article>
    `;

    const injuriesCard = `
      <article class="coach-panel-card coach-injuries-card">
        <div class="home-panel-header"><h2>Lesões ativas</h2></div>
        ${injuries.length ? `
          <div class="coach-injury-list">
            ${injuries.map(event => `
              <div class="injury-chip">
                <strong>${App.utils.escapeHtml(event.JogadorAfetado)}</strong>
                <span>${App.utils.escapeHtml(event.Titulo || "Lesão ativa")}</span>
                <b>${App.events.getEventDurationLabel(event)}</b>
              </div>
            `).join("")}
          </div>
        ` : `<p class="calendar-muted">Nenhum jogador lesionado no momento.</p>`}
      </article>
    `;

    const decisionCard = App.auth?.renderCoachDecisionCard ? App.auth.renderCoachDecisionCard(activeTeam.owner) : "";
    const pinCard = App.auth?.renderPinChangeCard ? App.auth.renderPinChangeCard(activeTeam.owner) : "";

    return `
      <section class="coach-dashboard" style="--coach-color:${color}">
        <article class="coach-hero-card">
          <div class="coach-hero-main">
            <div class="coach-club-mark">${App.clubs.getTeamBadgeHtml(activeTeam.team, "coach-crest")}</div>
            <div>
              <span class="modal-kicker">Painel do técnico</span>
              <h2>${activeTeam.owner}</h2>
              <p>Técnico do ${activeTeam.team}</p>
              <div class="coach-form-line">
                <span>Forma recente</span>
                ${App.players.renderFormDots(recentForm)}
              </div>
            </div>
          </div>
          <div class="coach-hero-rank">
            <strong>${standing?.position || "-"}º</strong>
            <span>${standing?.points || 0} pts</span>
          </div>
        </article>

        <section class="coach-quick-grid">
          <article><span>Campanha</span><strong>${standing?.wins || 0}/${standing?.draws || 0}/${standing?.losses || 0}</strong><small>V/E/D</small></article>
          <article><span>Saldo de gols</span><strong>${App.utils.formatGoalDifference(standing?.goalDifference || 0)}</strong><small>${standing?.goalsFor || 0} pró / ${standing?.goalsAgainst || 0} contra</small></article>
          <article><span>Saldo mercado</span><strong>${App.utils.formatCurrency(breakdown.available)}</strong><small>Gasto ${App.utils.formatCurrency(breakdown.spent)}</small></article>
          <article><span>Transfers hoje</span><strong>${todayCount}/${transferLimit}</strong><small>${transfers.length} totais válidas</small></article>
        </section>

        <section class="coach-layout-v54">
          <div class="coach-top-row-v54">
            ${nextMatchCard}
            ${injuriesCard}
          </div>

          ${decisionCard ? `<div class="coach-full-row-v54">${decisionCard}</div>` : ""}

          <div class="coach-flow-v55">
            <article class="coach-panel-card coach-war-room-card">
              <div class="home-panel-header">
                <h2>Sala de guerra</h2>
                <span class="coach-section-kicker">${alerts.length} alerta(s)</span>
              </div>
              ${App.players.renderCoachAlertDeck(alerts)}
            </article>

            <article class="coach-panel-card coach-market-card">
              <div class="home-panel-header">
                <h2>Mercado do técnico</h2>
                <span class="coach-section-kicker">${transfers.length} contratação(ões)</span>
              </div>
              ${App.players.renderCoachTransferDeck(transfers)}
            </article>

            <article class="coach-panel-card coach-event-radar-card">
              <div class="home-panel-header">
                <h2>Radar de ocorrências</h2>
                <span class="coach-section-kicker">${events.length} evento(s)</span>
              </div>
              ${App.players.renderCoachEventDeck(events)}
            </article>

            ${pinCard || ""}
          </div>
        </section>
      </section>
    `;
  },

  renderComparison(ranking) {
    const leader = ranking[0];
    return `
      <section class="coach-comparison coach-comparison-v47">
        <div class="home-panel-header">
          <h2>Termômetro da Liga</h2>
          ${leader ? `<span class="coach-section-kicker">Líder: ${App.utils.escapeHtml(leader.team.owner)} · ${leader.standing?.points || 0} pts</span>` : ""}
        </div>
        <div class="coach-podium-grid">
          ${ranking.map((item, index) => `
            <article class="coach-podium-card rank-${index + 1}" style="--coach-color:${App.data.ownerColors[item.team.owner] || "#2563eb"}">
              <span class="rank-number">${index + 1}</span>
              ${App.clubs.getTeamBadgeHtml(item.team.team, "small")}
              <div>
                <strong>${item.team.owner}</strong>
                <small>${item.team.team}</small>
              </div>
              <b>${item.standing?.points || 0} pts</b>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  },

  bindCoachActions() {
    document.querySelectorAll("[data-coach-owner]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const select = document.getElementById("playersFilter");
        if (select) {
          select.value = button.dataset.coachOwner;
          localStorage.setItem("mml-filter-playersFilter", select.value);
        }
        App.players.render();
      });
    });

    App.calendar.bindCalendarActions?.();
  },

  render() {
    const summary = document.getElementById("playersSummary");
    const grid = document.getElementById("playersGrid");
    if (!summary || !grid) return;

    const search = App.utils.normalizeText(document.getElementById("playersSearchInput")?.value);
    const filter = document.getElementById("playersFilter")?.value || "all";
    const standings = App.standings.getStandings();
    const budgetInfo = App.transfers.getBudgetInfoByBuyer();
    const ranking = App.players.getCoachRanking();
    const teams = App.players.getPlayerTeams();

    let filteredTeams = teams.filter(team => filter === "all" || team.owner === filter);
    if (search) {
      filteredTeams = filteredTeams.filter(team => {
        const next = App.players.getNextMatchForTeam(team.team);
        const transfersText = App.players.getApprovedTransfersForBuyer(team.owner).map(item => item.player).join(" ");
        const eventsText = App.players.getCoachEvents(team.owner, 20).map(event => event.Titulo).join(" ");
        return App.utils.normalizeText(`${team.owner} ${team.team} ${next?.home || ""} ${next?.away || ""} ${transfersText} ${eventsText}`).includes(search);
      });
    }

    const activeTeam = filteredTeams[0] || teams[0];
    const totalTransfers = App.transfers.getTransfersWithStats().filter(item => !item.isBlockedDuplicate).length;
    const totalAlerts = teams.reduce((sum, team) => {
      const standing = standings.find(item => App.utils.sameTeamName(item.team, team.team));
      const budget = budgetInfo[team.owner] || {};
      const next = App.players.getNextMatchForTeam(team.team);
      const todayCount = App.transfers.getTodayTransferCountByBuyer(team.owner);
      return sum + App.players.getCoachAlerts(team, standing, budget, next, todayCount).length;
    }, 0);

    summary.innerHTML = `
      <article class="summary-card"><span>Técnicos</span><strong>${teams.length}</strong></article>
      <article class="summary-card"><span>Líder entre técnicos</span><strong>${ranking[0]?.team.owner || "-"}</strong></article>
      <article class="summary-card"><span>Transferências</span><strong>${totalTransfers}</strong></article>
      <article class="summary-card"><span>Alertas ativos</span><strong>${totalAlerts}</strong></article>
    `;

    if (!activeTeam) {
      grid.innerHTML = `<article class="calendar-card"><h3>Nenhum técnico encontrado</h3></article>`;
      return;
    }

    grid.innerHTML = `
      ${App.players.renderCoachSelector(teams, activeTeam.owner)}
      ${App.players.renderCoachDashboard(activeTeam, standings, budgetInfo)}
      ${App.players.renderComparison(ranking)}
    `;

    App.players.bindCoachActions();
    App.auth?.bindPinChangeForm?.();
    App.auth?.bindDecisionAnswerButtons?.(grid);
    App.players.renderLeaderboard(document.getElementById("topScorers"), App.players.getGoalsByHumanTeams(), "gols por time");
    App.players.renderLeaderboard(document.getElementById("topAssists"), App.players.getTopExpensiveTransfers(5), "transferências caras");
  }
};
