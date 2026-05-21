window.App = window.App || {};

App.auth = {
  storageKey: "mistura_manager_session_v1",
  currentSession: null,
  publicNews: [],
  myDecisions: [],
  autoDecisionRunning: false,

  init() {
    try {
      const raw = localStorage.getItem(App.auth.storageKey);
      App.auth.currentSession = raw ? JSON.parse(raw) : null;
    } catch (error) {
      App.auth.currentSession = null;
    }

    App.auth.renderAll();
    App.auth.generateDueDecisions();
  },

  getSession() {
    return App.auth.currentSession;
  },

  isLoggedIn() {
    const session = App.auth.getSession();
    return Boolean(session?.managerId && session?.accessCode);
  },

  async login(managerName, accessCode) {
    const result = await App.api.rpc("app_login_manager", {
      p_manager_name: managerName,
      p_access_code: accessCode
    }, 30000);

    if (!result.ok) throw new Error(result.message || "Login não autorizado.");

    App.auth.currentSession = {
      managerId: result.manager.id,
      managerName: result.manager.name,
      clubName: result.manager.club || "",
      accessCode
    };

    localStorage.setItem(App.auth.storageKey, JSON.stringify(App.auth.currentSession));

    await App.auth.generateDueDecisions();
    await App.auth.loadMyDecisions();
    await App.auth.loadPublicNews();
    App.auth.renderAll();

    return result;
  },

  logout() {
    App.auth.currentSession = null;
    App.auth.myDecisions = [];
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

  async generateDueDecisions() {
    if (App.auth.autoDecisionRunning) return null;

    try {
      App.auth.autoDecisionRunning = true;
      const result = await App.api.rpc("app_generate_due_decision_events", {}, 30000);
      await App.auth.loadPublicNews();

      if (App.auth.isLoggedIn()) {
        await App.auth.loadMyDecisions();
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

    await App.auth.loadMyDecisions();
    await App.auth.loadPublicNews();
    App.auth.renderAll();

    return result;
  },

  renderAll() {
    App.auth.renderLoginPanel();
    App.auth.renderDecisionCenter();
    App.auth.renderLeagueNews();
  },

  renderLoginPanel() {
    const panel = document.getElementById("managerLoginPanel");
    if (!panel) return;

    const session = App.auth.getSession();
    const managers = App.utils?.getHumanBuyers ? App.utils.getHumanBuyers() : ["Henrique", "Willian", "Rafael", "Renato"];

    if (session) {
      panel.innerHTML = `
        <div class="manager-session-card is-logged">
          <div>
            <span>Login do técnico</span>
            <strong>${App.utils.escapeHtml(session.managerName)}</strong>
            <small>${App.utils.escapeHtml(session.clubName || "Clube vinculado")} · decisões privadas liberadas</small>
          </div>
          <div class="manager-session-actions">
            <button type="button" class="ghost-button" data-auth-action="logout">Sair</button>
          </div>
        </div>
      `;

      panel.querySelector('[data-auth-action="logout"]')?.addEventListener("click", () => App.auth.logout());

      return;
    }

    panel.innerHTML = `
      <form class="manager-login-card" id="managerLoginForm">
        <div>
          <span>Login do técnico</span>
          <strong>Decisões privadas</strong>
          <small>Entre com seu código para responder apenas os seus eventos de Sim/Não.</small>
        </div>
        <label>
          Técnico
          <select name="managerName" required>
            ${managers.map(name => `<option value="${App.utils.escapeHtml(name)}">${App.utils.escapeHtml(name)}</option>`).join("")}
          </select>
        </label>
        <label>
          Código
          <input name="accessCode" type="password" inputmode="numeric" placeholder="PIN do técnico" required />
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

    panel.querySelectorAll("[data-decision-answer]").forEach(button => {
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

  renderPinChangeCard() {
    const session = App.auth.getSession();

    if (!session) {
      return `
        <section class="coach-panel-card pin-change-card">
          <div class="home-panel-header">
            <h2>PIN do técnico</h2>
            <span class="coach-section-kicker">Bloqueado</span>
          </div>
          <div class="coach-empty-state">
            <span>🔐</span>
            <strong>Faça login para alterar seu PIN</strong>
            <p>A troca de PIN só aparece para o técnico logado.</p>
          </div>
        </section>
      `;
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
