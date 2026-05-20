window.App = window.App || {};

App.forms = {
  async handleResultSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const message = document.getElementById("resultMessage");
    const payload = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    App.utils.setMessage(message, "Enviando resultado...", "warning");

    try {
      const data = await App.api.postToApi({
        action: "addResult",
        ...payload,
        week: Number(payload.week),
        homeScore: Number(payload.homeScore),
        awayScore: Number(payload.awayScore),
        goalDetails: "",
        assistDetails: "",
        penaltyWinner: payload.penaltyWinner || "",
        penaltyScore: payload.penaltyScore || ""
      });

      if (!data.ok) throw new Error(data.message || data.error || "Resultado rejeitado.");
      App.utils.setMessage(message, data.message || "Resultado enviado com sucesso.", "success");
      form.reset();
      await App.api.loadApiData({ title: "Atualizando dados", message: "Resultado salvo. Atualizando classificação, calendário e painel da liga..." });
    } catch (error) {
      App.utils.setMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
    }
  },

  async handleTransferSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const message = document.getElementById("transferMessage");
    const payload = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    App.utils.setMessage(message, "Enviando transferência...", "warning");

    try {
      const data = await App.api.postToApi({
        action: "addTransfer",
        ...payload,
        overall: Number(payload.overall),
        marketValue: Number(payload.marketValue)
      });

      if (!data.ok) throw new Error(data.message || data.error || "Transferência rejeitada.");
      App.utils.setMessage(message, data.message || "Transferência enviada com sucesso.", "success");
      form.reset();
      await App.api.loadApiData({ title: "Atualizando dados", message: "Transferência salva. Atualizando orçamento, lista de transferências e painel..." });
    } catch (error) {
      App.utils.setMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
    }
  },

  async handleCpuSimulationSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const message = document.getElementById("cpuSimulationMessage");
    const payload = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    App.utils.setMessage(message, "Simulando jogos CPU x CPU...", "warning");

    try {
      const data = await App.api.postToApi({
        action: "simulateCpuWeek",
        week: Number(payload.week),
        submittedBy: payload.submittedBy
      });

      if (!data.ok) throw new Error(data.message || data.error || "Simulação rejeitada.");
      App.utils.setMessage(message, data.message || "Semana simulada com sucesso.", "success");
      form.reset();
      await App.api.loadApiData({ title: "Atualizando dados", message: "Simulação concluída. Atualizando semana, tabela e calendário..." });
    } catch (error) {
      App.utils.setMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
    }
  },

  renderApiSummary() {
    const container = document.getElementById("apiSummary");
    if (!container) return;
    const approvedResults = App.standings.getApprovedApiResults().length;
    const approvedTransfers = App.state.apiTransfers.filter(row => App.utils.normalizeText(row.Status) === "aprovado").length;
    const events = App.state.apiEvents.length;

    container.innerHTML = `
      <article class="summary-card"><span>Status planilha</span><strong>${App.state.apiLoaded ? "Conectada" : "Carregando"}</strong></article>
      <article class="summary-card"><span>Resultados</span><strong>${approvedResults}</strong></article>
      <article class="summary-card"><span>Transfers</span><strong>${approvedTransfers}</strong></article>
      <article class="summary-card"><span>Eventos</span><strong>${events}</strong></article>
    `;
  },

  setupForms() {
    document.getElementById("resultForm")?.addEventListener("submit", App.forms.handleResultSubmit);
    document.getElementById("transferForm")?.addEventListener("submit", App.forms.handleTransferSubmit);
    document.getElementById("cpuSimulationForm")?.addEventListener("submit", App.forms.handleCpuSimulationSubmit);
  },

  populateTeamOptions() {
    const teamOptions = document.getElementById("teamOptions");
    if (!teamOptions) return;
    const teams = [...new Set([
      ...App.data.teams.map(team => team.team),
      ...App.data.premierLeagueTeams,
      ...App.data.faCupLowerLeagueQualifiers
    ])].sort((a, b) => a.localeCompare(b));
    teamOptions.innerHTML = teams.map(team => `<option value="${team}"></option>`).join("");
  }
};
