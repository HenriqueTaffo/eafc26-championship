window.App = window.App || {};

App.auth = {
  storageKey: "mistura_manager_session_v1",
  currentSession: null,
  publicNews: [],
  myDecisions: [],
  myTransferProposals: [],
  myTransferTargets: [],
  myTransferTargetsLoaded: false,
  mySponsorships: null,
  myQoL: null,
  myFavorites: [],
  myNotifications: [],
  autoDecisionRunning: false,

  init() {
    try {
      const raw = localStorage.getItem(App.auth.storageKey);
      App.auth.currentSession = raw ? JSON.parse(raw) : null;
    } catch (error) {
      App.auth.currentSession = null;
    }

    App.auth.renderAll();
    App.auth.bootstrapSessionState();
    App.auth.generateDueDecisions();
  },

  getSession() {
    return App.auth.currentSession;
  },

  isLoggedIn() {
    const session = App.auth.getSession();
    return Boolean(session?.managerId && session?.accessCode);
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
        App.auth.loadMySponsorships(),
        App.auth.loadMyQoL(),
        App.auth.loadPublicNews()
      ]);
    }

    App.auth.renderAll();
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

  async login(managerName, accessCode) {
    let result;

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

    if (!result.ok) throw new Error(result.message || "Login não autorizado.");

    App.auth.currentSession = {
      managerId: result.manager.id,
      managerName: result.manager.name,
      clubName: result.manager.club || "",
      isCommissioner: Boolean(result.manager.isCommissioner),
      accessCode
    };

    localStorage.setItem(App.auth.storageKey, JSON.stringify(App.auth.currentSession));

    if (!App.auth.currentSession.isCommissioner) {
      await App.auth.generateDueDecisions();
      await App.auth.loadMyDecisions();
      await App.auth.loadMyTransferProposals();
      await App.auth.loadMyTransferTargets();
      await App.auth.loadMySponsorships();
      await App.auth.loadMyQoL();
    }
    await App.governance?.loadData?.();
    await App.auth.loadPublicNews();
    App.auth.renderAll();

    return result;
  },

  logout() {
    App.auth.currentSession = null;
    App.auth.myDecisions = [];
    App.auth.myTransferProposals = [];
    App.auth.myTransferTargets = [];
    App.auth.myTransferTargetsLoaded = false;
    App.auth.mySponsorships = null;
    App.auth.myQoL = null;
    App.auth.myFavorites = [];
    App.auth.myNotifications = [];
    localStorage.removeItem(App.auth.storageKey);
    App.auth.renderAll();
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
      console.warn("Propostas de transferencia indisponiveis:", error);
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
      await App.api.rpc("app_process_sponsorship_rewards", {
        p_manager_id: session.managerId,
        p_access_code: session.accessCode
      }, 45000);
    } catch (error) {
      console.warn("Processamento de bônus de patrocínio indisponível:", error);
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
      return App.auth.myQoL;
    } catch (error) {
      console.warn("Central privada/QoL indisponível:", error);
      App.auth.myQoL = null;
      App.auth.myFavorites = [];
      App.auth.myNotifications = [];
      return null;
    }
  },

  getFavoriteKey(type, key) {
    return `${App.utils.normalizeText(type)}|${App.utils.normalizeText(key)}`;
  },

  isFavorite(type, key) {
    const favoriteKey = App.auth.getFavoriteKey(type, key);
    return (App.auth.myFavorites || []).some(item => App.auth.getFavoriteKey(item.item_type, item.item_key) === favoriteKey);
  },

  async upsertFavorite(payload = {}) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para favoritar.");

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
    return result;
  },

  async deleteFavorite(type, key) {
    const session = App.auth.getSession();
    if (!session || session.isCommissioner) throw new Error("Faça login como técnico para remover favorito.");

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
    return result;
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
      console.warn("Geração automática de decisões indisponível:", error);
      return null;
    } finally {
      App.auth.autoDecisionRunning = false;
    }
  },

  async generateDecision() {
    const session = App.auth.getSession();
    if (!session) throw new Error("Faça login como técnico antes de sortear decisões.");

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
    if (!session) throw new Error("Faça login como técnico antes de responder decisões.");

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
      App.auth.loadMySponsorships(),
      App.auth.loadMyQoL(),
      App.auth.loadPublicNews()
    ]);

    App.main?.renderCurrentView?.();
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
    const managers = App.utils?.getHumanBuyers ? App.utils.getHumanBuyers() : ["Henrique", "Willian", "Rafael", "Renato"];
    const loginOptions = [...managers, "Comissário da Liga"];

    if (session) {
      panel.innerHTML = `
        <div class="manager-session-card is-logged">
          <div>
            <span>${session.isCommissioner ? "Login do comissário" : "Login do técnico"}</span>
            <strong>${App.utils.escapeHtml(session.managerName)}</strong>
            <small>${App.utils.escapeHtml(session.clubName || "Clube vinculado")} · ${session.isCommissioner ? "governança liberada" : "decisões privadas liberadas"}</small>
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
      <form class="manager-login-card" id="managerLoginForm">
        <div>
          <span>Login da liga</span>
          <strong>Área privada</strong>
          <small>Técnicos acessam decisões próprias. O comissário acessa as ferramentas de governança.</small>
        </div>
        <label>
          Perfil
          <select name="managerName" required>
            ${loginOptions.map(name => `<option value="${App.utils.escapeHtml(name)}">${App.utils.escapeHtml(name)}</option>`).join("")}
          </select>
        </label>
        <label>
          Código
          <input name="accessCode" type="password" inputmode="numeric" placeholder="PIN" required />
        </label>
        <button type="submit" class="primary-button">Entrar</button>
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
        button.textContent = "Entrar";
      }
    });
  },

  renderDecisionCenter() {
    const panel = document.getElementById("decisionCenter");
    if (!panel) return;

    const session = App.auth.getSession();

    if (!session) {
      panel.innerHTML = `
        <section class="decision-private-card decision-locked">
          <div>
            <span>Central de decisões</span>
            <strong>Faça login para ver seus eventos privados</strong>
            <p>Cada técnico só consegue responder as próprias decisões. O resultado aparece publicamente no Jornal da Liga.</p>
          </div>
          <b>🔐</b>
        </section>
      `;
      return;
    }

    const pending = App.auth.myDecisions.filter(item => item.status === "pending");
    const resolved = App.auth.myDecisions.filter(item => item.status !== "pending").slice(0, 4);

    panel.innerHTML = `
      <section class="decision-private-card">
        <div class="decision-header">
          <div>
            <span>Central de decisões</span>
            <strong>${pending.length ? `${pending.length} decisão(ões) pendente(s)` : "Nenhuma decisão pendente"}</strong>
            <p>${App.utils.escapeHtml(session.managerName)}, responda seus eventos privados. Outros técnicos não conseguem decidir por você.</p>
          </div>
          <span class="decision-auto-pill">Sorteio automático até 23:59</span>
        </div>

        ${pending.length ? `
          <div class="decision-grid">
            ${pending.map(item => App.auth.renderDecisionCard(item)).join("")}
          </div>
        ` : `
          <div class="decision-empty">
            <span>🗞️</span>
            <strong>A mesa está limpa</strong>
            <p>As decisões aparecem automaticamente durante o dia. Se não forem respondidas até 23:59, expiram e o app limpa para o próximo dia.</p>
          </div>
        `}

        ${resolved.length ? `
          <div class="decision-history">
            <strong>Últimas decisões resolvidas</strong>
            ${resolved.map(item => `
              <div>
                <span>${App.utils.escapeHtml(item.title)}</span>
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
        <article class="coach-panel-card coach-decision-card coach-decision-locked-card">
          <div class="home-panel-header">
            <h2>Central de decisões</h2>
            <span class="coach-section-kicker">Login necessário</span>
          </div>
          <div class="coach-empty-state decision-empty-visible">
            <span>🔐</span>
            <div>
              <strong>Decisões privadas do técnico</strong>
              <p>Faça login para ver e responder os eventos de Sim/Não. As consequências aparecem publicamente no Jornal da Liga.</p>
            </div>
          </div>
        </article>
      `;
    }

    if (App.utils.normalizeText(session.managerName) !== App.utils.normalizeText(owner)) {
      return `
        <article class="coach-panel-card coach-decision-card coach-decision-locked-card">
          <div class="home-panel-header">
            <h2>Central de decisões</h2>
            <span class="coach-section-kicker">Privado</span>
          </div>
          <div class="coach-empty-state decision-empty-visible">
            <span>🧤</span>
            <div>
              <strong>Painel protegido</strong>
              <p>Você está logado como ${App.utils.escapeHtml(session.managerName)}. Para decidir eventos de ${App.utils.escapeHtml(owner)}, entre com o PIN desse técnico.</p>
            </div>
          </div>
        </article>
      `;
    }

    const pending = App.auth.myDecisions.filter(item => item.status === "pending");
    const resolved = App.auth.myDecisions.filter(item => item.status !== "pending").slice(0, 3);

    return `
      <article class="coach-panel-card coach-decision-card">
        <div class="home-panel-header">
          <div>
            <h2>Central de decisões</h2>
            <p class="coach-card-subtitle">Eventos privados de Sim/Não. Sorteio automático durante o dia; expira às 23:59.</p>
          </div>
          <span class="coach-section-kicker">${pending.length} pendente(s)</span>
        </div>

        ${pending.length ? `
          <div class="coach-decision-grid">
            ${pending.map(item => App.auth.renderDecisionCard(item)).join("")}
          </div>
        ` : `
          <div class="coach-empty-state decision-empty-visible">
            <span>🗞️</span>
            <div>
              <strong>Nenhuma decisão pendente</strong>
              <p>Quando o sorteio automático cair para ${App.utils.escapeHtml(session.managerName)}, as opções aparecem aqui.</p>
            </div>
          </div>
        `}

        ${resolved.length ? `
          <div class="coach-decision-history">
            <strong>Últimas decisões</strong>
            ${resolved.map(item => `
              <div>
                <span>${App.utils.escapeHtml(item.title)}</span>
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
            <p class="coach-card-subtitle">Ofertas de outros técnicos pelos seus jogadores.</p>
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
          <div class="sponsor-active-list">
            ${active.map(item => `
              <div class="sponsor-active-item">
                <span>${App.utils.escapeHtml(item.category || "Patrocínio")}</span>
                <strong>${App.utils.escapeHtml(item.title)}</strong>
                <small>${App.utils.escapeHtml(item.sponsor_name)} · ${Number(item.claims_used || 0)}/${Number(item.max_claims || 0)} bônus pagos · ${App.utils.formatCurrency(item.reward_value)}</small>
                <p class="sponsor-condition-line">
                  Critério: ${App.utils.escapeHtml(App.auth.getSponsorshipConditionLabel(item))}
                  ${Number(item.termination_fee || 0) > 0 ? ` · multa atual ${App.utils.formatCurrency(item.termination_fee)}` : ""}
                </p>
              </div>
            `).join("")}
          </div>
        ` : `<p class="calendar-muted">Nenhum patrocinador ativo. Escolha com cuidado: as luvas são menores e o dinheiro forte depende das metas.</p>`}

        ${offers.length ? `
          <div class="sponsor-market-note">
            <strong>${active.length}/${maxActive} contratos ativos · ${slotsLeft} vaga(s) livre(s)</strong>
            <span>${offers.length} proposta(s) em ${offerCategories.length} categoria(s). Propostas da mesma categoria substituem o contrato atual e aplicam multa de rescisão.</span>
          </div>
          <div class="sponsor-category-list">
            ${offerCategories.map(category => `
              <section class="sponsor-category-group">
                <div class="sponsor-category-header">
                  <strong>${App.utils.escapeHtml(category)}</strong>
                  <span>${offersByCategory[category].length} proposta(s)</span>
                </div>
                <div class="sponsor-offer-grid">
                  ${offersByCategory[category].map(offer => `
                    <article class="sponsor-offer-card">
                      <span>${App.utils.escapeHtml(offer.riskLevel || "Meta comercial")}</span>
                      <strong>${App.utils.escapeHtml(offer.title)}</strong>
                      <em>${App.utils.escapeHtml(offer.sponsorName)}</em>
                      <p>${App.utils.escapeHtml(offer.description)}</p>
                      <small>
                        Luvas ${App.utils.formatCurrency(offer.signingBonus)} · ${App.utils.escapeHtml(offer.conditionLabel || "Meta cumprida")} paga ${App.utils.formatCurrency(offer.rewardValue)}
                        ${offer.isReplacement ? ` · substitui ${App.utils.escapeHtml(offer.currentSponsorName || "contrato atual")} por ${App.utils.formatCurrency(offer.terminationFee || 0)}` : ""}
                      </small>
                      <button type="button" data-sponsor-offer="${App.utils.escapeHtml(offer.id)}" data-sponsor-fee="${Number(offer.terminationFee || 0)}" data-sponsor-replacement="${offer.isReplacement ? "true" : "false"}">
                        ${offer.isReplacement ? "Trocar contrato" : "Assinar"}
                      </button>
                    </article>
                  `).join("")}
                </div>
              </section>
            `).join("")}
          </div>
        ` : slotsLeft <= 0 ? `<p class="calendar-muted">Limite comercial preenchido. Novas propostas aparecem quando houver categoria substituível ou vaga livre.</p>` : ""}

        ${rewards.length ? `
          <div class="sponsor-reward-list">
            <strong>Últimos pagamentos</strong>
            ${rewards.map(item => `
              <div>
                <span>${App.utils.escapeHtml(item.sponsor_name)}</span>
                <b>${App.utils.formatCurrency(item.reward_value)}</b>
              </div>
            `).join("")}
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
      "away_win": "Vencer como visitante"
    };

    return labels[condition] || "Meta comercial cumprida";
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

        if (!confirm(`Confirmar resposta "${label}"? A consequência será aplicada e publicada no Jornal da Liga.`)) return;

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

        if (!confirm(`Deseja ${label} esta proposta?`)) return;

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
        const message = isReplacement
          ? `Trocar para este patrocínio? A multa de rescisão estimada é ${App.utils.formatCurrency(fee)} e será debitada do orçamento.`
          : "Assinar este patrocínio? Ele ficará ativo e pagará bônus quando as metas forem cumpridas.";
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
    return `
      <article class="decision-card transfer-proposal-item">
        <div class="decision-card-top">
          <span>Oferta interna</span>
          <b>${App.utils.escapeHtml(item.status || "pending")}</b>
        </div>
        <h3>${App.utils.escapeHtml(item.player)}</h3>
        <p>${App.utils.escapeHtml(item.buyer)} ofereceu ${App.utils.formatCurrency(item.proposed_value)} por este jogador.</p>
        <div class="proposal-meta">
          <span>OVR ${App.utils.escapeHtml(item.overall || "-")}</span>
          <span>${App.utils.escapeHtml(item.from_club || "Negociação interna")}</span>
        </div>
        <div class="decision-options">
          <button type="button" data-transfer-proposal-answer data-proposal-id="${item.id}" data-decision="accepted">
            <strong>Aceitar</strong>
            <small>Vende o jogador e recebe o valor.</small>
          </button>
          <button type="button" data-transfer-proposal-answer data-proposal-id="${item.id}" data-decision="rejected">
            <strong>Recusar</strong>
            <small>A proposta é encerrada sem movimentação.</small>
          </button>
        </div>
      </article>
    `;
  },

  renderTransferProposalSummary(item) {
    return `
      <article class="proposal-summary-item">
        <span>${App.utils.escapeHtml(item.status || "pending")}</span>
        <strong>${App.utils.escapeHtml(item.player)}</strong>
        <small>${App.utils.escapeHtml(item.seller)} · ${App.utils.formatCurrency(item.proposed_value)}</small>
      </article>
    `;
  },

  renderDecisionCard(item) {
    return `
      <article class="decision-card">
        <div class="decision-card-top">
          <span>${App.utils.escapeHtml(item.category || "Evento")}</span>
          <b>Privado</b>
        </div>
        <h3>${App.utils.escapeHtml(item.title)}</h3>
        <p>${App.utils.escapeHtml(item.description)}</p>
        <div class="decision-options">
          <button type="button" data-decision-answer data-decision-id="${item.id}" data-choice="yes">
            <strong>${App.utils.escapeHtml(item.yes_label || "Sim")}</strong>
            <small>${App.utils.escapeHtml(item.yes_preview || "Aplicar consequência positiva/arriscada.")}</small>
          </button>
          <button type="button" data-decision-answer data-decision-id="${item.id}" data-choice="no">
            <strong>${App.utils.escapeHtml(item.no_label || "Não")}</strong>
            <small>${App.utils.escapeHtml(item.no_preview || "Recusar e aceitar a consequência alternativa.")}</small>
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

        session.accessCode = newPin;
        App.auth.currentSession = session;
        localStorage.setItem(App.auth.storageKey, JSON.stringify(session));

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
                ${App.utils.escapeHtml(item.title)} · ${App.utils.escapeHtml(item.body || "")}
              </span>
            `).join("") : `<span class="calendar-muted">Nenhum aviso privado agora.</span>`}
          </div>
          <div>
            <strong>Favoritos</strong>
            ${favorites.length ? favorites.slice(0, 5).map(item => `
              <span class="manager-qol-pill info">${App.utils.escapeHtml(item.title)} · ${App.utils.escapeHtml(item.detail || item.item_type || "")}</span>
            `).join("") : `<span class="calendar-muted">Favorite alvos e atalhos no painel do técnico.</span>`}
          </div>
        </div>
      </section>
    `;

    target.querySelector("[data-mark-notifications-read]")?.addEventListener("click", async () => {
      await App.auth.markNotificationsRead().catch(error => console.warn("Não consegui marcar notificações:", error));
    });
  },

  renderLeagueNews() {
    const panel = document.getElementById("leagueNewsPanel");
    if (!panel) return;

    const news = App.auth.publicNews || [];

    panel.innerHTML = `
      <section class="league-news-card">
        <div class="league-news-header">
          <div>
            <span>Jornal da Liga</span>
            <strong>Manchetes dos bastidores</strong>
          </div>
          <small>Decisões privadas viram notícia pública aqui.</small>
        </div>

        ${news.length ? `
          <div class="league-news-list">
            ${news.map(item => `
              <article>
                <span>${App.utils.escapeHtml(item.manager_name || "Liga")}</span>
                <strong>${App.utils.escapeHtml(item.headline)}</strong>
                <p>${App.utils.escapeHtml(item.summary)}</p>
                <small>${App.utils.escapeHtml(item.impact_text || "")}</small>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="league-news-empty">
            <strong>Nenhuma manchete publicada ainda</strong>
            <p>Quando um técnico responder uma decisão privada, o desenrolar aparece aqui como notícia da liga.</p>
          </div>
        `}
      </section>
    `;
  }
};

document.addEventListener("DOMContentLoaded", () => App.auth.init());
