window.App = window.App || {};

App.auth = {
  storageKey: "mistura_manager_session_v2",
  legacyStorageKey: "mistura_manager_session_v1",
  currentSession: null,
  publicNews: [],
  myDecisions: [],
  myTransferProposals: [],
  myTransferTargets: [],
  myTransferTargetsLoaded: false,
  myTransferSaleListings: {
    listings: [],
    ownedPlayers: []
  },
  mySponsorships: null,
  myQoL: null,
  myFavorites: [],
  myNotifications: [],
  autoDecisionRunning: false,
  autoCpuOfferRunning: false,

  init() {
    try {
      localStorage.removeItem(App.auth.legacyStorageKey);
      const raw = sessionStorage.getItem(App.auth.storageKey);
      App.auth.currentSession = raw ? JSON.parse(raw) : null;
    } catch (error) {
      App.auth.currentSession = null;
    }

    App.auth.syncAuthGate();
    App.auth.renderAll();
    App.auth.bootstrapSessionState();
  },

  getSession() {
    return App.auth.currentSession;
  },

  syncAuthGate() {
    if (!document.body) return;

    const isLocked = !App.auth.isLoggedIn();
    const isCommissioner = !isLocked && App.auth.isCommissioner();

    document.body.classList.toggle("auth-gated", isLocked);
    document.body.classList.toggle("auth-unlocked", !isLocked);
    document.body.classList.toggle("is-commissioner", isCommissioner);
    document.body.classList.toggle("is-manager", !isLocked && !isCommissioner);

    if (isLocked) {
      App.main?.hideLoader?.(true);
      App.main?.markSynced?.("Faça login para abrir a liga");
      return;
    }

    const activeView = document.querySelector(".view.active")?.id;
    if (!isCommissioner && activeView === "submitView") {
      App.main?.switchToView?.("playersView");
    }
  },

  isCpuProposal(item = {}) {
    return item.is_cpu_offer === true
      || App.utils.normalizeText(item.offer_source || "") === "cpu"
      || App.utils.normalizeText(item.buyer || "") === "cpu";
  },

  getTransferProposalSourceLabel(item = {}) {
    if (!App.auth.isCpuProposal(item)) return item.buyer || "outro técnico";
    return App.utils.normalizeText(item.buyer || "") === "cpu"
      ? "clube interessado"
      : item.buyer || "clube interessado";
  },

  getDecisionEmailMeta(item = {}) {
    const category = item.category || "Diretoria";
    const normalized = App.utils.normalizeText(category);
    const text = App.utils.normalizeText([
      item.title,
      item.description,
      item.yes_preview,
      item.no_preview
    ].join(" "));
    const senders = [
      { key: "mercado", sender: "Diretoria de futebol", folder: "Mercado" },
      { key: "finance", sender: "Financeiro", folder: "Finanças" },
      { key: "orcamento", sender: "Financeiro", folder: "Finanças" },
      { key: "lesao", sender: "Departamento médico", folder: "Elenco" },
      { key: "medic", sender: "Departamento médico", folder: "Elenco" },
      { key: "imprensa", sender: "Comunicação", folder: "Imprensa" },
      { key: "patro", sender: "Comercial", folder: "Comercial" },
      { key: "torcida", sender: "Relações com torcedores", folder: "Clube" }
    ];
    const matched = senders.find(item => normalized.includes(item.key) || text.includes(item.key));
    const isHighPriority = ["urgente", "risco", "multa", "lesao", "negativo", "perde", "bloque"].some(key => text.includes(key));

    return {
      sender: matched?.sender || "Diretoria executiva",
      folder: matched?.folder || category,
      priority: isHighPriority ? "Alta" : "Normal",
      tone: isHighPriority ? "high" : "normal"
    };
  },

  renderDecisionEmailStats(pending = [], resolved = []) {
    const highPriority = pending.filter(item => App.auth.getDecisionEmailMeta(item).priority === "Alta").length;
    return `
      <div class="email-office-stats">
        <article><span>Entrada</span><strong>${pending.length}</strong><small>aguardando resposta</small></article>
        <article><span>Prioridade</span><strong>${highPriority}</strong><small>alta atenção</small></article>
        <article><span>Arquivo</span><strong>${resolved.length}</strong><small>últimas respostas</small></article>
        <article><span>Prazo</span><strong>23:59</strong><small>fechamento diário</small></article>
      </div>
    `;
  },

  isLoggedIn() {
    const session = App.auth.getSession();
    return Boolean(session?.managerId && session?.accessCode);
  },

  persistSession(session) {
    App.auth.currentSession = session;
    try {
      sessionStorage.setItem(App.auth.storageKey, JSON.stringify(session));
      localStorage.removeItem(App.auth.legacyStorageKey);
    } catch (error) {
      console.warn("Sessão temporária indisponível:", error);
    }
  },

  clearStoredSession() {
    try {
      sessionStorage.removeItem(App.auth.storageKey);
      localStorage.removeItem(App.auth.storageKey);
      localStorage.removeItem(App.auth.legacyStorageKey);
    } catch (error) {
      console.warn("Não consegui limpar a sessão local:", error);
    }
  },

  buildSessionFromLogin(result, fallbackAccessCode = "") {
    return {
      managerId: result.manager.id,
      managerName: result.manager.name,
      clubName: result.manager.club || "",
      isCommissioner: Boolean(result.manager.isCommissioner),
      accessCode: result.sessionToken || fallbackAccessCode,
      sessionToken: result.sessionToken || "",
      sessionExpiresAt: result.expiresAt || ""
    };
  },

  async bootstrapSessionState() {
    if (!App.auth.isLoggedIn()) return;

    if (App.auth.isCommissioner()) {
      await Promise.all([
        App.governance?.loadData?.(),
        App.auth.loadPublicNews()
      ]);
    } else {
      await Promise.all([
        App.auth.loadMyDecisions(),
        App.auth.loadMyTransferProposals(),
        App.auth.loadMyTransferTargets(),
        App.auth.loadMyTransferSaleListings(),
        App.auth.loadMySponsorships(),
        App.auth.loadMyQoL(),
        App.auth.loadPublicNews()
      ]);
    }

    App.auth.renderAll();
    if (App.state.apiLoaded) App.main?.renderCurrentView?.();
  },

  canViewManagerPrivate(managerName) {
    const session = App.auth.getSession();
    if (!session?.managerName || !managerName) return false;
    return App.utils.normalizeText(session.managerName) === App.utils.normalizeText(managerName);
  },

  isCommissioner() {
    const session = App.auth.getSession();
    return Boolean(session?.isCommissioner || session?.managerId === "comissario");
  },

  async ensureLeagueDataReady() {
    if (App.state.apiLoaded) return;

    if (App.state.apiLoadPromise) {
      await App.state.apiLoadPromise.catch(() => null);
      if (App.state.apiLoaded) return;
    }

    if (App.api?.loadApiData) {
      await App.api.loadApiData({
        showLoader: false,
        skipBackgroundRefresh: true
      });
    }
  },

  async login(managerName, accessCode) {
    let result;

    try {
      result = await App.api.rpc("app_create_manager_session", {
        p_manager_name: managerName,
        p_access_code: accessCode
      }, 30000);
    } catch (sessionError) {
      console.warn("Sessão temporária indisponível, usando login legado nesta aba:", sessionError);
      if (App.utils.normalizeText(managerName).includes("comiss")) {
        result = await App.api.rpc("app_login_commissioner", {
          p_manager_name: managerName,
          p_access_code: accessCode
        }, 30000);
      } else {
        result = await App.api.rpc("app_login_manager", {
          p_manager_name: managerName,
          p_access_code: accessCode
        }, 30000);
      }
    }

    if (!result.ok) throw new Error(result.message || "Login não autorizado.");

    App.auth.persistSession(App.auth.buildSessionFromLogin(result, accessCode));

    if (!App.auth.currentSession.isCommissioner) {
      await App.auth.loadMyDecisions();
      await App.auth.loadMyTransferProposals();
      await App.auth.loadMyTransferTargets();
      await App.auth.loadMyTransferSaleListings();
      await App.auth.loadMySponsorships();
      await App.auth.loadMyQoL();
    }
    await App.governance?.loadData?.();
    await App.auth.loadPublicNews();
    await App.auth.ensureLeagueDataReady();
    App.auth.renderAll();
    App.auth.openSessionHome();
    App.main?.renderCurrentView?.();

    return result;
  },

  openSessionHome() {
    const session = App.auth.getSession();
    if (!session) return;

    if (session.isCommissioner) {
      App.main?.switchToView?.("commissionerView");
      return;
    }

    const filter = document.getElementById("playersFilter");
    if (filter) {
      filter.value = session.managerName;
      localStorage.setItem("mml-filter-playersFilter", session.managerName);
    }

    const search = document.getElementById("playersSearchInput");
    if (search) {
      search.value = "";
      localStorage.setItem("mml-filter-playersSearchInput", "");
    }

    App.main?.switchToView?.("playersView");
  },

  logout() {
    const session = App.auth.currentSession;
    if (session?.sessionToken) {
      App.api.rpc("app_revoke_manager_session", {
        p_manager_id: session.managerId,
        p_session_token: session.sessionToken
      }, 15000).catch(error => console.warn("Revogação de sessão indisponível:", error));
    }

    App.auth.currentSession = null;
    App.auth.myDecisions = [];
    App.auth.myTransferProposals = [];
    App.auth.myTransferTargets = [];
    App.auth.myTransferTargetsLoaded = false;
    App.auth.myTransferSaleListings = { listings: [], ownedPlayers: [] };
    App.auth.mySponsorships = null;
    App.auth.myQoL = null;
    App.auth.myFavorites = [];
    App.auth.myNotifications = [];
    App.auth.clearStoredSession();
    App.auth.renderAll();
    App.main?.renderCurrentView?.();
  },

  async loadPublicNews() {
    try {
      const result = await App.api.rpc("app_get_league_news", { p_limit: 8 }, 30000);
      App.auth.publicNews = Array.isArray(result) ? result : [];
      return App.auth.publicNews;
    } catch (error) {
      console.warn("Jornal da Liga indisponível:", error);
      App.auth.publicNews = [];
      return [];
    }
  },

  async loadMyTransferTargets() {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) {
      App.auth.myTransferTargets = [];
      return [];
    }

    try {
      const result = await App.api.rpc("app_get_private_transfer_targets", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode
      }, 30000);

      if (result?.ok === false) throw new Error(result.message || "Alvos privados indisponíveis.");
      App.auth.myTransferTargets = Array.isArray(result?.targets) ? result.targets : [];
      App.auth.myTransferTargetsLoaded = true;
      return App.auth.myTransferTargets;
    } catch (error) {
      console.warn("Alvos privados indisponíveis, usando cache local:", error);
      return App.auth.myTransferTargets || [];
    }
  },

  async upsertMyTransferTarget(payload = {}) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para pinar alvos.");

    const result = await App.api.rpc("app_upsert_private_transfer_target", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      p_target_id: payload.id || "",
      p_player: payload.player || "",
      p_club: payload.club || "",
      p_value: Number(payload.value || 0),
      p_priority: payload.priority || "Monitorar",
      p_note: payload.note || ""
    }, 30000);

    if (result?.ok === false) throw new Error(result.message || "Não consegui salvar o alvo.");
    App.auth.myTransferTargets = Array.isArray(result?.targets) ? result.targets : [];
    App.auth.myTransferTargetsLoaded = true;
    return App.auth.myTransferTargets;
  },

  async deleteMyTransferTarget(targetId) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para remover alvos.");

    const result = await App.api.rpc("app_delete_private_transfer_target", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      p_target_id: targetId
    }, 30000);

    if (result?.ok === false) throw new Error(result.message || "Não consegui remover o alvo.");
    App.auth.myTransferTargets = Array.isArray(result?.targets) ? result.targets : [];
    App.auth.myTransferTargetsLoaded = true;
    return App.auth.myTransferTargets;
  },

  async loadMyTransferSaleListings() {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) {
      App.auth.myTransferSaleListings = { listings: [], ownedPlayers: [] };
      return App.auth.myTransferSaleListings;
    }

    try {
      const result = await App.api.rpc("app_get_my_transfer_sale_listings", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode
      }, 30000);

      if (result?.ok === false) throw new Error(result.message || "Lista de venda indisponível.");
      App.auth.myTransferSaleListings = {
        listings: Array.isArray(result?.listings) ? result.listings : [],
        ownedPlayers: Array.isArray(result?.ownedPlayers) ? result.ownedPlayers : []
      };
      return App.auth.myTransferSaleListings;
    } catch (error) {
      console.warn("Lista de venda indisponível:", error);
      App.auth.myTransferSaleListings = App.auth.myTransferSaleListings || { listings: [], ownedPlayers: [] };
      return App.auth.myTransferSaleListings;
    }
  },

  async upsertTransferSaleListing(payload = {}) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para listar jogadores.");
    const rawAskingPrice = Number(payload.askingPrice || 0);
    const askingPrice =
      rawAskingPrice > 0 && rawAskingPrice < 1000
        ? rawAskingPrice * 1000000
        : rawAskingPrice;

    const result = await App.api.rpc("app_upsert_transfer_sale_listing", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      p_player: payload.player || "",
      p_asking_price: askingPrice,
      p_note: payload.note || ""
    }, 30000);

    if (result?.ok === false) throw new Error(result.message || "Não consegui salvar a lista de venda.");
    App.auth.myTransferSaleListings = {
      listings: Array.isArray(result?.listings) ? result.listings : [],
      ownedPlayers: Array.isArray(result?.ownedPlayers) ? result.ownedPlayers : []
    };
    return App.auth.myTransferSaleListings;
  },

  async deleteTransferSaleListing(listingId) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para remover jogadores da lista.");

    const result = await App.api.rpc("app_delete_transfer_sale_listing", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      p_listing_id: listingId
    }, 30000);

    if (result?.ok === false) throw new Error(result.message || "Não consegui remover da lista de venda.");
    App.auth.myTransferSaleListings = {
      listings: Array.isArray(result?.listings) ? result.listings : [],
      ownedPlayers: Array.isArray(result?.ownedPlayers) ? result.ownedPlayers : []
    };
    return App.auth.myTransferSaleListings;
  },

  async loadMyDecisions() {
    const session = App.auth.getSession();
    if (!session?.managerId || !session?.accessCode) {
      App.auth.myDecisions = [];
      return [];
    }

    try {
      const result = await App.api.rpc("app_get_my_decisions", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode
      }, 30000);

      App.auth.myDecisions = Array.isArray(result) ? result : [];
      return App.auth.myDecisions;
    } catch (error) {
      console.warn("Decisões privadas indisponíveis:", error);
      App.auth.myDecisions = [];
      return [];
    }
  },

  async loadMyTransferProposals() {
    const session = App.auth.getSession();
    if (!session?.managerId || !session?.accessCode) {
      App.auth.myTransferProposals = [];
      return [];
    }

    try {
      const result = await App.api.rpc("app_get_my_internal_transfer_proposals", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode
      }, 30000);

      App.auth.myTransferProposals = Array.isArray(result) ? result : [];
      return App.auth.myTransferProposals;
    } catch (error) {
      console.warn("Propostas de transferência indisponíveis:", error);
      App.auth.myTransferProposals = [];
      return [];
    }
  },

  async loadMySponsorships() {
    const session = App.auth.getSession();
    if (!session?.managerId || !session?.accessCode) {
      App.auth.mySponsorships = null;
      return null;
    }

    try {
      const result = await App.api.rpc("app_get_my_sponsorships", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode
      }, 30000);

      App.auth.mySponsorships = result || null;
      return App.auth.mySponsorships;
    } catch (error) {
      console.warn("Patrocínios indisponíveis:", error);
      App.auth.mySponsorships = null;
      return null;
    }
  },

  async loadMyQoL() {
    const session = App.auth.getSession();
    if (!session?.managerId || !session?.accessCode || session.isCommissioner) {
      App.auth.myQoL = null;
      App.auth.myFavorites = [];
      App.auth.myNotifications = [];
      return null;
    }

    try {
      const result = await App.api.rpc("app_get_manager_qol", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode
      }, 30000);

      if (result?.ok === false) throw new Error(result.message || "Central privada indisponível.");
      App.auth.myQoL = result || null;
      App.auth.myFavorites = Array.isArray(result?.favorites) ? result.favorites : [];
      App.auth.myNotifications = Array.isArray(result?.notifications) ? result.notifications : [];
      if (Array.isArray(result?.financeForecast)) App.state.apiFinanceForecast = result.financeForecast;
      if (result?.financeRules) App.state.apiFinanceRules = result.financeRules;
      App.auth.saveLocalFavorites(App.auth.myFavorites);
      return App.auth.myQoL;
    } catch (error) {
      console.warn("Central privada/QoL indisponível:", error);
      App.auth.myQoL = null;
      App.auth.myFavorites = App.auth.loadLocalFavorites();
      App.auth.myNotifications = [];
      return null;
    }
  },

  getFavoriteKey(type, key) {
    return `${App.utils.normalizeText(type)}|${App.utils.normalizeText(key)}`;
  },

  getLocalFavoritesStorageKey() {
    const session = App.auth.getSession();
    return `mistura_manager_favorites_v1:${session?.managerId || "anon"}`;
  },

  loadLocalFavorites() {
    try {
      const raw = localStorage.getItem(App.auth.getLocalFavoritesStorageKey());
      const favorites = raw ? JSON.parse(raw) : [];
      return Array.isArray(favorites) ? favorites : [];
    } catch (error) {
      return [];
    }
  },

  saveLocalFavorites(favorites = []) {
    try {
      localStorage.setItem(
        App.auth.getLocalFavoritesStorageKey(),
        JSON.stringify(Array.isArray(favorites) ? favorites : []),
      );
    } catch (error) {
      console.warn("Não consegui salvar favoritos locais:", error);
    }
  },

  isFavorite(type, key) {
    const favoriteKey = App.auth.getFavoriteKey(type, key);
    return (App.auth.myFavorites || []).some(item => App.auth.getFavoriteKey(item.item_type, item.item_key) === favoriteKey);
  },

  upsertLocalFavorite(payload = {}) {
    const session = App.auth.getSession();
    const favorite = {
      id: `${payload.type || "item"}:${payload.key || payload.title || Date.now()}`,
      manager_id: session?.managerId || "",
      manager_name: session?.managerName || "",
      item_type: payload.type || "item",
      item_key: payload.key || payload.title || "",
      title: payload.title || "Favorito",
      detail: payload.detail || "",
      payload: payload.payload || {},
      created_at: new Date().toISOString()
    };
    const favoriteKey = App.auth.getFavoriteKey(favorite.item_type, favorite.item_key);
    const next = [
      favorite,
      ...(App.auth.myFavorites || []).filter(item => App.auth.getFavoriteKey(item.item_type, item.item_key) !== favoriteKey)
    ];
    App.auth.myFavorites = next;
    App.auth.saveLocalFavorites(next);
    return { ok: true, favorites: next, localOnly: true };
  },

  deleteLocalFavorite(type, key) {
    const favoriteKey = App.auth.getFavoriteKey(type, key);
    const next = (App.auth.myFavorites || []).filter(item => App.auth.getFavoriteKey(item.item_type, item.item_key) !== favoriteKey);
    App.auth.myFavorites = next;
    App.auth.saveLocalFavorites(next);
    return { ok: true, favorites: next, localOnly: true };
  },

  async upsertFavorite(payload = {}) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para favoritar.");

    try {
      const result = await App.api.rpc("app_upsert_manager_favorite", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode,
        p_item_type: payload.type || "item",
        p_item_key: payload.key || payload.title || "",
        p_title: payload.title || "Favorito",
        p_detail: payload.detail || "",
        p_payload: payload.payload || {}
      }, 30000);

      if (result?.ok === false) throw new Error(result.message || "Não consegui favoritar.");
      App.auth.myQoL = result;
      App.auth.myFavorites = Array.isArray(result?.favorites) ? result.favorites : [];
      App.auth.myNotifications = Array.isArray(result?.notifications) ? result.notifications : [];
      App.auth.saveLocalFavorites(App.auth.myFavorites);
      return result;
    } catch (error) {
      console.warn("Favorito via Supabase indisponível, usando fallback local:", error);
      return App.auth.upsertLocalFavorite(payload);
    }
  },

  async deleteFavorite(type, key) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para remover favorito.");

    try {
      const result = await App.api.rpc("app_delete_manager_favorite", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode,
        p_item_type: type,
        p_item_key: key
      }, 30000);

      if (result?.ok === false) throw new Error(result.message || "Não consegui remover favorito.");
      App.auth.myQoL = result;
      App.auth.myFavorites = Array.isArray(result?.favorites) ? result.favorites : [];
      App.auth.myNotifications = Array.isArray(result?.notifications) ? result.notifications : [];
      App.auth.saveLocalFavorites(App.auth.myFavorites);
      return result;
    } catch (error) {
      console.warn("Remoção de favorito via Supabase indisponível, usando fallback local:", error);
      return App.auth.deleteLocalFavorite(type, key);
    }
  },

  async markNotificationsRead() {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) return null;

    const result = await App.api.rpc("app_mark_manager_notifications_read", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode
    }, 30000);

    if (result?.ok !== false) {
      App.auth.myQoL = result;
      App.auth.myFavorites = Array.isArray(result?.favorites) ? result.favorites : [];
      App.auth.myNotifications = Array.isArray(result?.notifications) ? result.notifications : [];
    }
    App.auth.renderAll();
    return result;
  },

  async acceptSponsorship(offerId) {
    const session = App.auth.getSession();
    if (!session) throw new Error("Faça login como técnico antes de assinar patrocínio.");

    const result = await App.api.rpc("app_accept_sponsorship", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      p_offer_id: offerId
    }, 45000);

    if (!result.ok) throw new Error(result.message || "Não foi possível assinar este patrocínio.");

    await App.api.loadApiData({
      variant: "market",
      title: "Patrocínio assinado",
      message: "Registrando bônus, contrato e novas metas comerciais..."
    });

    await App.auth.syncManagerState();
    return result;
  },

  async generateDueDecisions() {
    if (App.auth.autoDecisionRunning) return null;

    try {
      App.auth.autoDecisionRunning = true;
      const result = await App.api.rpc("app_generate_due_decision_events", {}, 30000);
      await App.auth.loadPublicNews();

      if (App.auth.isLoggedIn()) {
        await App.auth.loadMyDecisions();
        await App.auth.loadMyTransferProposals();
        await App.auth.loadMySponsorships();
      }

      App.auth.renderAll();
      return result;
    } catch (error) {
      console.warn("Geração automática de e-mails indisponível:", error);
      return null;
    } finally {
      App.auth.autoDecisionRunning = false;
    }
  },

  async generateDueCpuTransferProposals() {
    if (App.auth.autoCpuOfferRunning) return null;

    try {
      App.auth.autoCpuOfferRunning = true;
      const result = await App.api.rpc("app_generate_due_cpu_transfer_proposals", {
        p_count: 4
      }, 30000);

      if (App.auth.isLoggedIn() && !App.auth.isCommissioner()) {
        await App.auth.loadMyTransferProposals();
        App.auth.renderTransferProposalPanel();
        if (App.state.apiLoaded) App.main?.renderCurrentView?.();
      }

      return result;
    } catch (error) {
      console.warn("Geração automática de propostas externas indisponível:", error);
      return null;
    } finally {
      App.auth.autoCpuOfferRunning = false;
    }
  },

  async generateDecision() {
    const session = App.auth.getSession();
    if (!session) throw new Error("Faça login como técnico antes de sortear e-mails.");

    const result = await App.api.rpc("app_generate_my_decision_event", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode
    }, 30000);

    if (!result.ok) throw new Error(result.message || "Não foi possível gerar decisão.");

    await App.auth.loadMyDecisions();
    await App.auth.loadPublicNews();
    App.auth.renderAll();

    return result;
  },

  async answerDecision(decisionId, choice) {
    const session = App.auth.getSession();
    if (!session) throw new Error("Faça login como técnico antes de responder e-mails.");

    const result = await App.api.rpc("app_answer_decision_event", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      p_decision_id: Number(decisionId),
      p_choice: choice
    }, 45000);

    if (!result.ok) throw new Error(result.message || "Não foi possível aplicar a decisão.");

    await App.api.loadApiData({
      variant: "chaos",
      title: "Publicando no Jornal da Liga",
      message: "Aplicando consequência, atualizando orçamento, eventos e manchetes..."
    });

    await App.auth.syncManagerState();

    return result;
  },

  async answerTransferProposal(proposalId, decision) {
    const session = App.auth.getSession();
    if (!session) throw new Error("Faça login como técnico vendedor antes de responder propostas.");

    const result = await App.api.rpc("app_answer_internal_transfer_proposal", {
      p_manager_id: session.managerId,
      p_access_code: session.accessCode,
      p_proposal_id: Number(proposalId),
      p_decision: decision
    }, 45000);

    if (!result.ok) throw new Error(result.message || "Não foi possível responder a proposta.");

    await App.api.loadApiData({
      variant: "market",
      title: decision === "accepted" ? "Transferência aprovada" : "Proposta recusada",
      message: "Atualizando propostas, mercado, orçamentos e painel dos técnicos..."
    });

    await App.auth.syncManagerState();

    return result;
  },

  async syncManagerState(options = {}) {
    const { refreshData = false } = options;
    if (refreshData && App.api?.loadApiData) {
      await App.api.loadApiData({ showLoader: false });
      return;
    }

    await Promise.all([
      App.auth.loadMyDecisions(),
      App.auth.loadMyTransferProposals(),
      App.auth.loadMyTransferSaleListings(),
      App.auth.loadMySponsorships(),
      App.auth.loadMyQoL(),
      App.auth.loadPublicNews()
    ]);

    if (App.state.apiLoaded) App.main?.renderCurrentView?.();
    App.auth.renderAll();
  },

  renderAll() {
    App.auth.renderLoginPanel();
    App.auth.renderDecisionCenter();
    App.auth.renderTransferProposalPanel();
    App.auth.renderNotificationCenter();
    App.auth.renderLeagueNews();
  },

  renderLoginPanel() {
    const panel = document.getElementById("managerLoginPanel");
    if (!panel) return;

    const session = App.auth.getSession();
    App.auth.syncAuthGate();

    const managers = App.utils?.getHumanBuyers ? App.utils.getHumanBuyers() : ["Henrique", "Willian", "Rafael", "Renato"];
    const loginOptions = [...managers, "Comissário da Liga"];

    if (session) {
      panel.innerHTML = `
        <div class="manager-session-card is-logged manager-login-shell">
          <div class="manager-login-identity">
            <span class="manager-login-avatar">
              <img src="./assets/mistura-mascot.png?v=${App.config.assetVersion}" alt="" loading="lazy" />
            </span>
            <div>
              <span>${session.isCommissioner ? "Comissário" : "Técnico conectado"}</span>
              <strong>${App.utils.escapeHtml(session.managerName)}</strong>
              <small>${App.utils.escapeHtml(session.clubName || "Clube vinculado")} · ${session.isCommissioner ? "governança liberada" : "escritório liberado"}</small>
            </div>
          </div>
          <div class="manager-session-actions">
            <button type="button" class="ghost-button" data-auth-action="logout">Sair</button>
          </div>
        </div>
        <div id="managerNotificationCenter"></div>
      `;

      panel.querySelector('[data-auth-action="logout"]')?.addEventListener("click", () => App.auth.logout());

      return;
    }

    panel.innerHTML = `
      <form class="manager-login-card manager-login-shell" id="managerLoginForm">
        <div class="manager-login-brand">
          <span class="manager-login-mascot-stage manager-login-avatar-large" aria-hidden="true">
            <span class="manager-login-mascot-ring"></span>
            <span class="manager-login-flip-card">
              <img class="manager-login-face manager-login-face-front" src="./assets/login-cat-icon.gif?v=${App.config.assetVersion}" alt="" loading="lazy" />
              <img class="manager-login-face manager-login-face-back" src="./assets/mistura-mascot.png?v=${App.config.assetVersion}" alt="" loading="lazy" />
            </span>
          </span>
          <div>
            <span>Mistura Managers League</span>
            <strong>Acesso da liga</strong>
            <small>Entre para abrir seu escritório, calendário e decisões privadas.</small>
            <div class="manager-login-meta" aria-hidden="true">
              <b>Temporada 2026</b>
              <b>Área privada</b>
            </div>
          </div>
        </div>
        <div class="manager-login-form-panel">
          <div class="manager-login-fields">
            <label>
              Perfil
              <select name="managerName" required>
                ${loginOptions.map(name => `<option value="${App.utils.escapeHtml(name)}">${App.utils.escapeHtml(name)}</option>`).join("")}
              </select>
            </label>
            <label>
              Código
              <input name="accessCode" type="password" inputmode="numeric" placeholder="PIN" autocomplete="current-password" required />
            </label>
          </div>
          <button type="submit" class="primary-button manager-login-submit">Entrar no escritório</button>
        </div>
      </form>
    `;

    panel.querySelector("#managerLoginForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type='submit']");
      try {
        button.disabled = true;
        button.textContent = "Entrando...";
        await App.auth.login(form.elements.managerName.value, form.elements.accessCode.value);
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
        button.textContent = "Entrar no escritório";
      }
    });
  },

  renderDecisionCenter() {
    const panel = document.getElementById("decisionCenter");
    if (!panel) return;

    const session = App.auth.getSession();

    if (!session) {
      panel.innerHTML = `
        <section class="decision-private-card decision-locked email-office-card">
          <div>
            <span>E-mail do técnico</span>
            <strong>Caixa de entrada privada</strong>
            <p>Mensagens da diretoria, mercado e bastidores ficam disponíveis após o login do técnico.</p>
          </div>
          <b>@</b>
        </section>
      `;
      return;
    }

    const pending = App.auth.myDecisions.filter(item => item.status === "pending");
    const resolved = App.auth.myDecisions.filter(item => item.status !== "pending").slice(0, 4);

    panel.innerHTML = `
      <section class="decision-private-card email-office-card">
        <div class="decision-header email-office-header">
          <div>
            <span>E-mail do técnico</span>
            <strong>${pending.length ? `${pending.length} mensagens não respondidas` : "Inbox em dia"}</strong>
            <p>${App.utils.escapeHtml(session.managerName)}, mensagens privadas da diretoria e bastidores aparecem aqui.</p>
          </div>
          <span class="decision-auto-pill">Expira às 23:59</span>
        </div>
        ${App.auth.renderDecisionEmailStats(pending, resolved)}

        ${pending.length ? `
          <div class="decision-grid email-thread-grid">
            ${pending.map(item => App.auth.renderDecisionCard(item)).join("")}
          </div>
        ` : `
          <div class="decision-empty email-empty-state">
            <span>0</span>
            <strong>Nenhum e-mail pendente</strong>
            <p>Novas mensagens entram automaticamente ao longo do dia e vencem às 23:59.</p>
          </div>
        `}

        ${resolved.length ? `
          <div class="decision-history email-archive-list">
            <strong>Arquivados recentes</strong>
            ${resolved.map(item => `
              <div>
                <span>${App.utils.escapeDisplay(item.title)}</span>
                <b>${item.selected_option === "yes" ? "Sim" : "Não"}</b>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </section>
    `;

    App.auth.bindDecisionAnswerButtons(panel);
  },

  renderTransferProposalPanel() {
    const panel = document.getElementById("transferProposalPanel");
    if (!panel) return;

    const session = App.auth.getSession();
    if (!session) {
      panel.innerHTML = "";
      return;
    }

    const received = App.auth.myTransferProposals.filter(item => item.proposal_role !== "sent" && item.status === "pending");
    const sentAll = App.auth.myTransferProposals.filter(item => item.proposal_role === "sent");
    const sent = sentAll.slice(0, 4);
    const accepted = App.auth.myTransferProposals.filter(item => item.status === "accepted").length;
    const rejected = App.auth.myTransferProposals.filter(item => item.status === "rejected").length;

    if (!received.length && !sent.length) {
      panel.innerHTML = "";
      return;
    }

    panel.innerHTML = `
      <section class="decision-private-card transfer-proposal-card">
        <div class="decision-header">
          <div>
            <span>Central de negociação</span>
            <strong>${received.length} recebida(s) · ${sentAll.length} enviada(s)</strong>
            <p>${App.utils.escapeHtml(session.managerName)}, acompanhe pendências, aceite/recusa e histórico recente entre técnicos.</p>
          </div>
          <span class="decision-auto-pill">${accepted} aceita(s) · ${rejected} recusada(s)</span>
        </div>
        <div class="proposal-columns">
          <div>
            <h3>Recebidas</h3>
            <div class="decision-grid">
              ${received.length ? received.map(item => App.auth.renderTransferProposalCard(item)).join("") : `<p class="calendar-muted">Nenhuma oferta para responder.</p>`}
            </div>
          </div>
          <div>
            <h3>Enviadas</h3>
            <div class="proposal-sent-list">
              ${sent.length ? sent.map(item => App.auth.renderTransferProposalSummary(item)).join("") : `<p class="calendar-muted">Nenhuma proposta enviada recentemente.</p>`}
            </div>
          </div>
        </div>
      </section>
    `;

    App.auth.bindTransferProposalButtons(panel);
  },


  renderCoachDecisionCard(ownerName) {
    const session = App.auth.getSession();
    const owner = ownerName || "";

    if (!session) {
      return `
        <article class="coach-panel-card coach-decision-card coach-decision-locked-card email-office-card">
          <div class="home-panel-header">
            <h2>E-mail</h2>
            <span class="coach-section-kicker">Login necessário</span>
          </div>
          <div class="coach-empty-state decision-empty-visible email-locked-state">
            <span>@</span>
            <div>
              <strong>Caixa de entrada privada</strong>
              <p>Faça login para abrir mensagens da diretoria, mercado e bastidores do clube.</p>
            </div>
          </div>
        </article>
      `;
    }

    if (App.utils.normalizeText(session.managerName) !== App.utils.normalizeText(owner)) {
      return `
        <article class="coach-panel-card coach-decision-card coach-decision-locked-card email-office-card">
          <div class="home-panel-header">
            <h2>E-mail</h2>
            <span class="coach-section-kicker">Privado</span>
          </div>
          <div class="coach-empty-state decision-empty-visible email-locked-state">
            <span>@</span>
            <div>
              <strong>Caixa postal protegida</strong>
              <p>Você está logado como ${App.utils.escapeHtml(session.managerName)}. Para abrir os e-mails de ${App.utils.escapeHtml(owner)}, entre com o PIN desse técnico.</p>
            </div>
          </div>
        </article>
      `;
    }

    const pending = App.auth.myDecisions.filter(item => item.status === "pending");
    const resolved = App.auth.myDecisions.filter(item => item.status !== "pending").slice(0, 3);
    const highPriority = pending.filter(item => App.auth.getDecisionEmailMeta(item).priority === "Alta").length;

    return `
      <article class="coach-panel-card coach-decision-card email-office-card">
        <div class="home-panel-header email-office-header">
          <div>
            <h2>E-mail</h2>
            <p class="coach-card-subtitle">Inbox privada do escritório: diretoria, mercado, elenco e bastidores.</p>
          </div>
          <span class="coach-section-kicker">${pending.length} não respondida(s)</span>
        </div>
        <div class="email-office-command-row">
          <span>Entrada ${pending.length}</span>
          <span>Prioridade ${highPriority}</span>
          <span>Arquivados ${resolved.length}</span>
          <span>Prazo 23:59</span>
        </div>

        ${pending.length ? `
          <div class="coach-decision-grid email-thread-grid">
            ${pending.map(item => App.auth.renderDecisionCard(item)).join("")}
          </div>
        ` : `
          <div class="coach-empty-state decision-empty-visible email-empty-state">
            <span>0</span>
            <div>
              <strong>Nenhum e-mail pendente</strong>
              <p>Quando uma nova mensagem chegar para ${App.utils.escapeHtml(session.managerName)}, ela aparece aqui com ações de resposta.</p>
            </div>
          </div>
        `}

        ${resolved.length ? `
          <div class="coach-decision-history email-archive-list">
            <strong>Arquivados recentes</strong>
            ${resolved.map(item => `
              <div>
                <span>${App.utils.escapeDisplay(item.title)}</span>
                <b>${item.status === "expired" ? "Expirou" : item.selected_option === "yes" ? "Sim" : "Não"}</b>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </article>
    `;
  },

  renderCoachTransferProposalCard(ownerName) {
    const session = App.auth.getSession();
    if (!session || App.utils.normalizeText(session.managerName) !== App.utils.normalizeText(ownerName)) return "";

    const pending = App.auth.myTransferProposals.filter(item => item.proposal_role !== "sent" && item.status === "pending");
    if (!pending.length) return "";

    return `
      <article class="coach-panel-card coach-decision-card transfer-proposal-card">
        <div class="home-panel-header">
          <div>
            <h2>Propostas recebidas</h2>
            <p class="coach-card-subtitle">Ofertas internas e sondagens externas pelos seus jogadores.</p>
          </div>
          <span class="coach-section-kicker">${pending.length} pendente(s)</span>
        </div>
        <div class="coach-decision-grid">
          ${pending.map(item => App.auth.renderTransferProposalCard(item)).join("")}
        </div>
      </article>
    `;
  },

  renderCoachSponsorshipCard(ownerName) {
    const session = App.auth.getSession();
    if (!session || App.utils.normalizeText(session.managerName) !== App.utils.normalizeText(ownerName)) return "";

    const data = App.auth.mySponsorships || {};
    const active = Array.isArray(data.active) ? data.active : [];
    const offers = Array.isArray(data.offers) ? data.offers : [];
    const rewards = Array.isArray(data.recentRewards) ? data.recentRewards : [];
    const visibleRewards = rewards.slice(0, 5);
    const hiddenRewards = Math.max(0, rewards.length - visibleRewards.length);
    const maxActive = Number(data.maxActiveContracts || 2);
    const slotsLeft = Math.max(0, Number(data.activeSlotsLeft ?? (maxActive - active.length)));
    const offersByCategory = offers.reduce((groups, offer) => {
      const category = offer.category || "Patrocínio";
      groups[category] = groups[category] || [];
      groups[category].push(offer);
      return groups;
    }, {});
    const offerCategories = Object.keys(offersByCategory);

    return `
      <article class="coach-panel-card sponsorship-card">
        <div class="home-panel-header">
          <div>
            <h2>Patrocínios</h2>
            <p class="coach-card-subtitle">Escolha até ${maxActive} contratos ativos. Marcas da mesma categoria disputam espaço e podem substituir contrato com multa.</p>
          </div>
          <span class="coach-section-kicker">${active.length}/${maxActive} ativo(s)</span>
        </div>

        ${active.length ? `
          <div class="sponsor-active-list sponsor-portfolio-list">
            ${active.map(item => {
              const cadence = App.auth.getSponsorshipCadence(item);
              const claimLabel = cadence ? "parcelas" : "bônus";
              const paidTotal = Number(item.paid_total || item.paidTotal || 0);
              const signingPaidAt = App.auth.parseSponsorshipDate(item.signing_paid_at || item.signingPaidAt);
              const toneClass = cadence === "monthly" ? "monthly" : cadence === "weekly" ? "weekly" : "goal";
              const sponsorName = item.sponsor_name || item.sponsorName || "Marca";
              const rewardValue = Number(item.reward_value || item.rewardValue || 0);
              const signingBonus = Number(item.signing_bonus || item.signingBonus || 0);
              const claimsUsed = Number(item.claims_used || item.claimsUsed || 0);
              const maxClaims = Number(item.max_claims || item.maxClaims || 0);
              const progress = maxClaims > 0 ? Math.min(100, Math.round((claimsUsed / maxClaims) * 100)) : 0;
              const schedule = App.auth.getRecurringSponsorshipSchedule(item);
              const nextPaymentLabel = schedule?.nextPaymentAt
                ? App.utils.formatDate(schedule.nextPaymentAt)
                : schedule ? "contrato completo" : App.auth.getSponsorshipConditionLabel(item);
              const primaryLabel = cadence === "monthly"
                ? "Parcela mensal"
                : cadence === "weekly" ? "Parcela semanal" : "Bônus por meta";
              const frequencyLabel = App.auth.getSponsorshipFrequencyLabel(item);
              const dealStyle = item.deal_style || item.dealStyle || item.risk_level || item.riskLevel || "Contrato ativo";
              const contractTotal = App.auth.getSponsorshipTotalValue(item);

              return `
              <div class="sponsor-active-item sponsor-active-item-${toneClass}">
                <div class="sponsor-brand-shell">
                  ${App.auth.renderSponsorBrandMark(sponsorName)}
                  <div class="sponsor-brand-copy">
                    <span>${App.utils.escapeDisplay(item.category || "Patrocínio")}</span>
                    <strong>${App.utils.escapeDisplay(item.title)}</strong>
                    <em>${App.utils.escapeDisplay(sponsorName)}</em>
                  </div>
                  <div class="sponsor-badge-stack">
                    <b class="sponsor-cadence-badge ${App.auth.getSponsorshipCadenceClass(item)}">${App.utils.escapeHtml(App.auth.getSponsorshipCadenceLabel(item))}</b>
                    <b>${App.utils.escapeDisplay(dealStyle)}</b>
                  </div>
                </div>

                <div class="sponsor-contract-hero">
                  <span>${primaryLabel}</span>
                  <strong>${App.utils.formatCurrency(rewardValue)} <small>${App.utils.escapeDisplay(frequencyLabel)}</small></strong>
                  <p>${cadence ? `Próximo pagamento: ${App.utils.escapeDisplay(nextPaymentLabel)}` : App.utils.escapeDisplay(nextPaymentLabel)}</p>
                </div>

                <div class="sponsor-terms-row">
                  <span>
                    <b>Luva</b>
                    <strong>${App.utils.formatCurrency(signingBonus)}</strong>
                    <small>${signingPaidAt ? `paga em ${App.utils.formatDate(signingPaidAt)}` : "pagamento inicial"}</small>
                  </span>
                  <span>
                    <b>Total pago</b>
                    <strong>${App.utils.formatCurrency(paidTotal)}</strong>
                    <small>${claimsUsed}/${maxClaims} ${claimLabel}</small>
                  </span>
                  <span>
                    <b>Potencial</b>
                    <strong>${App.utils.formatCurrency(contractTotal)}</strong>
                    <small>teto do contrato</small>
                  </span>
                </div>

                <div class="sponsor-progress-row">
                  <div>
                    <span>Contrato utilizado</span>
                    <b>${progress}%</b>
                  </div>
                  <i><span style="width:${progress}%"></span></i>
                </div>

                <p class="sponsor-condition-line">
                  ${App.utils.escapeDisplay(App.auth.getSponsorshipConditionLabel(item))}
                  ${Number(item.termination_fee || 0) > 0 ? ` · multa atual ${App.utils.formatCurrency(item.termination_fee)}` : ""}
                </p>
                </div>
              `;
            }).join("")}
          </div>
        ` : `<p class="calendar-muted">Nenhum patrocinador ativo. Escolha com cuidado: as luvas agora entram como pagamento oficial e as marcas competem por categoria.</p>`}

        ${offers.length ? `
          <div class="sponsor-market-note">
            <strong>${active.length}/${maxActive} contratos ativos · ${slotsLeft} vaga(s) livre(s)</strong>
            <span>${offers.length} proposta(s) em ${offerCategories.length} categoria(s). Propostas da mesma categoria substituem o contrato atual e aplicam multa de rescisão.</span>
          </div>
          <div class="sponsor-category-list">
            ${offerCategories.map(category => `
              <section class="sponsor-category-group">
                <div class="sponsor-category-header">
                  <strong>${App.utils.escapeDisplay(category)}</strong>
                  <span>${offersByCategory[category].length} proposta(s)</span>
                </div>
                <div class="sponsor-offer-grid">
                  ${offersByCategory[category]
                    .slice()
                    .sort((a, b) => {
                      const priority = item => {
                        const cadence = App.auth.getSponsorshipCadence(item);
                        if (cadence === "monthly") return 0;
                        if (cadence === "weekly") return 1;
                        return 2;
                      };
                      const cadenceDiff = priority(a) - priority(b);
                      if (cadenceDiff !== 0) return cadenceDiff;
                      return (Number(b.rewardValue || b.reward_value || 0) + Number(b.signingBonus || b.signing_bonus || 0))
                        - (Number(a.rewardValue || a.reward_value || 0) + Number(a.signingBonus || a.signing_bonus || 0));
                    })
                    .map(offer => {
                    const cadence = App.auth.getSponsorshipCadence(offer);
                    const totalValue = App.auth.getSponsorshipTotalValue(offer);
                    const toneClass = cadence === "monthly" ? "monthly" : cadence === "weekly" ? "weekly" : "goal";
                    const cadenceLabel = App.auth.getSponsorshipCadenceLabel(offer);
                    const cadenceClass = App.auth.getSponsorshipCadenceClass(offer);
                    const frequencyLabel = App.auth.getSponsorshipFrequencyLabel(offer);
                    const offerStyle = offer.dealStyle || frequencyLabel;

                    return `
                      <article class="sponsor-offer-card sponsor-offer-card-${toneClass}">
                        <div class="sponsor-brand-shell sponsor-offer-shell">
                          ${App.auth.renderSponsorBrandMark(offer.sponsorName)}
                          <div class="sponsor-brand-copy">
                            <span>${App.utils.escapeDisplay(offer.riskLevel || "Meta comercial")}</span>
                            <strong>${App.utils.escapeDisplay(offer.title)}</strong>
                            <em>${App.utils.escapeDisplay(offer.sponsorName)}</em>
                          </div>
                          <div class="sponsor-badge-stack">
                            <b class="sponsor-cadence-badge ${cadenceClass}">${App.utils.escapeHtml(cadenceLabel)}</b>
                            <b>${App.utils.escapeDisplay(offerStyle)}</b>
                          </div>
                        </div>
                        <p class="sponsor-offer-story">${App.utils.escapeDisplay(offer.description)}</p>
                        <div class="sponsor-contract-hero sponsor-offer-hero">
                          <span>Total possível</span>
                          <strong>${App.utils.formatCurrency(totalValue)} <small>${Number(offer.maxClaims || 0)} pagamento(s)</small></strong>
                          <p>
                            ${App.utils.escapeDisplay(offer.conditionLabel || "Meta cumprida")}
                            ${offer.isReplacement ? ` · substitui ${App.utils.escapeDisplay(offer.currentSponsorName || "contrato atual")}` : ""}
                          </p>
                        </div>
                        <div class="sponsor-terms-row sponsor-offer-terms">
                          <span>
                            <b>Luva agora</b>
                            <strong>${App.utils.formatCurrency(offer.signingBonus || 0)}</strong>
                            <small>entrada imediata</small>
                          </span>
                          <span>
                            <b>${cadence ? "Parcela" : "Bônus"}</b>
                            <strong>${App.utils.formatCurrency(offer.rewardValue || 0)}</strong>
                            <small>${App.utils.escapeDisplay(frequencyLabel)}</small>
                          </span>
                          <span>
                            <b>${offer.isReplacement ? "Multa" : "Vaga"}</b>
                            <strong>${offer.isReplacement ? App.utils.formatCurrency(offer.terminationFee || 0) : "Livre"}</strong>
                            <small>${offer.isReplacement ? "rescisão atual" : "sem troca de marca"}</small>
                          </span>
                        </div>
                        <button type="button" data-sponsor-offer="${App.utils.escapeHtml(offer.id)}" data-sponsor-fee="${Number(offer.terminationFee || 0)}" data-sponsor-replacement="${offer.isReplacement ? "true" : "false"}" data-sponsor-signing="${Number(offer.signingBonus || 0)}" data-sponsor-reward="${Number(offer.rewardValue || 0)}" data-sponsor-cadence="${App.utils.escapeHtml(cadence || "goal")}">
                          ${offer.isReplacement ? "Trocar marca" : "Assinar contrato"}
                        </button>
                      </article>
                    `;
                    }).join("")}
                </div>
              </section>
            `).join("")}
          </div>
        ` : slotsLeft <= 0 ? `<p class="calendar-muted">Limite comercial preenchido. Novas propostas aparecem quando houver categoria substituível ou vaga livre.</p>` : ""}

        ${visibleRewards.length ? `
          <div class="sponsor-reward-list">
            <div class="sponsor-reward-header">
              <strong>Últimos pagamentos</strong>
              <span>${visibleRewards.length}/${rewards.length}</span>
            </div>
            ${visibleRewards.map(item => `
              <div class="sponsor-reward-item">
                <span>${App.utils.escapeDisplay(App.auth.getSponsorshipRewardKind(item))} · ${App.utils.escapeDisplay(item.sponsor_name)}</span>
                <b>${App.utils.formatCurrency(item.reward_value)}</b>
              </div>
            `).join("")}
            ${hiddenRewards > 0 ? `<p class="sponsor-reward-more">+${hiddenRewards} pagamento(s) já consolidados no extrato.</p>` : ""}
          </div>
        ` : ""}
      </article>
    `;
  },

  getSponsorshipConditionLabel(item = {}) {
    const fromContract = item.condition_label || item.conditionLabel;
    if (fromContract) return fromContract;

    const condition = App.utils.normalizeText(item.condition_type || item.conditionType || "");
    const labels = {
      "win_by_2": "Vencer por 2+ gols",
      "any_win": "Vencer qualquer partida",
      "home_win": "Vencer como mandante",
      "clean_sheet": "Não sofrer gols",
      "three_goals": "Marcar 3+ gols",
      "away_win": "Vencer como visitante",
      "weekly_payment": "Pagamento semanal fixo",
      "monthly_payment": "Pagamento mensal fixo"
    };

    return labels[condition] || "Meta comercial cumprida";
  },

  renderSponsorBrandMark(name = "") {
    const sponsorName = String(name || "Marca").trim() || "Marca";
    const icon = App.auth.getSponsorIcon(sponsorName);
    const label = App.utils.escapeDisplay(sponsorName);

    return `
      <span class="sponsor-brand-mark sponsor-brand-mark-${App.utils.escapeHtml(icon.key)}" title="${label}" aria-label="${label}">
        ${icon.mark}
      </span>
    `;
  },

  makeSponsorIcon(key, shape) {
    return {
      key,
      mark: `
        <svg class="sponsor-brand-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          ${shape}
        </svg>
      `
    };
  },

  getSponsorIcon(name = "") {
    const normalized = App.utils.normalizeText(name);
    const iconMap = [
      {
        keys: ["adidas"],
        icon: App.auth.makeSponsorIcon("adidas", `
          <path d="M7 23h4V10H7v13Zm7 0h4V7h-4v16Zm7 0h4V13h-4v10Z" />
          <path d="M5 25h22" />
        `)
      },
      {
        keys: ["aurora"],
        icon: App.auth.makeSponsorIcon("aurora", `
          <path d="M7 21a9 9 0 0 1 18 0" />
          <path d="M16 5v5M6 12l4 3M26 12l-4 3M5 24h22" />
        `)
      },
      {
        keys: ["nova"],
        icon: App.auth.makeSponsorIcon("nova", `
          <path d="M8 23V9l8 14 8-14v14" />
          <path d="M10 9h5M17 23h5" />
        `)
      },
      {
        keys: ["sony", "xperia"],
        icon: App.auth.makeSponsorIcon("xperia", `
          <rect x="9" y="5" width="14" height="22" rx="4" />
          <path d="M13 22h6M14 10h4" />
        `)
      },
      {
        keys: ["emirates", "etihad", "voasul"],
        icon: App.auth.makeSponsorIcon("airline", `
          <path d="M5 18 27 6l-7 20-5-8-8 4 4-7-6 3Z" />
        `)
      },
      {
        keys: ["redwood", "atlas", "banco", "capital"],
        icon: App.auth.makeSponsorIcon("finance", `
          <path d="M5 13 16 6l11 7H5Z" />
          <path d="M8 14v10M14 14v10M20 14v10M26 14v10M6 25h22" />
        `)
      },
      {
        keys: ["fortress"],
        icon: App.auth.makeSponsorIcon("fortress", `
          <path d="M8 25V10h4V7h4v3h4V7h4v18" />
          <path d="M8 14h16M14 25v-6a2 2 0 0 1 4 0v6" />
        `)
      },
      {
        keys: ["spotify", "streamplay", "prime video", "netflix", "twitch", "primecam"],
        icon: App.auth.makeSponsorIcon("media", `
          <rect x="5" y="8" width="22" height="16" rx="4" />
          <path d="m14 13 7 3-7 3v-6Z" />
        `)
      },
      {
        keys: ["betfair"],
        icon: App.auth.makeSponsorIcon("odds", `
          <path d="M10 23V9M10 9l-4 4M10 9l4 4" />
          <path d="M22 9v14M22 23l-4-4M22 23l4-4" />
        `)
      },
      {
        keys: ["pioneer", "motors"],
        icon: App.auth.makeSponsorIcon("motors", `
          <circle cx="16" cy="16" r="9" />
          <circle cx="16" cy="16" r="3" />
          <path d="M16 7v6M16 19v6M7 16h6M19 16h6" />
        `)
      },
      {
        keys: ["dhl", "maersk", "cargo"],
        icon: App.auth.makeSponsorIcon("logistics", `
          <path d="M5 20h16V10H5v10Zm16-6h4l3 3v3h-7v-6Z" />
          <circle cx="10" cy="23" r="2" />
          <circle cx="24" cy="23" r="2" />
          <path d="M7 14h8M7 17h6" />
        `)
      },
      {
        keys: ["castore", "hummel", "umbra"],
        icon: App.auth.makeSponsorIcon("kit", `
          <path d="M11 7h10l5 5-4 4-2-2v11H12V14l-2 2-4-4 5-5Z" />
          <path d="M13 7a3 3 0 0 0 6 0" />
        `)
      },
      {
        keys: ["red bull", "volt", "neurofit", "ironlab", "apex", "medcore"],
        icon: App.auth.makeSponsorIcon("performance", `
          <path d="M16 5v8h7L13 27v-9H6L16 5Z" />
        `)
      }
    ];

    const found = iconMap.find(item => item.keys.some(key => normalized.includes(key)));
    if (found) return found.icon;

    return {
      key: "generic",
      mark: `<span class="sponsor-brand-initial" aria-hidden="true">${App.utils.escapeHtml(App.auth.getSponsorInitials(name))}</span>`
    };
  },

  getSponsorInitials(name = "") {
    const words = String(name || "Marca")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) return "M";
    return words
      .slice(0, 2)
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase();
  },

  getSponsorshipCadence(item = {}) {
    const explicit = App.utils.normalizeText(item.paymentCadence || item.payment_cadence || "");
    if (explicit === "weekly" || explicit === "monthly") return explicit;

    const condition = App.utils.normalizeText(item.condition_type || item.conditionType || "");
    if (condition === "weekly_payment") return "weekly";
    if (condition === "monthly_payment") return "monthly";
    return "";
  },

  getSponsorshipFrequencyLabel(item = {}) {
    const cadence = App.auth.getSponsorshipCadence(item);
    if (cadence === "weekly") return "por semana";
    if (cadence === "monthly") return "por mês";
    return "por meta";
  },

  getSponsorshipCadenceLabel(item = {}) {
    const cadence = App.auth.getSponsorshipCadence(item);
    if (cadence === "weekly") return "Semanal";
    if (cadence === "monthly") return "Mensal";
    return "Meta";
  },

  getSponsorshipCadenceClass(item = {}) {
    const cadence = App.auth.getSponsorshipCadence(item);
    if (cadence === "weekly" || cadence === "monthly") return cadence;
    return "goal";
  },

  getSponsorshipTotalValue(item = {}) {
    const fromApi = Number(item.totalContractValue || item.total_contract_value || 0);
    if (fromApi > 0) return fromApi;

    const signing = Number(item.signingBonus || item.signing_bonus || 0);
    const reward = Number(item.rewardValue || item.reward_value || 0);
    const maxClaims = Number(item.maxClaims || item.max_claims || 0);
    return signing + (reward * maxClaims);
  },

  getSponsorshipRewardKind(item = {}) {
    if (item.reward_kind || item.rewardKind) return item.reward_kind || item.rewardKind;
    const key = App.utils.normalizeText(item.result_key || item.resultKey || "");
    if (key.startsWith("signing_bonus")) return "Luva";
    if (key.startsWith("periodic")) return "Parcela";
    return "Meta";
  },

  parseSponsorshipDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  getRecurringSponsorshipSchedule(item = {}) {
    const cadence = App.auth.getSponsorshipCadence(item);
    const intervalDays = cadence === "weekly" ? 7 : cadence === "monthly" ? 30 : 0;
    if (!intervalDays) return null;

    const signedAt = App.auth.parseSponsorshipDate(item.created_at || item.createdAt || item.createdAtUtc || "");
    if (!signedAt) return null;

    const claimsUsed = Number(item.claims_used || item.claimsUsed || 0);
    const maxClaims = Number(item.max_claims || item.maxClaims || 0);
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    const lastPaymentAt = App.auth.parseSponsorshipDate(item.last_installment_at || item.lastInstallmentAt)
      || (claimsUsed > 0 ? new Date(signedAt.getTime() + claimsUsed * intervalMs) : null);
    const nextPaymentAt = App.auth.parseSponsorshipDate(item.next_payment_at || item.nextPaymentAt)
      || (maxClaims && claimsUsed >= maxClaims ? null : new Date(signedAt.getTime() + (claimsUsed + 1) * intervalMs));

    return {
      cadence: intervalDays === 7 ? "semanal" : "mensal",
      lastPaymentAt,
      nextPaymentAt
    };
  },

  renderSponsorshipPaymentSchedule(item = {}) {
    const schedule = App.auth.getRecurringSponsorshipSchedule(item);
    if (!schedule) return "";

    const lastLabel = schedule.lastPaymentAt
      ? App.utils.formatDate(schedule.lastPaymentAt)
      : "ainda não pago";
    const nextLabel = schedule.nextPaymentAt
      ? App.utils.formatDate(schedule.nextPaymentAt)
      : "contrato completo";

    return `
      <div class="sponsor-payment-schedule">
        <span>${schedule.cadence}</span>
        <small><b>Última</b><strong>${lastLabel}</strong></small>
        <small><b>Próxima</b><strong>${nextLabel}</strong></small>
      </div>
    `;
  },

  bindDecisionAnswerButtons(root = document) {
    root.querySelectorAll("[data-decision-answer]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", async event => {
        const target = event.currentTarget;
        const decisionId = target.dataset.decisionId;
        const choice = target.dataset.choice;
        const label = choice === "yes" ? "Sim" : "Não";

        if (!confirm(`Enviar resposta "${label}" para este e-mail? A consequência será aplicada e publicada no Jornal da Liga.`)) return;

        try {
          target.disabled = true;
          await App.auth.answerDecision(decisionId, choice);
        } catch (error) {
          alert(error.message);
        } finally {
          target.disabled = false;
        }
      });
    });
  },

  bindTransferProposalButtons(root = document) {
    root.querySelectorAll("[data-transfer-proposal-answer]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", async event => {
        const target = event.currentTarget;
        const proposalId = target.dataset.proposalId;
        const decision = target.dataset.decision;
        const label = decision === "accepted" ? "aceitar" : "recusar";
        const sourceLabel = target.dataset.proposalSourceLabel || "esta oferta";

        if (!confirm(`Deseja ${label} a proposta de ${sourceLabel}?`)) return;

        try {
          target.disabled = true;
          await App.auth.answerTransferProposal(proposalId, decision);
        } catch (error) {
          alert(error.message);
        } finally {
          target.disabled = false;
        }
      });
    });

    App.auth.bindSponsorshipButtons(root);
  },

  bindSponsorshipButtons(root = document) {
    root.querySelectorAll("[data-sponsor-offer]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", async event => {
        const offerId = event.currentTarget.dataset.sponsorOffer;
        const isReplacement = event.currentTarget.dataset.sponsorReplacement === "true";
        const fee = Number(event.currentTarget.dataset.sponsorFee || 0);
        const signingBonus = Number(event.currentTarget.dataset.sponsorSigning || 0);
        const rewardValue = Number(event.currentTarget.dataset.sponsorReward || 0);
        const cadence = event.currentTarget.dataset.sponsorCadence;
        const paymentLabel = cadence === "weekly"
          ? `parcela semanal de ${App.utils.formatCurrency(rewardValue)}`
          : cadence === "monthly"
            ? `parcela mensal de ${App.utils.formatCurrency(rewardValue)}`
            : `bônus por meta de ${App.utils.formatCurrency(rewardValue)}`;
        const message = isReplacement
          ? `Trocar para este patrocínio? A multa estimada é ${App.utils.formatCurrency(fee)}. A luva de ${App.utils.formatCurrency(signingBonus)} entra agora e o contrato paga ${paymentLabel}.`
          : `Assinar este patrocínio? A luva de ${App.utils.formatCurrency(signingBonus)} entra agora e o contrato paga ${paymentLabel}.`;
        if (!confirm(message)) return;

        try {
          event.currentTarget.disabled = true;
          await App.auth.acceptSponsorship(offerId);
        } catch (error) {
          alert(error.message);
        } finally {
          event.currentTarget.disabled = false;
        }
      });
    });
  },

  renderTransferProposalCard(item) {
    const isCpuOffer = App.auth.isCpuProposal(item);
    const sourceLabel = App.auth.getTransferProposalSourceLabel(item);
    const sourceLabelEscaped = App.utils.escapeDisplay(sourceLabel);
    const proposedValue = Number(item.proposed_value || 0);
    const status = App.utils.normalizeText(item.status || "pending");
    const statusLabel =
      status === "accepted"
        ? "Aceita"
        : status === "rejected"
          ? "Recusada"
          : "Pendente";

    return `
      <article class="decision-card transfer-proposal-item proposal-status-${status}">
        <div class="decision-card-top">
          <span>${isCpuOffer ? "Oferta externa" : "Oferta interna"}</span>
          <b>${statusLabel}</b>
        </div>
        <h3>${App.utils.escapeHtml(item.player)}</h3>
        <p>${sourceLabelEscaped} ofereceu ${App.utils.formatCurrency(proposedValue)} por este jogador.</p>
        <div class="proposal-meta">
          <span>OVR ${App.utils.escapeHtml(item.overall || "-")}</span>
          <span>${App.utils.escapeHtml(item.from_club || "Negociação interna")}</span>
        </div>
        <div class="decision-options">
          <button
            type="button"
            data-transfer-proposal-answer
            data-proposal-id="${App.utils.escapeHtml(item.id)}"
            data-decision="accepted"
            data-proposal-source-label="${sourceLabelEscaped}"
          >
            <strong>Aceitar</strong>
            <small>${isCpuOffer ? `Vende para ${sourceLabelEscaped} e recebe ${App.utils.formatCurrency(proposedValue)}.` : "Vende o jogador e recebe o valor."}</small>
          </button>
          <button
            type="button"
            data-transfer-proposal-answer
            data-proposal-id="${App.utils.escapeHtml(item.id)}"
            data-decision="rejected"
            data-proposal-source-label="${sourceLabelEscaped}"
          >
            <strong>Recusar</strong>
            <small>A proposta é encerrada sem movimentação.</small>
          </button>
        </div>
      </article>
    `;
  },

  renderTransferProposalSummary(item) {
    const status = App.utils.normalizeText(item.status || "pending");
    const statusLabel =
      status === "accepted"
        ? "Aceita"
        : status === "rejected"
          ? "Recusada"
          : "Pendente";
    return `
      <article class="proposal-summary-item proposal-status-${status}">
        <span>${statusLabel}</span>
        <strong>${App.utils.escapeHtml(item.player)}</strong>
        <small>${App.utils.escapeHtml(item.seller)} · ${App.utils.escapeHtml(App.auth.getTransferProposalSourceLabel(item))} · ${App.utils.formatCurrency(item.proposed_value)}</small>
      </article>
    `;
  },

  renderDecisionCard(item) {
    const meta = App.auth.getDecisionEmailMeta(item);
    const statusLabel = item.status === "pending" ? "Não respondido" : item.status || "arquivado";

    return `
      <article class="decision-card decision-email-message priority-${meta.tone}">
        <div class="decision-card-top email-message-top">
          <span>${App.utils.escapeDisplay(meta.sender)}</span>
          <b>${App.utils.escapeDisplay(statusLabel)}</b>
        </div>
        <div class="email-message-subject">
          <strong>${App.utils.escapeDisplay(item.title)}</strong>
          <small>${App.utils.escapeDisplay(meta.folder)} · prioridade ${App.utils.escapeDisplay(meta.priority)}</small>
        </div>
        <p>${App.utils.escapeDisplay(item.description)}</p>
        <div class="email-message-preview">
          <span>${App.utils.escapeDisplay(item.yes_label || "Sim")}: ${App.utils.escapeDisplay(item.yes_preview || "Aplicar consequência positiva/arriscada.")}</span>
          <span>${App.utils.escapeDisplay(item.no_label || "Não")}: ${App.utils.escapeDisplay(item.no_preview || "Recusar e aceitar a consequência alternativa.")}</span>
        </div>
        <div class="decision-options email-response-actions">
          <button type="button" data-decision-answer data-decision-id="${item.id}" data-choice="yes">
            <strong>Responder: ${App.utils.escapeDisplay(item.yes_label || "Sim")}</strong>
            <small>${App.utils.escapeDisplay(item.yes_preview || "Aplicar consequência positiva/arriscada.")}</small>
          </button>
          <button type="button" data-decision-answer data-decision-id="${item.id}" data-choice="no">
            <strong>Responder: ${App.utils.escapeDisplay(item.no_label || "Não")}</strong>
            <small>${App.utils.escapeDisplay(item.no_preview || "Recusar e aceitar a consequência alternativa.")}</small>
          </button>
        </div>
      </article>
    `;
  },

  renderPinChangeCard(ownerName = "") {
    const session = App.auth.getSession();

    if (!session) return "";

    if (ownerName && App.utils.normalizeText(session.managerName) !== App.utils.normalizeText(ownerName)) {
      return "";
    }

    return `
      <section class="coach-panel-card pin-change-card">
        <div class="home-panel-header">
          <h2>PIN do técnico</h2>
          <span class="coach-section-kicker">${App.utils.escapeHtml(session.managerName)}</span>
        </div>
        <form class="pin-change-form" id="pinChangeForm">
          <label>PIN atual
            <input name="currentPin" type="password" inputmode="numeric" autocomplete="current-password" required />
          </label>
          <label>Confirmar PIN atual
            <input name="confirmCurrentPin" type="password" inputmode="numeric" autocomplete="current-password" required />
          </label>
          <label>Novo PIN
            <input name="newPin" type="password" inputmode="numeric" autocomplete="new-password" minlength="4" required />
          </label>
          <button class="secondary-button" type="submit">Atualizar PIN</button>
          <span class="app-message" id="pinChangeMessage"></span>
        </form>
      </section>
    `;
  },

  bindPinChangeForm() {
    const form = document.getElementById("pinChangeForm");
    if (!form || form.dataset.bound === "true") return;

    form.dataset.bound = "true";
    form.addEventListener("submit", async event => {
      event.preventDefault();

      const session = App.auth.getSession();
      const message = document.getElementById("pinChangeMessage");
      const currentPin = form.elements.currentPin.value.trim();
      const confirmCurrentPin = form.elements.confirmCurrentPin.value.trim();
      const newPin = form.elements.newPin.value.trim();

      if (!session) {
        App.utils.setMessage(message, "Faça login antes de alterar o PIN.", "error");
        return;
      }

      if (currentPin !== confirmCurrentPin) {
        App.utils.setMessage(message, "Os dois campos de PIN atual precisam ser iguais.", "error");
        return;
      }

      if (newPin.length < 4) {
        App.utils.setMessage(message, "O novo PIN precisa ter pelo menos 4 caracteres.", "error");
        return;
      }

      try {
        const result = await App.api.rpc("app_change_manager_pin", {
          p_manager_id: session.managerId,
          p_current_code: currentPin,
          p_confirm_current_code: confirmCurrentPin,
          p_new_code: newPin
        }, 30000);

        if (!result.ok) throw new Error(result.message || "Não foi possível atualizar o PIN.");

        try {
          const nextSession = await App.api.rpc("app_create_manager_session", {
            p_manager_name: session.managerName,
            p_access_code: newPin
          }, 30000);
          if (nextSession?.ok) {
            App.auth.persistSession(App.auth.buildSessionFromLogin(nextSession, session.accessCode));
          }
        } catch (sessionError) {
          console.warn("PIN alterado, mas não consegui renovar a sessão temporária:", sessionError);
        }

        form.reset();
        App.utils.setMessage(message, "PIN atualizado com sucesso.", "success");
      } catch (error) {
        App.utils.setMessage(message, error.message, "error");
      }
    });
  },

  renderNotificationCenter() {
    const target = document.getElementById("managerNotificationCenter");
    if (!target) return;

    const notifications = App.auth.myNotifications || [];
    const unread = notifications.filter(item => !item.is_read);
    const favorites = App.auth.myFavorites || [];

    target.innerHTML = `
      <section class="manager-qol-card">
        <div class="manager-qol-header">
          <div>
            <span>Central privada</span>
            <strong>${unread.length} aviso(s) novo(s)</strong>
          </div>
          ${unread.length ? `<button type="button" class="ghost-button" data-mark-notifications-read>Marcar lidos</button>` : ""}
        </div>
        <div class="manager-qol-grid">
          <div>
            <strong>Notificações</strong>
            ${notifications.length ? notifications.slice(0, 4).map(item => `
              <span class="manager-qol-pill ${App.utils.escapeHtml(item.tone || "info")} ${item.is_read ? "is-read" : ""}">
                ${App.utils.escapeDisplay(item.title)} · ${App.utils.escapeDisplay(item.body || "")}
              </span>
            `).join("") : `<span class="calendar-muted">Nenhum aviso privado agora.</span>`}
          </div>
          <div>
            <strong>Favoritos</strong>
            ${favorites.length ? favorites.slice(0, 5).map(item => `
              <span class="manager-qol-pill info">${App.utils.escapeDisplay(item.title)} · ${App.utils.escapeDisplay(item.detail || item.item_type || "")}</span>
            `).join("") : `<span class="calendar-muted">Favorite alvos e atalhos no escritório do técnico.</span>`}
          </div>
        </div>
      </section>
    `;

    target.querySelector("[data-mark-notifications-read]")?.addEventListener("click", async () => {
      await App.auth.markNotificationsRead().catch(error => console.warn("Não consegui marcar notificações:", error));
    });
  },

  getLeagueNewsTone(item = {}) {
    const text = App.utils.normalizeText(`${item.headline || ""} ${item.summary || ""} ${item.impact_text || ""}`);
    if (text.includes("-") || text.includes("fora") || text.includes("veta") || text.includes("recusa") || text.includes("ignora")) return "negative";
    if (text.includes("+") || text.includes("aceita") || text.includes("fechou") || text.includes("reforcou")) return "positive";
    return "neutral";
  },

  getLeagueNewsRows(news = []) {
    const groups = (news || []).reduce((acc, item) => {
      const manager = item.manager_name || "Liga";
      const headlineKey = App.utils.normalizeText(item.headline || "")
        .replace(App.utils.normalizeText(manager), "")
        .replace(/\s+/g, " ")
        .trim();
      const key = [
        headlineKey,
        App.utils.normalizeText(item.summary || ""),
        App.utils.normalizeText(item.impact_text || "")
      ].join("|");
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});

    return Object.values(groups).map(group => {
      const first = group[0] || {};
      const managers = [...new Set(group.map(item => item.manager_name).filter(Boolean))];
      const isGrouped = group.length > 1;
      const rawHeadline = first.headline || "movimento de bastidor";
      const firstManager = String(first.manager_name || "").trim();
      const groupedHeadline = firstManager && rawHeadline.toLowerCase().startsWith(firstManager.toLowerCase())
        ? rawHeadline.slice(firstManager.length).trim()
        : rawHeadline;
      const managerLabel = isGrouped
        ? `${managers.slice(0, 3).join(", ")}${managers.length > 3 ? ` +${managers.length - 3}` : ""}`
        : first.manager_name || "Liga";
      const impactText = first.impact_text || "";
      return {
        managerLabel,
        count: group.length,
        tone: App.auth.getLeagueNewsTone(first),
        headline: isGrouped
          ? `Tema recorrente: ${groupedHeadline || "movimento de bastidor"}`
          : rawHeadline || "Movimento de bastidor",
        summary: isGrouped
          ? `${group.length} publicações seguiram a mesma linha: ${first.summary || "decisão registrada pela liga."}`
          : first.summary || "Decisão registrada pela liga.",
        impact: isGrouped && impactText
          ? `${group.length} caso(s) · ${impactText}`
          : impactText || "Sem impacto financeiro direto."
      };
    }).slice(0, 6);
  },

  renderLeagueNews() {
    const panel = document.getElementById("leagueNewsPanel");
    if (!panel) return;

    const news = App.auth.getLeagueNewsRows(App.auth.publicNews || []);
    const lead = news[0];
    const briefs = news.slice(1, 5);

    panel.innerHTML = `
      <section class="league-news-card">
        <div class="league-news-header">
          <div>
            <span>Jornal da Liga</span>
            <strong>Bastidores em manchete</strong>
          </div>
          <small>Somente movimentos com consequência ou leitura pública entram aqui.</small>
        </div>

        ${lead ? `
          <div class="league-news-layout">
            <article class="league-news-feature tone-${App.utils.escapeHtml(lead.tone)}">
              <span>${App.utils.escapeDisplay(lead.managerLabel)}</span>
              <strong>${App.utils.escapeDisplay(lead.headline)}</strong>
              <p>${App.utils.escapeDisplay(lead.summary)}</p>
              <small>${App.utils.escapeDisplay(lead.impact)}</small>
            </article>
            ${briefs.length ? `
              <div class="league-news-list">
                ${briefs.map(item => `
                  <article class="tone-${App.utils.escapeHtml(item.tone)}">
                    <span>${App.utils.escapeDisplay(item.managerLabel)}</span>
                    <strong>${App.utils.escapeDisplay(item.headline)}</strong>
                    <p>${App.utils.escapeDisplay(item.summary)}</p>
                    <small>${App.utils.escapeDisplay(item.impact)}</small>
                  </article>
                `).join("")}
              </div>
            ` : ""}
          </div>
        ` : `
          <div class="league-news-empty">
            <strong>Nenhuma manchete relevante publicada</strong>
            <p>Quando uma decisão privada mexer com caixa, elenco ou bastidor, ela aparece aqui como nota pública.</p>
          </div>
        `}
      </section>
    `;
  }
};

document.addEventListener("DOMContentLoaded", () => App.auth.init());
