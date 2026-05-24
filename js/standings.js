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

  getRoundCenterData() {
    if (!App.calendar?.getCalendarEvents) return null;

    const allEvents = App.calendar.getCalendarEvents();
    const pending = allEvents.filter(event => App.calendar.getStatusClass(event) === "pending");
    const pendingWithCoach = pending.filter(event => App.calendar.involvesOurTeam(event));
    const nextPending = pendingWithCoach[0] || pending[0];
    const currentWeek = Number(nextPending?.week || 1);

    const weekEvents = allEvents.filter(event => Number(event.week) === currentWeek);
    const weekTechEvents = weekEvents.filter(event => App.calendar.involvesOurTeam(event));
    const weekCpuEvents = weekEvents.filter(event => App.calendar.getMatchOwners(event).length === 0);
    const weekTechPending = weekTechEvents.filter(event => App.calendar.getStatusClass(event) === "pending");
    const weekCpuPending = weekCpuEvents.filter(event => App.calendar.getStatusClass(event) === "pending");

    const managers = App.utils.getHumanBuyers();
    const byManager = managers.map(manager => {
      const total = weekTechEvents.filter(event => App.calendar.getMatchOwners(event).includes(manager)).length;
      const pendingCount = weekTechPending.filter(event => App.calendar.getMatchOwners(event).includes(manager)).length;
      return { manager, total, pending: pendingCount, done: Math.max(0, total - pendingCount) };
    });

    return {
      currentWeek,
      weekEvents,
      weekTechPending,
      weekCpuPending,
      cpuReady: weekTechPending.length === 0 && weekCpuPending.length > 0,
      byManager
    };
  },

  renderRoundCenter() {
    const target = document.getElementById("roundCenter");
    if (!target) return;

    const data = App.standings.getRoundCenterData();
    if (!data) {
      target.innerHTML = "";
      return;
    }

    const pendingText = data.weekTechPending.length === 0
      ? "Todos os jogos com técnico da semana estão enviados."
      : `${data.weekTechPending.length} jogo(s) com técnico pendente(s).`;

    const cpuText = data.cpuReady
      ? `${data.weekCpuPending.length} jogo(s) CPU x CPU prontos para simular.`
      : `${data.weekCpuPending.length} jogo(s) CPU x CPU pendente(s).`;
    const cpuCardContent = `
      <span>CPU x CPU</span>
      <strong>${data.cpuReady ? "Pode simular" : "Aguardando técnicos"}</strong>
      <small>${App.auth?.isCommissioner?.() ? `${data.weekCpuPending.length} jogo(s) pendente(s)` : "Simulação liberada ao comissário"}</small>
    `;

    target.innerHTML = `
      <article class="round-center-card">
        <div class="round-center-main">
          <span class="modal-kicker">Central da rodada</span>
          <h2>Semana ${data.currentWeek}</h2>
          <p>${pendingText} ${cpuText}</p>
        </div>
        <div class="round-center-grid">
          ${data.byManager.map(item => `
            <div class="round-manager-card ${item.pending === 0 ? "done" : "pending"}">
              <span class="owner" style="background:${App.data.ownerColors[item.manager]}">${item.manager}</span>
              <strong>${item.pending === 0 ? "Completo" : `${item.pending} pendente(s)`}</strong>
              <small>${item.done}/${item.total || 0} enviados</small>
            </div>
          `).join("")}
          ${App.auth?.isCommissioner?.() ? `
            <button class="round-cpu-card ${data.cpuReady ? "is-ready" : ""}" type="button" data-view-target="submitView">
              ${cpuCardContent}
            </button>
          ` : `
            <div class="round-cpu-card ${data.cpuReady ? "is-ready" : ""}">
              ${cpuCardContent}
            </div>
          `}
        </div>
      </article>
    `;
  },

  getAttentionItems() {
    const pendingHumanGames = App.calendar.getCalendarEvents()
      .filter(event => App.calendar.getStatusClass(event) === "pending" && App.calendar.involvesOurTeam(event))
      .slice(0, 3)
      .map(event => ({
        type: "Jogo pendente",
        title: `${event.home} x ${event.away}`,
        detail: `${event.competition} · ${event.phase} · Semana ${event.week}`,
        action: "Calendário",
        target: "calendarView"
      }));

    const activeEvents = (App.state.apiEvents || [])
      .filter(event => App.events.isActiveOrDurationEvent(event))
      .slice(0, 3)
      .map(event => ({
        type: "Evento ativo",
        title: event.Titulo || "Evento da liga",
        detail: `${event.Jogador || "Liga"} · ${event.Tipo || "Evento"}`,
        action: "Eventos",
        target: "eventsView"
      }));

    const recentTransfers = App.transfers.getRecentTransferMovements(3)
      .map(item => ({
        type: "Mercado",
        title: `${item.buyer} contratou ${item.player}`,
        detail: `${App.utils.formatCurrency(item.totalCost)} · ${item.fromClub || "Clube não informado"}`,
        action: "Transferências",
        target: "transfersView"
      }));

    return [...pendingHumanGames, ...activeEvents, ...recentTransfers].slice(0, 6);
  },

  renderAttentionPanel() {
    const target = document.getElementById("attentionPanel");
    if (!target) return;

    const items = App.standings.getAttentionItems();

    target.innerHTML = `
      <article class="attention-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Atenção agora</span>
            <h2>O que pede ação</h2>
          </div>
        </div>
        ${items.length ? `
          <div class="attention-grid">
            ${items.map(item => `
              <button class="attention-item" type="button" data-view-target="${item.target}">
                <span>${App.utils.escapeHtml(item.type)}</span>
                <strong>${App.utils.escapeHtml(item.title)}</strong>
                <small>${App.utils.escapeHtml(item.detail)}</small>
                <b>${App.utils.escapeHtml(item.action)} ›</b>
              </button>
            `).join("")}
          </div>
        ` : `<div class="next-game-empty">Nada urgente agora. A liga está respirando.</div>`}
      </article>
    `;
  },

  getActivityItems() {
    const resultItems = (App.state.apiResults || []).map(row => ({
      type: "Resultado",
      tone: "result",
      date: row.Timestamp || row.created_at || row.Data || "",
      title: `${App.utils.resolveTeamName(row.Mandante)} ${row.GolsMandante} x ${row.GolsVisitante} ${App.utils.resolveTeamName(row.Visitante)}`,
      detail: `${row.Competicao || ""} · ${row.RodadaFase || ""} · enviado por ${row.EnviadoPor || "Liga"}`.replace(/\s+·\s+$/g, ""),
      metric: App.utils.formatDateTime(row.Timestamp || row.created_at || row.Data || "")
    }));

    const transferItems = (App.state.apiTransfers || []).map(row => {
      const isCpuSale =
        App.utils.normalizeText(row.TipoTransferencia || row.transfer_type) ===
        "cpu_sale";
      const value = isCpuSale
        ? row.ValorNegociado || row.negotiated_value || row.ValorFinal
        : row.ValorFinal || row.ValorTransfermarkt;
      const valueLabel = Number(value || 0) > 0 ? App.utils.formatCurrency(value || 0) : "valor em revisão";
      const seller = row.Vendedor || row.CompradorRegistro || row.Comprador || "-";
      const destination = row.ClubeDestino || row.Destino || row.destination_club || row.Comprador || "clube interessado";
      return {
        type: "Transferência",
        tone: isCpuSale ? "sale" : "transfer",
        date: row.Timestamp || "",
        title: isCpuSale
          ? `${seller} vendeu ${row.Jogador || "-"} para ${destination}`
          : `${row.Comprador || "-"} contratou ${row.Jogador || "-"}`,
        detail: isCpuSale
          ? `${valueLabel} recebido · destino: ${destination}`
          : `${valueLabel} custo final · origem: ${row.ClubeOrigem || "clube não informado"}`,
        metric: App.utils.formatDateTime(row.Timestamp || "")
      };
    });

    const eventItems = (App.state.apiEvents || [])
      .filter(row => !App.utils.normalizeText(row.Titulo || "").startsWith("venda externa"))
      .map(row => {
        const impact = Number(row.ImpactoFinanceiro || 0);
        return {
          type: "Evento",
          tone: impact > 0 ? "positive" : impact < 0 ? "negative" : "event",
          date: row.Timestamp || row.ExpiraEm || "",
          title: row.Titulo || "-",
          detail: `${row.Jogador || "Liga"} · ${row.Tipo || "Ocorrência"} · ${row.Status || "registrado"}`,
          metric: App.events?.getEventImpactLabel ? App.events.getEventImpactLabel(row) : App.utils.formatDateTime(row.Timestamp || row.ExpiraEm || "")
        };
      });

    return [...resultItems, ...transferItems, ...eventItems]
      .filter(item => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  },

  renderActivityPanel() {
    const target = document.getElementById("activityPanel");
    if (!target) return;

    const items = App.standings.getActivityItems();

    target.innerHTML = `
      <article class="activity-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Linha do tempo</span>
            <h2>Movimentos oficiais</h2>
          </div>
        </div>
        ${items.length ? `
          <div class="activity-list">
            ${items.map(item => `
              <div class="activity-item activity-${App.utils.escapeHtml(item.tone || "event")}">
                <span class="activity-type">${App.utils.escapeHtml(item.type)}</span>
                <div>
                  <strong>${App.utils.escapeHtml(item.title)}</strong>
                  <small>${App.utils.escapeHtml(item.detail)}</small>
                </div>
                <b>${App.utils.escapeHtml(item.metric || App.utils.formatDateTime(item.date))}</b>
              </div>
            `).join("")}
          </div>
        ` : `<div class="next-game-empty">Nenhuma atividade recente encontrada.</div>`}
      </article>
    `;
  },

  render() {
    const table = document.getElementById("standingsTable");
    const mobile = document.getElementById("standingsMobile");
    const summary = document.getElementById("standingsSummary");
    if (!table || !mobile || !summary) return;

    if (!App.state.apiLoaded) {
      summary.innerHTML = `
        ${App.ui.summaryCard("Liga", "Sincronizando", "Buscando jogos aprovados")}
        ${App.ui.summaryCard("Classificação", "Aguarde", "Calculando tabela")}
        ${App.ui.summaryCard("Mercado", "Aguarde", "Carregando orçamentos")}
        ${App.ui.summaryCard("Times", App.data.teams.length, "Na competição")}
      `;
      App.standings.renderHomeStandings([]);
      const homeTable = document.getElementById("homeStandingsTable");
      if (homeTable) {
        homeTable.innerHTML = `
          <tr>
            <td colspan="8" class="calendar-muted">Sincronizando dados oficiais da liga...</td>
          </tr>
        `;
      }
      table.innerHTML = `
        <tr>
          <td colspan="11" class="calendar-muted">Sincronizando dados oficiais da liga...</td>
        </tr>
      `;
      mobile.innerHTML = `
        <article class="calendar-card standings-mobile-card">
          <p class="calendar-muted">Sincronizando dados oficiais da liga...</p>
        </article>
      `;
      return;
    }

    const standings = App.standings.getStandings();

    App.standings.renderSummaryCards(standings, summary);
    App.standings.renderHomeStandings(standings);
    App.standings.renderHomeNextGames();
    App.standings.renderRoundCenter();
    App.standings.renderAttentionPanel();
    App.standings.renderActivityPanel();
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
