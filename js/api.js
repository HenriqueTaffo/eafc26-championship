import App from "./app.js";

App.api = {
  reversedTransferKeys: ["rafael|ayoze perez|villarreal club de futbol s.a.d."],

  getTransferStateKey(item = {}) {
    return [
      item.Comprador || item.buyer || "",
      item.Jogador || item.player || item.name || "",
      item.ClubeOrigem || item.fromClub || item.club || "",
    ]
      .map((value) => App.utils.normalizeText(value))
      .join("|");
  },

  isReversedTransfer(item = {}) {
    return App.api.reversedTransferKeys.includes(
      App.api.getTransferStateKey(item),
    );
  },

  isApprovedTransfer(item = {}) {
    return ["aprovado", "approved"].includes(
      App.utils.normalizeText(item.Status || item.status),
    );
  },

  async fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        cache: "no-store",
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async mapWithConcurrency(items = [], limit = 6, mapper = async () => null) {
    const results = [];
    const normalizedLimit = Math.max(1, Number(limit || 1));

    for (let index = 0; index < items.length; index += normalizedLimit) {
      const chunk = items.slice(index, index + normalizedLimit);
      const chunkResults = await Promise.all(chunk.map(mapper));
      results.push(...chunkResults);
    }

    return results;
  },

  getSupabaseHeaders() {
    return {
      apikey: App.config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${App.config.SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    };
  },

  async rpc(functionName, payload = {}, timeoutMs = 45000) {
    const response = await App.api.fetchWithTimeout(
      `${App.config.SUPABASE_URL}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: App.api.getSupabaseHeaders(),
        body: JSON.stringify(payload),
      },
      timeoutMs,
    );

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = text;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.hint ||
        data?.details ||
        text ||
        `Erro Supabase ${response.status}`;
      throw new Error(message);
    }

    return data;
  },

  async loadMarketPlayers(query = "", showContracted = false, limit = 12) {
    try {
      const data = await App.api.rpc(
        "app_search_market_players",
        {
          p_query: query || "",
          p_show_contracted: Boolean(showContracted),
          p_limit: Number(limit || 12),
        },
        30000,
      );

      const rows = App.api.applyMarketPlayerOverrides(
        Array.isArray(data) ? data : [],
        { showContracted: Boolean(showContracted) },
      );
      App.api.mergeMarketPlayers(rows);
      return rows;
    } catch (rpcError) {
      console.warn(
        "Busca RPC players_market indisponível, tentando leitura direta:",
        rpcError,
      );

      try {
        const data = await App.api.fetchMarketPlayersDirect(
          query,
          Number(limit || 12),
        );
        const rows = App.api.applyMarketPlayerOverrides(
          Array.isArray(data) ? data : [],
          { showContracted: Boolean(showContracted) },
        );
        App.api.mergeMarketPlayers(rows);
        return rows;
      } catch (error) {
        console.warn("Não consegui carregar players_market:", error);
        App.state.apiMarketPlayers = [];
        return [];
      }
    }
  },

  async fetchMarketPlayersDirect(query = "", limit = 12) {
    const selectWithAvatar =
      "id,name,club,league,country,position,age,market_value_eur,transfermarkt_url,avatar_url,source,last_synced_at";
    const selectWithoutAvatar =
      "id,name,club,league,country,position,age,market_value_eur,transfermarkt_url,source,last_synced_at";
    const normalizedLimit = Math.max(1, Math.min(Number(limit || 12), 200));
    const queryText = String(query || "").trim();
    const filters = queryText
      ? `&or=(name.ilike.*${encodeURIComponent(queryText)}*,club.ilike.*${encodeURIComponent(queryText)}*,position.ilike.*${encodeURIComponent(queryText)}*)`
      : "";

    const request = async (select) =>
      App.api.fetchWithTimeout(
        `${App.config.SUPABASE_URL}/rest/v1/players_market?select=${select}${filters}&order=name.asc&limit=${normalizedLimit}`,
        {
          method: "GET",
          headers: App.api.getSupabaseHeaders(),
        },
        30000,
      );

    let response = await request(selectWithAvatar);
    if (!response.ok) response = await request(selectWithoutAvatar);
    if (!response.ok) return [];
    return await response.json();
  },

  mergeMarketPlayers(rows = []) {
    const current = Array.isArray(App.state.apiMarketPlayers)
      ? App.state.apiMarketPlayers
      : [];
    const byKey = current.reduce((acc, item) => {
      const key = String(item.id || item.name || "").toLowerCase();
      if (key) acc[key] = item;
      return acc;
    }, {});

    App.api
      .applyMarketPlayerOverrides(rows, { showContracted: true })
      .forEach((item) => {
        const key = String(item.id || item.name || "").toLowerCase();
        if (key) byKey[key] = { ...(byKey[key] || {}), ...item };
      });

    App.state.apiMarketPlayers = Object.values(byKey);
    return App.state.apiMarketPlayers;
  },

  getLatestMovementByPlayer() {
    const movements = {};

    (App.state.apiTransfers || []).forEach((row, index) => {
      const playerName = row.Jogador || row.player || row.player_name || "";
      const key = App.utils.normalizeText(playerName);
      if (!key) return;

      const time = new Date(
        row.Timestamp || row.created_at || row.createdAt || 0,
      ).getTime();
      const score = Number.isNaN(time) ? index : time * 1000 + index;
      if (movements[key] && movements[key].score > score) return;

      movements[key] = {
        buyer: row.Comprador || row.buyer || row.buyer_id || "",
        destination:
          row.ClubeDestino || row.Destino || row.destination_club || "",
        score,
        transferType: App.utils.normalizeText(
          row.TipoTransferencia || row.transfer_type || row.transferType || "",
        ),
      };
    });

    return movements;
  },

  applyMarketPlayerOverrides(players = [], options = {}) {
    const showContracted =
      options.showContracted === undefined
        ? true
        : Boolean(options.showContracted);
    const latestMovements = App.api.getLatestMovementByPlayer();

    return players
      .map((player) => {
        const key = App.utils.normalizeText(player.name || "");
        const movement = latestMovements[key];
        let next = { ...player };

        if (movement?.transferType === "cpu_sale" && movement.destination) {
          next = {
            ...next,
            club: movement.destination,
            original_club: next.original_club || next.club,
            league: "Mercado externo",
            alreadyContracted: false,
            is_contracted: false,
          };
        } else if (movement && movement.buyer) {
          next = {
            ...next,
            alreadyContracted: true,
            is_contracted: true,
          };
        }

        if (
          App.api.isReversedTransfer({
            Comprador: "Rafael",
            Jogador: next.name,
            ClubeOrigem: next.club,
          })
        ) {
          next = {
            ...next,
            alreadyContracted: false,
            is_contracted: false,
          };
        }

        const cachedAvatar = App.transfers?.getMarketPlayerAvatar?.(next) || "";
        if (
          !App.transfers?.isUsablePlayerAvatar?.(next.avatar_url) &&
          cachedAvatar
        ) {
          next = { ...next, avatar_url: cachedAvatar };
        }

        return next;
      })
      .filter(
        (player) =>
          showContracted || !(player.alreadyContracted || player.is_contracted),
      );
  },

  getRatingSourcePriority(item = {}) {
    const source = App.utils.normalizeText(
      item.source_name || item.source || "",
    );
    if (source.includes("futbin")) return 50;
    if (source.includes("ea sports") || source.includes("official")) return 40;
    if (source.includes("sofifa")) return 30;
    if (source.includes("fifa ratings")) return 20;
    return 10;
  },

  getRatingIdentityKey(item = {}) {
    const name = App.utils.normalizeText(item.name || "");
    if (!name) return String(item.id || item.ea_id || "").toLowerCase();
    return [
      name,
      App.utils.normalizeText(item.club || ""),
      App.utils.normalizeText(item.position || ""),
    ].join("|");
  },

  pickPreferredRating(current, next) {
    if (!current) return next;
    const sourceDelta =
      App.api.getRatingSourcePriority(next) -
      App.api.getRatingSourcePriority(current);
    if (sourceDelta !== 0) return sourceDelta > 0 ? next : current;

    const nextSynced = new Date(
      next.synced_at || next.updated_at || 0,
    ).getTime();
    const currentSynced = new Date(
      current.synced_at || current.updated_at || 0,
    ).getTime();
    if ((nextSynced || 0) !== (currentSynced || 0)) {
      return (nextSynced || 0) > (currentSynced || 0) ? next : current;
    }

    if (next.avatar_url && !current.avatar_url) return next;
    if (Number(next.overall || 0) !== Number(current.overall || 0)) {
      return Number(next.overall || 0) > Number(current.overall || 0)
        ? next
        : current;
    }
    return current;
  },

  mergeEaRatings(rows = []) {
    const current = Array.isArray(App.state.apiRatings)
      ? App.state.apiRatings
      : [];
    const byKey = current.reduce((acc, item) => {
      const key = App.api.getRatingIdentityKey(item);
      if (key) acc[key] = App.api.pickPreferredRating(acc[key], item);
      return acc;
    }, {});

    rows.forEach((item) => {
      const key = App.api.getRatingIdentityKey(item);
      if (key) byKey[key] = App.api.pickPreferredRating(byKey[key], item);
    });

    App.state.apiRatings = Object.values(byKey).sort(
      (a, b) =>
        App.api.getRatingSourcePriority(b) -
          App.api.getRatingSourcePriority(a) ||
        Number(b.overall || 0) - Number(a.overall || 0) ||
        String(a.name || "").localeCompare(String(b.name || "")),
    );
    return App.state.apiRatings;
  },

  async searchEaRatings(query = "", limit = 12) {
    const data = await App.api.rpc(
      "app_search_ea_player_ratings",
      {
        p_query: query || "",
        p_limit: Number(limit || 12),
      },
      30000,
    );

    return Array.isArray(data) ? data : [];
  },

  async loadEaRatings(query = "", limit = 12) {
    try {
      const rows = await App.api.searchEaRatings(query, limit);
      App.api.mergeEaRatings(rows);
      return App.state.apiRatings;
    } catch (error) {
      console.warn("Base de ratings indisponível:", error);
      return App.state.apiRatings || [];
    }
  },

  async loadRatingsForPlayerNames(names = [], limitPerName = 3) {
    const uniqueNames = [
      ...new Set(
        (names || []).map((name) => String(name || "").trim()).filter(Boolean),
      ),
    ]
      .filter((name) => !App.transfers?.getRatingForPlayerName?.(name)?.overall)
      .slice(0, 12);
    if (!uniqueNames.length) return App.state.apiRatings || [];

    const groups = await App.api.mapWithConcurrency(uniqueNames, 2, (name) => {
      const aliases = App.transfers?.getPlayerSearchAliases
        ? App.transfers.getPlayerSearchAliases(name)
        : [name];
      const normalizedAlias = App.transfers?.normalizePlayerRatingKey
        ? App.transfers.normalizePlayerRatingKey(name)
        : App.utils.normalizeText(name);
      const searchAliases = [
        ...new Set([...aliases, normalizedAlias].filter(Boolean)),
      ].slice(0, 2);
      return Promise.all(
        searchAliases.map((alias) => {
          if (App.transfers?.searchEaRatingsCached) {
            return App.transfers.searchEaRatingsCached(alias, limitPerName);
          }
          return App.api.searchEaRatings(alias, limitPerName).catch(() => []);
        }),
      );
    });

    App.api.mergeEaRatings(groups.flat(2));
    return App.state.apiRatings;
  },

  async loadMarketPlayersForNames(names = [], limitPerName = 3) {
    const uniqueNames = [
      ...new Set(
        (names || []).map((name) => String(name || "").trim()).filter(Boolean),
      ),
    ].slice(0, 40);
    if (!uniqueNames.length) return App.state.apiMarketPlayers || [];

    const groups = await App.api.mapWithConcurrency(uniqueNames, 6, (name) =>
      App.api
        .fetchMarketPlayersDirect(name, limitPerName)
        .then((rows) =>
          App.api.applyMarketPlayerOverrides(Array.isArray(rows) ? rows : [], {
            showContracted: true,
          }),
        )
        .catch(() =>
          App.api.loadMarketPlayers(name, true, limitPerName).catch(() => []),
        ),
    );

    App.api.mergeMarketPlayers(groups.flat());
    return App.state.apiMarketPlayers;
  },

  getTransferLookupNames(data = {}) {
    return [
      ...(data.transfers || []).map((item) => item.Jogador),
      ...(App.data.transfers || []).map((item) => item.player),
    ]
      .map((name) => String(name || "").trim())
      .filter(Boolean);
  },

  async hydrateSecondaryData(data = {}, options = {}) {
    const { minIntervalMs = 5 * 60 * 1000 } = options;
    const now = Date.now();
    if (App.state.secondaryHydrationRunning) return;
    if (
      minIntervalMs > 0 &&
      App.state.lastSecondaryHydrationAt &&
      now - Number(App.state.lastSecondaryHydrationAt || 0) < minIntervalMs
    ) {
      return;
    }

    App.state.secondaryHydrationRunning = true;
    App.state.lastSecondaryHydrationAt = now;
    const names = App.api.getTransferLookupNames(data);

    try {
      await Promise.allSettled([
        App.api.loadMarketPlayersForNames(names),
        App.api.loadEaRatings("", 50),
        App.api.loadRatingsForPlayerNames(names),
        App.api.loadExperienceData(),
        App.api.loadManagerOnboarding?.(),
        App.api.loadSalaryReferences?.(),
        App.api.loadFinanceRulesAndForecast?.(),
        App.api.loadSquadManagementData?.(),
        App.governance?.loadData?.(),
        App.auth?.loadPublicNews?.(),
        App.auth?.loadMyDecisions?.(),
        App.auth?.loadMyTransferProposals?.(),
        App.auth?.loadMyTransferSaleListings?.(),
        App.auth?.loadMyQoL?.(),
        App.auth?.loadMySponsorships?.(),
      ]);

      if (App.state.apiLoaded) {
        App.main?.renderCurrentView?.();
        App.main?.markSynced?.("Dados complementares sincronizados");
      }
    } finally {
      App.state.secondaryHydrationRunning = false;
    }
  },

  async processSponsorshipsInBackground() {
    try {
      await App.api.rpc("app_process_all_sponsorship_rewards", {}, 45000);
      await App.api.rpc("app_process_periodic_sponsorships", {}, 45000);
    } catch (sponsorshipError) {
      console.warn(
        "Processamento automático de patrocínios indisponível:",
        sponsorshipError,
      );
    }
  },

  async loadExperienceData() {
    try {
      const data = await App.api.rpc("app_get_experience_data", {}, 30000);
      App.state.apiExperience = data || {
        opportunities: [],
        auctions: [],
        news: [],
      };
      return App.state.apiExperience;
    } catch (error) {
      console.warn("Camada de experiência indisponível:", error);
      App.state.apiExperience = App.state.apiExperience || {
        opportunities: [],
        auctions: [],
        news: [],
      };
      return App.state.apiExperience;
    }
  },

  async loadMatches() {
    try {
      const data = await App.api.rpc("app_get_matches", {}, 45000);
      App.state.apiMatches = Array.isArray(data) ? data : [];
      return App.state.apiMatches;
    } catch (error) {
      console.warn(
        "Não consegui carregar public.matches via app_get_matches:",
        error,
      );
      App.state.apiMatches = [];
      return [];
    }
  },

  async loadMatchAudit(week = null) {
    try {
      return await App.api.rpc(
        "app_get_match_audit",
        {
          p_week: week ? Number(week) : null,
        },
        45000,
      );
    } catch (error) {
      console.warn("Auditoria de partidas indisponível:", error);
      return {
        ok: false,
        week: week || null,
        summary: {},
        matches: [],
        message:
          error.message || "Não consegui carregar auditoria de partidas.",
      };
    }
  },

  async loadSponsorshipRewardTotals() {
    try {
      const totals = await App.api.rpc(
        "app_get_sponsorship_reward_totals",
        {},
        30000,
      );
      return totals && typeof totals === "object" && !Array.isArray(totals)
        ? totals
        : {};
    } catch (error) {
      console.warn("Totais de patrocínio indisponíveis:", error);
      return {};
    }
  },

  async loadBudgetReconciliation() {
    try {
      const budgets = await App.api.rpc(
        "app_get_budget_reconciliation",
        {},
        30000,
      );
      return budgets && typeof budgets === "object" && !Array.isArray(budgets)
        ? budgets
        : null;
    } catch (error) {
      console.warn("Reconciliação de orçamento indisponível:", error);
      return null;
    }
  },

  getSponsorshipEventTotalByManager(events = []) {
    return (events || []).reduce((acc, event) => {
      const manager = event.Jogador || event.manager_name || "";
      const title = App.utils.normalizeText(event.Titulo || event.title || "");
      const isSponsorshipReward = title.includes("bonus de patrocinio");
      if (!manager || !isSponsorshipReward) return acc;

      acc[manager] =
        (acc[manager] || 0) +
        Number(event.ImpactoFinanceiro || event.financial_impact || 0);
      return acc;
    }, {});
  },

  getPerformanceBudgetStats() {
    return App.utils.getHumanBuyers().reduce((acc, buyer) => {
      acc[buyer] = { homeMatches: 0, wins: 0 };
      return acc;
    }, {});
  },

  reconcileApiBudgets(data, sponsorshipRewardTotals = {}) {
    const budgets = data.budgets || {};
    const stats = App.api.getPerformanceBudgetStats(data.results || []);
    const sponsorshipEventTotals = App.api.getSponsorshipEventTotalByManager(
      data.events || [],
    );

    (data.results || [])
      .filter((result) => App.utils.normalizeText(result.Status) === "aprovado")
      .filter(
        (result) =>
          App.utils.normalizeText(result.Competicao) === "championship",
      )
      .forEach((result) => {
        const homeTeam = App.utils.getTeamByName(result.Mandante);
        const awayTeam = App.utils.getTeamByName(result.Visitante);
        const homeScore = Number(result.GolsMandante);
        const awayScore = Number(result.GolsVisitante);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

        if (homeTeam?.status === "Nosso" && stats[homeTeam.owner])
          stats[homeTeam.owner].homeMatches += 1;
        if (
          homeScore > awayScore &&
          homeTeam?.status === "Nosso" &&
          stats[homeTeam.owner]
        )
          stats[homeTeam.owner].wins += 1;
        if (
          awayScore > homeScore &&
          awayTeam?.status === "Nosso" &&
          stats[awayTeam.owner]
        )
          stats[awayTeam.owner].wins += 1;
      });

    return App.utils.getHumanBuyers().reduce((acc, buyer) => {
      const current = budgets[buyer] || {};
      const buyerStats = stats[buyer] || { homeMatches: 0, wins: 0 };
      const baseBudget = Number(
        current.baseBudget ?? data.budget ?? App.config.transferBudget,
      );
      const spentTotal = Number(current.spentTotal ?? 0);
      const homeBonus = buyerStats.homeMatches * App.config.homeMatchBonus;
      const winBonusValue = buyerStats.wins * App.config.winBonus;
      const sponsorshipRewards = Number(sponsorshipRewardTotals[buyer] || 0);
      const sponsorshipEvents = Number(sponsorshipEventTotals[buyer] || 0);
      const eventTotal =
        Number(current.eventTotal ?? 0) -
        sponsorshipEvents +
        sponsorshipRewards;
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
        remainingBudget: totalBudget - spentTotal,
      };

      return acc;
    }, {});
  },

  getDbMatchEvents() {
    return (App.state.apiMatches || []).map((row) => {
      const homeScore =
        row.home_score === null || row.home_score === undefined
          ? null
          : Number(row.home_score);
      const awayScore =
        row.away_score === null || row.away_score === undefined
          ? null
          : Number(row.away_score);
      const competition = row.competition || "Championship";
      const matchDate = row.match_date
        ? new Date(`${row.match_date}T12:00:00`)
        : App.utils.getCupDate(Number(row.week || 1));

      return {
        id: `db-match-${row.id}`,
        dbId: row.id,
        date: matchDate,
        week: Number(row.week || 0),
        competition,
        className:
          competition === "Championship"
            ? "championship"
            : competition === "Copa da Liga"
              ? "league-cup"
              : "fa-cup",
        phase: row.phase || "",
        matchOrder:
          row.match_order === null || row.match_order === undefined
            ? null
            : Number(row.match_order),
        home: row.home || "",
        away: row.away || "",
        homeScore,
        awayScore,
        penaltyWinner: row.penalty_winner || "",
        penaltyScore: row.penalty_score || "",
        status:
          typeof homeScore === "number" && typeof awayScore === "number"
            ? "Finalizado"
            : row.status_pt || row.status || "Pendente",
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
    if (
      String(event.status || "")
        .toLowerCase()
        .includes("aguardando")
    )
      return false;
    return App.calendar.getStatusClass(event) !== "done";
  },

  getSimulationWeekEvents(week) {
    const targetWeek = Number(week);
    const dbEvents = App.api.getDbMatchEvents();
    const calendarEvents = App.calendar.getCalendarEvents();
    const source = dbEvents.length ? dbEvents : calendarEvents;
    const byKey = new Map();

    source
      .filter((event) => Number(event.week) === targetWeek)
      .forEach((event) => {
        const key = [
          App.utils.normalizeText(event.competition),
          App.utils.normalizeText(event.phase),
          App.utils.normalizeTeamName(event.home),
          App.utils.normalizeTeamName(event.away),
        ].join("|");
        byKey.set(key, event);
      });

    calendarEvents
      .filter((event) => Number(event.week) === targetWeek)
      .forEach((event) => {
        const key = [
          App.utils.normalizeText(event.competition),
          App.utils.normalizeText(event.phase),
          App.utils.normalizeTeamName(event.home),
          App.utils.normalizeTeamName(event.away),
        ].join("|");
        if (!byKey.has(key)) byKey.set(key, event);
      });

    return [...byKey.values()].sort(
      (a, b) =>
        (a.competition || "").localeCompare(b.competition || "") ||
        Number(a.matchOrder || 999) - Number(b.matchOrder || 999) ||
        String(a.phase || "").localeCompare(String(b.phase || "")),
    );
  },

  getCpuSimulationReport(week) {
    const events = App.api.getSimulationWeekEvents(week);
    const playable = events.filter((event) =>
      App.api.isPlayablePendingMatch(event),
    );
    const humanPending = playable.filter(
      (event) => App.calendar.getMatchOwners(event).length > 0,
    );
    const cpuPending = playable.filter(
      (event) => App.calendar.getMatchOwners(event).length === 0,
    );
    const done = events.filter(
      (event) => App.calendar.getStatusClass(event) === "done",
    );
    const waiting = events.filter(
      (event) =>
        !App.api.isPlayablePendingMatch(event) &&
        App.calendar.getStatusClass(event) !== "done",
    );
    const competitions = [
      ...new Set(events.map((event) => event.competition).filter(Boolean)),
    ];

    return {
      events,
      playable,
      humanPending,
      cpuPending,
      done,
      waiting,
      competitions,
    };
  },

  generatePenaltyShootout(home, away) {
    const homeWins = Math.random() >= 0.5;
    const winnerPens = 4 + Math.floor(Math.random() * 3);
    const loserPens = Math.max(
      0,
      winnerPens - 1 - Math.floor(Math.random() * 2),
    );
    const homePens = homeWins ? winnerPens : loserPens;
    const awayPens = homeWins ? loserPens : winnerPens;

    return {
      winner: homeWins ? home : away,
      score: `${homePens} x ${awayPens}`,
    };
  },

  async renderCpuSimulationPreview(weekValue) {
    const container = document.getElementById("cpuSimulationPreview");
    if (!container) return;

    const week = Number(weekValue || 0);

    App.dom.setHtml(
      container,
      `
      <div class="sim-preview-shell is-loading">
        <div class="sim-preview-title">
          <strong>${week ? `Analisando semana ${week}` : "Mapa de pendências"}</strong>
          <span>Consultando o banco oficial...</span>
        </div>
      </div>
    `,
    );

    const audit = await App.api.loadMatchAudit(week || null);
    const matches = Array.isArray(audit.matches) ? audit.matches : [];

    if (!audit.ok) {
      App.dom.setHtml(
        container,
        `<div class="sim-preview-empty">${App.utils.escapeHtml(audit.message || "Não consegui carregar a auditoria de partidas.")}</div>`,
      );
      return;
    }

    if (!matches.length) {
      App.dom.setHtml(
        container,
        `<div class="sim-preview-empty">${week ? `Nenhum jogo encontrado na semana ${week}.` : "Nenhum jogo pendente encontrado no banco."}</div>`,
      );
      return;
    }

    const summary = audit.summary || {};
    const isApprovedMatch = (match) =>
      App.utils.normalizeText(match.status || "") === "approved";
    const isCpuMatch = (match) =>
      App.utils.normalizeText(match.match_type || "") === "cpu x cpu";

    const weekRows = [
      ...matches
        .reduce((acc, match) => {
          const key = Number(match.week || 0);
          if (!key) return acc;

          if (!acc.has(key)) {
            acc.set(key, {
              week: key,
              total: 0,
              cpuPending: 0,
              humanPending: 0,
              approved: 0,
              competitions: new Set(),
            });
          }

          const row = acc.get(key);
          const isDone = isApprovedMatch(match);
          row.total += 1;
          row.competitions.add(match.competition || "Liga");

          if (isDone) row.approved += 1;
          else if (isCpuMatch(match)) row.cpuPending += 1;
          else row.humanPending += 1;

          return acc;
        }, new Map())
        .values(),
    ]
      .map((row) => ({
        ...row,
        pending: row.cpuPending + row.humanPending,
        donePercent: row.total
          ? Math.round((row.approved / row.total) * 100)
          : 0,
        competitionsLabel: [...row.competitions].slice(0, 2).join(" · "),
      }))
      .sort((a, b) => Number(a.week) - Number(b.week));

    const pendingWeeks = weekRows
      .filter((row) => row.pending > 0)
      .map((row) => row.week);

    const blocks = week
      ? Object.entries(
          matches.reduce((acc, match) => {
            const key = match.competition || "Liga";
            if (!acc[key]) acc[key] = [];
            acc[key].push(match);
            return acc;
          }, {}),
        )
          .map(
            ([title, items]) => `
        <article class="sim-competition-block">
          <div class="sim-competition-header">
            <strong>${App.utils.escapeHtml(title)}</strong>
            <span>${items.length} jogo(s)</span>
          </div>
          <div class="sim-match-list">
            ${items
              .map((match) => {
                const isDone = isApprovedMatch(match);
                const isCpu = isCpuMatch(match);
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
              })
              .join("")}
          </div>
        </article>
      `,
          )
          .join("")
      : "";

    const canSimulate =
      Number(summary.human_pending || 0) === 0 &&
      Number(summary.cpu_pending || 0) > 0;

    const weekOverview = weekRows.filter(
      (row) => row.pending > 0 || row.approved > 0,
    );

    App.dom.setHtml(
      container,
      `
      <div class="sim-preview-shell ${week ? "is-week-detail" : "is-week-map"}">
        <div class="sim-preview-title">
          <div>
            <strong>${week ? `Semana ${week}` : "Simulação CPU x CPU"}</strong>
            <span>${week ? "Auditoria oficial antes de simular esta semana." : "Escolha uma semana para ver detalhes e liberar a simulação."}</span>
          </div>
          ${week ? `<button type="button" class="sim-map-button" data-clear-sim-week>Mapa geral</button>` : `<small>${pendingWeeks.length} semana(s) com pendências</small>`}
        </div>

        ${
          !week
            ? `
          <div class="sim-week-board">
            ${weekOverview
              .map((item) => {
                const ready = item.cpuPending > 0 && item.humanPending === 0;
                const blocked = item.humanPending > 0;
                return `
                  <button
                    type="button"
                    class="sim-week-card ${ready ? "is-ready" : ""} ${blocked ? "is-blocked" : ""}"
                    data-fill-sim-week="${item.week}"
                  >
                    <span>Semana ${item.week}</span>
                    <strong>${item.cpuPending} CPU</strong>
                    <small>${blocked ? `${item.humanPending} com técnico pendente` : ready ? "pronta para simular" : `${item.approved}/${item.total} finalizados`}</small>
                    <i style="--sim-progress:${item.donePercent}%"></i>
                  </button>
                `;
              })
              .join("")}
          </div>
        `
            : ""
        }

        <div class="sim-preview-summary">
          <article><span>Total</span><strong>${Number(summary.total || matches.length)}</strong></article>
          <article><span>CPU x CPU pendentes</span><strong>${Number(summary.cpu_pending || 0)}</strong></article>
          <article><span>Com técnico pendentes</span><strong>${Number(summary.human_pending || 0)}</strong></article>
          <article><span>Finalizados</span><strong>${Number(summary.approved || 0)}</strong></article>
        </div>

        ${
          week && canSimulate
            ? `
          <div class="sim-ok">Semana pronta: ${Number(summary.cpu_pending || 0)} jogo(s) CPU x CPU podem ser simulados agora.</div>
        `
            : ""
        }

        ${
          week && Number(summary.human_pending || 0) > 0
            ? `
          <div class="sim-warning">A simulação está bloqueada: ainda existe(m) ${Number(summary.human_pending || 0)} jogo(s) com técnico pendente nessa semana.</div>
        `
            : ""
        }

        ${
          week &&
          Number(summary.cpu_pending || 0) === 0 &&
          Number(summary.human_pending || 0) === 0
            ? `
          <div class="sim-preview-empty">Não há jogos CPU x CPU pendentes para simular nessa semana.</div>
        `
            : ""
        }

        ${week ? `<div class="sim-preview-grid">${blocks}</div>` : ""}
      </div>
    `,
    );

    container.querySelectorAll("[data-fill-sim-week]").forEach((button) => {
      button.addEventListener("click", () => {
        const form = document.getElementById("cpuSimulationForm");
        if (!form?.elements.week) return;
        form.elements.week.value = button.dataset.fillSimWeek;
        App.api.renderCpuSimulationPreview(button.dataset.fillSimWeek);
      });
    });

    container
      .querySelector("[data-clear-sim-week]")
      ?.addEventListener("click", () => {
        const form = document.getElementById("cpuSimulationForm");
        if (form?.elements.week) form.elements.week.value = "";
        App.api.renderCpuSimulationPreview("");
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

  async loadFinanceRulesAndForecast() {
    try {
      const [rules, salaryDebts, salaryReferences] = await Promise.all([
        App.api.rpc("app_get_finance_rules", {}, 30000),
        App.api.rpc("app_get_salary_debt_status", {}, 30000),
        App.api.loadSalaryReferences(),
      ]);
      const forecast = await App.api.rpc(
        "app_get_manager_finance_forecast",
        {},
        30000,
      );
      App.state.apiFinanceRules = rules || null;
      App.state.apiFinanceForecast = Array.isArray(forecast) ? forecast : [];
      App.state.apiSalaryDebts = Array.isArray(salaryDebts) ? salaryDebts : [];
      App.state.apiSalaryReferences = Array.isArray(salaryReferences)
        ? salaryReferences
        : [];
      return App.state.apiFinanceForecast;
    } catch (error) {
      console.warn("Previsão financeira persistente indisponível:", error);
      App.state.apiFinanceRules = null;
      App.state.apiFinanceForecast = [];
      App.state.apiSalaryDebts = [];
      App.state.apiSalaryReferences = [];
      return [];
    }
  },

  async loadSalaryReferences() {
    try {
      const result = await App.api.rpc(
        "app_get_public_salary_references",
        {},
        30000,
      );
      App.state.apiSalaryReferences = Array.isArray(result) ? result : [];
      return App.state.apiSalaryReferences;
    } catch (error) {
      console.warn("Referencias publicas de salario indisponiveis:", error);
      App.state.apiSalaryReferences = [];
      return [];
    }
  },

  async getPlayerSalaryQuote(player = {}) {
    const result = await App.api.rpc(
      "app_get_player_salary_quote",
      {
        p_player_name: player.name || player.player || player.playerName || "",
        p_club_name:
          player.club || player.fromClub || player.clubName || player.ClubeOrigem || "",
        p_league: player.league || "",
        p_position: player.position || "",
        p_overall: Number(player.overall || player.Overall || 0) || null,
        p_market_value:
          Number(
            player.marketValue ||
              player.market_value_eur ||
              player.ValorTransfermarkt ||
              0,
          ) || null,
        p_age: Number(player.age || 0) || null,
      },
      30000,
    );
    return result?.ok === false ? null : result;
  },

  async loadSquadManagementData(options = {}) {
    const { force = false } = options;

    if (
      !force &&
      App.state.apiSquadManagement?.ok &&
      !App.state.apiSquadManagementLoading
    ) {
      return App.state.apiSquadManagement;
    }

    if (App.state.apiSquadManagementLoading) {
      return App.state.apiSquadManagement || null;
    }

    App.state.apiSquadManagementLoading = true;

    try {
      const data = await App.api.rpc(
        "app_get_squad_management_data",
        {},
        30000,
      );
      App.state.apiSquadManagement = data || {
        ok: false,
        managers: [],
        rosters: {},
        lineups: {},
        finance: [],
      };
      App.react?.notify?.();
      return App.state.apiSquadManagement;
    } catch (error) {
      console.warn("Gestao de elenco indisponivel:", error);
      App.state.apiSquadManagement = App.state.apiSquadManagement || {
        ok: false,
        managers: [],
        rosters: {},
        lineups: {},
        finance: [],
        error: error.message,
      };
      App.react?.notify?.();
      return App.state.apiSquadManagement;
    } finally {
      App.state.apiSquadManagementLoading = false;
    }
  },

  async saveSquadLineup({ clubName = "", formation = "", lineup = {} } = {}) {
    App.api.requireSession("Faca login antes de salvar a escalacao.");

    const result = await App.api.rpc(
      "app_save_manager_squad_lineup",
      {
        ...App.api.getAuthPayload(),
        p_club_name: clubName || "",
        p_formation: formation || "4-2-3-1",
        p_lineup: lineup || {},
      },
      30000,
    );

    if (!result?.ok) {
      throw new Error(result?.message || "Nao consegui salvar a escalacao.");
    }

    await App.api.loadSquadManagementData({ force: true });
    return result;
  },

  async loadApiData(options = {}) {
    const {
      showLoader = true,
      force = false,
      cacheTtlMs = 0,
      variant = App.main?.getDefaultLoaderVariant
        ? App.main.getDefaultLoaderVariant()
        : "match",
      title = "Atualizando dados",
      message = "Aguarde enquanto os dados mais recentes são consultados.",
    } = options;

    const now = Date.now();
    if (
      !force &&
      App.state.apiLoaded &&
      App.state.lastApiPayload &&
      cacheTtlMs > 0 &&
      now - Number(App.state.lastApiLoadAt || 0) < cacheTtlMs
    ) {
      App.main?.renderCurrentView?.();
      return App.state.lastApiPayload;
    }

    if (showLoader && App.main?.showLoader) {
      App.main.showLoader({ variant, title, message });
    }

    try {
      const data = await App.api.rpc("app_get_data", {}, 45000);
      if (!data.ok)
        throw new Error(
          data.error || data.message || "Erro ao carregar Supabase.",
        );

      if (data.budget !== undefined)
        App.config.transferBudget = Number(data.budget);
      if (data.homeMatchBonus !== undefined)
        App.config.homeMatchBonus = Number(data.homeMatchBonus);
      if (data.winBonus !== undefined)
        App.config.winBonus = Number(data.winBonus);
      if (data.dailyTransferLimit !== undefined)
        App.config.baseDailyTransferLimit = Number(data.dailyTransferLimit);

      const [budgetReconciliation, sponsorshipRewardTotals] = await Promise.all(
        [
          App.api.loadBudgetReconciliation(),
          App.api.loadSponsorshipRewardTotals(),
        ],
      );

      App.state.apiResults = data.results || [];
      App.state.apiTransfers = (data.transfers || []).filter(
        (item) =>
          App.api.isApprovedTransfer(item) && !App.api.isReversedTransfer(item),
      );
      App.state.apiEvents = data.events || [];
      App.state.apiClubs = data.clubs || [];
      App.state.apiBudgets =
        budgetReconciliation ||
        App.api.reconcileApiBudgets(data, sponsorshipRewardTotals);
      if (Array.isArray(data.eventSlots) && data.eventSlots.length) {
        App.config.eventSlots = data.eventSlots.map(Number);
      }

      App.state.apiLoaded = true;
      App.state.lastApiPayload = data;
      App.state.lastApiLoadAt = Date.now();
      App.main.renderCurrentView();
      App.main?.markSynced?.();

      const activeView = document.querySelector(".view.active")?.id;
      const requiredLoads = [App.api.loadMatches()];
      if (
        activeView === "playersView" ||
        activeView === "transfersView" ||
        activeView === "squadView"
      ) {
        requiredLoads.push(App.api.loadMarketPlayers());
        requiredLoads.push(App.api.loadSalaryReferences());
      }
      if (activeView === "squadView") {
        requiredLoads.push(App.api.loadSquadManagementData({ force: true }));
      }
      await Promise.all(requiredLoads);

      App.main.renderCurrentView();
      App.main?.markSynced?.();

      if (!options.skipBackgroundRefresh) {
        const runHydration = () => {
          App.api
            .hydrateSecondaryData(data)
            .catch((error) =>
              console.warn("Hidratação complementar indisponível:", error),
            );
        };
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(runHydration, { timeout: 2500 });
        } else {
          setTimeout(runHydration, 500);
        }
      }
      return data;
    } catch (error) {
      const hadPreviousData =
        App.state.apiLoaded &&
        ((App.state.apiResults || []).length ||
          (App.state.apiTransfers || []).length ||
          (App.state.apiEvents || []).length);

      if (!hadPreviousData) {
        App.state.apiLoaded = false;
      }

      console.error(error);

      if (hadPreviousData) {
        App.main.renderCurrentView();
      }

      const resultMessage = document.getElementById("resultMessage");
      const errorMessage =
        error.name === "AbortError"
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

  getAuthPayload() {
    const session = App.auth?.getSession ? App.auth.getSession() : null;
    return {
      p_manager_id: session?.managerId || "",
      p_access_code: session?.accessCode || "",
    };
  },

  requireSession(message = "Faça login antes de executar esta ação.") {
    const session = App.auth?.getSession ? App.auth.getSession() : null;
    if (!session?.managerId || !session?.accessCode) throw new Error(message);
    return session;
  },

  requireCommissioner(
    message = "Apenas o Comissário da Liga pode executar esta ação.",
  ) {
    const session = App.api.requireSession(
      "Faça login como Comissário da Liga.",
    );
    if (!App.auth?.isCommissioner?.()) throw new Error(message);
    return session;
  },

  mapResultPayload(payload) {
    const authPayload = App.api.getAuthPayload();
    return {
      ...authPayload,
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
      p_submitted_by: payload.submittedBy || "",
    };
  },

  mapReverseResultPayload(payload) {
    return {
      ...App.api.getAuthPayload(),
      p_competition: payload.competition,
      p_phase: payload.phase,
      p_home: payload.home,
      p_away: payload.away,
    };
  },

  mapReverseTransferPayload(payload) {
    const transferId = Number(payload.transferId);
    return {
      ...App.api.getAuthPayload(),
      p_transfer_id: Number.isFinite(transferId) ? transferId : null,
      p_buyer: payload.buyer || "",
      p_player: payload.player || "",
      p_from_club: payload.fromClub || "",
      p_timestamp: payload.timestamp || "",
    };
  },

  async postToApi(payload) {
    if (payload.action === "addResult") {
      App.api.requireSession(
        "Faça login como técnico ou comissário antes de enviar resultado.",
      );
      return App.api.rpc(
        "app_add_result",
        App.api.mapResultPayload(payload),
        45000,
      );
    }

    if (payload.action === "reverseResult") {
      App.api.requireCommissioner(
        "Apenas o Comissário da Liga pode desfazer resultados.",
      );
      return App.api.rpc(
        "app_reverse_match_result",
        App.api.mapReverseResultPayload(payload),
        45000,
      );
    }

    if (payload.action === "reverseTransfer") {
      App.api.requireCommissioner(
        "Apenas o Comissário da Liga pode desfazer transferências.",
      );
      return App.api.rpc(
        "app_reverse_transfer",
        App.api.mapReverseTransferPayload(payload),
        45000,
      );
    }

    if (payload.action === "addTransfer") {
      if (payload.transferType === "internal") {
        return App.api.rpc(
          "app_create_internal_transfer_proposal",
          {
            p_manager_id: payload.managerId,
            p_access_code: payload.accessCode,
            p_buyer: payload.buyer,
            p_seller: payload.seller || "",
            p_player: payload.player,
            p_from_club: payload.fromClub,
            p_overall: Number(payload.overall),
            p_market_value: Number(payload.marketValue),
          },
          45000,
        );
      }

      const session = App.api.requireSession(
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

      const hasTradeIn =
        payload.tradeInPlayer && Number(payload.tradeInCredit || 0) > 0;

      return App.api.rpc(
        hasTradeIn
          ? "app_add_transfer_with_trade_verified_salary"
          : "app_add_transfer_verified_salary",
        {
          ...App.api.getAuthPayload(),
          p_buyer: payload.buyer,
          p_player: payload.player,
          p_from_club: payload.fromClub,
          p_overall: Number(payload.overall),
          p_market_value: Number(payload.marketValue),
          p_weekly_salary_eur: Number(payload.weeklySalary || 0),
          p_salary_source_name: payload.salarySourceName || "",
          p_salary_source_url: payload.salarySourceUrl || "",
          ...(hasTradeIn
            ? {
                p_trade_in_player: payload.tradeInPlayer,
                p_trade_in_credit: Number(payload.tradeInCredit || 0),
              }
            : {}),
        },
        45000,
      );
    }

    if (payload.action === "generateDueEvents") {
      App.api.requireCommissioner();
      return App.api.rpc(
        "app_generate_due_events",
        {
          ...App.api.getAuthPayload(),
        },
        45000,
      );
    }

    if (payload.action === "simulateCpuWeek") {
      return App.api.simulateCpuWeek(payload);
    }

    return {
      ok: false,
      message: "Ação inválida.",
    };
  },

  getTeamStrength(teamName) {
    const club = (App.state.apiClubs || []).find((item) =>
      App.utils.sameTeamName(item.Time, teamName),
    );
    return Number(club?.Forca || 70);
  },

  simulateScore(home, away) {
    const homeStrength = App.api.getTeamStrength(home);
    const awayStrength = App.api.getTeamStrength(away);
    const homeAdvantage = 3;

    const homeExpected =
      1.2 + (homeStrength + homeAdvantage - awayStrength) / 18;
    const awayExpected = 1.0 + (awayStrength - homeStrength) / 18;

    return {
      homeScore: Math.max(
        0,
        Math.min(5, Math.round(homeExpected + Math.random() * 2.2 - 0.7)),
      ),
      awayScore: Math.max(
        0,
        Math.min(5, Math.round(awayExpected + Math.random() * 2.0 - 0.6)),
      ),
    };
  },

  async simulateCpuWeek(payload) {
    const week = Number(payload.week);
    const submittedBy = payload.submittedBy || "Liga";

    if (!week) {
      return {
        ok: false,
        created: 0,
        message: "Informe uma semana válida para simular.",
      };
    }

    App.api.requireCommissioner(
      "Apenas o Comissário da Liga pode simular rodadas CPU x CPU.",
    );
    return App.api.rpc(
      "app_simulate_cpu_week",
      {
        ...App.api.getAuthPayload(),
        p_week: week,
        p_submitted_by: submittedBy,
      },
      120000,
    );
  },
};
