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
    const impact = App.transfers.getEventImpactByBuyer();
    const modifier = impact[buyer]?.transferModifier || 0;
    return Math.max(0, Math.min(5, App.config.baseDailyTransferLimit + modifier));
  },

  getBudgetInfoByBuyer() {
    const buyers = App.utils.getHumanBuyers();
    const info = buyers.reduce((acc, buyer) => {
      acc[buyer] = {
        buyer,
        baseBudget: App.config.transferBudget,
        homeMatches: 0,
        wins: 0,
        homeBonus: 0,
        winBonusValue: 0,
        eventBonus: 0,
        eventPenalty: 0,
        eventTotal: 0,
        eventCount: 0,
        transferModifier: 0,
        transferLimit: App.config.baseDailyTransferLimit,
        activeInjuries: 0,
        totalBudget: App.config.transferBudget
      };
      return acc;
    }, {});

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
      const currentBudget = App.transfers.getBudgetInfoByBuyer()[transfer.buyer]?.totalBudget || App.config.transferBudget;
      const remainingBudget = currentBudget - spentByBuyer[transfer.buyer];

      return {
        ...transfer,
        index,
        feeRate,
        totalCost,
        hasDuplicate,
        isBlockedDuplicate,
        currentBudget,
        runningSpent: spentByBuyer[transfer.buyer],
        remainingBudget
      };
    });
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
    let data = App.transfers.getTransfersWithStats().filter(item => !item.isBlockedDuplicate);
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

        if (Number.isNaN(parsed.getTime())) {
          return false;
        }

        return parsed.toLocaleDateString("pt-BR") === today;
      }).length;
  },

  renderSummary() {
    const summary = document.getElementById("transferSummary");
    if (!summary) return;

    const data = App.transfers.getTransfersWithStats().filter(item => !item.isBlockedDuplicate);
    const buyers = App.utils.getHumanBuyers();
    const budgetInfo = App.transfers.getBudgetInfoByBuyer();
    const totalBonus = buyers.reduce((sum, buyer) => sum + (budgetInfo[buyer]?.homeBonus || 0) + (budgetInfo[buyer]?.winBonusValue || 0) + (budgetInfo[buyer]?.eventTotal || 0), 0);
    const bestRemaining = Math.max(...buyers.map(buyer => {
      const budget = budgetInfo[buyer]?.totalBudget || App.config.transferBudget;
      const spent = data.filter(item => item.buyer === buyer).reduce((sum, item) => sum + item.totalCost, 0);
      return budget - spent;
    }), App.config.transferBudget);

    summary.innerHTML = `
      <article class="summary-card"><span>Orçamento base</span><strong>${App.utils.formatCurrency(App.config.transferBudget)}</strong></article>
      <article class="summary-card"><span>Bônus acumulado</span><strong>${App.utils.formatCurrency(totalBonus)}</strong></article>
      <article class="summary-card"><span>Contratações válidas</span><strong>${data.length}</strong></article>
      <article class="summary-card"><span>Maior saldo</span><strong>${App.utils.formatCurrency(bestRemaining)}</strong></article>
    `;
  },

  render() {
    App.transfers.renderSummary();
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
          <td class="calendar-match">${item.player}</td>
          <td><span class="owner" style="background:${color}">${item.buyer}</span></td>
          <td>${item.fromClub || "-"}</td>
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
          <h3>${item.player}</h3>
          <p class="calendar-muted">${item.fromClub || "-"} · OVR ${item.overall}</p>
          <p>Valor final: <strong>${App.utils.formatCurrency(item.totalCost)}</strong></p>
          <p>Saldo: <strong>${App.utils.formatCurrency(item.remainingBudget)}</strong></p>
        </article>
      `;
    }).join("");
  }
};
