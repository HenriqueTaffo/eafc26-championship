window.App = window.App || {};

App.main = {
  LOADER_VARIANTS: {
    match: {
      cardClass: "loader-card-match",
      chip: "Montando a rodada",
      speech: "Subornando o VAR...",
      market: {
        label: "Tática montada",
        value: "Rodada pronta",
        detail: "escalando confrontos..."
      },
      chaosItems: ["⚠ conferindo lesões", "⚠ achando transfer ban", "⚠ morra will"]
    },
    market: {
      cardClass: "loader-card-market",
      chip: "Mercado em análise",
      speech: "Subornando o VAR...",
      market: {
        label: "Scout report",
        value: "OVR 87?",
        detail: "taxa subindo..."
      },
      chaosItems: ["⚠ conferindo lesões", "⚠ achando transfer ban", "⚠ morra will"]
    },
    chaos: {
      cardClass: "loader-card-chaos",
      chip: "Modo desespero",
      speech: "Subornando o VAR...",
      market: {
        label: "Scout report",
        value: "OVR 87?",
        detail: "taxa subindo..."
      },
      chaosItems: ["⚠ conferindo lesões", "⚠ achando transfer ban", "⚠ morra will"]
    }
  },

  renderAll() {
    App.standings.render();
    App.calendar.render();
    App.cups.render();
    App.events.render();
    App.players.render();
    App.transfers.render();
    App.forms.renderApiSummary();
    App.auth?.renderAll?.();
  },

  renderCurrentView() {
    const activeView = document.querySelector(".view.active")?.id;

    if (activeView === "standingsView") App.standings.render();
    else if (activeView === "calendarView") App.calendar.render();
    else if (activeView === "cupsView") App.cups.render();
    else if (activeView === "playersView") App.players.render();
    else if (activeView === "eventsView") App.events.render();
    else if (activeView === "transfersView") App.transfers.render();
    else if (activeView === "submitView") App.forms.renderApiSummary();
    else App.main.renderAll();

    App.auth?.renderAll?.();
  },

  getDefaultLoaderVariant() {
    const activeView = document.querySelector(".view.active")?.id;
    if (activeView === "playersView" || activeView === "transfersView") return "market";
    if (activeView === "submitView") return "chaos";
    return "match";
  },

  applyLoaderVariant(variant = "match") {
    const card = document.getElementById("globalLoaderCard");
    if (!card) return;

    const resolvedVariant = App.main.LOADER_VARIANTS[variant] ? variant : "match";
    const config = App.main.LOADER_VARIANTS[resolvedVariant];

    card.classList.remove("loader-card-match", "loader-card-market", "loader-card-chaos");
    card.classList.add(config.cardClass);

    const chipEl = document.getElementById("globalLoaderChip");
    const speechEl = document.getElementById("globalLoaderSpeech");
    const marketLabelEl = document.getElementById("globalLoaderMarketLabel");
    const marketValueEl = document.getElementById("globalLoaderMarketValue");
    const marketDetailEl = document.getElementById("globalLoaderMarketDetail");
    const chaosItem1El = document.getElementById("globalLoaderChaosItem1");
    const chaosItem2El = document.getElementById("globalLoaderChaosItem2");
    const chaosItem3El = document.getElementById("globalLoaderChaosItem3");

    if (chipEl) chipEl.textContent = config.chip || "Carregando";
    if (speechEl) speechEl.textContent = config.speech || "Subornando o VAR...";
    if (marketLabelEl) marketLabelEl.textContent = config.market?.label || "Scout report";
    if (marketValueEl) marketValueEl.textContent = config.market?.value || "OVR 87?";
    if (marketDetailEl) marketDetailEl.textContent = config.market?.detail || "taxa subindo...";
    if (chaosItem1El) chaosItem1El.textContent = config.chaosItems?.[0] || "⚠ conferindo lesões";
    if (chaosItem2El) chaosItem2El.textContent = config.chaosItems?.[1] || "⚠ achando transfer ban";
    if (chaosItem3El) chaosItem3El.textContent = config.chaosItems?.[2] || "⚠ morra will";
  },

  showLoader(optionsOrTitle = "Carregando dados da liga", legacyMessage = "Aguarde enquanto a classificação, o calendário e os painéis são atualizados.") {
    const overlay = document.getElementById("globalLoader");
    if (!overlay) return;

    const options = typeof optionsOrTitle === "object" && optionsOrTitle !== null
      ? optionsOrTitle
      : { title: optionsOrTitle, message: legacyMessage };

    const titleEl = document.getElementById("globalLoaderTitle");
    const textEl = document.getElementById("globalLoaderText");
    const variant = options.variant || App.main.getDefaultLoaderVariant();
    const title = options.title || "Carregando dados da liga";
    const message = options.message || "Aguarde enquanto a classificação, o calendário e os painéis são atualizados.";

    App.state.loadingCount = Number(App.state.loadingCount || 0) + 1;
    App.main.applyLoaderVariant(variant);
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
    overlay.classList.add("is-visible");
    document.body.classList.add("loader-active");
  },

  hideLoader(force = false) {
    const overlay = document.getElementById("globalLoader");
    if (!overlay) return;

    if (force) App.state.loadingCount = 0;
    else App.state.loadingCount = Math.max(0, Number(App.state.loadingCount || 0) - 1);

    if (App.state.loadingCount > 0) return;

    overlay.classList.remove("is-visible");
    document.body.classList.remove("loader-active");
  },

  setupTabs() {
    document.querySelectorAll(".tab-button").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach(item => item.classList.remove("active"));
        document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
        button.classList.add("active");
        document.getElementById(button.dataset.view)?.classList.add("active");
        App.main.renderCurrentView();
      });
    });
  },

  setupFilters() {
    [
      "calendarSearchInput", "calendarCompetitionFilter", "calendarOwnerFilter", "calendarWeekFilter", "calendarStatusFilter",
      "cupsSearchInput", "cupsCompetitionFilter",
      "playersSearchInput", "playersFilter",
      "eventsSearchInput", "eventsOwnerFilter", "eventsTypeFilter", "eventsPeriodFilter",
      "transferSearchInput", "transferOwnerFilter", "transferStatusFilter"
    ].forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;

      const storageKey = `mml-filter-${id}`;
      const savedValue = localStorage.getItem(storageKey);
      if (savedValue !== null) {
        element.value = savedValue;
      }

      const eventName = element.tagName === "INPUT" ? "input" : "change";
      element.addEventListener(eventName, () => {
        localStorage.setItem(storageKey, element.value);
        App.main.renderCurrentView();
      });
    });
  },

  updateTransferCountdown() {
    const element = document.getElementById("nextTransferCountdown");
    if (!element) return;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);
    const diff = Math.max(0, nextReset - now);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    element.textContent = `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  },

  startTimers() {
    App.main.updateTransferCountdown();
    App.events.updateEventCountdown();

    setInterval(() => {
      App.main.updateTransferCountdown();
      App.events.updateEventCountdown();
    }, 1000);

    setInterval(() => {
      if (!App.state.apiLoaded) return;
      const activeView = document.querySelector(".view.active")?.id;
      if (activeView === "eventsView" || activeView === "playersView" || activeView === "transfersView") {
        App.main.renderCurrentView();
      }
    }, 60000);

    setInterval(App.events.autoGenerateDueEvents, 60000);
  },

  init() {
    App.main.setupTabs();
    App.forms.populateTeamOptions();
    App.forms.setupForms();
    App.main.setupFilters();
    App.calendar.populateWeeks();
    App.main.startTimers();

    App.api.loadApiData({
      variant: "match",
      title: "Carregando dados da liga",
      message: "Consultando o Supabase e preparando classificação, calendário, copas, eventos e painel."
    })
      .then(App.events.autoGenerateDueEvents)
      .catch(() => {});
  }
};

document.addEventListener("DOMContentLoaded", App.main.init);
