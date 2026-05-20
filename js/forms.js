window.App = window.App || {};

App.forms = {
  updatePenaltyVisibility(form) {
    if (!form) return;
    const competition = form.elements.competition?.value || "";
    const homeScore = form.elements.homeScore?.value;
    const awayScore = form.elements.awayScore?.value;
    const hasPenalties = form.elements.hasPenalties?.checked || false;
    const section = form.querySelector("[data-penalty-section]");
    const fields = form.querySelector("[data-penalty-fields]");
    const penaltyWinner = form.elements.penaltyWinner;
    const penaltyScore = form.elements.penaltyScore;
    const isCup = competition && competition !== "Championship";
    const isTie = homeScore !== "" && awayScore !== "" && Number(homeScore) === Number(awayScore);

    if (!section) return;

    section.hidden = !isCup;

    if (!isCup) {
      if (form.elements.hasPenalties) form.elements.hasPenalties.checked = false;
      if (fields) fields.hidden = true;
      if (penaltyWinner) {
        penaltyWinner.value = "";
        penaltyWinner.required = false;
      }
      if (penaltyScore) {
        penaltyScore.value = "";
        penaltyScore.required = false;
      }
      return;
    }

    const shouldShowFields = hasPenalties || isTie;
    if (fields) fields.hidden = !shouldShowFields;

    if (penaltyWinner) penaltyWinner.required = isTie;
    if (penaltyScore) penaltyScore.required = false;
  },

  normalizeResultPayload(payload) {
    const isChampionship = payload.competition === "Championship";
    const homeScore = Number(payload.homeScore);
    const awayScore = Number(payload.awayScore);
    const isCupTie = !isChampionship && homeScore === awayScore;

    return {
      ...payload,
      week: Number(payload.week),
      homeScore,
      awayScore,
      goalDetails: payload.goalDetails || "",
      assistDetails: payload.assistDetails || "",
      penaltyWinner: isChampionship ? "" : (payload.penaltyWinner || ""),
      penaltyScore: isChampionship ? "" : (payload.penaltyScore || ""),
      isCupTie
    };
  },

  validateResultPayload(payload) {
    if (payload.isCupTie && !payload.penaltyWinner) {
      return "Jogo de copa empatado precisa informar o vencedor nos pênaltis.";
    }
    return "";
  },

  async submitResultPayload(payload, message, options = {}) {
    const normalized = App.forms.normalizeResultPayload(payload);
    const validation = App.forms.validateResultPayload(normalized);
    if (validation) throw new Error(validation);

    const data = await App.api.postToApi({
      action: "addResult",
      ...normalized
    });

    if (!data.ok) throw new Error(data.message || data.error || "Resultado rejeitado.");

    App.utils.setMessage(message, data.message || "Resultado enviado com sucesso.", "success");

    await App.api.loadApiData({
      variant: "match",
      title: "Atualizando dados",
      message: options.refreshMessage || "Resultado salvo. Atualizando classificação, calendário e painel da liga..."
    });

    return data;
  },

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
      await App.forms.submitResultPayload(payload, message);
      form.reset();
      App.forms.updatePenaltyVisibility(form);
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

  async handleCalendarResultSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const message = document.getElementById("calendarResultMessage");
    const payload = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    App.utils.setMessage(message, "Salvando resultado...", "warning");
    App.main.showLoader({
      variant: "match",
      title: "Salvando placar",
      message: "Validando resultado pelo calendário e atualizando a liga."
    });

    try {
      await App.forms.submitResultPayload(payload, message, {
        refreshMessage: "Placar salvo. Atualizando calendário, classificação e central da rodada..."
      });
      form.reset();
      App.forms.updatePenaltyVisibility(form);
      App.calendar.closeResultModal();
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

  setupPenaltyControls(form) {
    if (!form || form.dataset.penaltyReady === "true") return;
    form.dataset.penaltyReady = "true";
    ["competition", "homeScore", "awayScore", "hasPenalties"].forEach(name => {
      const field = form.elements[name];
      if (!field) return;
      field.addEventListener("input", () => App.forms.updatePenaltyVisibility(form));
      field.addEventListener("change", () => App.forms.updatePenaltyVisibility(form));
    });
    App.forms.updatePenaltyVisibility(form);
  },

  setupForms() {
    const resultForm = document.getElementById("resultForm");
    const calendarResultForm = document.getElementById("calendarResultForm");

    resultForm?.addEventListener("submit", App.forms.handleResultSubmit);
    calendarResultForm?.addEventListener("submit", App.forms.handleCalendarResultSubmit);

    App.forms.setupPenaltyControls(resultForm);
    App.forms.setupPenaltyControls(calendarResultForm);

    document.querySelectorAll("[data-close-result-modal]").forEach(element => {
      element.addEventListener("click", App.calendar.closeResultModal);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") App.calendar.closeResultModal();
    });

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
