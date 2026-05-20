window.App = window.App || {};

App.transfers = {
  getTransferRate(overall) {
    if (overall >= 89) return 0.25;
    if (overall >= 84) return 0.20;
    if (overall >= 80) return 0.15;
    if (overall >= 75) return 0.05;
    return 0;
  },

  getAllTransfers() {
    const approvedApiTransfers = App.state.apiTransfers
      .filter(row => App.utils.normalizeText(row.Status) === "aprovado")
      .map((row, index) => ({
        player: row.Jogador,
        buyer: row.Comprador,
        fromClub: row.ClubeOrigem,
        overall: Number(row.Overall),
        marketValue: Number(row.ValorTransfermarkt),
        timestamp: row.Timestamp,
        sourceIndex: index
      }));

    const staticTransfers = App.data.transfers.map((transfer, index) => ({
      ...transfer,
      timestamp: transfer.timestamp || "",
      sourceIndex: index
    }));

    return [...staticTransfers, ...approvedApiTransfers];
  },

  getEventImpactByBuyer() {
    const impact = App.utils.getHumanBuyers().reduce((acc, buyer) => {
      acc[buyer] = { positive: 0, negative: 0, total: 0, events: 0, transferModifier: 0, activeInjuries: 0 };
      return acc;
    }, {});

    const todayText = new Date().toLocaleDateString("pt-BR");

    App.state.apiEvents
      .filter(event => ["aplicado", "ativo", "gerado"].includes(App.utils.normalizeText(event.Status)))
      .forEach(event => {
        const owner = event.Jogador;
        if (!impact[owner]) return;

        const value = Number(event.ImpactoFinanceiro || 0);
        const transferModifier = Number(event.ModificadorTransferencias || 0);
        const eventTimestamp = new Date(event.Timestamp || 0);
        const isTodayEvent = String(event.Data || "") === todayText || (!Number.isNaN(eventTimestamp.getTime()) && eventTimestamp.toLocaleDateString("pt-BR") === todayText);

        impact[owner].events += 1;
        impact[owner].total += value;
        if (isTodayEvent) impact[owner].transferModifier += Number.isNaN(transferModifier) ? 0 : transferModifier;
        if (value >= 0) impact[owner].positive += value;
        else impact[owner].negative += value;

        const durationType = App.utils.normalizeText(event.DuracaoTipo || "");
        const affectedPlayer = String(event.JogadorAfetado || "").trim();
        const remainingMatches = Number(event.PartidasRestantes || event.DuracaoValor || 0);
        const expiresAt = event.ExpiraEm ? new Date(event.ExpiraEm) : null;
        const stillTimeActive = expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date();
        const stillMatchActive = durationType.includes("partida") && remainingMatches > 0;

        if (affectedPlayer && (stillTimeActive || stillMatchActive)) impact[owner].activeInjuries += 1;
      });

    return impact;
  },

  getTransferLimitForBuyer(buyer) {
    const supabaseBudget = App.state.apiBudgets?.[buyer];
    if (supabaseBudget?.transferLimit !== undefined) return Number(supabaseBudget.transferLimit);

    const impact = App.transfers.getEventImpactByBuyer();
    const modifier = impact[buyer]?.transferModifier || 0;
    return Math.max(0, Math.min(5, App.config.baseDailyTransferLimit + modifier));
  },

  getBudgetInfoByBuyer() {
    const buyers = App.utils.getHumanBuyers();
    const info = buyers.reduce((acc, buyer) => {
      const supabaseBudget = App.state.apiBudgets?.[buyer] || {};

      acc[buyer] = {
        buyer,
        baseBudget: Number(supabaseBudget.baseBudget ?? App.config.transferBudget),
        homeMatches: Number(supabaseBudget.homeMatches ?? 0),
        wins: Number(supabaseBudget.wins ?? 0),
        homeBonus: Number(supabaseBudget.homeBonus ?? 0),
        winBonusValue: Number(supabaseBudget.winBonusValue ?? supabaseBudget.winBonus ?? 0),
        eventBonus: Number(supabaseBudget.eventBonus ?? 0),
        eventPenalty: 0,
        eventTotal: Number(supabaseBudget.eventTotal ?? 0),
        eventCount: Number(supabaseBudget.eventCount ?? 0),
        transferModifier: Number(supabaseBudget.transferModifier ?? 0),
        transferLimit: Number(supabaseBudget.transferLimit ?? App.config.baseDailyTransferLimit),
        activeInjuries: Number(supabaseBudget.activeInjuries ?? 0),
        totalBudget: Number(supabaseBudget.totalBudget ?? App.config.transferBudget),
        spentTotal: Number(supabaseBudget.spentTotal ?? 0),
        remainingBudget: Number(supabaseBudget.remainingBudget ?? App.config.transferBudget),
        transfersToday: Number(supabaseBudget.transfersToday ?? 0)
      };
      return acc;
    }, {});

    if (Object.keys(App.state.apiBudgets || {}).length) {
      return info;
    }

    App.standings.getApprovedApiResults()
      .filter(result => App.utils.normalizeText(result.Competicao) === "championship")
      .forEach(result => {
        const homeTeam = App.utils.getTeamByName(result.Mandante);
        const awayTeam = App.utils.getTeamByName(result.Visitante);
        const homeScore = Number(result.GolsMandante);
        const awayScore = Number(result.GolsVisitante);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

        if (homeTeam?.status === "Nosso" && info[homeTeam.owner]) info[homeTeam.owner].homeMatches += 1;
        if (homeScore > awayScore && homeTeam?.status === "Nosso" && info[homeTeam.owner]) info[homeTeam.owner].wins += 1;
        if (awayScore > homeScore && awayTeam?.status === "Nosso" && info[awayTeam.owner]) info[awayTeam.owner].wins += 1;
      });

    const eventImpact = App.transfers.getEventImpactByBuyer();

    Object.values(info).forEach(item => {
      item.homeBonus = item.homeMatches * App.config.homeMatchBonus;
      item.winBonusValue = item.wins * App.config.winBonus;
      item.eventBonus = eventImpact[item.buyer]?.positive || 0;
      item.eventPenalty = eventImpact[item.buyer]?.negative || 0;
      item.eventTotal = eventImpact[item.buyer]?.total || 0;
      item.eventCount = eventImpact[item.buyer]?.events || 0;
      item.transferModifier = eventImpact[item.buyer]?.transferModifier || 0;
      item.transferLimit = App.transfers.getTransferLimitForBuyer(item.buyer);
      item.activeInjuries = eventImpact[item.buyer]?.activeInjuries || 0;
      item.totalBudget = item.baseBudget + item.homeBonus + item.winBonusValue + item.eventTotal;
    });

    return info;
  },

  getTransfersWithStats() {
    const allTransfers = App.transfers.getAllTransfers();
    const nameCounts = allTransfers.reduce((acc, transfer) => {
      const key = App.utils.normalizeText(transfer.player);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const spentByBuyer = {};

    return allTransfers.map((transfer, index) => {
      const feeRate = App.transfers.getTransferRate(Number(transfer.overall));
      const totalCost = Number(transfer.marketValue || 0) + (Number(transfer.marketValue || 0) * feeRate);
      const nameKey = App.utils.normalizeText(transfer.player);
      const hasDuplicate = nameCounts[nameKey] > 1;
      const isBlockedDuplicate = hasDuplicate && allTransfers.findIndex(item => App.utils.normalizeText(item.player) === nameKey) !== index;
      const countedCost = isBlockedDuplicate ? 0 : totalCost;
      spentByBuyer[transfer.buyer] = (spentByBuyer[transfer.buyer] || 0) + countedCost;
      const budgetInfo = App.transfers.getBudgetInfoByBuyer()[transfer.buyer];
      const currentBudget = budgetInfo?.totalBudget || App.config.transferBudget;
      const runningSpent = Object.keys(App.state.apiBudgets || {}).length
        ? (budgetInfo?.spentTotal || 0)
        : spentByBuyer[transfer.buyer];
      const remainingBudget = Object.keys(App.state.apiBudgets || {}).length
        ? (budgetInfo?.remainingBudget ?? (currentBudget - runningSpent))
        : currentBudget - runningSpent;

      return {
        ...transfer,
        index,
        feeRate,
        totalCost,
        hasDuplicate,
        isBlockedDuplicate,
        currentBudget,
        runningSpent,
        remainingBudget
      };
    });
  },

  getValidTransfers() {
    return App.transfers.getTransfersWithStats().filter(item => !item.isBlockedDuplicate);
  },

  getTransferStatusClass(item) {
    if (item.isBlockedDuplicate) return "duplicate";
    if (item.runningSpent > item.currentBudget) return "overbudget";
    return "valid";
  },

  getTransferStatusLabel(item) {
    if (item.isBlockedDuplicate) return "Duplicado";
    if (item.runningSpent > item.currentBudget) return "Acima do orçamento";
    return "Válido";
  },

  getFilteredTransfers(limit = 5) {
    let data = App.transfers.getValidTransfers();
    const search = App.utils.normalizeText(document.getElementById("transferSearchInput")?.value);
    const owner = document.getElementById("transferOwnerFilter")?.value || "all";
    const status = document.getElementById("transferStatusFilter")?.value || "all";

    if (owner !== "all") data = data.filter(item => item.buyer === owner);
    if (status !== "all") data = data.filter(item => App.transfers.getTransferStatusClass(item) === status);
    if (search) {
      data = data.filter(item =>
        App.utils.normalizeText(item.player).includes(search) ||
        App.utils.normalizeText(item.buyer).includes(search) ||
        App.utils.normalizeText(item.fromClub).includes(search)
      );
    }

    data.sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime) || b.index - a.index;
    });

    return data.slice(0, limit);
  },

  getTodayTransferCountByBuyer(buyer) {
    const supabaseBudget = App.state.apiBudgets?.[buyer];
    if (supabaseBudget?.transfersToday !== undefined) return Number(supabaseBudget.transfersToday);

    const today = new Date().toLocaleDateString("pt-BR");

    return App.state.apiTransfers
      .filter(row => App.utils.normalizeText(row.Status) === "aprovado")
      .filter(row => App.utils.normalizeText(row.Comprador) === App.utils.normalizeText(buyer))
      .filter(row => {
        const timestamp = row.Timestamp;
        if (!timestamp) return false;

        if (typeof timestamp === "string" && timestamp.startsWith(today)) {
          return true;
        }

        const parsed = new Date(timestamp);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.toLocaleDateString("pt-BR") === today;
      }).length;
  },

  getSpendingSummary() {
    const budgets = App.transfers.getBudgetInfoByBuyer();
    const validTransfers = App.transfers.getValidTransfers();
    const buyers = App.utils.getHumanBuyers();

    return buyers.map(buyer => {
      const budget = budgets[buyer] || {};
      const transfers = validTransfers.filter(item => item.buyer === buyer);
      const spent = Object.keys(App.state.apiBudgets || {}).length
        ? Number(budget.spentTotal || 0)
        : transfers.reduce((sum, item) => sum + item.totalCost, 0);
      const totalBudget = Number(budget.totalBudget || App.config.transferBudget);
      const remaining = Object.keys(App.state.apiBudgets || {}).length
        ? Number(budget.remainingBudget ?? (totalBudget - spent))
        : totalBudget - spent;
      const transferLimit = Number(budget.transferLimit ?? App.transfers.getTransferLimitForBuyer(buyer));
      const transfersToday = Number(budget.transfersToday ?? App.transfers.getTodayTransferCountByBuyer(buyer));
      const pct = totalBudget > 0 ? Math.min(100, Math.max(0, (spent / totalBudget) * 100)) : 0;

      return {
        buyer,
        totalBudget,
        spent,
        remaining,
        transfers,
        count: transfers.length,
        transferLimit,
        transfersToday,
        pct,
        eventTotal: Number(budget.eventTotal || 0),
        activeInjuries: Number(budget.activeInjuries || 0),
        homeBonus: Number(budget.homeBonus || 0),
        winBonusValue: Number(budget.winBonusValue || 0)
      };
    });
  },

  findExistingPlayer(playerName) {
    const key = App.utils.normalizeText(playerName);
    if (!key) return null;
    return App.transfers.getValidTransfers().find(item => App.utils.normalizeText(item.player) === key) || null;
  },

  getTransferPreview(form) {
    if (!form) return null;

    const buyer = form.elements.buyer?.value || "";
    const player = form.elements.player?.value || "";
    const fromClub = form.elements.fromClub?.value || "";
    const overall = Number(form.elements.overall?.value);
    const marketValue = Number(form.elements.marketValue?.value);
    const hasEnoughData = Boolean(buyer && player && !Number.isNaN(overall) && !Number.isNaN(marketValue) && overall > 0 && marketValue >= 0);
    const budget = App.transfers.getSpendingSummary().find(item => item.buyer === buyer);
    const rate = Number.isNaN(overall) ? 0 : App.transfers.getTransferRate(overall);
    const finalValue = Number.isNaN(marketValue) ? 0 : marketValue + (marketValue * rate);
    const duplicate = App.transfers.findExistingPlayer(player);
    const remainingAfter = budget ? budget.remaining - finalValue : 0;
    const limitReached = budget ? budget.transfersToday >= budget.transferLimit : false;
    const overBudget = budget ? finalValue > budget.remaining : false;
    const hardBlock = Boolean(hasEnoughData && (duplicate || limitReached || overBudget));

    return {
      buyer,
      player,
      fromClub,
      overall,
      marketValue,
      hasEnoughData,
      rate,
      finalValue,
      duplicate,
      budget,
      remainingAfter,
      limitReached,
      overBudget,
      hardBlock
    };
  },

  renderTransferPreview(form) {
    const target = document.getElementById("transferFormPreview");
    if (!target || !form) return;

    const preview = App.transfers.getTransferPreview(form);
    const submitButton = form.querySelector("button[type='submit']");

    if (!preview?.hasEnoughData) {
      if (submitButton && !submitButton.dataset.submitting) submitButton.disabled = false;
      target.className = "transfer-live-preview";
      target.innerHTML = `
        <strong>Prévia da contratação</strong>
        <span>Preencha comprador, jogador, overall e valor para calcular custo final, saldo e travas antes de enviar.</span>
      `;
      return;
    }

    const messages = [];

    if (preview.duplicate) {
      messages.push(`Jogador já contratado por ${preview.duplicate.buyer}.`);
    }

    if (preview.limitReached) {
      messages.push(`${preview.buyer} já atingiu o limite diário (${preview.budget.transfersToday}/${preview.budget.transferLimit}).`);
    }

    if (preview.overBudget) {
      messages.push(`Saldo insuficiente: faltam ${App.utils.formatCurrency(Math.abs(preview.remainingAfter))}.`);
    }

    if (!messages.length) {
      messages.push("Contratação liberada para envio.");
    }

    if (submitButton && !submitButton.dataset.submitting) {
      submitButton.disabled = preview.hardBlock;
    }

    target.className = `transfer-live-preview ${preview.hardBlock ? "danger" : "success"}`;
    target.innerHTML = `
      <div class="preview-header">
        <strong>${App.utils.escapeHtml(preview.player)}</strong>
        <span>${preview.buyer}</span>
      </div>
      <div class="preview-grid">
        <span>OVR <strong>${preview.overall}</strong></span>
        <span>Taxa <strong>${Math.round(preview.rate * 100)}%</strong></span>
        <span>Custo final <strong>${App.utils.formatCurrency(preview.finalValue)}</strong></span>
        <span>Saldo após compra <strong>${App.utils.formatCurrency(preview.remainingAfter)}</strong></span>
        <span>Transferências hoje <strong>${preview.budget.transfersToday}/${preview.budget.transferLimit}</strong></span>
      </div>
      <ul class="preview-alerts">
        ${messages.map(message => `<li>${App.utils.escapeHtml(message)}</li>`).join("")}
      </ul>
    `;
  },

  renderBudgetBoard() {
    const target = document.getElementById("transferBudgetBoard");
    if (!target) return;

    const data = App.transfers.getSpendingSummary();

    target.innerHTML = data.map(item => {
      const color = App.data.ownerColors[item.buyer] || "#2563eb";
      const limitClass = item.transfersToday >= item.transferLimit ? "is-blocked" : item.transfersToday >= item.transferLimit - 1 ? "is-warning" : "";
      return `
        <article class="transfer-budget-card ${limitClass}">
          <div class="budget-card-header">
            <span class="owner" style="background:${color}">${item.buyer}</span>
            <strong>${item.transfersToday}/${item.transferLimit} hoje</strong>
          </div>
          <div class="budget-money">
            <span>Saldo livre</span>
            <strong>${App.utils.formatCurrency(item.remaining)}</strong>
          </div>
          <div class="budget-bar" aria-label="Uso do orçamento">
            <i style="width:${item.pct}%"></i>
          </div>
          <div class="budget-breakdown">
            <span>Gasto: ${App.utils.formatCurrency(item.spent)}</span>
            <span>Total: ${App.utils.formatCurrency(item.totalBudget)}</span>
          </div>
          <div class="budget-tags">
            ${item.eventTotal ? `<span>${item.eventTotal > 0 ? "+" : ""}${App.utils.formatCurrency(item.eventTotal)} eventos</span>` : ""}
            ${item.activeInjuries ? `<span>${item.activeInjuries} lesão(ões)</span>` : ""}
          </div>
        </article>
      `;
    }).join("");
  },

  renderInsights() {
    const target = document.getElementById("transferInsights");
    if (!target) return;

    const transfers = App.transfers.getValidTransfers();
    const biggest = [...transfers].sort((a, b) => b.totalCost - a.totalCost).slice(0, 5);
    const spending = App.transfers.getSpendingSummary().sort((a, b) => b.spent - a.spent);
    const remaining = App.transfers.getSpendingSummary().sort((a, b) => b.remaining - a.remaining);
    const duplicateCount = App.transfers.getTransfersWithStats().filter(item => item.isBlockedDuplicate).length;

    target.innerHTML = `
      <article class="transfer-insight-card">
        <h3>Maiores compras</h3>
        ${biggest.length ? biggest.map(item => `
          <div class="insight-row">
            <span>${App.utils.escapeHtml(item.player)}</span>
            <strong>${App.utils.formatCurrency(item.totalCost)}</strong>
          </div>
        `).join("") : `<p class="calendar-muted">Nenhuma compra aprovada ainda.</p>`}
      </article>
      <article class="transfer-insight-card">
        <h3>Quem mais gastou</h3>
        ${spending.map(item => `
          <div class="insight-row">
            <span>${item.buyer}</span>
            <strong>${App.utils.formatCurrency(item.spent)}</strong>
          </div>
        `).join("")}
      </article>
      <article class="transfer-insight-card">
        <h3>Maior saldo</h3>
        ${remaining.map(item => `
          <div class="insight-row">
            <span>${item.buyer}</span>
            <strong>${App.utils.formatCurrency(item.remaining)}</strong>
          </div>
        `).join("")}
      </article>
      <article class="transfer-insight-card">
        <h3>Alertas</h3>
        <div class="insight-row">
          <span>Duplicadas bloqueadas</span>
          <strong>${duplicateCount}</strong>
        </div>
        <div class="insight-row">
          <span>Limites diários críticos</span>
          <strong>${spending.filter(item => item.transfersToday >= item.transferLimit).length}</strong>
        </div>
        <div class="insight-row">
          <span>Lesões ativas</span>
          <strong>${spending.reduce((sum, item) => sum + item.activeInjuries, 0)}</strong>
        </div>
      </article>
    `;
  },


  getMarketPlayers() {
    return Array.isArray(App.state.apiMarketPlayers) ? App.state.apiMarketPlayers : [];
  },

  async searchMarketPlayers(query = "") {
    const showContracted = Boolean(document.getElementById("showContractedPlayers")?.checked);
    const normalized = App.utils.normalizeText(query);
    const limit = normalized ? 14 : 8;

    return App.api.loadMarketPlayers(query, showContracted, limit);
  },

  selectMarketPlayer(playerId) {
    const form = document.getElementById("transferForm");
    if (!form) return;

    const player = App.transfers.getMarketPlayers().find(item => String(item.id) === String(playerId));
    if (!player || player.alreadyContracted || player.is_contracted) return;

    if (form.elements.player) form.elements.player.value = player.name || "";
    if (form.elements.fromClub) form.elements.fromClub.value = player.club || "";
    if (form.elements.marketValue) form.elements.marketValue.value = Math.round(Number(player.market_value_eur || 0));

    const search = document.getElementById("marketPlayerSearch");
    if (search) search.value = `${player.name} • ${player.club}`;

    App.transfers.renderTransferPreview(form);
  },

  async renderMarketPlayerResults() {
    const target = document.getElementById("marketPlayerResults");
    const input = document.getElementById("marketPlayerSearch");
    if (!target) return;

    const query = input?.value || "";
    target.innerHTML = `<div class="market-empty">Buscando jogadores no mercado...</div>`;

    const players = await App.transfers.searchMarketPlayers(query);

    if (!players.length) {
      target.innerHTML = `
        <div class="market-empty">
          Nenhum jogador disponível encontrado. Tente buscar por nome, clube, liga ou posição.
          ${document.getElementById("showContractedPlayers")?.checked ? "" : " Jogadores já contratados estão escondidos por padrão."}
        </div>
      `;
      return;
    }

    target.innerHTML = players.map(player => {
      const isContracted = Boolean(player.alreadyContracted || player.is_contracted);
      return `
        <button class="market-player-option ${isContracted ? "is-contracted" : ""}" type="button" data-market-player="${player.id}" ${isContracted ? "disabled" : ""}>
          <span class="market-player-main">
            <strong>${App.utils.escapeHtml(player.name || "-")}</strong>
            <small>${App.utils.escapeHtml([player.position, player.age ? `${player.age} anos` : "", player.league].filter(Boolean).join(" · "))}</small>
          </span>
          <span class="market-player-club">${App.utils.escapeHtml(player.club || "Clube não informado")}</span>
          <span class="market-player-value">${App.utils.formatCurrency(Number(player.market_value_eur || 0))}</span>
          ${isContracted ? `<span class="market-player-status">Já contratado</span>` : ""}
        </button>
      `;
    }).join("");

    target.querySelectorAll("[data-market-player]").forEach(button => {
      button.addEventListener("click", () => App.transfers.selectMarketPlayer(button.dataset.marketPlayer));
    });
  },

  renderSummary() {
    const summary = document.getElementById("transferSummary");
    if (!summary) return;

    const data = App.transfers.getValidTransfers();
    const spending = App.transfers.getSpendingSummary();
    const totalBonus = spending.reduce((sum, item) => sum + item.homeBonus + item.winBonusValue + item.eventTotal, 0);
    const bestRemaining = Math.max(...spending.map(item => item.remaining), App.config.transferBudget);
    const totalSpent = spending.reduce((sum, item) => sum + item.spent, 0);

    summary.innerHTML = `
      <article class="summary-card"><span>Orçamento base</span><strong>${App.utils.formatCurrency(App.config.transferBudget)}</strong></article>
      <article class="summary-card"><span>Bônus acumulado</span><strong>${App.utils.formatCurrency(totalBonus)}</strong></article>
      <article class="summary-card"><span>Contratações válidas</span><strong>${data.length}</strong></article>
      <article class="summary-card"><span>Total gasto</span><strong>${App.utils.formatCurrency(totalSpent)}</strong></article>
      <article class="summary-card"><span>Maior saldo</span><strong>${App.utils.formatCurrency(bestRemaining)}</strong></article>
    `;
  },

  render() {
    App.transfers.renderSummary();
    App.transfers.renderBudgetBoard();
    App.transfers.renderInsights();
    App.transfers.renderMarketPlayerResults();

    const table = document.getElementById("transferTable");
    const mobile = document.getElementById("transferMobile");
    if (!table || !mobile) return;

    const data = App.transfers.getFilteredTransfers(5);
    if (!data.length) {
      table.innerHTML = `<tr><td colspan="9" class="calendar-muted">Nenhuma transferência aprovada ainda.</td></tr>`;
      mobile.innerHTML = `<article class="calendar-card"><h3>Nenhuma transferência cadastrada</h3><p class="calendar-muted">Use a aba Enviar dados para cadastrar contratações.</p></article>`;
      return;
    }

    table.innerHTML = data.map(item => {
      const color = App.data.ownerColors[item.buyer] || App.data.ownerColors["Livre / CPU"];
      const statusClass = App.transfers.getTransferStatusClass(item);
      const remainingClass = item.remainingBudget < 0 ? "money-danger" : item.remainingBudget < 10000000 ? "money-warning" : "money-positive";
      return `
        <tr class="ours-row">
          <td class="calendar-match">${App.utils.escapeHtml(item.player)}</td>
          <td><span class="owner" style="background:${color}">${item.buyer}</span></td>
          <td>${App.utils.escapeHtml(item.fromClub || "-")}</td>
          <td class="numeric">${item.overall}</td>
          <td>${App.utils.formatCurrency(item.marketValue)}</td>
          <td class="numeric">${Math.round(item.feeRate * 100)}%</td>
          <td>${App.utils.formatCurrency(item.totalCost)}</td>
          <td class="${remainingClass}">${App.utils.formatCurrency(item.remainingBudget)}</td>
          <td><span class="transfer-status ${statusClass}">${App.transfers.getTransferStatusLabel(item)}</span></td>
        </tr>
      `;
    }).join("");

    mobile.innerHTML = data.map(item => {
      const color = App.data.ownerColors[item.buyer] || App.data.ownerColors["Livre / CPU"];
      return `
        <article class="calendar-card ours-row">
          <div class="calendar-card-header"><span class="owner" style="background:${color}">${item.buyer}</span><span class="transfer-status ${App.transfers.getTransferStatusClass(item)}">${App.transfers.getTransferStatusLabel(item)}</span></div>
          <h3>${App.utils.escapeHtml(item.player)}</h3>
          <p class="calendar-muted">${App.utils.escapeHtml(item.fromClub || "-")} · OVR ${item.overall}</p>
          <p>Valor final: <strong>${App.utils.formatCurrency(item.totalCost)}</strong></p>
          <p>Saldo: <strong>${App.utils.formatCurrency(item.remainingBudget)}</strong></p>
        </article>
      `;
    }).join("");
  }
};
