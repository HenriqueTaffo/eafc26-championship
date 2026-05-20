window.App = window.App || {};

App.api = {
  async fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  },

  getSupabaseHeaders() {
    return {
      "apikey": App.config.SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${App.config.SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json"
    };
  },

  async rpc(functionName, payload = {}, timeoutMs = 45000) {
    const response = await App.api.fetchWithTimeout(
      `${App.config.SUPABASE_URL}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: App.api.getSupabaseHeaders(),
        body: JSON.stringify(payload)
      },
      timeoutMs
    );

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = text;
    }

    if (!response.ok) {
      const message = data?.message || data?.hint || data?.details || text || `Erro Supabase ${response.status}`;
      throw new Error(message);
    }

    return data;
  },

  async loadApiData(options = {}) {
    const {
      showLoader = true,
      variant = App.main?.getDefaultLoaderVariant ? App.main.getDefaultLoaderVariant() : "match",
      title = "Atualizando dados",
      message = "Aguarde enquanto os dados mais recentes são consultados."
    } = options;

    if (showLoader && App.main?.showLoader) {
      App.main.showLoader({ variant, title, message });
    }

    try {
      const data = await App.api.rpc("app_get_data", {}, 45000);
      if (!data.ok) throw new Error(data.error || data.message || "Erro ao carregar Supabase.");

      App.state.apiResults = data.results || [];
      App.state.apiTransfers = data.transfers || [];
      App.state.apiEvents = data.events || [];
      App.state.apiClubs = data.clubs || [];

      if (Array.isArray(data.eventSlots) && data.eventSlots.length) {
        App.config.eventSlots = data.eventSlots.map(Number);
      }

      if (data.budget !== undefined) App.config.transferBudget = Number(data.budget);
      if (data.homeMatchBonus !== undefined) App.config.homeMatchBonus = Number(data.homeMatchBonus);
      if (data.winBonus !== undefined) App.config.winBonus = Number(data.winBonus);
      if (data.dailyTransferLimit !== undefined) App.config.baseDailyTransferLimit = Number(data.dailyTransferLimit);

      App.state.apiLoaded = true;
      App.main.renderAll();
      return data;
    } catch (error) {
      const hadPreviousData = App.state.apiLoaded && (
        (App.state.apiResults || []).length ||
        (App.state.apiTransfers || []).length ||
        (App.state.apiEvents || []).length
      );

      if (!hadPreviousData) {
        App.state.apiLoaded = false;
      }

      console.error(error);

      if (hadPreviousData) {
        App.main.renderCurrentView();
      }

      const resultMessage = document.getElementById("resultMessage");
      const errorMessage = error.name === "AbortError"
        ? "O Supabase demorou demais para responder. Tente novamente em alguns segundos."
        : `Não consegui carregar o Supabase: ${error.message}`;

      App.utils.setMessage(resultMessage, errorMessage, "error");
      throw error;
    } finally {
      if (showLoader && App.main?.hideLoader) {
        App.main.hideLoader();
      }
    }
  },

  mapResultPayload(payload) {
    return {
      p_pin: App.config.API_PIN,
      p_competition: payload.competition,
      p_week: Number(payload.week),
      p_phase: payload.phase,
      p_home: payload.home,
      p_away: payload.away,
      p_home_score: Number(payload.homeScore),
      p_away_score: Number(payload.awayScore),
      p_goal_details: payload.goalDetails || "",
      p_assist_details: payload.assistDetails || "",
      p_penalty_winner: payload.penaltyWinner || "",
      p_penalty_score: payload.penaltyScore || "",
      p_submitted_by: payload.submittedBy || ""
    };
  },

  async postToApi(payload) {
    if (payload.action === "addResult") {
      return App.api.rpc("app_add_result", App.api.mapResultPayload(payload), 45000);
    }

    if (payload.action === "addTransfer") {
      return App.api.rpc("app_add_transfer", {
        p_pin: App.config.API_PIN,
        p_buyer: payload.buyer,
        p_player: payload.player,
        p_from_club: payload.fromClub,
        p_overall: Number(payload.overall),
        p_market_value: Number(payload.marketValue)
      }, 45000);
    }

    if (payload.action === "generateDueEvents") {
      return App.api.rpc("app_generate_due_events", {
        p_pin: App.config.API_PIN
      }, 45000);
    }

    if (payload.action === "simulateCpuWeek") {
      return App.api.simulateCpuWeek(payload);
    }

    return {
      ok: false,
      message: "Ação inválida."
    };
  },

  getTeamStrength(teamName) {
    const club = (App.state.apiClubs || []).find(item => App.utils.sameTeamName(item.Time, teamName));
    return Number(club?.Forca || 70);
  },

  simulateScore(home, away) {
    const homeStrength = App.api.getTeamStrength(home);
    const awayStrength = App.api.getTeamStrength(away);
    const homeAdvantage = 3;

    const homeExpected = 1.2 + ((homeStrength + homeAdvantage - awayStrength) / 18);
    const awayExpected = 1.0 + ((awayStrength - homeStrength) / 18);

    return {
      homeScore: Math.max(0, Math.min(5, Math.round(homeExpected + Math.random() * 2.2 - 0.7))),
      awayScore: Math.max(0, Math.min(5, Math.round(awayExpected + Math.random() * 2.0 - 0.6)))
    };
  },

  async simulateCpuWeek(payload) {
    const week = Number(payload.week);
    const submittedBy = payload.submittedBy || "Liga";
    const matches = App.calendar.getCalendarEvents()
      .filter(event => event.competition === "Championship")
      .filter(event => Number(event.week) === week);

    const humanMatches = matches.filter(event => App.calendar.involvesOurTeam(event));
    const missingHumanMatches = humanMatches.filter(event => App.calendar.getStatusClass(event) !== "done");

    if (missingHumanMatches.length > 0) {
      return {
        ok: false,
        created: 0,
        message: `Ainda existem ${missingHumanMatches.length} jogo(s) com técnico sem resultado nesta semana.`
      };
    }

    const cpuMatches = matches
      .filter(event => !App.calendar.involvesOurTeam(event))
      .filter(event => App.calendar.getStatusClass(event) !== "done");

    let created = 0;
    let rejected = 0;

    for (const match of cpuMatches) {
      const score = App.api.simulateScore(match.home, match.away);

      const response = await App.api.rpc("app_add_result", {
        p_pin: App.config.API_PIN,
        p_competition: "Championship",
        p_week: week,
        p_phase: match.phase,
        p_home: match.home,
        p_away: match.away,
        p_home_score: score.homeScore,
        p_away_score: score.awayScore,
        p_goal_details: "",
        p_assist_details: "",
        p_penalty_winner: "",
        p_penalty_score: "",
        p_submitted_by: submittedBy
      }, 45000);

      if (response.ok) created += 1;
      else rejected += 1;
    }

    return {
      ok: true,
      created,
      rejected,
      message: `${created} jogo(s) CPU x CPU simulados na semana ${week}.${rejected ? ` ${rejected} já existiam ou foram rejeitados.` : ""}`
    };
  }
};
