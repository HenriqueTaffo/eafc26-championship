import App from "./app.js";

App.forms = {
  getFriendlyErrorMessage(error) {
    const message = error?.message || "";
    if (error?.name === "AbortError") {
      return "A operacao demorou demais para responder. Verifique o Supabase e tente novamente.";
    }
    if (App.utils.normalizeText(message).includes("statement timeout")) {
      return "O Supabase demorou demais para concluir a acao. Tente novamente em alguns segundos.";
    }
    return message;
  },

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
    const isTie =
      homeScore !== "" &&
      awayScore !== "" &&
      Number(homeScore) === Number(awayScore);

    if (!section) return;

    section.hidden = !isCup;

    if (!isCup) {
      if (form.elements.hasPenalties)
        form.elements.hasPenalties.checked = false;
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
      penaltyWinner: isChampionship ? "" : payload.penaltyWinner || "",
      penaltyScore: isChampionship ? "" : payload.penaltyScore || "",
      isCupTie,
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
      ...normalized,
    });

    if (!data.ok)
      throw new Error(data.message || data.error || "Resultado rejeitado.");

    App.utils.setMessage(
      message,
      data.message || "Resultado enviado com sucesso.",
      "success",
    );

    await App.api.loadApiData({
      variant: "match",
      title: "Atualizando dados",
      message:
        options.refreshMessage ||
        "Resultado salvo. Atualizando classificação, calendário e painel da liga...",
    });

    return data;
  },

  async handleResultSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const message = document.getElementById("resultMessage");
    const payload = Object.fromEntries(new FormData(form).entries());
    const session = App.auth?.getSession ? App.auth.getSession() : null;

    button.disabled = true;
    App.utils.setMessage(message, "Enviando resultado...", "warning");
    App.main.showLoader({
      variant: "match",
      title: "Registrando resultado",
      message:
        "Montando a rodada, validando o placar e preparando a atualização da classificação.",
    });

    try {
      if (!session)
        throw new Error(
          "Faça login como técnico ou comissário antes de enviar resultado.",
        );
      if (
        !App.auth?.isCommissioner?.() &&
        ![payload.home, payload.away].some((team) =>
          App.utils.sameTeamName(team, session.clubName),
        )
      ) {
        throw new Error(
          "Você só pode enviar resultado de jogos do seu próprio clube.",
        );
      }
      payload.managerId = session.managerId;
      payload.accessCode = session.accessCode;
      payload.submittedBy = payload.submittedBy || session.managerName;
      await App.forms.submitResultPayload(payload, message);
      form.reset();
      App.forms.updatePenaltyVisibility(form);
    } catch (error) {
      App.utils.setMessage(
        message,
        App.forms.getFriendlyErrorMessage(error),
        "error",
      );
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
    const session = App.auth?.getSession ? App.auth.getSession() : null;

    button.disabled = true;
    App.utils.setMessage(message, "Salvando resultado...", "warning");
    App.main.showLoader({
      variant: "match",
      title: "Salvando placar",
      message: "Validando resultado pelo calendário e atualizando a liga.",
    });

    try {
      if (!session)
        throw new Error(
          "Faça login como técnico ou comissário antes de salvar resultado.",
        );
      if (
        !App.auth?.isCommissioner?.() &&
        ![payload.home, payload.away].some((team) =>
          App.utils.sameTeamName(team, session.clubName),
        )
      ) {
        throw new Error(
          "Você só pode enviar resultado de jogos do seu próprio clube.",
        );
      }
      payload.managerId = session.managerId;
      payload.accessCode = session.accessCode;
      payload.submittedBy = payload.submittedBy || session.managerName;
      await App.forms.submitResultPayload(payload, message, {
        refreshMessage:
          "Placar salvo. Atualizando calendário, classificação e central da rodada...",
      });
      form.reset();
      App.forms.updatePenaltyVisibility(form);
      App.calendar.closeResultModal();
    } catch (error) {
      App.utils.setMessage(
        message,
        App.forms.getFriendlyErrorMessage(error),
        "error",
      );
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

    if (App.transfers?.isTransferWindowLocked?.()) {
      App.utils.setMessage(
        message,
        App.transfers.getTransferWindowLockMessage(),
        "error",
      );
      App.transfers.renderTransferPreview(form);
      return;
    }

    button.disabled = true;
    App.utils.setMessage(message, "Enviando transferência...", "warning");
    App.main.showLoader({
      variant: "market",
      title: "Processando transferência",
      message:
        "Consultando orçamento e possíveis travas de mercado. Propostas internas não consomem limite diário.",
    });

    try {
      const preview = App.transfers.getTransferPreview(form);
      const isInternal = App.transfers.isInternalTransferForm(form);
      const session = App.auth?.getSession ? App.auth.getSession() : null;

      if (
        form.elements.confirmTransferBuyer &&
        !form.elements.confirmTransferBuyer.checked
      ) {
        throw new Error(
          "Confirme que o comprador selecionado está correto antes de enviar.",
        );
      }

      if (isInternal) {
        if (!session)
          throw new Error(
            "Faça login como comprador para enviar proposta a outro técnico.",
          );
        if (
          App.utils.normalizeText(session.managerName) !==
          App.utils.normalizeText(payload.buyer)
        ) {
          throw new Error(
            "A proposta interna precisa ser enviada pelo comprador logado.",
          );
        }
        if (!payload.seller) throw new Error("Selecione o técnico vendedor.");
        if (payload.buyer === payload.seller)
          throw new Error(
            "Comprador e vendedor precisam ser técnicos diferentes.",
          );
        payload.fromClub = `Negociação interna: ${payload.seller}`;
        payload.managerId = session.managerId;
        payload.accessCode = session.accessCode;
      } else {
        if (!session)
          throw new Error(
            "Faça login como comprador antes de enviar transferência.",
          );
        if (
          !App.auth?.isCommissioner?.() &&
          App.utils.normalizeText(session.managerName) !==
            App.utils.normalizeText(payload.buyer)
        ) {
          throw new Error(
            "A transferência precisa ser enviada pelo comprador logado.",
          );
        }
        payload.managerId = session.managerId;
        payload.accessCode = session.accessCode;
        if (preview?.exchangePlayer) {
          payload.tradeInPlayer = preview.exchangePlayer.player;
          payload.tradeInCredit = preview.exchangeCredit;
        }
      }

      if (
        !preview ||
        !payload.buyer ||
        !payload.player ||
        !payload.fromClub ||
        !payload.overall ||
        !payload.marketValue
      ) {
        throw new Error(
          "Preencha todos os dados da transferência antes de confirmar.",
        );
      }

      if (preview?.hardBlock) {
        const reason = preview.sameBuyerAndSeller
          ? "Comprador e vendedor precisam ser técnicos diferentes."
          : preview.exchangeSamePlayer
            ? "O jogador oferecido na troca precisa ser diferente do alvo."
            : preview.duplicateBlock
              ? `Jogador já contratado por ${preview.duplicate.buyer}.`
              : preview.salaryReferenceMissing
                ? "Nao consegui calcular salario de folha antes de enviar."
                : preview.limitReached
                  ? `${preview.buyer} já atingiu o limite diário.`
                  : "Saldo insuficiente para concluir a contratação.";
        throw new Error(reason);
      }

      App.main.hideLoader();
      const confirmed = await App.transfers.confirmNegotiationSubmission?.({
        payload,
        preview,
        isInternal,
      });
      if (!confirmed) {
        throw new Error("Negociação cancelada antes do envio.");
      }

      App.utils.setMessage(
        message,
        isInternal
          ? "Enviando e-mail ao vendedor..."
          : "Abrindo mesa de negociação...",
        "warning",
      );
      App.main.showLoader({
        variant: "market",
        title: isInternal ? "Enviando proposta" : "Negociando transferência",
        message: isInternal
          ? "Registrando a proposta no inbox do vendedor."
          : "Simulando resposta do clube vendedor, contrato e validação da liga.",
      });

      const data = await App.api.postToApi({
        action: "addTransfer",
        ...payload,
        overall: Number(payload.overall),
        marketValue: Number(payload.marketValue),
        referenceValue: Number(payload.marketValue),
        offerValue: Number(
          isInternal
            ? payload.marketValue
            : preview.finalValue || payload.marketValue,
        ),
        weeklySalary: Number(preview.weeklySalary || payload.weeklySalary || 0),
        salarySourceName:
          payload.salarySourceName || preview.salarySourceName || "",
        salarySourceUrl: payload.salarySourceUrl || preview.salarySourceUrl || "",
      });

      if (!data.ok)
        throw new Error(
          data.message || data.error || "Transferência rejeitada.",
        );
      const negotiationEntry = App.transfers.recordNegotiationResult?.(
        payload,
        preview,
        data,
        isInternal,
      );
      App.utils.setMessage(
        message,
        data.message ||
          (isInternal
            ? "Proposta enviada com sucesso."
            : "Proposta enviada ao clube vendedor."),
        "success",
      );
      form.reset();
      if (form.elements.confirmTransferBuyer)
        form.elements.confirmTransferBuyer.checked = false;
      App.transfers.syncInternalTransferFields(form);
      App.transfers.renderTransferPreview(form);
      await App.api.loadApiData({
        variant: "market",
        title: "Atualizando dados",
        message: isInternal
          ? "Proposta enviada. Atualizando pendências do mercado..."
          : "Resposta recebida. Atualizando hub de negociação e e-mails...",
      });
      if (!isInternal && data.status === "accepted") {
        await App.api.loadSquadManagementData?.({ force: true });
      }
      await App.transfers.showNegotiationResultModal?.(
        negotiationEntry,
        isInternal,
      );
    } catch (error) {
      App.utils.setMessage(
        message,
        App.forms.getFriendlyErrorMessage(error),
        "error",
      );
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
    App.utils.setMessage(
      message,
      "Simulando jogos CPU x CPU... Isso deve levar poucos segundos.",
      "warning",
    );
    App.main.showLoader({
      variant: "chaos",
      title: "Simulando CPU x CPU",
      message:
        "Mascote trabalhando pesado para fechar os confrontos, aplicar eventos e atualizar tudo.",
    });

    try {
      if (!App.auth?.isCommissioner?.()) {
        throw new Error(
          "Apenas o Comissário da Liga pode simular jogos CPU x CPU.",
        );
      }
      const data = await App.api.postToApi({
        action: "simulateCpuWeek",
        week: Number(payload.week),
        submittedBy: payload.submittedBy,
      });

      if (!data.ok)
        throw new Error(data.message || data.error || "Simulação rejeitada.");
      App.utils.setMessage(
        message,
        data.message || "Semana simulada com sucesso.",
        "success",
      );
      await App.api.loadApiData({
        variant: "chaos",
        title: "Atualizando dados",
        message:
          "Simulação concluída. Atualizando semana, tabela, calendário e eventos...",
      });
      await App.api.renderCpuSimulationPreview(payload.week);
    } catch (error) {
      App.utils.setMessage(
        message,
        App.forms.getFriendlyErrorMessage(error),
        "error",
      );
    } finally {
      App.main.hideLoader();
      button.disabled = false;
    }
  },

  renderApiSummary() {
    const transferForm = document.getElementById("transferForm");
    if (transferForm && App.state.apiLoaded) {
      App.transfers.populateExchangePlayers(transferForm);
      App.transfers.refreshWorkspace(transferForm);
    }

    const container = document.getElementById("apiSummary");
    if (!container) return;
    const approvedResults = App.standings.getApprovedApiResults().length;
    const events = App.state.apiEvents.length;

    App.dom.setHtml(
      container,
      `
      ${App.ui.summaryCard("Status Supabase", App.state.apiLoaded ? "Conectado" : "Carregando")}
      ${App.ui.summaryCard("Resultados", approvedResults)}
      ${App.ui.summaryCard("Eventos", events)}
    `,
    );
  },

  setupPenaltyControls(form) {
    if (!form || form.dataset.penaltyReady === "true") return;
    form.dataset.penaltyReady = "true";
    ["competition", "homeScore", "awayScore", "hasPenalties"].forEach(
      (name) => {
        const field = form.elements[name];
        if (!field) return;
        field.addEventListener("input", () =>
          App.forms.updatePenaltyVisibility(form),
        );
        field.addEventListener("change", () =>
          App.forms.updatePenaltyVisibility(form),
        );
      },
    );
    App.forms.updatePenaltyVisibility(form);
  },

  setupTransferPreview() {
    const transferForm = document.getElementById("transferForm");
    if (!transferForm || transferForm.dataset.previewReady === "true") return;

    transferForm.dataset.previewReady = "true";
    [
      "buyer",
      "seller",
      "internalPlayer",
      "exchangePlayer",
      "player",
      "fromClub",
      "overall",
      "marketValue",
      "weeklySalary",
      "salarySourceName",
      "salarySourceUrl",
    ].forEach((name) => {
      const field = transferForm.elements[name];
      if (!field) return;
      field.addEventListener("input", () =>
        App.transfers.refreshWorkspace(transferForm),
      );
      field.addEventListener("change", () =>
        App.transfers.refreshWorkspace(transferForm),
      );
    });

    transferForm.elements.buyer?.addEventListener("change", () => {
      App.transfers.populateSellerOptions?.(transferForm);
      App.transfers.populateExchangePlayers(transferForm);
      App.transfers.refreshWorkspace(transferForm);
    });
    transferForm.elements.exchangePlayer?.addEventListener("focus", () => {
      App.transfers.populateExchangePlayers(transferForm);
    });

    transferForm
      .querySelectorAll('input[name="transferType"]')
      .forEach((field) => {
        field.addEventListener("change", () =>
          App.transfers.syncInternalTransferFields(transferForm),
        );
      });

    transferForm.elements.seller?.addEventListener("change", () => {
      App.transfers.populateInternalTransferPlayers(transferForm);
      App.transfers.selectInternalTransferPlayer(transferForm);
    });

    transferForm.elements.internalPlayer?.addEventListener("change", () => {
      App.transfers.selectInternalTransferPlayer(transferForm);
    });

    document
      .getElementById("transferFormPreview")
      ?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-open-auto-auction]");
        if (!button) return;

        const message = document.getElementById("transferMessage");
        const preview = App.transfers.getTransferPreview(transferForm);
        try {
          button.disabled = true;
          await App.transfers.createAutoAuctionFromPreview(preview);
          App.utils.setMessage(
            message,
            "Leilão automático registrado na Central de Inteligência.",
            "success",
          );
        } catch (error) {
          App.utils.setMessage(message, error.message, "error");
        } finally {
          button.disabled = false;
        }
      });

    const marketSearch = document.getElementById("marketPlayerSearch");
    const showContracted = document.getElementById("showContractedPlayers");
    let marketSearchTimer = null;

    const requestMarketRender = () => {
      clearTimeout(marketSearchTimer);
      marketSearchTimer = setTimeout(
        App.transfers.renderMarketPlayerResults,
        220,
      );
    };

    if (marketSearch) {
      marketSearch.addEventListener("input", requestMarketRender);
      marketSearch.addEventListener(
        "focus",
        App.transfers.renderMarketPlayerResults,
      );
    }

    if (showContracted) {
      showContracted.addEventListener(
        "change",
        App.transfers.renderMarketPlayerResults,
      );
    }

    App.transfers.bindWorkspaceEvents?.();
    App.transfers.renderMarketPlayerResults();
    App.transfers.syncInternalTransferFields(transferForm);
    App.transfers.refreshWorkspace(transferForm);
  },

  setupForms() {
    const resultForm = document.getElementById("resultForm");
    const calendarResultForm = document.getElementById("calendarResultForm");

    resultForm?.addEventListener("submit", App.forms.handleResultSubmit);
    calendarResultForm?.addEventListener(
      "submit",
      App.forms.handleCalendarResultSubmit,
    );

    App.forms.setupPenaltyControls(resultForm);
    App.forms.setupPenaltyControls(calendarResultForm);
    App.forms.setupTransferPreview();

    document
      .querySelectorAll("[data-close-result-modal]")
      .forEach((element) => {
        element.addEventListener("click", App.calendar.closeResultModal);
      });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") App.calendar.closeResultModal();
    });

    document
      .getElementById("transferForm")
      ?.addEventListener("submit", App.forms.handleTransferSubmit);
    const cpuSimulationForm = document.getElementById("cpuSimulationForm");
    if (cpuSimulationForm) {
      cpuSimulationForm.addEventListener(
        "submit",
        App.forms.handleCpuSimulationSubmit,
      );
      const weekField = cpuSimulationForm.elements.week;
      if (weekField) {
        let previewTimer = null;
        let previewLoaded = false;
        const updatePreview = () => {
          previewLoaded = true;
          clearTimeout(previewTimer);
          previewTimer = setTimeout(
            () => App.api.renderCpuSimulationPreview(weekField.value),
            250,
          );
        };
        weekField.addEventListener("input", updatePreview);
        weekField.addEventListener("change", updatePreview);
        weekField.addEventListener("focus", () => {
          if (!previewLoaded) updatePreview();
        });
      }
    }
  },

  populateTeamOptions() {
    const teamOptions = document.getElementById("teamOptions");
    if (!teamOptions) return;
    const teams = [
      ...new Set([
        ...App.data.teams.map((team) => team.team),
        ...App.data.premierLeagueTeams,
        ...App.data.faCupLowerLeagueQualifiers,
      ]),
    ].sort((a, b) => a.localeCompare(b));
    App.dom.setHtml(
      teamOptions,
      teams.map((team) => `<option value="${team}"></option>`).join(""),
    );
  },
};
