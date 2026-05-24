window.App = window.App || {};

App.main = {
  get viewRenderers() {
    return {
      standingsView: App.standings.render,
      calendarView: App.calendar.render,
      cupsView: App.cups.render,
      playersView: App.players.render,
      experienceView: App.experience.render,
      eventsView: App.events.render,
      transfersView: App.transfers.render,
      commissionerView: App.governance.render
    };
  },

  LOADER_VARIANTS: {
    match: {
      cardClass: "loader-card-match",
      chip: "Montando a rodada",
      speech: "Conferindo a rodada...",
      market: {
        label: "Tática montada",
        value: "Rodada pronta",
        detail: "escalando confrontos..."
      },
      chaosItems: ["conferindo lesões", "validando calendário", "sincronizando bastidores"]
    },
    market: {
      cardClass: "loader-card-market",
      chip: "Mercado em análise",
      speech: "Validando negociações...",
      market: {
        label: "Scout report",
        value: "OVR 87?",
        detail: "taxa subindo..."
      },
      chaosItems: ["checando limites", "validando orçamento", "organizando propostas"]
    },
    chaos: {
      cardClass: "loader-card-chaos",
      chip: "Atualizando dados",
      speech: "Organizando envios...",
      market: {
        label: "Scout report",
        value: "OVR 87?",
        detail: "taxa subindo..."
      },
      chaosItems: ["conferindo formulários", "validando registros", "preparando painel"]
    }
  },

  renderAll() {
    Object.values(App.main.viewRenderers).forEach(render => render());
    App.forms.renderApiSummary();
    App.auth?.renderAll?.();
  },

  renderCurrentView() {
    const activeView = document.querySelector(".view.active")?.id;
    const render = App.main.viewRenderers[activeView];

    if (render) render();
    else if (activeView === "submitView") App.forms.renderApiSummary();
    else App.main.renderAll();

    App.auth?.renderAll?.();
  },

  markSynced(label = "Dados sincronizados") {
    const element = document.getElementById("syncStatusText");
    if (!element) return;

    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    element.textContent = `${label} às ${time}`;
  },

  markSyncing(label = "Sincronizando dados da liga...") {
    const element = document.getElementById("syncStatusText");
    if (element) element.textContent = label;
  },

  async applyCacheHygiene() {
    const version = App.config.assetVersion || "";
    if (!version) return;

    const storageKey = "mml-app-asset-version";
    let previousVersion = "";

    try {
      previousVersion = localStorage.getItem(storageKey) || "";
      localStorage.setItem(storageKey, version);
    } catch (_) {
      previousVersion = "";
    }

    if (!previousVersion || previousVersion === version) return;

    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name.startsWith("mml-") || name.includes("mistura"))
            .map((name) => caches.delete(name)),
        );
      }
    } catch (error) {
      console.warn("Limpeza de cache indisponível:", error);
    }
  },

  getDefaultLoaderVariant() {
    const activeView = document.querySelector(".view.active")?.id;
    if (activeView === "playersView" || activeView === "transfersView" || activeView === "commissionerView") return "market";
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
    if (speechEl) speechEl.textContent = config.speech || "Conferindo a rodada...";
    if (marketLabelEl) marketLabelEl.textContent = config.market?.label || "Scout report";
    if (marketValueEl) marketValueEl.textContent = config.market?.value || "OVR 87?";
    if (marketDetailEl) marketDetailEl.textContent = config.market?.detail || "taxa subindo...";
    if (chaosItem1El) chaosItem1El.textContent = config.chaosItems?.[0] || "conferindo lesões";
    if (chaosItem2El) chaosItem2El.textContent = config.chaosItems?.[1] || "validando mercado";
    if (chaosItem3El) chaosItem3El.textContent = config.chaosItems?.[2] || "organizando bastidores";
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

  setupManualSync() {
    document.querySelectorAll("[data-manual-sync]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        try {
          button.disabled = true;
          App.main.markSyncing("Sincronizando manualmente...");
          await App.api.loadApiData({
            showLoader: false,
            force: true
          });
        } catch (error) {
          App.main.markSynced("Falha ao sincronizar");
        } finally {
          button.disabled = false;
        }
      });
    });
  },

  switchToView(viewId) {
    const button = document.querySelector(`.tab-button[data-view="${viewId}"]`);
    const view = document.getElementById(viewId);
    if (!button || !view) return;

    document.querySelectorAll(".tab-button").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    view.classList.add("active");
    App.main.renderCurrentView();
  },

  getGlobalSearchItems() {
    const items = [];
    const add = item => {
      if (!item?.title) return;
      items.push({
        ...item,
        haystack: App.utils.normalizeText(`${item.title} ${item.detail || ""} ${item.meta || ""}`)
      });
    };

    App.data.teams.forEach(team => add({
      type: "Clube",
      title: team.team,
      detail: `${team.owner || "Sem técnico"} · ${team.status || "Liga"}`,
      view: "playersView",
      filterId: "playersSearchInput",
      filterValue: team.team
    }));

    (App.calendar.getCalendarEvents?.() || []).forEach(match => add({
      type: match.competition === "Championship" ? "Jogo" : "Copa",
      title: `${match.home} x ${match.away}`,
      detail: `${match.competition} · ${match.phase} · ${App.utils.formatDate(match.date)}`,
      meta: `${match.homeScore ?? ""} ${match.awayScore ?? ""}`,
      view: match.competition === "Championship" ? "calendarView" : "cupsView",
      filterId: match.competition === "Championship" ? "calendarSearchInput" : "cupsSearchInput",
      filterValue: `${match.home} ${match.away}`
    }));

    App.transfers.getValidTransfers().forEach(item => add({
      type: "Transferência",
      title: item.player,
      detail: `${item.buyer} · ${item.fromClub || "Mercado"} · ${App.utils.formatCurrency(item.totalCost)}`,
      meta: `${item.overall || ""}`,
      view: "transfersView",
      filterId: "transferSearchInput",
      filterValue: item.player
    }));

    (App.state.apiEvents || []).forEach(event => add({
      type: event.Tipo || "Evento",
      title: event.Titulo || event.JogadorAfetado || "Evento da liga",
      detail: `${event.Jogador || "Liga"} · ${event.JogadorAfetado || event.Descricao || ""}`,
      view: "eventsView",
      filterId: "eventsSearchInput",
      filterValue: event.JogadorAfetado || event.Titulo || event.Jogador || ""
    }));

    (App.auth?.myFavorites || []).forEach(item => add({
      type: "Favorito",
      title: item.title,
      detail: item.detail || item.item_type || "Atalho privado",
      view: "playersView",
      filterId: "playersSearchInput",
      filterValue: item.title
    }));

    return items;
  },

  renderGlobalSearchResults(query = "") {
    const input = document.getElementById("globalSearchInput");
    const target = document.getElementById("globalSearchResults");
    if (!input || !target) return;

    const normalized = App.utils.normalizeText(query);
    if (normalized.length < 2) {
      target.classList.remove("is-visible");
      target.innerHTML = "";
      return;
    }

    const results = App.main.getGlobalSearchItems()
      .filter(item => item.haystack.includes(normalized))
      .slice(0, 10);

    target.classList.add("is-visible");
    target.innerHTML = results.length ? results.map((item, index) => `
      <button
        type="button"
        class="global-search-item"
        role="option"
        data-global-search-index="${index}"
      >
        <span>${App.utils.escapeHtml(item.type)}</span>
        <strong>${App.utils.escapeHtml(item.title)}</strong>
        <small>${App.utils.escapeHtml(item.detail || "")}</small>
      </button>
    `).join("") : `<div class="global-search-empty">Nenhum resultado encontrado.</div>`;

    target.querySelectorAll("[data-global-search-index]").forEach(button => {
      button.addEventListener("click", () => {
        const item = results[Number(button.dataset.globalSearchIndex || 0)];
        if (!item) return;
        if (item.filterId) {
          const filter = document.getElementById(item.filterId);
          if (filter) {
            filter.value = item.filterValue || item.title;
            localStorage.setItem(`mml-filter-${item.filterId}`, filter.value);
          }
        }
        input.value = item.title;
        target.classList.remove("is-visible");
        App.main.switchToView(item.view);
      });
    });
  },

  setupGlobalSearch() {
    const input = document.getElementById("globalSearchInput");
    const target = document.getElementById("globalSearchResults");
    if (!input || !target || input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    let searchTimer = null;
    const requestRender = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => App.main.renderGlobalSearchResults(input.value), 120);
    };

    input.addEventListener("input", requestRender);
    input.addEventListener("focus", () => App.main.renderGlobalSearchResults(input.value));
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        input.value = "";
        target.classList.remove("is-visible");
        target.innerHTML = "";
      }
    });
    document.addEventListener("click", event => {
      if (!event.target.closest("[data-global-search]")) target.classList.remove("is-visible");
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
      let filterTimer = null;
      element.addEventListener(eventName, () => {
        localStorage.setItem(storageKey, element.value);
        if (eventName === "input") {
          clearTimeout(filterTimer);
          filterTimer = setTimeout(App.main.renderCurrentView, 160);
          return;
        }
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

    setInterval(() => {
      if (!App.state.apiLoaded || App.state.silentSyncRunning || document.hidden) return;
      const activeView = document.querySelector(".view.active")?.id;
      if (activeView === "submitView" || document.body.classList.contains("modal-active")) return;
      App.state.silentSyncRunning = true;
      App.api.loadApiData({ showLoader: false, cacheTtlMs: 60000 })
        .catch(error => console.warn("Sincronização silenciosa indisponível", error))
        .finally(() => {
          App.state.silentSyncRunning = false;
        });
    }, 90000);
  },

  init() {
    App.main.applyCacheHygiene();
    App.main.setupTabs();
    App.main.setupManualSync();
    App.main.setupGlobalSearch();
    App.forms.populateTeamOptions();
    App.forms.setupForms();
    App.main.setupFilters();
    App.calendar.populateWeeks();
    App.main.startTimers();

    if (!App.auth?.isLoggedIn?.()) {
      App.main.hideLoader(true);
      App.main.markSynced("Faça login para abrir a liga");
      return;
    }

    const initialLoad = App.api.loadApiData({
      force: true,
      variant: "match",
      title: "Carregando dados da liga",
      message: "Consultando o Supabase e preparando classificação, calendário, copas, eventos e painel."
    });

    App.state.apiLoadPromise = initialLoad;
    initialLoad
      .catch(() => {})
      .finally(() => {
        if (App.state.apiLoadPromise === initialLoad) {
          App.state.apiLoadPromise = null;
        }
      });
  }
};

document.addEventListener("DOMContentLoaded", App.main.init);
