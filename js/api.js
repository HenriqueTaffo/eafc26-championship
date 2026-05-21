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

  renderCpuSimulationPreview(weekValue) {
    const container = document.getElementById("cpuSimulationPreview");
    if (!container) return;

    const week = Number(weekValue || 0);
    if (!week) {
      container.innerHTML = `<div class="sim-preview-empty">Informe uma semana para ver jogos pendentes por competição.</div>`;
      return;
    }

    const report = App.api.getCpuSimulationReport(week);

    if (!report.events.length) {
      container.innerHTML = `<div class="sim-preview-empty">Nenhum jogo encontrado na semana ${week}.</div>`;
      return;
    }

    const competitionBlocks = report.competitions.map(competition => {
      const events = report.events.filter(event => event.competition === competition);
      return `
        <article class="sim-competition-block">
          <div class="sim-competition-header">
            <strong>${App.utils.escapeHtml(competition)}</strong>
            <span>${events.length} jogo(s)</span>
          </div>
          <div class="sim-match-list">
            ${events.map(event => {
              const owners = App.calendar.getMatchOwners(event);
              const type = App.calendar.getMatchType(event);
              const status = App.calendar.getStatusClass(event) === "done"
                ? App.calendar.formatMatchResult(event)
                : App.api.isPlayablePendingMatch(event)
                  ? "Pendente"
                  : (event.status || "Aguardando");
              return `
                <div class="sim-match-row ${owners.length ? "has-human" : "is-cpu"} ${App.calendar.getStatusClass(event) === "done" ? "is-done" : ""}">
                  <span>${App.clubs.getMatchupHtml(event.home, event.away, "mini-match")}</span>
                  <small>${App.utils.escapeHtml(event.phase || "-")} · ${type}</small>
                  <b>${App.utils.escapeHtml(status)}</b>
                </div>
              `;
            }).join("")}
          </div>
        </article>
      `;
    }).join("");

    container.innerHTML = `
      <div class="sim-preview-summary">
        <article><span>Competições</span><strong>${report.competitions.length}</strong></article>
        <article><span>CPU x CPU pendentes</span><strong>${report.cpuPending.length}</strong></article>
        <article><span>Com técnico pendentes</span><strong>${report.humanPending.length}</strong></article>
        <article><span>Finalizados</span><strong>${report.done.length}</strong></article>
      </div>
      ${report.humanPending.length ? `
        <div class="sim-warning">
          Ainda existem ${report.humanPending.length} jogo(s) com técnico pendente nessa semana. A simulação fica bloqueada até esses resultados serem enviados.
        </div>
      ` : ""}
      <div class="sim-preview-grid">${competitionBlocks}</div>
    `;
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
      App.state.apiBudgets = data.budgets || {};
      await App.api.loadMatches();
      await App.api.loadMarketPlayers();

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
    const report = App.api.getCpuSimulationReport(week);

    if (!week) {
      return { ok: false, created: 0, message: "Informe uma semana válida para simular." };
    }

    if (report.humanPending.length > 0) {
      const sample = report.humanPending.slice(0, 4).map(match => `${match.competition}: ${match.home} x ${match.away}`).join("; ");
      return {
        ok: false,
        created: 0,
        message: `Ainda existem ${report.humanPending.length} jogo(s) com técnico sem resultado na semana ${week}. Exemplos: ${sample}`
      };
    }

    const cpuMatches = report.cpuPending;

    let created = 0;
    let rejected = 0;
    const details = [];

    for (const match of cpuMatches) {
      const score = App.api.simulateScore(match.home, match.away);
      let penaltyWinner = "";
      let penaltyScore = "";

      if (App.api.isCupCompetition(match.competition) && score.homeScore === score.awayScore) {
        const shootout = App.api.generatePenaltyShootout(match.home, match.away);
        penaltyWinner = shootout.winner;
        penaltyScore = shootout.score;
      }

      const response = await App.api.rpc("app_add_result", {
        p_pin: App.config.API_PIN,
        p_competition: match.competition,
        p_week: week,
        p_phase: match.phase,
        p_home: match.home,
        p_away: match.away,
        p_home_score: score.homeScore,
        p_away_score: score.awayScore,
        p_goal_details: "",
        p_assist_details: "",
        p_penalty_winner: penaltyWinner,
        p_penalty_score: penaltyScore,
        p_submitted_by: submittedBy
      }, 45000);

      if (response.ok) created += 1;
      else rejected += 1;

      details.push({
        competition: match.competition,
        match: `${match.home} x ${match.away}`,
        score: `${score.homeScore} x ${score.awayScore}`,
        penalties: penaltyWinner ? `${penaltyWinner} (${penaltyScore})` : "",
        ok: Boolean(response.ok),
        message: response.message || ""
      });
    }

    const byCompetition = details.reduce((acc, item) => {
      if (item.ok) acc[item.competition] = (acc[item.competition] || 0) + 1;
      return acc;
    }, {});

    const competitionText = Object.entries(byCompetition)
      .map(([competition, total]) => `${competition}: ${total}`)
      .join(" · ");

    return {
      ok: true,
      created,
      rejected,
      details,
      message: `${created} jogo(s) CPU x CPU simulados na semana ${week}${competitionText ? ` (${competitionText})` : ""}.${rejected ? ` ${rejected} rejeitado(s).` : ""}`
    };
  }
};
