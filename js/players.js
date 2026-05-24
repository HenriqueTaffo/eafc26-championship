window.App = window.App || {};

App.players = {
  getPlayerTeams() {
    return App.data.teams.filter(team => team.status === "Nosso");
  },

  getHumanTeamNames() {
    return App.players.getPlayerTeams().map(team => team.team);
  },

  getApprovedTransfersForBuyer(buyer) {
    return App.transfers.getValidTransfers().filter(item => item.buyer === buyer);
  },

  getSpentByBuyer(buyer) {
    return App.players.getApprovedTransfersForBuyer(buyer).reduce((sum, item) => sum + item.totalCost, 0);
  },

  getFinanceForecastForBuyer(buyer) {
    return (App.state.apiFinanceForecast || []).find(
      item =>
        App.utils.normalizeText(item.manager_name || item.managerName) ===
        App.utils.normalizeText(buyer),
    ) || null;
  },

  getWeeklyPayrollForBuyer(buyer, transfers = []) {
    const forecast = App.players.getFinanceForecastForBuyer(buyer);
    const forecastPayroll = Number(forecast?.payroll_weekly ?? forecast?.payrollWeekly);
    if (Number.isFinite(forecastPayroll) && forecastPayroll > 0) {
      return forecastPayroll;
    }
    return transfers.reduce((sum, item) => sum + App.transfers.estimateWeeklySalary(item), 0);
  },

  getBudgetBreakdown(budget, spent) {
    const base = Number(budget.baseBudget ?? App.config.transferBudget);
    const homeBonus = Number(budget.homeBonus || 0);
    const winBonus = Number(budget.winBonusValue || budget.winBonus || 0);
    const weeklyIncome = Number(budget.weeklyIncome || 0);
    const formBonus = Number(budget.formBonus || 0);
    const cupRebalanceBonus = Number(budget.cupRebalanceBonus || 0);
    const eventBonus = Number(budget.eventTotal || budget.eventBonus || 0);
    const sponsorshipRewards = Number(budget.sponsorshipRewards || 0);
    const totalAccumulated = Number(budget.totalBudget ?? (base + homeBonus + winBonus + eventBonus));
    const spentValue = Number(budget.spentTotal ?? spent ?? 0);
    const available = Number(budget.remainingBudget ?? (totalAccumulated - spentValue));

    return { base, homeBonus, winBonus, weeklyIncome, formBonus, cupRebalanceBonus, eventBonus, sponsorshipRewards, totalAccumulated, spent: spentValue, available };
  },

  getCoachStatementEntries(owner, budget, breakdown) {
    const entries = [];
    const pushEntry = ({ label, detail, amount, dateLabel, rank }) => {
      const value = Number(amount || 0);
      if (value <= 0) return;
      entries.push({ label, detail, amount: value, dateLabel, rank });
    };

    const positiveEvents = (App.state.apiEvents || [])
      .filter(event => App.utils.normalizeText(event.Jogador) === App.utils.normalizeText(owner))
      .filter(event => Number(event.ImpactoFinanceiro || 0) > 0)
      .sort((a, b) => App.events.getEventDateTime(b) - App.events.getEventDateTime(a))
      .slice(0, 4);

    positiveEvents.forEach((event, index) => {
      pushEntry({
        label: event.Titulo || "Evento positivo",
        detail: event.Tipo || "Evento da liga",
        amount: Number(event.ImpactoFinanceiro || 0),
        dateLabel: App.utils.formatDateTime(App.events.getEventDateTime(event)),
        rank: 10 + index
      });
    });

    const eventRollup = Number(breakdown.eventBonus || 0) - Number(breakdown.sponsorshipRewards || 0);
    if (!positiveEvents.length && eventRollup > 0) {
      pushEntry({
        label: "Eventos positivos",
        detail: `${Number(budget.eventCount || 0)} ocorrência(s) com impacto financeiro`,
        amount: eventRollup,
        dateLabel: "Atualizado pela liga",
        rank: 20
      });
    }

    pushEntry({
      label: "Patrocínios",
      detail: "Bônus comerciais já processados",
      amount: breakdown.sponsorshipRewards,
      dateLabel: "Contratos ativos",
      rank: 30
    });

    pushEntry({
      label: "Premiação por vitórias",
      detail: `${Number(budget.wins || 0)} vitória(s) aprovada(s)`,
      amount: breakdown.winBonus,
      dateLabel: "Resultados aprovados",
      rank: 40
    });

    pushEntry({
      label: "Receita semanal",
      detail: "Distribuição fixa por semana ativa",
      amount: breakdown.weeklyIncome,
      dateLabel: "Temporada",
      rank: 42
    });

    pushEntry({
      label: "Bônus de campanha",
      detail: `${Number(budget.points || 0)} ponto(s) em ${Number(budget.matchesPlayed || 0)} jogo(s)`,
      amount: breakdown.formBonus,
      dateLabel: "Blocos de 5 jogos",
      rank: 44
    });

    pushEntry({
      label: "Ajuste de copas",
      detail: "Rebalanceamento de premiações de avanço",
      amount: breakdown.cupRebalanceBonus,
      dateLabel: "Copas",
      rank: 46
    });

    pushEntry({
      label: "Bilheteria por mando",
      detail: `${Number(budget.homeMatches || 0)} jogo(s) como mandante`,
      amount: breakdown.homeBonus,
      dateLabel: "Calendário oficial",
      rank: 50
    });

    pushEntry({
      label: "Orçamento inicial",
      detail: "Crédito base da temporada",
      amount: breakdown.base,
      dateLabel: "Temporada",
      rank: 60
    });

    return entries.sort((a, b) => a.rank - b.rank);
  },

  renderCoachFinancialStatement(owner, budget, breakdown) {
    const entries = App.players.getCoachStatementEntries(owner, budget, breakdown);
    const extraRevenue = Math.max(0, Number(breakdown.totalAccumulated || 0) - Number(breakdown.base || 0));
    const latestExtra = entries.find(entry => entry.label !== "Orçamento inicial");

    return `
      <div class="coach-full-row-v54">
        <article class="coach-panel-card coach-statement-card">
          <div class="home-panel-header">
            <h2>Extrato do clube</h2>
            <span class="coach-section-kicker">Privado</span>
          </div>
          <div class="coach-statement-summary">
            <div>
              <span>Receitas extras</span>
              <strong>${App.utils.formatCurrency(extraRevenue)}</strong>
            </div>
            <div>
              <span>Saldo atual</span>
              <strong>${App.utils.formatCurrency(breakdown.available)}</strong>
            </div>
            <div>
              <span>Último crédito</span>
              <strong>${latestExtra ? App.utils.formatCurrency(latestExtra.amount) : "-"}</strong>
            </div>
          </div>
          <div class="coach-statement-list">
            ${entries.map(entry => `
              <div class="coach-statement-item">
                <div>
                  <strong>${App.utils.escapeHtml(entry.label)}</strong>
                  <span>${App.utils.escapeHtml(entry.detail)}</span>
                </div>
                <div>
                  <b>${App.utils.formatCurrency(entry.amount)}</b>
                  <small>${App.utils.escapeHtml(entry.dateLabel)}</small>
                </div>
              </div>
            `).join("")}
          </div>
        </article>
      </div>
    `;
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

  getPrivateTargetsKey(owner) {
    const session = App.auth?.getSession ? App.auth.getSession() : null;
    const ownerKey = App.utils.normalizeText(owner).replace(/[^a-z0-9]+/g, "-");
    const sessionKey = String(session?.managerId || ownerKey || "manager").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return `mml-private-transfer-targets-v1:${sessionKey}:${ownerKey}`;
  },

  getPrivateTransferTargets(owner) {
    if (!App.auth?.canViewManagerPrivate?.(owner)) return [];
    const session = App.auth?.getSession ? App.auth.getSession() : null;
    if (session && App.utils.normalizeText(session.managerName) === App.utils.normalizeText(owner) && App.auth.myTransferTargetsLoaded) {
      return App.auth.myTransferTargets;
    }

    try {
      const raw = localStorage.getItem(App.players.getPrivateTargetsKey(owner));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },

  savePrivateTransferTargets(owner, targets = []) {
    if (!App.auth?.canViewManagerPrivate?.(owner)) return [];
    const cleanTargets = targets
      .map(item => ({
        id: item.id || `target-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      player: String(item.player || "").trim(),
        club: String(item.club || "").trim(),
        value: Number(item.value || 0),
        priority: String(item.priority || "Monitorar"),
        note: String(item.note || "").trim(),
        createdAt: item.createdAt || new Date().toISOString()
      }))
      .filter(item => item.player);

    localStorage.setItem(App.players.getPrivateTargetsKey(owner), JSON.stringify(cleanTargets));
    return cleanTargets;
  },

  addPrivateTransferTarget(owner, payload = {}) {
    const targets = App.players.getPrivateTransferTargets(owner);
    const playerKey = App.transfers.normalizePlayerRatingKey(payload.player);
    const existing = targets.find(item => App.transfers.normalizePlayerRatingKey(item.player) === playerKey);
    const nextTarget = {
      ...(existing || {}),
      player: payload.player,
      club: payload.club,
      value: payload.value,
      priority: payload.priority,
      note: payload.note,
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    const nextTargets = existing
      ? targets.map(item => item.id === existing.id ? { ...nextTarget, id: existing.id } : item)
      : [{ ...nextTarget, id: `target-${Date.now()}` }, ...targets];

    return App.players.savePrivateTransferTargets(owner, nextTargets);
  },

  removePrivateTransferTarget(owner, targetId) {
    const targets = App.players.getPrivateTransferTargets(owner).filter(item => item.id !== targetId);
    return App.players.savePrivateTransferTargets(owner, targets);
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
          ${topTransfer ? App.transfers.renderPlayerIdentity(topTransfer.player, topTransfer.fromClub || "", "coach-header-player-identity", { club: topTransfer.fromClub }) : `<strong>-</strong>`}
        </div>
        <div>
          <span>Total exibido</span>
          <strong>${App.utils.formatCurrency(total)}</strong>
        </div>
      </div>

      <div class="coach-transfer-timeline">
        ${transfers.map((item, index) => `
          <div class="coach-transfer-item">
            ${App.transfers.renderPlayerIdentity(item.player, item.fromClub || "Clube não informado", "coach-transfer-player-identity", { club: item.fromClub })}
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

  renderPrivateTransferTargets(owner) {
    const targets = App.players.getPrivateTransferTargets(owner);

    return `
      <article class="coach-panel-card coach-targets-card" data-private-target-owner="${App.utils.escapeHtml(owner)}">
        <div class="home-panel-header">
          <h2>Alvos privados</h2>
          <span class="coach-section-kicker">Só você vê</span>
        </div>
        <form class="coach-target-form" data-private-target-form>
          <label>
            Jogador
            <input name="player" type="text" placeholder="Buscar no mercado..." autocomplete="off" required data-private-target-search />
          </label>
          <label>
            Clube atual
            <input name="club" type="text" placeholder="Clube ou liga" autocomplete="off" />
          </label>
          <label>
            Valor teto
            <input name="value" type="number" min="0" step="100000" placeholder="0" />
          </label>
          <label>
            Prioridade
            <select name="priority">
              <option>Prioridade alta</option>
              <option>Monitorar</option>
              <option>Plano B</option>
              <option>Oportunidade</option>
            </select>
          </label>
          <label class="target-note-field">
            Nota privada
            <input name="note" type="text" placeholder="Ex.: negociar depois da rodada" autocomplete="off" />
          </label>
          <button type="submit" class="secondary-button">Pinar alvo</button>
        </form>
        <div class="coach-target-search-results" data-private-target-results></div>
        <div class="coach-target-list">
          ${targets.length ? targets.map(target => {
            const marketPlayer = App.transfers.findMarketPlayerByName(target.player, { club: target.club }) || {
              name: target.player,
              club: target.club
            };
            const rating = App.transfers.getRatingForPlayerName(target.player, { club: target.club });
            const favoriteKey = `target:${target.id || target.player}`;
            const isFavorite = App.auth?.isFavorite?.("transfer_target", favoriteKey);
            return `
              <div class="coach-target-item">
                ${App.transfers.renderPlayerPhoto(marketPlayer, rating, "player-avatar")}
                <div class="coach-target-copy">
                  <strong>${App.utils.escapeHtml(target.player)}</strong>
                  <small>${App.utils.escapeHtml([target.priority, target.club, target.value ? App.utils.formatCurrency(target.value) : ""].filter(Boolean).join(" · "))}</small>
                  ${target.note ? `<span>${App.utils.escapeHtml(target.note)}</span>` : ""}
                </div>
                <div class="coach-target-actions">
                  <button
                    type="button"
                    class="icon-action-button favorite-action-button ${isFavorite ? "is-active" : ""}"
                    title="${isFavorite ? "Remover dos favoritos" : "Favoritar alvo"}"
                    aria-label="${isFavorite ? "Remover dos favoritos" : "Favoritar alvo"}"
                    data-favorite-target="${App.utils.escapeHtml(favoriteKey)}"
                    data-favorite-title="${App.utils.escapeHtml(target.player)}"
                    data-favorite-detail="${App.utils.escapeHtml([target.priority, target.club].filter(Boolean).join(" · "))}"
                  ><span aria-hidden="true"></span></button>
                  <button type="button" class="icon-action-button" title="Remover alvo" aria-label="Remover alvo" data-remove-private-target="${App.utils.escapeHtml(target.id)}">×</button>
                </div>
              </div>
            `;
          }).join("") : `
            <div class="coach-empty-state compact">
              <strong>Nenhum alvo pinado</strong>
              <p>Use este bloco para guardar nomes sem expor sua lista para os outros técnicos.</p>
            </div>
          `}
        </div>
      </article>
    `;
  },

  async renderPrivateTargetSearchResults(form) {
    const card = form.closest("[data-private-target-owner]");
    const target = card?.querySelector("[data-private-target-results]");
    const input = form.elements.player;
    if (!target || !input) return;

    const query = String(input.value || "").trim();
    if (query.length < 2) {
      target.innerHTML = "";
      target.classList.remove("is-visible");
      return;
    }

    target.classList.add("is-visible");
    target.innerHTML = `<div class="market-empty">Buscando jogadores no mercado...</div>`;

    const players = await App.api.loadMarketPlayers(query, true, 8).catch(error => {
      console.warn("Busca de alvos privados indisponível:", error);
      return [];
    });

    if (String(input.value || "").trim() !== query) return;

    if (!players.length) {
      target.innerHTML = `<div class="market-empty">Nenhum jogador encontrado no mercado.</div>`;
      return;
    }

    const ratingRows = await Promise.all(players.slice(0, 8).map(player =>
      App.api.searchEaRatings(player.name || "", 2).catch(() => [])
    ));
    App.api.mergeEaRatings?.(ratingRows.flat());

    target.innerHTML = `
      <div class="market-player-results">
        ${players.map(player => {
      const eaRating = App.transfers.findEaRatingForMarketPlayer(player);
      const marketValue = App.transfers.getMarketPlayerValue(player);
      const overall = Number(eaRating?.overall || player.overall || 0);
      return `
        <button class="market-player-option private-target-option" type="button" data-private-target-player="${App.utils.escapeHtml(player.id || player.name)}">
          ${App.transfers.renderPlayerPhoto(player, eaRating)}
          <span class="market-player-main">
            <strong>${App.utils.escapeHtml(player.name || "-")}</strong>
            <small>${App.utils.escapeHtml([player.position, player.age ? `${player.age} anos` : "", player.league, player.club].filter(Boolean).join(" · "))}</small>
          </span>
          <span class="market-player-side">
            ${overall ? `<span class="market-player-overall">OVR ${overall}</span>` : ""}
            <span class="market-player-value">${App.utils.formatCurrency(marketValue)}</span>
          </span>
        </button>
      `;
    }).join("")}
      </div>
    `;

    target.querySelectorAll("[data-private-target-player]").forEach(button => {
      button.addEventListener("click", () => {
        const player = players.find(item => String(item.id || item.name) === String(button.dataset.privateTargetPlayer));
        if (!player) return;
        form.elements.player.value = player.name || "";
        form.elements.club.value = player.club || "";
        form.elements.value.value = Math.round(App.transfers.getMarketPlayerValue(player));
        form.elements.player.dataset.marketPlayerId = player.id || "";
        target.innerHTML = "";
        target.classList.remove("is-visible");
      });
    });
  },

  getCoachAlerts(team, standing, budget, next, transfersToday, canViewPrivate = false) {
    const alerts = [];
    const activeEvents = App.events.getActiveEventsForBuyer(team.owner);
    const injuries = activeEvents.filter(event => String(event.JogadorAfetado || "").trim());
    const limit = Number(budget.transferLimit ?? App.config.baseDailyTransferLimit);
    const remaining = Number(budget.remainingBudget ?? App.config.transferBudget);

    if (next) alerts.push(`Próximo jogo pendente: ${next.home} x ${next.away}`);
    if (canViewPrivate && injuries.length) alerts.push(`${injuries.length} jogador(es) afetado(s) por evento.`);
    if (canViewPrivate && transfersToday >= limit) alerts.push("Limite diário de transferências atingido.");
    else if (canViewPrivate && transfersToday >= Math.max(1, limit - 1)) alerts.push("Limite diário de transferências quase atingido.");
    if (canViewPrivate && remaining < 10000000) alerts.push("Saldo de transferências baixo.");
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

  getCoachObjectives(activeTeam, standing, budget, transfers) {
    const remaining = Number(budget.remainingBudget ?? App.config.transferBudget);
    const totalBudget = Number(budget.totalBudget ?? App.config.transferBudget);
    const spent = Number(budget.spentTotal || 0);
    const spendPct = totalBudget > 0 ? spent / totalBudget : 0;
    const topSix = Number(standing?.position || 99) <= 6;
    const positiveGoalDiff = Number(standing?.goalDifference || 0) >= 0;
    const cashDiscipline = remaining >= 0 && spendPct <= .85;
    const squadDepth = transfers.length >= 4;

    return [
      {
        label: "Brigar pelo topo",
        status: topSix ? "ok" : "risk",
        detail: topSix ? "Dentro do G6." : `Atual: ${standing?.position || "-"}º. Diretoria quer G6.`
      },
      {
        label: "Saldo competitivo",
        status: positiveGoalDiff ? "ok" : "risk",
        detail: `Saldo de gols ${App.utils.formatGoalDifference(standing?.goalDifference || 0)}.`
      },
      {
        label: "Fair play financeiro",
        status: cashDiscipline ? "ok" : "risk",
        detail: cashDiscipline ? "Gasto sob controle." : "Orçamento pressionado ou negativo."
      },
      {
        label: "Profundidade do elenco",
        status: squadDepth ? "ok" : "warn",
        detail: `${transfers.length} contratação(ões) válidas.`
      }
    ];
  },

  getCoachMorale(activeTeam, standing, budget, injuries, recentForm) {
    let score = 55;
    recentForm.forEach(item => {
      if (item.result === "W") score += 8;
      if (item.result === "D") score += 2;
      if (item.result === "L") score -= 7;
    });
    score += Math.min(12, Math.max(-12, Number(standing?.goalDifference || 0) * 2));
    score -= injuries.length * 10;
    if (Number(budget.remainingBudget || 0) < 0) score -= 12;
    score = Math.max(0, Math.min(100, score));

    const label = score >= 75 ? "Vestiário em alta" : score >= 50 ? "Ambiente estável" : "Pressão no elenco";
    return { score, label };
  },

  getFairPlayFlags(budget, transfers) {
    const remaining = Number(budget.remainingBudget ?? App.config.transferBudget);
    const totalBudget = Number(budget.totalBudget ?? App.config.transferBudget);
    const spent = Number(budget.spentTotal || 0);
    const payrollWeekly = transfers.reduce((sum, item) => sum + App.transfers.estimateWeeklySalary(item), 0);
    const payrollPressure = totalBudget > 0 ? (payrollWeekly * 4) / totalBudget : 0;
    const flags = [];

    if (remaining < 0) flags.push("Saldo negativo: risco de auditoria.");
    if (totalBudget > 0 && spent / totalBudget >= .9) flags.push("Gasto acima de 90% do orçamento.");
    if (payrollPressure >= .18) flags.push(`Folha pesada: ${App.utils.formatCurrency(payrollWeekly)} por semana.`);
    if (transfers.some(item => Number(item.totalCost || 0) >= 30000000)) flags.push("Compra pesada no radar da liga.");
    if (!flags.length) flags.push("Sem alerta financeiro grave.");

    return flags;
  },

  getPrivateBoardObjectives(activeTeam, standing, budget, transfers, recentForm) {
    const next = App.players.getNextMatchForTeam(activeTeam.team);
    const remaining = Number(budget.remainingBudget ?? App.config.transferBudget);
    const totalBudget = Number(budget.totalBudget ?? App.config.transferBudget);
    const payrollWeekly = transfers.reduce((sum, item) => sum + App.transfers.estimateWeeklySalary(item), 0);
    const lastFive = recentForm.slice(0, 5);
    const wins = lastFive.filter(item => item.result === "W").length;
    const hasValueBuy = transfers.some(item => Number(item.overall || 0) >= 78 && Number(item.totalCost || 0) <= 14000000);
    const hasBigBuy = transfers.some(item => Number(item.totalCost || 0) >= 25000000 || Number(item.overall || 0) >= 86);
    const spendRatio = totalBudget > 0 ? 1 - (remaining / totalBudget) : 0;

    return [
      {
        label: "Alvo de mercado",
        status: hasValueBuy || hasBigBuy ? "ok" : "warn",
        detail: hasBigBuy
          ? "Contratação de impacto já entrou no elenco."
          : hasValueBuy
            ? "Boa compra custo-benefício registrada."
            : "Mapeie um titular acessível antes do próximo deadline."
      },
      {
        label: "Próximo jogo",
        status: next ? "warn" : "ok",
        detail: next
          ? `${next.competition} contra ${App.utils.sameTeamName(next.home, activeTeam.team) ? next.away : next.home}.`
          : "Sem compromisso pendente no calendário."
      },
      {
        label: "Controle de caixa",
        status: remaining >= 0 && spendRatio < .82 && payrollWeekly * 4 < totalBudget * .18 ? "ok" : "risk",
        detail: `${App.utils.formatCurrency(remaining)} livres · folha ${App.utils.formatCurrency(payrollWeekly)}/sem.`
      },
      {
        label: "Momento competitivo",
        status: wins >= 2 || Number(standing?.points || 0) >= 10 ? "ok" : "warn",
        detail: `${wins} vitória(s) nos últimos ${lastFive.length || 0} jogos rastreados.`
      }
    ];
  },

  renderPrivateBoardObjectives(activeTeam, standing, budget, transfers, recentForm) {
    const objectives = App.players.getPrivateBoardObjectives(activeTeam, standing, budget, transfers, recentForm);
    return `
      <div class="coach-full-row-v54">
        <article class="coach-panel-card coach-private-board-card">
          <div class="home-panel-header">
            <div>
              <span class="modal-kicker">Só você vê</span>
              <h2>Metas secretas</h2>
            </div>
            <span class="coach-section-kicker">${objectives.filter(item => item.status === "ok").length}/${objectives.length}</span>
          </div>
          <div class="coach-objective-grid private-board-grid">
            ${objectives.map(item => `
              <div class="coach-objective-item ${item.status}">
                <strong>${App.utils.escapeHtml(item.label)}</strong>
                <span>${App.utils.escapeHtml(item.detail)}</span>
              </div>
            `).join("")}
          </div>
        </article>
      </div>
    `;
  },

  renderPrivateFavoritesCard(owner) {
    const session = App.auth?.getSession?.();
    if (!session || App.utils.normalizeText(session.managerName) !== App.utils.normalizeText(owner)) return "";
    const favorites = App.auth.myFavorites || [];

    return `
      <article class="coach-panel-card coach-favorites-card">
        <div class="home-panel-header">
          <h2>Favoritos privados</h2>
          <span class="coach-section-kicker">${favorites.length} item(ns)</span>
        </div>
        <div class="coach-favorite-list">
          ${favorites.length ? favorites.map(item => `
            <div class="coach-favorite-item">
              <strong>${App.utils.escapeHtml(item.title)}</strong>
              <span>${App.utils.escapeHtml(item.detail || item.item_type || "")}</span>
              <button type="button" class="icon-action-button" data-remove-favorite-type="${App.utils.escapeHtml(item.item_type)}" data-remove-favorite-key="${App.utils.escapeHtml(item.item_key)}">×</button>
            </div>
          `).join("") : `
            <div class="coach-empty-state compact">
              <strong>Nenhum favorito salvo</strong>
              <p>Use a estrela nos alvos privados para criar atalhos persistentes.</p>
            </div>
          `}
        </div>
      </article>
    `;
  },

  renderCoachStrategyCards(activeTeam, standing, budget, transfers, injuries, recentForm) {
    const objectives = App.players.getCoachObjectives(activeTeam, standing, budget, transfers);
    const morale = App.players.getCoachMorale(activeTeam, standing, budget, injuries, recentForm);
    const fairPlay = App.players.getFairPlayFlags(budget, transfers);
    const payrollWeekly = App.players.getWeeklyPayrollForBuyer(activeTeam.owner, transfers);
    const runwayWeeks = payrollWeekly > 0
      ? Math.floor(Math.max(0, Number(budget.remainingBudget ?? App.config.transferBudget)) / payrollWeekly)
      : null;

    return `
      <div class="coach-full-row-v54">
        <article class="coach-panel-card coach-strategy-card">
          <div class="home-panel-header">
            <h2>Objetivos da diretoria</h2>
            <span class="coach-section-kicker">${objectives.filter(item => item.status === "ok").length}/${objectives.length} em dia</span>
          </div>
          <div class="coach-objective-grid">
            ${objectives.map(item => `
              <div class="coach-objective-item ${item.status}">
                <strong>${App.utils.escapeHtml(item.label)}</strong>
                <span>${App.utils.escapeHtml(item.detail)}</span>
              </div>
            `).join("")}
          </div>
        </article>
      </div>
      <div class="coach-full-row-v54 coach-strategy-split">
        <article class="coach-panel-card coach-morale-card">
          <div class="home-panel-header">
            <h2>Moral do elenco</h2>
            <span class="coach-section-kicker">${Math.round(morale.score)}%</span>
          </div>
          <div class="morale-meter"><span style="width:${morale.score}%"></span></div>
          <p class="calendar-muted">${App.utils.escapeHtml(morale.label)}. Forma, saldo, caixa e DM pesam nessa leitura.</p>
        </article>
        <article class="coach-panel-card coach-fairplay-card">
          <div class="home-panel-header">
            <h2>Fair play financeiro</h2>
            <span class="coach-section-kicker">Folha ${App.utils.formatCurrency(payrollWeekly)}/sem</span>
          </div>
          <div class="fairplay-list">
            ${fairPlay.map(item => `<span>${App.utils.escapeHtml(item)}</span>`).join("")}
            ${runwayWeeks !== null ? `<span>Fôlego estimado de caixa: ${runwayWeeks} semana(s) de folha.</span>` : ""}
          </div>
        </article>
      </div>
    `;
  },

  renderCoachDashboard(activeTeam, standings, budgetInfo) {
    const standing = standings.find(item => App.utils.sameTeamName(item.team, activeTeam.team));
    const budget = budgetInfo[activeTeam.owner] || {};
    const spent = App.players.getSpentByBuyer(activeTeam.owner);
    const breakdown = App.players.getBudgetBreakdown(budget, spent);
    const transfers = App.players.getApprovedTransfersForBuyer(activeTeam.owner);
    const visibleTransfers = transfers.slice(0, 6);
    const payrollWeekly = App.players.getWeeklyPayrollForBuyer(activeTeam.owner, transfers);
    const next = App.players.getNextMatchForTeam(activeTeam.team);
    const recentForm = App.players.getRecentForm(activeTeam.team);
    const todayCount = App.transfers.getTodayTransferCountByBuyer(activeTeam.owner);
    const transferLimit = Number(budget.transferLimit ?? App.transfers.getTransferLimitForBuyer(activeTeam.owner));
    const canViewPrivate = App.auth?.canViewManagerPrivate ? App.auth.canViewManagerPrivate(activeTeam.owner) : false;
    const alerts = App.players.getCoachAlerts(activeTeam, standing, budget, next, todayCount, canViewPrivate);
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
                ${App.transfers.renderPlayerIdentity(event.JogadorAfetado, event.Titulo || "Lesão ativa", "injury-player-identity")}
                <b>${App.events.getEventDurationLabel(event)}</b>
              </div>
            `).join("")}
          </div>
        ` : `<p class="calendar-muted">Nenhum jogador lesionado no momento.</p>`}
      </article>
    `;

    const decisionCard = App.auth?.renderCoachDecisionCard ? App.auth.renderCoachDecisionCard(activeTeam.owner) : "";
    const proposalCard = App.auth?.renderCoachTransferProposalCard ? App.auth.renderCoachTransferProposalCard(activeTeam.owner) : "";
    const sponsorshipCard = App.auth?.renderCoachSponsorshipCard ? App.auth.renderCoachSponsorshipCard(activeTeam.owner) : "";
    const pinCard = App.auth?.renderPinChangeCard ? App.auth.renderPinChangeCard(activeTeam.owner) : "";
    const strategyCards = canViewPrivate ? App.players.renderCoachStrategyCards(activeTeam, standing, budget, transfers, injuries, recentForm) : "";
    const privateBoardCard = canViewPrivate ? App.players.renderPrivateBoardObjectives(activeTeam, standing, budget, transfers, recentForm) : "";
    const statementCard = canViewPrivate ? App.players.renderCoachFinancialStatement(activeTeam.owner, budget, breakdown) : "";
    const targetsCard = canViewPrivate ? App.players.renderPrivateTransferTargets(activeTeam.owner) : "";
    const favoritesCard = canViewPrivate ? App.players.renderPrivateFavoritesCard(activeTeam.owner) : "";

    return `
      <section class="coach-dashboard" style="--coach-color:${color}">
        <article class="coach-hero-card">
          <div class="coach-hero-main">
            <div class="coach-club-mark">${App.clubs.getTeamBadgeHtml(activeTeam.team, "coach-crest")}</div>
            <div>
              <span class="modal-kicker">Escritório do técnico</span>
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

        <section class="coach-quick-grid ${canViewPrivate ? "" : "public-only"}">
          <article><span>Campanha</span><strong>${standing?.wins || 0}/${standing?.draws || 0}/${standing?.losses || 0}</strong><small>V/E/D</small></article>
          <article><span>Saldo de gols</span><strong>${App.utils.formatGoalDifference(standing?.goalDifference || 0)}</strong><small>${standing?.goalsFor || 0} pró / ${standing?.goalsAgainst || 0} contra</small></article>
          ${canViewPrivate ? `
            <article><span>Saldo mercado</span><strong>${App.utils.formatCurrency(breakdown.available)}</strong><small>Gasto ${App.utils.formatCurrency(breakdown.spent)}</small></article>
            <article><span>Transfers hoje</span><strong>${todayCount}/${transferLimit}</strong><small>${transfers.length} totais válidas</small></article>
            <article><span>Folha semanal</span><strong>${App.utils.formatCurrency(payrollWeekly)}</strong><small>Estimativa por elenco contratado</small></article>
          ` : ""}
        </section>

        <section class="coach-layout-v54">
          <div class="coach-top-row-v54 ${canViewPrivate ? "" : "public-only"}">
            ${nextMatchCard}
            ${canViewPrivate ? injuriesCard : ""}
          </div>

          ${decisionCard ? `<div class="coach-full-row-v54">${decisionCard}</div>` : ""}
          ${proposalCard ? `<div class="coach-full-row-v54">${proposalCard}</div>` : ""}
          ${sponsorshipCard ? `<div class="coach-full-row-v54">${sponsorshipCard}</div>` : ""}
          ${statementCard}
          ${privateBoardCard}
          ${strategyCards}

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
              ${App.players.renderCoachTransferDeck(visibleTransfers)}
            </article>

            <article class="coach-panel-card coach-event-radar-card">
              <div class="home-panel-header">
                <h2>Radar de ocorrências</h2>
                <span class="coach-section-kicker">${events.length} evento(s)</span>
              </div>
              ${App.players.renderCoachEventDeck(events)}
            </article>

            ${pinCard || ""}
            ${favoritesCard}
            ${targetsCard}
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
    document.querySelectorAll("[data-private-target-form]").forEach(form => {
      if (form.dataset.bound === "true") return;
      form.dataset.bound = "true";
      const searchInput = form.querySelector("[data-private-target-search]");
      let searchTimeout = null;
      searchInput?.addEventListener("input", () => {
        window.clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(() => App.players.renderPrivateTargetSearchResults(form), 220);
      });
      searchInput?.addEventListener("focus", () => App.players.renderPrivateTargetSearchResults(form));
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const card = form.closest("[data-private-target-owner]");
        const owner = card?.dataset.privateTargetOwner || "";
        const payload = {
          player: form.elements.player.value,
          club: form.elements.club.value,
          value: form.elements.value.value,
          priority: form.elements.priority.value,
          note: form.elements.note.value
        };
        App.players.addPrivateTransferTarget(owner, payload);
        if (App.auth?.upsertMyTransferTarget) {
          try {
            const targets = await App.auth.upsertMyTransferTarget(payload);
            App.players.savePrivateTransferTargets(owner, targets);
          } catch (error) {
            console.warn("Não consegui sincronizar alvo privado, mantive no cache local:", error);
          }
        }
        form.reset();
        App.players.render();
      });
    });

    document.querySelectorAll("[data-remove-private-target]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const card = button.closest("[data-private-target-owner]");
        const owner = card?.dataset.privateTargetOwner || "";
        App.players.removePrivateTransferTarget(owner, button.dataset.removePrivateTarget);
        if (App.auth?.deleteMyTransferTarget) {
          try {
            const targets = await App.auth.deleteMyTransferTarget(button.dataset.removePrivateTarget);
            App.players.savePrivateTransferTargets(owner, targets);
          } catch (error) {
            console.warn("Não consegui sincronizar remoção do alvo privado:", error);
          }
        }
        App.players.render();
      });
    });

    document.querySelectorAll("[data-favorite-target]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const key = button.dataset.favoriteTarget;
        const isFavorite = App.auth?.isFavorite?.("transfer_target", key);
        try {
          if (isFavorite) await App.auth.deleteFavorite("transfer_target", key);
          else await App.auth.upsertFavorite({
            type: "transfer_target",
            key,
            title: button.dataset.favoriteTitle || "Alvo privado",
            detail: button.dataset.favoriteDetail || "",
            payload: { source: "private-target" }
          });
        } catch (error) {
          console.warn("Favorito privado indisponível:", error);
        }
        App.players.render();
        App.auth?.renderAll?.();
      });
    });

    document.querySelectorAll("[data-remove-favorite-type]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        try {
          await App.auth.deleteFavorite(button.dataset.removeFavoriteType, button.dataset.removeFavoriteKey);
        } catch (error) {
          console.warn("Não consegui remover favorito:", error);
        }
        App.players.render();
        App.auth?.renderAll?.();
      });
    });
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
      const canViewPrivate = App.auth?.canViewManagerPrivate ? App.auth.canViewManagerPrivate(team.owner) : false;
      return sum + App.players.getCoachAlerts(team, standing, budget, next, todayCount, canViewPrivate).length;
    }, 0);

    summary.innerHTML = `
      ${App.ui.summaryCard("Técnicos", teams.length)}
      ${App.ui.summaryCard("Líder entre técnicos", ranking[0]?.team.owner || "-")}
      ${App.ui.summaryCard("Transferências", totalTransfers)}
      ${App.ui.summaryCard("Alertas ativos", totalAlerts)}
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
    App.auth?.bindTransferProposalButtons?.(grid);
    App.auth?.bindSponsorshipButtons?.(grid);
    App.players.renderLeaderboard(document.getElementById("topScorers"), App.players.getGoalsByHumanTeams(), "gols por time");
    App.players.renderLeaderboard(document.getElementById("topAssists"), App.players.getTopExpensiveTransfers(5), "transferências caras");
  }
};
