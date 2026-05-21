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


  async loadMarketPlayers(query = "", showContracted = false, limit = 12) {
    try {
      const data = await App.api.rpc("app_search_market_players", {
        p_query: query || "",
        p_show_contracted: Boolean(showContracted),
        p_limit: Number(limit || 12)
      }, 30000);

      App.state.apiMarketPlayers = Array.isArray(data) ? data : [];
      return App.state.apiMarketPlayers;
    } catch (rpcError) {
      console.warn("Busca RPC players_market indisponível, tentando leitura direta:", rpcError);

      try {
        const response = await App.api.fetchWithTimeout(
          `${App.config.SUPABASE_URL}/rest/v1/players_market?select=id,name,club,league,country,position,age,market_value_eur,transfermarkt_url,source,last_synced_at&order=name.asc&limit=200`,
          {
            method: "GET",
            headers: App.api.getSupabaseHeaders()
          },
          30000
        );

        if (!response.ok) {
          App.state.apiMarketPlayers = [];
          return [];
        }

        const data = await response.json();
        App.state.apiMarketPlayers = Array.isArray(data) ? data : [];
        return App.state.apiMarketPlayers;
      } catch (error) {
        console.warn("Não consegui carregar players_market:", error);
        App.state.apiMarketPlayers = [];
        return [];
      }
    }
  },


  async loadMatches() {
    try {
      const data = await App.api.rpc("app_get_matches", {}, 45000);
      App.state.apiMatches = Array.isArray(data) ? data : [];
      return App.state.apiMatches;
    } catch (error) {
      console.warn("Não consegui carregar public.matches via app_get_matches:", error);
      App.state.apiMatches = [];
      return [];
    }
  },

  async loadMatchAudit(week = null) {
    try {
      return await App.api.rpc("app_get_match_audit", {
        p_week: week ? Number(week) : null
      }, 45000);
    } catch (error) {
      console.warn("Auditoria de partidas indisponível:", error);
      return {
        ok: false,
        week: week || null,
        summary: {},
        matches: [],
        message: error.message || "Não consegui carregar auditoria de partidas."
      };
    }
  },

  async loadSponsorshipRewardTotals() {
    try {
      const totals = await App.api.rpc("app_get_sponsorship_reward_totals", {}, 30000);
      return totals && typeof totals === "object" && !Array.isArray(totals) ? totals : {};
    } catch (error) {
      console.warn("Totais de patrocínio indisponíveis:", error);
      return {};
    }
  },

  getSponsorshipEventTotalByManager(events = []) {
    return (events || []).reduce((acc, event) => {
      const manager = event.Jogador || event.manager_name || "";
      const title = App.utils.normalizeText(event.Titulo || event.title || "");
      const isSponsorshipReward = title.includes("bonus de patrocinio");
      if (!manager || !isSponsorshipReward) return acc;

      acc[manager] = (acc[manager] || 0) + Number(event.ImpactoFinanceiro || event.financial_impact || 0);
      return acc;
    }, {});
  },

  getPerformanceBudgetStats(results = []) {
    return App.utils.getHumanBuyers().reduce((acc, buyer) => {
      acc[buyer] = { homeMatches: 0, wins: 0 };
      return acc;
    }, {});
  },

  reconcileApiBudgets(data, sponsorshipRewardTotals = {}) {
    const budgets = data.budgets || {};
    const stats = App.api.getPerformanceBudgetStats(data.results || []);
    const sponsorshipEventTotals = App.api.getSponsorshipEventTotalByManager(data.events || []);

    (data.results || [])
      .filter(result => App.utils.normalizeText(result.Status) === "aprovado")
      .filter(result => App.utils.normalizeText(result.Competicao) === "championship")
      .forEach(result => {
        const homeTeam = App.utils.getTeamByName(result.Mandante);
        const awayTeam = App.utils.getTeamByName(result.Visitante);
        const homeScore = Number(result.GolsMandante);
        const awayScore = Number(result.GolsVisitante);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

        if (homeTeam?.status === "Nosso" && stats[homeTeam.owner]) stats[homeTeam.owner].homeMatches += 1;
        if (homeScore > awayScore && homeTeam?.status === "Nosso" && stats[homeTeam.owner]) stats[homeTeam.owner].wins += 1;
        if (awayScore > homeScore && awayTeam?.status === "Nosso" && stats[awayTeam.owner]) stats[awayTeam.owner].wins += 1;
      });

    return App.utils.getHumanBuyers().reduce((acc, buyer) => {
      const current = budgets[buyer] || {};
      const buyerStats = stats[buyer] || { homeMatches: 0, wins: 0 };
      const baseBudget = Number(current.baseBudget ?? data.budget ?? App.config.transferBudget);
      const spentTotal = Number(current.spentTotal ?? 0);
      const homeBonus = buyerStats.homeMatches * App.config.homeMatchBonus;
      const winBonusValue = buyerStats.wins * App.config.winBonus;
      const sponsorshipRewards = Number(sponsorshipRewardTotals[buyer] || 0);
      const sponsorshipEvents = Number(sponsorshipEventTotals[buyer] || 0);
      const eventTotal = Number(current.eventTotal ?? 0) - sponsorshipEvents + sponsorshipRewards;
      const totalBudget = baseBudget + homeBonus + winBonusValue + eventTotal;

      acc[buyer] = {
        ...current,
        baseBudget,
        homeMatches: buyerStats.homeMatches,
        wins: buyerStats.wins,
        homeBonus,
        winBonusValue,
        sponsorshipRewards,
        eventTotal,
        totalBudget,
        spentTotal,
        remainingBudget: totalBudget - spentTotal
      };

      return acc;
    }, {});
  },

  getDbMatchEvents() {
    return (App.state.apiMatches || []).map(row => {
      const homeScore = row.home_score === null || row.home_score === undefined ? null : Number(row.home_score);
      const awayScore = row.away_score === null || row.away_score === undefined ? null : Number(row.away_score);
      const competition = row.competition || "Championship";
      const matchDate = row.match_date ? new Date(`${row.match_date}T12:00:00`) : App.utils.getCupDate(Number(row.week || 1));

      return {
        id: `db-match-${row.id}`,
        dbId: row.id,
        date: matchDate,
        week: Number(row.week || 0),
        competition,
        className: competition === "Championship" ? "championship" : competition === "Copa da Liga" ? "league-cup" : "fa-cup",
        phase: row.phase || "",
        matchOrder: row.match_order === null || row.match_order === undefined ? null : Number(row.match_order),
        home: row.home || "",
        away: row.away || "",
        homeScore,
        awayScore,
        penaltyWinner: row.penalty_winner || "",
        penaltyScore: row.penalty_score || "",
        status: typeof homeScore === "number" && typeof awayScore === "number"
          ? "Finalizado"
          : (row.status_pt || row.status || "Pendente")
      };
    });
  },

  isCupCompetition(competition) {
    return App.utils.normalizeText(competition) !== "championship";
  },

  isPlayablePendingMatch(event) {
    if (!event) return false;
    if (!event.home || !event.away) return false;
    if (App.cups?.hasPlaceholderTeam?.(event)) return false;
    if (String(event.status || "").toLowerCase().includes("aguardando")) return false;
    return App.calendar.getStatusClass(event) !== "done";
  },

  getSimulationWeekEvents(week) {
    const targetWeek = Number(week);
    const dbEvents = App.api.getDbMatchEvents();
    const calendarEvents = App.calendar.getCalendarEvents();
    const source = dbEvents.length ? dbEvents : calendarEvents;
    const byKey = new Map();

    source
      .filter(event => Number(event.week) === targetWeek)
      .forEach(event => {
        const key = [
          App.utils.normalizeText(event.competition),
          App.utils.normalizeText(event.phase),
          App.utils.normalizeTeamName(event.home),
          App.utils.normalizeTeamName(event.away)
        ].join("|");
        byKey.set(key, event);
      });

    calendarEvents
      .filter(event => Number(event.week) === targetWeek)
      .forEach(event => {
        const key = [
          App.utils.normalizeText(event.competition),
          App.utils.normalizeText(event.phase),
          App.utils.normalizeTeamName(event.home),
          App.utils.normalizeTeamName(event.away)
        ].join("|");
        if (!byKey.has(key)) byKey.set(key, event);
      });

    return [...byKey.values()].sort((a, b) =>
      (a.competition || "").localeCompare(b.competition || "") ||
      Number(a.matchOrder || 999) - Number(b.matchOrder || 999) ||
      String(a.phase || "").localeCompare(String(b.phase || ""))
    );
  },

  getCpuSimulationReport(week) {
    const events = App.api.getSimulationWeekEvents(week);
    const playable = events.filter(event => App.api.isPlayablePendingMatch(event));
    const humanPending = playable.filter(event => App.calendar.getMatchOwners(event).length > 0);
    const cpuPending = playable.filter(event => App.calendar.getMatchOwners(event).length === 0);
    const done = events.filter(event => App.calendar.getStatusClass(event) === "done");
    const waiting = events.filter(event => !App.api.isPlayablePendingMatch(event) && App.calendar.getStatusClass(event) !== "done");
    const competitions = [...new Set(events.map(event => event.competition).filter(Boolean))];

    return { events, playable, humanPending, cpuPending, done, waiting, competitions };
  },

  generatePenaltyShootout(home, away) {
    const homeWins = Math.random() >= 0.5;
    const winnerPens = 4 + Math.floor(Math.random() * 3);
    const loserPens = Math.max(0, winnerPens - 1 - Math.floor(Math.random() * 2));
    const homePens = homeWins ? winnerPens : loserPens;
    const awayPens = homeWins ? loserPens : winnerPens;

    return {
      winner: homeWins ? home : away,
      score: `${homePens} x ${awayPens}`
    };
  },

  async renderCpuSimulationPreview(weekValue) {
    const container = document.getElementById("cpuSimulationPreview");
    if (!container) return;

    const week = Number(weekValue || 0);

    container.innerHTML = `
      <div class="sim-preview-shell is-loading">
        <div class="sim-preview-title">
          <strong>${week ? `Analisando semana ${week}` : "Mapa de pendências"}</strong>
          <span>Consultando o banco oficial...</span>
        </div>
      </div>
    `;

    const audit = await App.api.loadMatchAudit(week || null);
    const matches = Array.isArray(audit.matches) ? audit.matches : [];

    if (!audit.ok) {
      container.innerHTML = `<div class="sim-preview-empty">${App.utils.escapeHtml(audit.message || "Não consegui carregar a auditoria de partidas.")}</div>`;
      return;
    }

    if (!matches.length) {
      container.innerHTML = `<div class="sim-preview-empty">${week ? `Nenhum jogo encontrado na semana ${week}.` : "Nenhum jogo pendente encontrado no banco."}</div>`;
      return;
    }

    const summary = audit.summary || {};
    const pendingWeeks = [...new Set(matches
      .filter(match => match.status !== "approved")
      .map(match => match.week)
      .filter(Boolean)
    )].sort((a, b) => Number(a) - Number(b));

    const grouped = matches.reduce((acc, match) => {
      const key = week ? match.competition : `Semana ${match.week || "-"} · ${match.competition}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});

    const blocks = Object.entries(grouped).map(([title, items]) => `
      <article class="sim-competition-block">
        <div class="sim-competition-header">
          <strong>${App.utils.escapeHtml(title)}</strong>
          <span>${items.length} jogo(s)</span>
        </div>
        <div class="sim-match-list">
          ${items.map(match => {
            const isDone = match.status === "approved";
            const isCpu = match.match_type === "CPU x CPU";
            const statusLabel = isDone
              ? `${match.home_score} x ${match.away_score}${match.penalty_winner ? ` · Pên.: ${match.penalty_winner} ${match.penalty_score || ""}` : ""}`
              : match.status_label || "Pendente";

            return `
              <div class="sim-match-row ${isCpu ? "is-cpu" : "has-human"} ${isDone ? "is-done" : ""}">
                <div class="sim-match-main">
                  <strong>${App.utils.escapeHtml(match.home)} <span>x</span> ${App.utils.escapeHtml(match.away)}</strong>
                  <small>${App.utils.escapeHtml(match.phase || "-")} · ${App.utils.escapeHtml(match.match_type || "-")}</small>
                </div>
                <b>${App.utils.escapeHtml(statusLabel)}</b>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `).join("");

    const canSimulate = Number(summary.human_pending || 0) === 0 && Number(summary.cpu_pending || 0) > 0;

    container.innerHTML = `
      <div class="sim-preview-shell">
        <div class="sim-preview-title">
          <strong>${week ? `Semana ${week}` : "Pendências por semana"}</strong>
          <span>${week ? "Auditoria oficial do Supabase antes da simulação." : "Informe uma semana para simular; abaixo está o mapa geral."}</span>
        </div>

        ${!week && pendingWeeks.length ? `
          <div class="sim-week-pills">
            ${pendingWeeks.map(item => `<button type="button" data-fill-sim-week="${item}">Semana ${item}</button>`).join("")}
          </div>
        ` : ""}

        <div class="sim-preview-summary">
          <article><span>Total</span><strong>${Number(summary.total || matches.length)}</strong></article>
          <article><span>CPU x CPU pendentes</span><strong>${Number(summary.cpu_pending || 0)}</strong></article>
          <article><span>Com técnico pendentes</span><strong>${Number(summary.human_pending || 0)}</strong></article>
          <article><span>Finalizados</span><strong>${Number(summary.approved || 0)}</strong></article>
        </div>

        ${week && canSimulate ? `
          <div class="sim-ok">Semana pronta: ${Number(summary.cpu_pending || 0)} jogo(s) CPU x CPU podem ser simulados agora.</div>
        ` : ""}

        ${week && Number(summary.human_pending || 0) > 0 ? `
          <div class="sim-warning">A simulação está bloqueada: ainda existe(m) ${Number(summary.human_pending || 0)} jogo(s) com técnico pendente nessa semana.</div>
        ` : ""}

        ${week && Number(summary.cpu_pending || 0) === 0 && Number(summary.human_pending || 0) === 0 ? `
          <div class="sim-preview-empty">Não há jogos CPU x CPU pendentes para simular nessa semana.</div>
        ` : ""}

        <div class="sim-preview-grid">${blocks}</div>
      </div>
    `;

    container.querySelectorAll("[data-fill-sim-week]").forEach(button => {
      button.addEventListener("click", () => {
        const form = document.getElementById("cpuSimulationForm");
        if (!form?.elements.week) return;
        form.elements.week.value = button.dataset.fillSimWeek;
        App.api.renderCpuSimulationPreview(button.dataset.fillSimWeek);
      });
    });
  },



  async loadManagerOnboarding() {
    try {
      const result = await App.api.rpc("app_get_manager_onboarding", {}, 30000);
      const rows = Array.isArray(result) ? result : [];
      App.state.apiOnboarding = rows.reduce((acc, item) => {
        if (item.managerName) acc[item.managerName] = item;
        return acc;
      }, {});
      return App.state.apiOnboarding;
    } catch (error) {
      console.warn("Onboarding de técnicos indisponível:", error);
      App.state.apiOnboarding = {};
      return {};
    }
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
      try {
        await App.api.rpc("app_process_all_sponsorship_rewards", {}, 45000);
      } catch (sponsorshipError) {
        console.warn("Processamento automático de patrocínios indisponível:", sponsorshipError);
      }

      const data = await App.api.rpc("app_get_data", {}, 45000);
      if (!data.ok) throw new Error(data.error || data.message || "Erro ao carregar Supabase.");

      if (data.budget !== undefined) App.config.transferBudget = Number(data.budget);
      if (data.homeMatchBonus !== undefined) App.config.homeMatchBonus = Number(data.homeMatchBonus);
      if (data.winBonus !== undefined) App.config.winBonus = Number(data.winBonus);
      if (data.dailyTransferLimit !== undefined) App.config.baseDailyTransferLimit = Number(data.dailyTransferLimit);

      const sponsorshipRewardTotals = await App.api.loadSponsorshipRewardTotals();

      App.state.apiResults = data.results || [];
      App.state.apiTransfers = data.transfers || [];
      App.state.apiEvents = data.events || [];
      App.state.apiClubs = data.clubs || [];
      App.state.apiBudgets = App.api.reconcileApiBudgets(data, sponsorshipRewardTotals);
      if (Array.isArray(data.eventSlots) && data.eventSlots.length) {
        App.config.eventSlots = data.eventSlots.map(Number);
      }

      await App.api.loadMatches();
      await App.api.loadMarketPlayers();
      await App.api.loadManagerOnboarding?.();
      await App.governance?.loadData?.();
      await App.auth?.generateDueDecisions?.();
      await App.auth?.loadPublicNews?.();
      await App.auth?.loadMyDecisions?.();
      await App.auth?.loadMyTransferProposals?.();
      await App.auth?.loadMySponsorships?.();

      App.state.apiLoaded = true;
      App.main.renderAll();
      App.main?.markSynced?.();
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
      if (payload.transferType === "internal") {
        return App.api.rpc("app_create_internal_transfer_proposal", {
          p_manager_id: payload.managerId,
          p_access_code: payload.accessCode,
          p_buyer: payload.buyer,
          p_seller: payload.seller || "",
          p_player: payload.player,
          p_from_club: payload.fromClub,
          p_overall: Number(payload.overall),
          p_market_value: Number(payload.marketValue)
        }, 45000);
      }

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

    if (!week) {
      return { ok: false, created: 0, message: "Informe uma semana válida para simular." };
    }

    return App.api.rpc("app_simulate_cpu_week", {
      p_pin: App.config.API_PIN,
      p_week: week,
      p_submitted_by: submittedBy
    }, 120000);
  }
};
