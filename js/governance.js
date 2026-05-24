window.App = window.App || {};

App.governance = {
  async loadData() {
    try {
      const session = App.auth?.getSession ? App.auth.getSession() : null;
      const [result, weeklyCloseStatus] = await Promise.all([
        App.api.rpc("app_get_governance_data", {
          p_manager_id: session?.managerId || "",
          p_access_code: session?.accessCode || ""
        }, 30000),
        App.api.rpc("app_get_weekly_close_status", {}, 30000).catch(() => null)
      ]);

      App.state.apiGovernance = result || { auctions: [], medicalActions: [], weeklyReviews: [] };
      App.state.apiWeeklyCloseStatus = weeklyCloseStatus || null;
      return App.state.apiGovernance;
    } catch (error) {
      console.warn("Governança indisponível:", error);
      App.state.apiGovernance = App.state.apiGovernance || { auctions: [], medicalActions: [], weeklyReviews: [] };
      App.state.apiWeeklyCloseStatus = App.state.apiWeeklyCloseStatus || null;
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

  getEconomyRows() {
    if (Array.isArray(App.state.apiFinanceForecast) && App.state.apiFinanceForecast.length) {
      return App.state.apiFinanceForecast.map(item => ({
        buyer: item.manager_name,
        totalBudget: Number(item.total_budget || 0),
        spent: Number(item.spent_total || 0),
        remaining: Number(item.remaining_budget || 0),
        payrollWeekly: Number(item.payroll_weekly || 0),
        projectedMonth: Number(item.payroll_monthly || 0),
        runwayWeeks: item.runway_weeks === null ? null : Number(item.runway_weeks),
        marketEmbargo: Boolean(item.market_embargo),
        salaryDebtActive: Boolean(item.salary_debt_active),
        salaryDebtAmount: Number(item.salary_debt_amount || 0),
        salaryDebtWeeks: Number(item.salary_debt_weeks || 0),
        risk: item.risk || "Saudável",
        burnRate: Number(item.total_budget || 0) > 0
          ? (Number(item.spent_total || 0) + Number(item.payroll_monthly || 0)) / Number(item.total_budget || 1)
          : 0
      })).sort((a, b) => b.burnRate - a.burnRate || a.remaining - b.remaining);
    }

    return App.transfers.getSpendingSummary()
      .map(item => {
        const projectedMonth = item.payrollWeekly * 4;
        const burnRate = item.totalBudget > 0 ? (item.spent + projectedMonth) / item.totalBudget : 0;
        const risk =
          item.remaining < 0 ? "Crítico" :
            burnRate >= .95 ? "Muito alto" :
              burnRate >= .78 ? "Atenção" :
                item.payrollWeekly > 0 && item.runwayWeeks !== null && item.runwayWeeks < 4 ? "Folha curta" :
                  "Saudável";

        return {
          ...item,
          projectedMonth,
          burnRate,
          marketEmbargo: Boolean(item.marketEmbargo || item.salaryDebtActive || item.remaining < 0),
          salaryDebtActive: Boolean(item.salaryDebtActive),
          salaryDebtAmount: Number(item.salaryDebtAmount || (item.remaining < 0 ? Math.abs(item.remaining) : 0)),
          salaryDebtWeeks: Number(item.salaryDebtWeeks || 0),
          risk
        };
      })
      .sort((a, b) => b.burnRate - a.burnRate || a.remaining - b.remaining);
  },

  getPublicRumors() {
    const transfers = App.transfers.getValidTransfers();
    const fairPlay = App.transfers.getFairPlayWatchlist();
    const auctions = App.state.apiGovernance?.auctions || [];
    const rows = [];

    transfers
      .filter(item => Number(item.totalCost || 0) >= 22000000 || Number(item.overall || 0) >= 84)
      .slice(-5)
      .reverse()
      .forEach(item => rows.push({
        tone: "active",
        title: `${item.buyer} mira impacto imediato`,
        detail: `${item.player} chegou por ${App.utils.formatCurrency(item.totalCost)}.`
      }));

    auctions
      .filter(item => item.status === "open")
      .slice(0, 3)
      .forEach(item => rows.push({
        tone: "deadline",
        title: "Disputa pública no mercado",
        detail: `${item.player_name} tem leilão aberto a partir de ${App.utils.formatCurrency(item.opening_value)}.`
      }));

    fairPlay.slice(0, 3).forEach(item => rows.push({
      tone: item.marketEmbargo || item.remaining < 0 ? "critical" : "warn",
      title: `${item.buyer} sob observação financeira`,
      detail: `${item.severity} · saldo ${App.utils.formatCurrency(item.remaining)}.`
    }));

    if (!rows.length) {
      rows.push({
        tone: "calm",
        title: "Mercado sem vazamentos relevantes",
        detail: "Nenhum alvo privado entra neste radar público."
      });
    }

    return rows.slice(0, 8);
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
        severity: item.marketEmbargo || item.remaining < 0 ? "critical" : "warn",
        title: `Fair play: ${item.buyer}`,
        detail: `${item.severity} · saldo ${App.utils.formatCurrency(item.remaining)} · folha ${App.utils.formatCurrency(item.payrollWeekly || 0)}/sem.`
      });
    });

    const avatarCache = App.data?.marketPlayerAvatars || null;
    const avatarTotal = avatarCache ? Object.keys(avatarCache).length : 0;
    if (avatarCache && avatarTotal < 20000) {
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
        ${canAct ? `
          <div class="commissioner-actions audit-actions">
            <button type="button" data-audit-action="process_sponsorships">Reprocessar patrocínios</button>
            <button type="button" data-audit-action="refresh_finance">Atualizar previsão financeira</button>
            <button type="button" data-audit-action="expire_completed_sponsorships">Encerrar contratos completos</button>
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

  renderEconomyControl() {
    const rows = App.governance.getEconomyRows();
    return `
      <article class="commissioner-card commissioner-economy-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Orçamento e folha</span>
            <h2>Controle financeiro</h2>
          </div>
          <span class="coach-section-kicker">${rows.filter(item => item.risk !== "Saudável").length} alerta(s)</span>
        </div>
        <div class="commissioner-list economy-list">
          ${rows.map(item => `
            <div class="economy-row ${App.utils.normalizeText(item.risk).replace(/\s+/g, "-")}">
              <strong>${App.utils.escapeHtml(item.buyer)} · ${App.utils.escapeHtml(item.risk)}</strong>
              <span>Saldo ${App.utils.formatCurrency(item.remaining)} · folha ${App.utils.formatCurrency(item.payrollWeekly)}/sem · mês projetado ${App.utils.formatCurrency(item.projectedMonth)}${item.marketEmbargo ? ` · embargo ativo${item.salaryDebtAmount ? ` (${App.utils.formatCurrency(item.salaryDebtAmount)})` : ""}` : ""}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  },

  renderRumorDesk() {
    const rows = App.governance.getPublicRumors();
    return `
      <article class="commissioner-card commissioner-rumor-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Boatos públicos</span>
            <h2>Central de rumores</h2>
          </div>
          <span class="coach-section-kicker">Sem alvos privados</span>
        </div>
        <div class="league-radar-list">
          ${rows.map(item => `
            <div class="league-radar-item ${App.utils.escapeHtml(item.tone || "info")}">
              <strong>${App.utils.escapeHtml(item.title)}</strong>
              <span>${App.utils.escapeHtml(item.detail)}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  },

  renderTransferReversal() {
    const canAct = App.auth?.isCommissioner?.();
    const rows = (App.state.apiTransfers || [])
      .filter((item) => App.transfers.isApprovedTransferStatus(item.Status || item.status))
      .slice()
      .sort((a, b) => {
        const buyerA = App.utils.normalizeText(a.Comprador || a.buyer || "");
        const buyerB = App.utils.normalizeText(b.Comprador || b.buyer || "");
        if (buyerA !== buyerB) return buyerA.localeCompare(buyerB);
        return new Date(b.Timestamp || b.created_at || 0) - new Date(a.Timestamp || a.created_at || 0);
      });
    const ownerOrder = App.utils.getHumanBuyers();
    const groupedRows = rows.reduce((groups, item) => {
      const buyer = item.Comprador || item.buyer || "Sem técnico";
      groups[buyer] = groups[buyer] || [];
      groups[buyer].push(item);
      return groups;
    }, {});
    const groupNames = [
      ...ownerOrder.filter(owner => groupedRows[owner]),
      ...Object.keys(groupedRows).filter(owner => !ownerOrder.includes(owner)).sort()
    ];

    return `
      <article class="commissioner-card commissioner-transfer-reversal-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Correções de mercado</span>
            <h2>Desfazer transferência</h2>
          </div>
          <span class="coach-section-kicker">${rows.length} disponível(is)</span>
        </div>
        ${canAct && rows.length ? `
          <form class="commissioner-transfer-reversal-form" data-reverse-transfer-form>
            <select name="transfer" required>
              <option value="">Selecione uma transferência</option>
              ${groupNames.map(groupName => `
                <optgroup label="${App.utils.escapeHtml(groupName)}">
                  ${groupedRows[groupName].map((item, index) => {
                    const transferId = item.id || item.Id || item.ID || "";
                    const timestamp = item.Timestamp || item.created_at || "";
                    const player = item.Jogador || item.player || "-";
                    const fromClub = item.ClubeOrigem || item.fromClub || "";
                    const fromClubLabel = fromClub || "Clube não informado";
                    const value = Number(item.ValorFinal || item.ValorTransfermarkt || 0);
                    return `<option
                      value="${App.utils.escapeHtml(`${groupName}-${index}`)}"
                      data-transfer-id="${App.utils.escapeHtml(String(transferId))}"
                      data-transfer-buyer="${App.utils.escapeHtml(groupName)}"
                      data-transfer-player="${App.utils.escapeHtml(player)}"
                      data-transfer-from="${App.utils.escapeHtml(fromClub)}"
                      data-transfer-timestamp="${App.utils.escapeHtml(String(timestamp))}">
                      ${App.utils.escapeHtml(`${player} · ${fromClubLabel} · ${App.utils.formatCurrency(value)}`)}
                    </option>`;
                  }).join("")}
                </optgroup>
              `).join("")}
            </select>
            <button class="secondary-button danger" type="submit">Desfazer</button>
          </form>
          <p class="calendar-muted">Ordenado por técnico. Escolha qualquer transferência aprovada sem abrir uma lista enorme no painel.</p>
        ` : rows.length ? `<p class="calendar-muted">Faça login como Comissário da Liga para desfazer transferências.</p>` : `<p class="calendar-muted">Nenhuma transferência aprovada para desfazer.</p>`}
      </article>
    `;
  },

  renderCpuTransferOffers() {
    const canAct = App.auth?.isCommissioner?.();
    const owners = App.utils.getHumanBuyers();

    return `
      <article class="commissioner-card commissioner-cpu-offers-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Mercado ativo</span>
            <h2>Propostas externas</h2>
          </div>
          <span class="coach-section-kicker">Clubes x Técnico</span>
        </div>
        <p class="calendar-muted">Gere ofertas automáticas de clubes reais por jogadores dos técnicos. O técnico recebe no painel privado e decide aceitar ou recusar.</p>
        ${canAct ? `
          <form class="commissioner-inline-form" data-cpu-transfer-offers-form>
            <select name="targetManager">
              <option value="">Todos os técnicos</option>
              ${owners.map(owner => `<option value="${App.utils.escapeHtml(owner)}">${App.utils.escapeHtml(owner)}</option>`).join("")}
            </select>
            <input name="count" type="number" min="1" max="12" value="4" aria-label="Quantidade de propostas" />
            <button class="secondary-button success" type="submit">Gerar propostas</button>
          </form>
        ` : `<p class="calendar-muted">Faça login como Comissário da Liga para gerar propostas externas.</p>`}
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
          <button class="secondary-button success" type="submit">Abrir leilão</button>
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
    const closeStatus = App.state.apiWeeklyCloseStatus || {};
    const lastClosure = closeStatus.lastClosure || {};
    const lastClosureLabel = lastClosure.closed_at
      ? `${App.utils.escapeHtml(lastClosure.period_key || "")} · ${App.utils.formatDateTime(lastClosure.closed_at)} · ${App.utils.escapeHtml(lastClosure.source || "")}`
      : "Nenhum fechamento automático registrado ainda.";
    const canAct = App.auth?.isCommissioner?.();

    return `
      <article class="commissioner-card" id="commissionerWeekly">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Fechamento semanal</span>
            <h2>Objetivos, folha e fair play</h2>
          </div>
          ${canAct ? `<button class="secondary-button" type="button" data-close-weekly-review>Fechar semana + folha</button>` : ""}
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
          <strong>Automação</strong>
          <span>${closeStatus.automatic ? `Ativa · ${App.utils.escapeHtml(closeStatus.scheduledLabel || "Domingo, 23:00 (BRT)")}` : "Inativa"}</span>
          <span>Último fechamento: ${lastClosureLabel}</span>
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
          const result = await App.governance.runAction("app_close_weekly_review", {
            p_snapshot: JSON.stringify(App.governance.getWeeklyObjectiveRows())
          });
          const payroll = result?.payroll || null;
          const payrollMessage = payroll
            ? ` ${Number(payroll.charged || 0)} folha(s), ${Number(payroll.debts || 0)} dívida(s), ${Number(payroll.penalties || 0)} multa(s).`
            : "";
          App.utils.setMessage(message, `Fechamento semanal registrado.${payrollMessage}`, "success");
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        }
      });
    }

    root.querySelectorAll("[data-audit-action]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const session = App.auth?.getSession?.();
        if (!session) return;
        try {
          button.disabled = true;
          const result = await App.api.rpc("app_run_audit_action", {
            p_manager_id: session.managerId,
            p_access_code: session.accessCode,
            p_action: button.dataset.auditAction,
            p_payload: {}
          }, 45000);
          if (result?.ok === false) throw new Error(result.message || "Ação recusada.");
          await App.api.loadFinanceRulesAndForecast?.();
          await App.api.loadApiData({ showLoader: false });
          App.utils.setMessage(message, result.message || "Auditoria executada.", "success");
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        } finally {
          button.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-reverse-transfer-form]").forEach(form => {
      if (form.dataset.bound === "true") return;
      form.dataset.bound = "true";
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const select = form.elements.transfer;
        const option = select?.selectedOptions?.[0];
        if (!option?.value) return;

        const player = option.dataset.transferPlayer || "jogador";
        const buyer = option.dataset.transferBuyer || "comprador";
        if (!window.confirm(`Desfazer a transferência de ${player} para ${buyer}?`)) return;

        const button = form.querySelector("button");
        const originalText = button?.textContent || "Desfazer";

        try {
          if (button) {
            button.disabled = true;
            button.textContent = "Desfazendo...";
          }
          App.utils.setMessage(message, `Desfazendo transferência de ${player}...`, "warning");
          App.main?.showLoader?.({
            variant: "market",
            title: "Desfazendo transferência",
            message: "Atualizando mercado, orçamento e posse do jogador."
          });
          const result = await App.api.postToApi({
            action: "reverseTransfer",
            transferId: option.dataset.transferId,
            buyer,
            player,
            fromClub: option.dataset.transferFrom || "",
            timestamp: option.dataset.transferTimestamp || ""
          });
          if (result?.ok === false) throw new Error(result.message || "Transferência não foi desfeita.");
          await App.api.loadApiData({
            variant: "market",
            title: "Atualizando mercado",
            message: "Transferência desfeita. Recalculando orçamento, elenco e radar."
          });
          App.utils.setMessage(message, result.message || "Transferência desfeita.", "success");
          if (select) select.value = "";
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        } finally {
          App.main?.hideLoader?.();
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
        }
      });
    });

    root.querySelectorAll("[data-cpu-transfer-offers-form]").forEach(form => {
      if (form.dataset.bound === "true") return;
      form.dataset.bound = "true";
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(form).entries());
        const button = form.querySelector("button");
        const originalText = button?.textContent || "Gerar propostas";

        try {
          if (button) {
            button.disabled = true;
            button.textContent = "Gerando...";
          }
          const result = await App.governance.runAction("app_generate_cpu_transfer_proposals", {
            p_count: Number(payload.count || 4),
            p_target_manager: payload.targetManager || ""
          });
          await App.auth?.loadMyTransferProposals?.();
          App.utils.setMessage(message, result.message || "Propostas externas geradas.", "success");
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
        }
      });
    });
  },

  render() {
    App.governance.renderSummary();
    const target = document.getElementById("commissionerGrid");
    if (!target) return;

    target.innerHTML = `
      ${App.governance.renderIntegrityAudit()}
      ${App.governance.renderLeagueRadar()}
      ${App.governance.renderEconomyControl()}
      ${App.governance.renderRumorDesk()}
      ${App.governance.renderTransferReversal()}
      ${App.governance.renderCpuTransferOffers()}
      ${App.governance.renderAuctions()}
      ${App.governance.renderMedical()}
      ${App.governance.renderWeekly()}
      ${App.governance.renderReputation()}
    `;

    App.governance.bindActions(target);
  }
};
