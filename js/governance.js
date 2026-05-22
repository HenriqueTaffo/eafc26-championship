window.App = window.App || {};

App.governance = {
  async loadData() {
    try {
      const session = App.auth?.getSession ? App.auth.getSession() : null;
      const result = await App.api.rpc("app_get_governance_data", {
        p_manager_id: session?.managerId || "",
        p_access_code: session?.accessCode || ""
      }, 30000);

      App.state.apiGovernance = result || { auctions: [], medicalActions: [], weeklyReviews: [] };
      return App.state.apiGovernance;
    } catch (error) {
      console.warn("Governança indisponível:", error);
      App.state.apiGovernance = App.state.apiGovernance || { auctions: [], medicalActions: [], weeklyReviews: [] };
      return App.state.apiGovernance;
    }
  },

  getMarketPhase() {
    const hour = new Date().getHours();
    if (hour < 9) return { name: "Mercado fechado", detail: "Apenas propostas internas e planejamento.", tone: "closed" };
    if (hour < 13) return { name: "Mercado calmo", detail: "Bom momento para consultas e ajustes finos.", tone: "calm" };
    if (hour < 18) return { name: "Janela ativa", detail: "Compras, leilões e negociações liberadas.", tone: "active" };
    if (hour < 21) return { name: "Deadline day", detail: "Negociações pesadas entram no radar de leilão.", tone: "deadline" };
    return { name: "Mercado fechado", detail: "Use a noite para revisar orçamento e propostas.", tone: "closed" };
  },

  getActiveInjuries() {
    return (App.state.apiEvents || [])
      .filter(event => String(event.JogadorAfetado || "").trim())
      .filter(event => App.events.isActiveOrDurationEvent(event))
      .sort((a, b) => App.events.getEventDateTime(b) - App.events.getEventDateTime(a));
  },

  getRivalries() {
    const standings = App.standings.getStandings().filter(row => row.status === "Nosso");
    return standings.map(team => {
      const nearest = standings
        .filter(other => other.owner !== team.owner)
        .sort((a, b) => Math.abs((a.points || 0) - (team.points || 0)) - Math.abs((b.points || 0) - (team.points || 0)))[0];

      return {
        owner: team.owner,
        team: team.team,
        rival: nearest?.owner || "-",
        gap: nearest ? Math.abs((nearest.points || 0) - (team.points || 0)) : 0
      };
    });
  },

  getReputationRows() {
    const transfers = App.transfers.getValidTransfers();
    const proposals = App.auth?.myTransferProposals || [];
    return App.utils.getHumanBuyers().map(owner => {
      const bought = transfers.filter(item => App.utils.normalizeText(item.buyer) === App.utils.normalizeText(owner));
      const spent = bought.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
      const sent = proposals.filter(item => App.utils.normalizeText(item.buyer) === App.utils.normalizeText(owner));
      const sold = proposals.filter(item => App.utils.normalizeText(item.seller) === App.utils.normalizeText(owner) && item.status === "accepted");
      const avg = bought.length ? spent / bought.length : 0;
      const tag = spent > 90000000 ? "Gastador" : sold.length >= 2 ? "Bom vendedor" : sent.length >= 3 ? "Negociador ativo" : avg < 12000000 && bought.length ? "Conservador" : "Estável";

      return { owner, bought: bought.length, spent, sent: sent.length, sold: sold.length, tag };
    });
  },

  getWeeklyObjectiveRows() {
    const standings = App.standings.getStandings();
    const budgets = App.transfers.getBudgetInfoByBuyer();
    return App.data.teams
      .filter(team => team.status === "Nosso")
      .map(team => {
        const standing = standings.find(row => App.utils.sameTeamName(row.team, team.team));
        const transfers = App.players.getApprovedTransfersForBuyer(team.owner);
        const objectives = App.players.getCoachObjectives(team, standing, budgets[team.owner] || {}, transfers);
        const ok = objectives.filter(item => item.status === "ok").length;
        const verdict = ok >= 3 ? "Bônus sugerido" : ok >= 2 ? "Neutro" : "Pressão da diretoria";
        const managerId = App.utils.normalizeText(team.owner).replace(/\s+/g, "-");
        return { managerId, owner: team.owner, team: team.team, ok, total: objectives.length, verdict };
      });
  },

  getEventKey(event = {}) {
    return [
      App.utils.normalizeText(event.competition),
      App.cups?.normalizeCupPhase ? App.cups.normalizeCupPhase(event.phase || "") : App.utils.normalizeText(event.phase),
      App.utils.normalizeTeamName(event.home),
      App.utils.normalizeTeamName(event.away)
    ].join("|");
  },

  isSameCompetition(left = "", right = "") {
    return App.utils.normalizeText(left) === App.utils.normalizeText(right);
  },

  findDbMatchForEvent(event, dbEvents = []) {
    return dbEvents.find(dbEvent =>
      App.governance.isSameCompetition(event.competition, dbEvent.competition) &&
      (
        App.utils.normalizeText(event.phase) === App.utils.normalizeText(dbEvent.phase) ||
        App.cups?.cupPhasesAreCompatible?.(event.phase, dbEvent.phase)
      ) &&
      App.cups?.sameCupTeams?.(event.home, event.away, dbEvent.home, dbEvent.away)
    ) || null;
  },

  getIntegrityAudit() {
    const dbEvents = App.api.getDbMatchEvents ? App.api.getDbMatchEvents() : [];
    const cupEvents = App.cups?.getCupEvents ? App.cups.getCupEvents().filter(event => event.competition !== "Championship") : [];
    const approvedResults = App.standings.getApprovedApiResults ? App.standings.getApprovedApiResults() : [];
    const issues = [];

    const missingCupMatches = cupEvents
      .filter(event => App.api.isPlayablePendingMatch?.(event))
      .filter(event => !App.governance.findDbMatchForEvent(event, dbEvents));

    missingCupMatches.forEach(event => {
      issues.push({
        severity: "critical",
        title: "Copa fora da simulação",
        detail: `${event.competition} · ${event.phase} · ${event.home} x ${event.away} não existe em matches.`
      });
    });

    const resultGroups = approvedResults
      .filter(row => App.utils.normalizeText(row.Competicao) !== "championship")
      .reduce((acc, row) => {
        const key = [
          App.utils.normalizeText(row.Competicao),
          App.cups?.normalizeCupPhase ? App.cups.normalizeCupPhase(row.RodadaFase || "") : App.utils.normalizeText(row.RodadaFase),
          [App.utils.normalizeTeamName(row.Mandante), App.utils.normalizeTeamName(row.Visitante)].sort().join("~")
        ].join("|");
        acc[key] = acc[key] || [];
        acc[key].push(row);
        return acc;
      }, {});

    Object.values(resultGroups).filter(group => group.length > 1).forEach(group => {
      const first = group[0];
      issues.push({
        severity: "warn",
        title: "Resultado de copa duplicado",
        detail: `${first.Competicao} · ${first.RodadaFase} · ${first.Mandante} x ${first.Visitante} aparece ${group.length} vezes.`
      });
    });

    App.transfers.getFairPlayWatchlist().forEach(item => {
      issues.push({
        severity: item.remaining < 0 ? "critical" : "warn",
        title: `Fair play: ${item.buyer}`,
        detail: `${item.severity} · saldo ${App.utils.formatCurrency(item.remaining)} · folha ${App.utils.formatCurrency(item.payrollWeekly || 0)}/sem.`
      });
    });

    const avatarTotal = Object.keys(App.data?.marketPlayerAvatars || {}).length;
    if (avatarTotal < 20000) {
      issues.push({
        severity: "info",
        title: "Fotos do mercado",
        detail: `${avatarTotal} fotos em cache. Rode sync:market-avatar-cache periodicamente.`
      });
    }

    return {
      issues,
      missingCupMatches,
      score: Math.max(0, 100 - issues.filter(item => item.severity === "critical").length * 25 - issues.filter(item => item.severity === "warn").length * 10)
    };
  },

  getLeagueRadarItems() {
    const audit = App.governance.getIntegrityAudit();
    const phase = App.governance.getMarketPhase();
    const auctions = App.state.apiGovernance?.auctions || [];
    const injuries = App.governance.getActiveInjuries();
    const targets = App.auth?.myTransferTargets || [];

    return [
      { tone: phase.tone, title: phase.name, detail: phase.detail },
      ...audit.issues.slice(0, 4).map(issue => ({ tone: issue.severity, title: issue.title, detail: issue.detail })),
      ...auctions.filter(item => item.status === "open").slice(0, 2).map(item => ({ tone: "deadline", title: "Leilão aberto", detail: `${item.player_name} · ${App.utils.formatCurrency(item.opening_value)}` })),
      ...(injuries.length ? [{ tone: "warn", title: "DM movimentado", detail: `${injuries.length} lesão(ões) ativa(s) na liga.` }] : []),
      ...(targets.length ? [{ tone: "calm", title: "Shortlist privada", detail: `${targets.length} alvo(s) no seu radar privado.` }] : [])
    ];
  },

  async runAction(action, payload = {}) {
    const session = App.auth?.getSession ? App.auth.getSession() : null;
    if (!session) throw new Error("Faça login como técnico antes de usar a mesa do comissário.");
    if (!App.auth?.isCommissioner?.()) throw new Error("Apenas o Comissário da Liga pode executar esta ação.");

    const rpcPayload = {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      ...payload
    };

    const result = await App.api.rpc(action, rpcPayload, 45000);
    if (result?.ok === false) throw new Error(result.message || "Ação recusada pelo Supabase.");

    await App.api.loadApiData({
      variant: "chaos",
      title: "Atualizando governança",
      message: "Aplicando ação especial, sincronizando eventos, mercado e painéis."
    });

    return result;
  },

  renderSummary() {
    const target = document.getElementById("commissionerSummary");
    if (!target) return;

    const phase = App.governance.getMarketPhase();
    const injuries = App.governance.getActiveInjuries();
    const auctions = App.state.apiGovernance?.auctions || [];
    const fairPlay = App.transfers.getFairPlayWatchlist();
    const audit = App.governance.getIntegrityAudit();

    target.innerHTML = `
      ${App.ui.summaryCard("Fase do mercado", phase.name, phase.detail)}
      ${App.ui.summaryCard("Lesões ativas", injuries.length)}
      ${App.ui.summaryCard("Leilões abertos", auctions.filter(item => item.status === "open").length)}
      ${App.ui.summaryCard("Fair play", fairPlay.length ? `${fairPlay.length} alerta(s)` : "OK")}
      ${App.ui.summaryCard("Integridade", `${audit.score}%`, audit.issues.length ? `${audit.issues.length} ponto(s) para revisar` : "Liga sincronizada")}
    `;
  },

  renderIntegrityAudit() {
    const audit = App.governance.getIntegrityAudit();
    const canAct = App.auth?.isCommissioner?.();

    return `
      <article class="commissioner-card commissioner-integrity-card" id="commissionerIntegrity">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Auditoria automática</span>
            <h2>Saúde da liga</h2>
          </div>
          <span class="coach-section-kicker">${audit.score}% íntegra</span>
        </div>
        <div class="commissioner-list integrity-list">
          ${audit.issues.length ? audit.issues.slice(0, 8).map(issue => `
            <div class="integrity-row ${issue.severity}">
              <strong>${App.utils.escapeHtml(issue.title)}</strong>
              <span>${App.utils.escapeHtml(issue.detail)}</span>
            </div>
          `).join("") : `<p class="calendar-muted">Nenhuma inconsistência crítica detectada.</p>`}
        </div>
        ${audit.missingCupMatches.length && canAct ? `
          <div class="commissioner-sublist">
            <strong>Correção sugerida</strong>
            <span>Use as migrações de seed/geração de copa para gravar essas partidas em public.matches antes de simular.</span>
          </div>
        ` : ""}
      </article>
    `;
  },

  renderLeagueRadar() {
    const items = App.governance.getLeagueRadarItems();

    return `
      <article class="commissioner-card commissioner-radar-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Central operacional</span>
            <h2>Radar da liga</h2>
          </div>
        </div>
        <div class="league-radar-list">
          ${items.map(item => `
            <div class="league-radar-item ${App.utils.escapeHtml(item.tone || "info")}">
              <strong>${App.utils.escapeHtml(item.title)}</strong>
              <span>${App.utils.escapeHtml(item.detail)}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  },

  renderAuctions() {
    const auctions = App.state.apiGovernance?.auctions || [];
    const candidates = App.transfers.getAuctionCandidates();
    const canAct = App.auth?.isCommissioner?.();

    return `
      <article class="commissioner-card" id="commissionerAuctions">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Mercado por fases</span>
            <h2>Leilões e compras pesadas</h2>
          </div>
          <span class="coach-section-kicker">${App.governance.getMarketPhase().name}</span>
        </div>
        <p class="calendar-muted">${App.governance.getMarketPhase().detail}</p>
        ${canAct ? `<form class="commissioner-inline-form" data-governance-auction>
          <input name="player" type="text" placeholder="Jogador do leilão" required />
          <input name="overall" type="number" min="1" max="99" placeholder="OVR" required />
          <input name="value" type="number" min="1" placeholder="Lance inicial" required />
          <button type="submit">Abrir leilão</button>
        </form>` : `<p class="calendar-muted">Faça login como Comissário da Liga para abrir leilões.</p>`}
        <div class="commissioner-list">
          ${auctions.length ? auctions.slice(0, 6).map(item => `
            <div>
              <strong>${App.utils.escapeHtml(item.player_name)}</strong>
              <span>${App.utils.formatCurrency(item.opening_value)} · ${App.utils.escapeHtml(item.status)} · expira ${App.utils.formatDateTime(item.expires_at)}</span>
            </div>
          `).join("") : `<p class="calendar-muted">Nenhum leilão registrado ainda.</p>`}
        </div>
        <div class="commissioner-sublist">
          <strong>Radar automático</strong>
          ${candidates.length ? candidates.map(item => `<span>${App.utils.escapeHtml(item.player)} · ${App.utils.formatCurrency(item.totalCost)}</span>`).join("") : `<span>Nenhuma compra pesada aprovada.</span>`}
        </div>
      </article>
    `;
  },

  renderMedical() {
    const injuries = App.governance.getActiveInjuries();
    const canAct = App.auth?.isCommissioner?.();

    return `
      <article class="commissioner-card" id="commissionerMedical">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Centro médico</span>
            <h2>Tratamento de lesões</h2>
          </div>
          <span class="coach-section-kicker">${injuries.length} ativa(s)</span>
        </div>
        <div class="commissioner-list medical-list">
          ${injuries.length ? injuries.map(event => `
            <div>
              <strong>${App.utils.escapeHtml(event.JogadorAfetado)} · ${App.utils.escapeHtml(event.Jogador)}</strong>
              <span>${App.utils.escapeHtml(event.Titulo || "Lesão")} · ${App.events.getEventDurationLabel(event)}</span>
              ${canAct ? `<div class="commissioner-actions">
                <button type="button" data-medical-action="intensive" data-event-id="${App.utils.escapeHtml(event.Id || event.id || "")}" data-event-key="${App.utils.escapeHtml(event.ChaveUnica || "")}" data-event-owner="${App.utils.escapeHtml(event.Jogador || "")}" data-event-player="${App.utils.escapeHtml(event.JogadorAfetado || "")}">Tratamento intensivo</button>
                <button type="button" data-medical-action="force_return" data-event-id="${App.utils.escapeHtml(event.Id || event.id || "")}" data-event-key="${App.utils.escapeHtml(event.ChaveUnica || "")}" data-event-owner="${App.utils.escapeHtml(event.Jogador || "")}" data-event-player="${App.utils.escapeHtml(event.JogadorAfetado || "")}">Forçar retorno</button>
              </div>` : ""}
            </div>
          `).join("") : `<p class="calendar-muted">Nenhuma lesão ativa para tratar.</p>`}
        </div>
        ${canAct ? `<button class="secondary-button" type="button" data-commissioner-clear-injuries>Mutirão do DM</button>` : `<p class="calendar-muted">Faça login como Comissário da Liga para aplicar ações médicas.</p>`}
      </article>
    `;
  },

  renderWeekly() {
    const rows = App.governance.getWeeklyObjectiveRows();
    const reviews = App.state.apiGovernance?.weeklyReviews || [];
    const canAct = App.auth?.isCommissioner?.();

    return `
      <article class="commissioner-card" id="commissionerWeekly">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Fechamento semanal</span>
            <h2>Objetivos e diretoria</h2>
          </div>
          ${canAct ? `<button class="secondary-button" type="button" data-close-weekly-review>Fechar semana</button>` : ""}
        </div>
        <div class="commissioner-list">
          ${rows.map(item => `
            <div>
              <strong>${App.utils.escapeHtml(item.owner)} · ${item.ok}/${item.total}</strong>
              <span>${App.utils.escapeHtml(item.team)} · ${App.utils.escapeHtml(item.verdict)}</span>
            </div>
          `).join("")}
        </div>
        <div class="commissioner-sublist">
          <strong>Fechamentos recentes</strong>
          ${reviews.length ? reviews.slice(0, 5).map(item => `<span>${App.utils.escapeHtml(item.manager_name)} · ${item.objectives_met}/${item.objectives_total} · ${App.utils.escapeHtml(item.verdict)}</span>`).join("") : `<span>Nenhum fechamento registrado.</span>`}
        </div>
      </article>
    `;
  },

  renderReputation() {
    const reputations = App.governance.getReputationRows();
    const rivalries = App.governance.getRivalries();

    return `
      <article class="commissioner-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Narrativa</span>
            <h2>Reputação e rivalidades</h2>
          </div>
        </div>
        <div class="commissioner-split-list">
          <div>
            <strong>Reputação</strong>
            ${reputations.map(item => `<span>${App.utils.escapeHtml(item.owner)} · ${App.utils.escapeHtml(item.tag)} · ${App.utils.formatCurrency(item.spent)}</span>`).join("")}
          </div>
          <div>
            <strong>Rivalidades</strong>
            ${rivalries.map(item => `<span>${App.utils.escapeHtml(item.owner)} x ${App.utils.escapeHtml(item.rival)} · ${item.gap} pts</span>`).join("")}
          </div>
        </div>
      </article>
    `;
  },

  bindActions(root = document) {
    const message = document.getElementById("commissionerMessage");

    root.querySelectorAll("[data-governance-auction]").forEach(form => {
      if (form.dataset.bound === "true") return;
      form.dataset.bound = "true";
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
          await App.governance.runAction("app_open_auction_intent", {
            p_player_name: payload.player,
            p_overall: Number(payload.overall),
            p_opening_value: Number(payload.value)
          });
          form.reset();
          App.utils.setMessage(message, "Leilão aberto.", "success");
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        }
      });
    });

    root.querySelectorAll("[data-medical-action]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        try {
          await App.governance.runAction("app_apply_medical_action", {
            p_event_id: Number(button.dataset.eventId || 0),
            p_event_key: button.dataset.eventKey || "",
            p_event_owner: button.dataset.eventOwner || "",
            p_player_name: button.dataset.eventPlayer || "",
            p_action_type: button.dataset.medicalAction
          });
          App.utils.setMessage(message, "Ação médica aplicada.", "success");
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        }
      });
    });

    const clearButton = root.querySelector("[data-commissioner-clear-injuries]");
    if (clearButton && clearButton.dataset.bound !== "true") {
      clearButton.dataset.bound = "true";
      clearButton.addEventListener("click", async () => {
        try {
          await App.governance.runAction("app_commissioner_clear_injuries");
          App.utils.setMessage(message, "Mutirão do DM aplicado.", "success");
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        }
      });
    }

    const weeklyButton = root.querySelector("[data-close-weekly-review]");
    if (weeklyButton && weeklyButton.dataset.bound !== "true") {
      weeklyButton.dataset.bound = "true";
      weeklyButton.addEventListener("click", async () => {
        try {
          await App.governance.runAction("app_close_weekly_review", {
            p_snapshot: JSON.stringify(App.governance.getWeeklyObjectiveRows())
          });
          App.utils.setMessage(message, "Fechamento semanal registrado.", "success");
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        }
      });
    }
  },

  render() {
    App.governance.renderSummary();
    const target = document.getElementById("commissionerGrid");
    if (!target) return;

    target.innerHTML = `
      ${App.governance.renderIntegrityAudit()}
      ${App.governance.renderLeagueRadar()}
      ${App.governance.renderAuctions()}
      ${App.governance.renderMedical()}
      ${App.governance.renderWeekly()}
      ${App.governance.renderReputation()}
    `;

    App.governance.bindActions(target);
  }
};
