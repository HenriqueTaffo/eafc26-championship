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
    App.main.showLoader({
      variant: "match",
      title: "Registrando resultado",
      message: "Montando a rodada, validando o placar e preparando a atualização da classificação."
    });

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
      await App.api.loadApiData({
        variant: "match",
        title: "Atualizando dados",
        message: "Resultado salvo. Atualizando classificação, calendário e painel da liga..."
      });
    } catch (error) {
      const friendlyMessage = error.name === "AbortError"
        ? "A simulação demorou demais para responder. Verifique se os jogos foram criados no Supabase; se não foram, tente novamente."
        : error.message;
      App.utils.setMessage(message, friendlyMessage, "error");
    } finally {
      App.main.hideLoader();
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
    App.main.showLoader({
      variant: "market",
      title: "Processando transferência",
      message: "Consultando orçamento, limite diário e possíveis travas de mercado."
    });

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
      await App.api.loadApiData({
        variant: "market",
        title: "Atualizando dados",
        message: "Transferência salva. Atualizando orçamento, lista de transferências e painel..."
      });
    } catch (error) {
      const friendlyMessage = error.name === "AbortError"
        ? "A operação demorou demais para responder. Verifique o Supabase e tente novamente."
        : error.message;
      App.utils.setMessage(message, friendlyMessage, "error");
    } finally {
      App.main.hideLoader();
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
    App.utils.setMessage(message, "Simulando jogos CPU x CPU... Isso deve levar poucos segundos.", "warning");
    App.main.showLoader({
      variant: "chaos",
      title: "Simulando CPU x CPU",
      message: "Mascote trabalhando pesado para fechar os confrontos, aplicar eventos e atualizar tudo."
    });

    try {
      const data = await App.api.postToApi({
        action: "simulateCpuWeek",
        week: Number(payload.week),
        submittedBy: payload.submittedBy
      });

      if (!data.ok) throw new Error(data.message || data.error || "Simulação rejeitada.");
      App.utils.setMessage(message, data.message || "Semana simulada com sucesso.", "success");
      form.reset();
      await App.api.loadApiData({
        variant: "chaos",
        title: "Atualizando dados",
        message: "Simulação concluída. Atualizando semana, tabela, calendário e eventos..."
      });
    } catch (error) {
      const friendlyMessage = error.name === "AbortError"
        ? "A operação demorou demais para responder. Verifique o Supabase e tente novamente."
        : error.message;
      App.utils.setMessage(message, friendlyMessage, "error");
    } finally {
      App.main.hideLoader();
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
      <article class="summary-card"><span>Status Supabase</span><strong>${App.state.apiLoaded ? "Conectado" : "Carregando"}</strong></article>
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
