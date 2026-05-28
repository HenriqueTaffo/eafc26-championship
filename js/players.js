import App from "./app.js";

App.players = {
  getPlayerTeams() {
    return App.data.teams.filter((team) => team.status === "Nosso");
  },

  getHumanTeamNames() {
    return App.players.getPlayerTeams().map((team) => team.team);
  },

  getApprovedTransfersForBuyer(buyer) {
    return App.transfers
      .getValidTransfers()
      .filter((item) => item.buyer === buyer);
  },

  getSpentByBuyer(buyer) {
    return App.players
      .getApprovedTransfersForBuyer(buyer)
      .reduce((sum, item) => sum + item.totalCost, 0);
  },

  getFinanceForecastForBuyer(buyer) {
    return (
      (App.state.apiFinanceForecast || []).find(
        (item) =>
          App.utils.normalizeText(item.manager_name || item.managerName) ===
          App.utils.normalizeText(buyer),
      ) || null
    );
  },

  getSalaryDebtForBuyer(buyer) {
    return (
      (App.state.apiSalaryDebts || []).find(
        (item) =>
          (item.status === "active" || item.marketEmbargo) &&
          App.utils.normalizeText(item.managerName || item.manager_name) ===
            App.utils.normalizeText(buyer),
      ) || null
    );
  },

  getWeeklyPayrollForBuyer(buyer, transfers = []) {
    const forecast = App.players.getFinanceForecastForBuyer(buyer);
    const forecastPayroll = Number(
      forecast?.payroll_weekly ?? forecast?.payrollWeekly,
    );
    if (Number.isFinite(forecastPayroll) && forecastPayroll > 0) {
      return forecastPayroll;
    }
    return transfers.reduce(
      (sum, item) => sum + App.transfers.getVerifiedWeeklySalary(item),
      0,
    );
  },

  getBudgetBreakdown(budget, spent) {
    const base = Number(budget.baseBudget ?? App.config.transferBudget);
    const homeBonus = Number(budget.homeBonus || 0);
    const winBonus = Number(budget.winBonusValue || budget.winBonus || 0);
    const weeklyIncome = Number(budget.weeklyIncome || 0);
    const formBonus = Number(budget.formBonus || 0);
    const cupRebalanceBonus = Number(budget.cupRebalanceBonus || 0);
    const eventBonus = Number(budget.eventTotal || budget.eventBonus || 0);
    const sponsorshipRewards = Number(budget.sponsorshipRewards || 0);
    const totalAccumulated = Number(
      budget.totalBudget ?? base + homeBonus + winBonus + eventBonus,
    );
    const spentValue = Number(budget.spentTotal ?? spent ?? 0);
    const available = Number(
      budget.remainingBudget ?? totalAccumulated - spentValue,
    );

    return {
      base,
      homeBonus,
      winBonus,
      weeklyIncome,
      formBonus,
      cupRebalanceBonus,
      eventBonus,
      sponsorshipRewards,
      totalAccumulated,
      spent: spentValue,
      available,
    };
  },

  getCoachStatementEntries(owner, budget, breakdown) {
    const entries = [];
    const pushEntry = ({ label, detail, amount, dateLabel, rank }) => {
      const value = Number(amount || 0);
      if (value <= 0) return;
      entries.push({ label, detail, amount: value, dateLabel, rank });
    };

    const positiveEvents = (App.state.apiEvents || [])
      .filter(
        (event) =>
          App.utils.normalizeText(event.Jogador) ===
          App.utils.normalizeText(owner),
      )
      .filter((event) => Number(event.ImpactoFinanceiro || 0) > 0)
      .sort(
        (a, b) =>
          App.events.getEventDateTime(b) - App.events.getEventDateTime(a),
      )
      .slice(0, 4);

    positiveEvents.forEach((event, index) => {
      pushEntry({
        label: event.Titulo || "Evento positivo",
        detail: event.Tipo || "Evento da liga",
        amount: Number(event.ImpactoFinanceiro || 0),
        dateLabel: App.utils.formatDateTime(App.events.getEventDateTime(event)),
        rank: 10 + index,
      });
    });

    const eventRollup =
      Number(breakdown.eventBonus || 0) -
      Number(breakdown.sponsorshipRewards || 0);
    if (!positiveEvents.length && eventRollup > 0) {
      pushEntry({
        label: "Eventos positivos",
        detail: `${Number(budget.eventCount || 0)} ocorr\u00eancia(s) com impacto financeiro`,
        amount: eventRollup,
        dateLabel: "Atualizado pela liga",
        rank: 20,
      });
    }

    pushEntry({
      label: "Patroc\u00ednios",
      detail: "B\u00f4nus comerciais j\u00e1 processados",
      amount: breakdown.sponsorshipRewards,
      dateLabel: "Contratos ativos",
      rank: 30,
    });

    pushEntry({
      label: "PremiaÃ§Ã£o por vitÃ³rias",
      detail: `${Number(budget.wins || 0)} vitÃ³ria(s) aprovada(s)`,
      amount: breakdown.winBonus,
      dateLabel: "Resultados aprovados",
      rank: 40,
    });

    pushEntry({
      label: "Receita semanal",
      detail: "DistribuiÃ§Ã£o fixa por semana ativa",
      amount: breakdown.weeklyIncome,
      dateLabel: "Temporada",
      rank: 42,
    });

    pushEntry({
      label: "BÃ´nus de campanha",
      detail: `${Number(budget.points || 0)} ponto(s) em ${Number(budget.matchesPlayed || 0)} jogo(s)`,
      amount: breakdown.formBonus,
      dateLabel: "Blocos de 5 jogos",
      rank: 44,
    });

    pushEntry({
      label: "Ajuste de copas",
      detail: "Rebalanceamento de premiaÃ§Ãµes de avanÃ§o",
      amount: breakdown.cupRebalanceBonus,
      dateLabel: "Copas",
      rank: 46,
    });

    pushEntry({
      label: "Bilheteria por mando",
      detail: `${Number(budget.homeMatches || 0)} jogo(s) como mandante`,
      amount: breakdown.homeBonus,
      dateLabel: "CalendÃ¡rio oficial",
      rank: 50,
    });

    pushEntry({
      label: "OrÃ§amento inicial",
      detail: "CrÃ©dito base da temporada",
      amount: breakdown.base,
      dateLabel: "Temporada",
      rank: 60,
    });

    return entries.sort((a, b) => a.rank - b.rank);
  },

  renderCoachFinancialStatement(owner, budget, breakdown) {
    const entries = App.players.getCoachStatementEntries(
      owner,
      budget,
      breakdown,
    );
    const extraRevenue = Math.max(
      0,
      Number(breakdown.totalAccumulated || 0) - Number(breakdown.base || 0),
    );
    const latestExtra = entries.find(
      (entry) => entry.label !== "OrÃ§amento inicial",
    );
    const baseEntry = entries.find(
      (entry) => entry.label === "OrÃ§amento inicial",
    );
    const visibleEntries = entries
      .filter((entry) => entry.label !== "OrÃ§amento inicial")
      .slice(0, 5);
    const hiddenEntries = Math.max(
      0,
      entries.length - visibleEntries.length - (baseEntry ? 1 : 0),
    );

    return `
      <div class="coach-full-row-v54">
        <article class="coach-panel-card coach-statement-card">
          <div class="home-panel-header">
            <h2>Extrato do clube</h2>
            <span class="coach-section-kicker">Privado</span>
          </div>
          <div class="coach-statement-summary">
            <div>
              <span>Saldo atual</span>
              <strong>${App.utils.formatCurrency(breakdown.available)}</strong>
            </div>
            <div>
              <span>Receitas extras</span>
              <strong>${App.utils.formatCurrency(extraRevenue)}</strong>
            </div>
            <div>
              <span>Ãšltimo crÃ©dito</span>
              <strong>${latestExtra ? App.utils.formatCurrency(latestExtra.amount) : "-"}</strong>
            </div>
          </div>
          <div class="coach-statement-list">
            ${visibleEntries
              .map(
                (entry) => `
              <div class="coach-statement-item">
                <div>
                  <strong>${App.utils.escapeHtml(entry.label)}</strong>
                  <span>${App.utils.escapeHtml(entry.detail)}</span>
                </div>
                <div>
                  <b>${App.utils.formatCurrency(entry.amount)}</b>
                  <small>${App.utils.escapeHtml(entry.dateLabel)}</small>
                </div>
              </div>
            `,
              )
              .join("")}
            ${
              baseEntry
                ? `
              <div class="coach-statement-base-line">
                <span>Base da temporada</span>
                <b>${App.utils.formatCurrency(baseEntry.amount)}</b>
              </div>
            `
                : ""
            }
            ${hiddenEntries > 0 ? `<p class="coach-statement-note">+${hiddenEntries} receita(s) consolidada(s) no saldo atual.</p>` : ""}
          </div>
        </article>
      </div>
    `;
  },

  getMatchesForTeam(teamName) {
    return App.calendar
      .getCalendarEvents()
      .filter(
        (event) =>
          App.utils.sameTeamName(event.home, teamName) ||
          App.utils.sameTeamName(event.away, teamName),
      );
  },

  getPlayedResultsForTeam(teamName) {
    return App.standings
      .getApprovedApiResults()
      .filter(
        (row) => App.utils.normalizeText(row.Competicao) === "championship",
      )
      .filter(
        (row) =>
          App.utils.sameTeamName(row.Mandante, teamName) ||
          App.utils.sameTeamName(row.Visitante, teamName),
      );
  },

  getNextMatchForTeam(teamName) {
    return App.players.getMatchesForTeam(teamName).find((event) => {
      if (!event) return false;

      // Regra central:
      // O painel dos tÃ©cnicos sÃ³ pode mostrar jogos realmente pendentes.
      // Jogos de copa jÃ¡ finalizados/classificados nÃ£o devem voltar para "PrÃ³ximo compromisso",
      // mesmo quando o texto da fase no banco e no calendÃ¡rio tiver pequenas diferenÃ§as.
      return App.calendar.getStatusClass(event) === "pending";
    });
  },

  getGoalsByHumanTeams() {
    const humanTeams = App.players.getHumanTeamNames();
    const goalsMap = {};

    humanTeams.forEach((team) => {
      goalsMap[App.utils.normalizeTeamName(team)] = {
        name: team,
        detail: App.utils.getTeamByName(team)?.owner || "TÃ©cnico",
        count: 0,
      };
    });

    App.standings.getApprovedApiResults().forEach((row) => {
      const homeKey = App.utils.normalizeTeamName(row.Mandante);
      const awayKey = App.utils.normalizeTeamName(row.Visitante);
      if (goalsMap[homeKey])
        goalsMap[homeKey].count += Number(row.GolsMandante || 0);
      if (goalsMap[awayKey])
        goalsMap[awayKey].count += Number(row.GolsVisitante || 0);
    });

    return Object.values(goalsMap).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  },

  getTopExpensiveTransfers(limit = 5) {
    return App.transfers
      .getTransfersWithStats()
      .filter((item) => !item.isBlockedDuplicate)
      .sort(
        (a, b) => b.totalCost - a.totalCost || a.player.localeCompare(b.player),
      )
      .slice(0, limit)
      .map((item) => ({
        name: item.player,
        detail: `${item.buyer} â€¢ ${item.fromClub || "Clube nÃ£o informado"}`,
        count: App.utils.formatCurrency(item.totalCost),
      }));
  },

  getCoachRanking() {
    const standings = App.standings.getStandings();
    return App.players
      .getPlayerTeams()
      .map((team) => {
        const standing = standings.find((item) =>
          App.utils.sameTeamName(item.team, team.team),
        );
        const budget = App.transfers
          .getSpendingSummary()
          .find((item) => item.buyer === team.owner);
        return { team, standing, budget };
      })
      .sort(
        (a, b) =>
          Number(b.standing?.points || 0) - Number(a.standing?.points || 0) ||
          Number(b.standing?.goalDifference || 0) -
            Number(a.standing?.goalDifference || 0),
      );
  },

  getResultPerspective(row, teamName) {
    const isHome = App.utils.sameTeamName(row.Mandante, teamName);
    const gf = Number(isHome ? row.GolsMandante : row.GolsVisitante);
    const ga = Number(isHome ? row.GolsVisitante : row.GolsMandante);
    const opponent = isHome ? row.Visitante : row.Mandante;
    const result = gf > ga ? "V" : gf === ga ? "E" : "D";
    return { result, gf, ga, opponent, row };
  },

  getRecentForm(teamName, limit = 5) {
    return App.players
      .getPlayedResultsForTeam(teamName)
      .slice(-limit)
      .reverse()
      .map((row) => App.players.getResultPerspective(row, teamName));
  },

  getCoachEvents(buyer, limit = 5) {
    return (App.state.apiEvents || [])
      .filter(
        (event) =>
          App.utils.normalizeText(event.Jogador) ===
          App.utils.normalizeText(buyer),
      )
      .sort(
        (a, b) =>
          App.events.getEventDateTime(b) - App.events.getEventDateTime(a),
      )
      .slice(0, limit);
  },

  getActiveInjuriesForCoach(buyer) {
    return App.events
      .getActiveEventsForBuyer(buyer)
      .filter((event) => String(event.JogadorAfetado || "").trim())
      .filter(
        (event) =>
          Number(event.PartidasRestantes || 0) > 0 ||
          App.events.isActiveOrDurationEvent(event),
      );
  },

  getMedicalPlanOptions() {
    const options = App.state.apiMedicalCenter?.options;
    if (Array.isArray(options) && options.length) return options;
    return [
      {
        planKey: "base_dm",
        name: "DM base",
        description: "Departamento medico padrao do clube.",
        weeklyCost: 0,
        setupCost: 0,
        preventionPct: 0,
        recoveryPct: 0,
        treatmentDaysBonus: 1,
      },
    ];
  },

  getMedicalPlanForCoach(owner) {
    const plans = App.state.apiMedicalCenter?.plans || {};
    const direct = plans[owner];
    if (direct) return direct;
    return App.players.getMedicalPlanOptions()[0] || {};
  },

  formatMedicalPercent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  },

  getMedicalEventValue(event = {}, keys = []) {
    for (const key of keys) {
      if (event[key] !== undefined && event[key] !== null && event[key] !== "") {
        return event[key];
      }
    }
    return null;
  },

  getMedicalSeverityLabel(value = "") {
    const normalized = App.utils.normalizeText(value);
    if (normalized.includes("grave")) return "Grave";
    if (normalized.includes("moder")) return "Moderada";
    if (normalized.includes("leve")) return "Leve";
    return value ? String(value) : "Clinica";
  },

  getMedicalAvailabilityMeta(meta = {}) {
    const status = App.utils.normalizeText(meta.clearanceStatus || "");
    if (status === "restricted_match") {
      return {
        label: meta.minutesCap ? `${meta.minutesCap} min` : "Uso controlado",
        detail: "Retorno progressivo",
        tone: "watch",
        canStart: true,
        isRestricted: true,
      };
    }
    if (status === "available") {
      return {
        label: "100%",
        detail: "Apto",
        tone: "success",
        canStart: true,
        isRestricted: false,
      };
    }
    if (status === "restricted_training") {
      return {
        label: "Treino controlado",
        detail: "Nao escalar",
        tone: "warning",
        canStart: false,
        isRestricted: true,
      };
    }
    if (status === "rehab") {
      return {
        label: "Reabilitacao",
        detail: "Fora",
        tone: "danger",
        canStart: false,
        isRestricted: false,
      };
    }
    return {
      label: "Baixa medica",
      detail: "Fora",
      tone: "danger",
      canStart: false,
      isRestricted: false,
    };
  },

  getMedicalStaffSummary(plan = {}) {
    const profile = plan.staffProfile || {};
    const labelMap = {
      fisioterapia: "Fisio",
      medicina_esportiva: "Medicina",
      ciencia_do_esporte: "Ciência",
      recuperacao: "Recuperação",
    };

    return Object.entries(labelMap)
      .map(([key, label]) => {
        const level = Number(profile[key] || 0);
        return level > 0 ? `${label} ${level}/5` : "";
      })
      .filter(Boolean)
      .join(" · ");
  },

  getMedicalRemainingDays(event = {}) {
    const expiresAtRaw = App.players.getMedicalEventValue(event, [
      "ExpiraEm",
      "expires_at",
    ]);
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
      return Math.max(0, Math.ceil((expiresAt - new Date()) / 86400000));
    }
    return Math.max(
      0,
      Number(
        App.players.getMedicalEventValue(event, [
          "PartidasRestantes",
          "DuracaoValor",
          "duration_value",
          "matches_remaining",
        ]) || 0,
      ),
    );
  },

  getMedicalCaseMeta(event = {}, plan = {}) {
    const remainingDays = App.players.getMedicalRemainingDays(event);
    const caseType =
      App.players.getMedicalEventValue(event, [
        "TipoLesao",
        "medicalCaseType",
        "medical_case_type",
      ]) || "Lesão";
    const severity =
      App.players.getMedicalEventValue(event, [
        "GravidadeLesao",
        "medicalCaseSeverity",
        "medical_case_severity",
      ]) ||
      (remainingDays >= 11 ? "grave" : remainingDays >= 6 ? "moderada" : "leve");
    const clearanceStatus =
      App.players.getMedicalEventValue(event, [
        "StatusClinico",
        "medicalClearanceStatus",
        "medical_clearance_status",
      ]) ||
      (remainingDays <= 1
        ? "restricted_match"
        : remainingDays <= 3
          ? "restricted_training"
          : remainingDays <= 6
            ? "rehab"
            : "out");
    const relapseRisk = Math.max(
      0.08,
      Math.min(
        0.95,
        Number(
          App.players.getMedicalEventValue(event, [
            "RiscoRecaida",
            "medicalRelapseRisk",
            "medical_relapse_risk",
          ]) ||
            (severity === "grave"
              ? 0.42
              : severity === "moderada"
                ? 0.26
                : 0.14),
        ),
      ),
    );
    const workloadScore = Math.max(
      0,
      Math.min(
        100,
        Number(
          App.players.getMedicalEventValue(event, [
            "CargaMedica",
            "medicalWorkloadScore",
            "medical_workload_score",
          ]) || 48,
        ),
      ),
    );
    const nextReviewRaw = App.players.getMedicalEventValue(event, [
      "ProximaRevisaoMedica",
      "medicalNextReviewAt",
      "medical_next_review_at",
    ]);
    const nextReviewAt = nextReviewRaw ? new Date(nextReviewRaw) : null;
    const baseDuration = Math.max(
      remainingDays,
      Number(event.DuracaoValor || 0),
      Number(event.PartidasRestantes || 0),
      1,
    );
    const prevention = Number(plan.preventionPct || 0);
    const recovery = Number(plan.recoveryPct || 0);
    const diagnostics = Number(plan.diagnosticsPct || 0);
    const science = Number(plan.sciencePct || 0);
    const stage = clearanceStatus;
    const stageMeta = {
      out: {
        label: "Baixa clínica",
        subtitle: "Retorno distante",
        recommendation:
          "Segure carga física, preserve o atleta e deixe o staff preparar a próxima revisão clínica.",
        tone: "danger",
        minutesCap: 0,
      },
      rehab: {
        label: "Recuperação ativa",
        subtitle: "Reabilitação guiada",
        recommendation:
          "Controle treino, mantenha fisioterapia e reavalie antes de qualquer carga competitiva.",
        tone: "warning",
        minutesCap: 0,
      },
      restricted_training: {
        label: "Transição clínica",
        subtitle: "Treino com restrição",
        recommendation:
          "Use apenas em treino leve e prepare um retorno progressivo com revisão nas próximas 24h.",
        tone: "watch",
        minutesCap: 20,
      },
      restricted_match: {
        label: "Liberação progressiva",
        subtitle: "Apto com restrição",
        recommendation:
          "Pode voltar gradualmente. Prefira minutos controlados no primeiro jogo.",
        tone: "success",
        minutesCap: 45,
      },
      available: {
        label: "100% apto",
        subtitle: "Sem restrição",
        recommendation: "Caso clínico encerrado. O atleta voltou ao fluxo completo.",
        tone: "success",
        minutesCap: 90,
      },
    }[stage] || {
      label: "Caso em observação",
      subtitle: "Monitoramento do staff",
      recommendation: "Acompanhe o caso e ajuste a carga até a próxima revisão.",
      tone: "warning",
      minutesCap: 0,
    };
    const riskMeta =
      relapseRisk >= 0.35
        ? { label: "Risco alto", tone: "danger" }
        : relapseRisk >= 0.2
          ? { label: "Risco médio", tone: "warning" }
          : { label: "Risco baixo", tone: "success" };
    const progress = Math.max(
      6,
      Math.min(96, Math.round((1 - remainingDays / baseDuration) * 100)),
    );
    const minutesCap = Math.max(
      0,
      Number(
        App.players.getMedicalEventValue(event, [
          "MinutosControlados",
          "medicalMinutesCap",
          "medical_minutes_cap",
        ]) || stageMeta.minutesCap,
      ),
    );
    const nextReviewLabel =
      nextReviewAt && !Number.isNaN(nextReviewAt.getTime())
        ? App.utils.formatDateTime(nextReviewAt)
        : "Acompanhar no próximo ciclo";
    const severityLabel = App.players.getMedicalSeverityLabel(severity);
    const availability = App.players.getMedicalAvailabilityMeta({
      clearanceStatus,
      minutesCap,
    });

    return {
      caseType,
      severity,
      severityLabel,
      clearanceStatus,
      remainingDays,
      baseDuration,
      progress,
      relapseRisk,
      workloadScore,
      nextReviewLabel,
      riskLabel: riskMeta.label,
      riskTone: riskMeta.tone,
      stageLabel: stageMeta.label,
      stageSubtitle: stageMeta.subtitle,
      tone: stageMeta.tone,
      recommendation: stageMeta.recommendation,
      minutesCap,
      diagnosticsPct: diagnostics,
      sciencePct: science,
      supportPct: prevention + recovery,
      availability,
      allowManagedReturn:
        clearanceStatus === "restricted_training" ||
        clearanceStatus === "restricted_match",
    };
  },

  getMedicalStatusSnapshot(owner) {
    const plan = App.players.getMedicalPlanForCoach(owner);
    const injuries = App.players.getActiveInjuriesForCoach(owner);
    const tonePriority = { danger: 0, warning: 1, watch: 2, success: 3 };

    return injuries.reduce((map, event) => {
      const playerName = String(event.JogadorAfetado || "").trim();
      if (!playerName) return map;
      const meta = App.players.getMedicalCaseMeta(event, plan);
      const key = App.utils.normalizeText(playerName);
      const current = map.get(key);
      if (!current) {
        map.set(key, { event, meta });
        return map;
      }
      const currentPriority = tonePriority[current.meta.riskTone] ?? 99;
      const nextPriority = tonePriority[meta.riskTone] ?? 99;
      if (
        nextPriority < currentPriority ||
        (nextPriority === currentPriority &&
          Number(meta.remainingDays || 0) > Number(current.meta.remainingDays || 0))
      ) {
        map.set(key, { event, meta });
      }
      return map;
    }, new Map());
  },

  renderCoachMedicalCenter(owner, injuries = []) {
    const plan = App.players.getMedicalPlanForCoach(owner);
    const options = App.players.getMedicalPlanOptions();
    const activePlanKey = plan.planKey || "base_dm";
    const treatmentDays = Number(plan.treatmentDaysBonus || 1);
    const injuryCases = injuries.map((event) => ({
      event,
      meta: App.players.getMedicalCaseMeta(event, plan),
    }));
    const highRiskCount = injuryCases.filter(
      (item) => item.meta.riskTone === "danger",
    ).length;
    const transitionCount = injuryCases.filter(
      (item) => item.meta.minutesCap > 0,
    ).length;
    const averageReturn = injuryCases.length
      ? Math.max(
          1,
          Math.round(
            injuryCases.reduce((sum, item) => sum + item.meta.remainingDays, 0) /
              injuryCases.length,
          ),
        )
      : 0;

    return `
      <article class="coach-panel-card coach-medical-card" data-medical-owner="${App.utils.escapeHtml(owner)}">
        <div class="home-panel-header">
          <div>
            <h2>Centro médico</h2>
            <p class="coach-card-subtitle">Prevenção, tratamento e retorno progressivo por dias corridos de calendário.</p>
          </div>
          <span class="coach-section-kicker">${App.utils.formatCountLabel(injuries.length, "caso", "casos")}</span>
        </div>

        <div class="medical-plan-hero medical-plan-hero--advanced">
          <div>
            <span>Estrutura ativa</span>
            <strong>${App.utils.escapeDisplay(plan.name || "DM base")}</strong>
            <small>${App.utils.escapeDisplay(plan.description || "Departamento médico padrão do clube.")}</small>
          </div>
          <div>
            <span>Resposta do staff</span>
            <strong>${App.utils.formatCurrency(plan.weeklyCost || 0)}</strong>
            <small>${App.utils.escapeDisplay(App.players.getMedicalStaffSummary(plan) || `tratamento intensivo reduz até ${treatmentDays} dia(s) corrido(s)`)}</small>
          </div>
        </div>

        <div class="medical-summary-strip">
          <span><b>Fora agora</b><strong>${injuries.length}</strong></span>
          <span><b>Risco alto</b><strong>${highRiskCount}</strong></span>
          <span><b>Retorno médio</b><strong>${averageReturn ? `${averageReturn} dia(s)` : "estável"}</strong></span>
          <span><b>Liberação parcial</b><strong>${transitionCount}</strong></span>
        </div>

        <div class="medical-metric-grid">
          <span><b>Prevenção</b><strong>${App.players.formatMedicalPercent(plan.preventionPct)}</strong></span>
          <span><b>Recuperação</b><strong>${App.players.formatMedicalPercent(plan.recoveryPct)}</strong></span>
          <span><b>Diagnóstico</b><strong>${App.players.formatMedicalPercent(plan.diagnosticsPct)}</strong></span>
          <span><b>Ciência</b><strong>${App.players.formatMedicalPercent(plan.sciencePct)}</strong></span>
          <span><b>Implantação</b><strong>${App.utils.formatCurrency(plan.setupCost || 0)}</strong></span>
        </div>

        <div class="medical-plan-options">
          ${options
            .map((item) => {
              const isActive = item.planKey === activePlanKey;
              return `
                <button
                  type="button"
                  class="${isActive ? "is-active" : ""}"
                  data-medical-plan-key="${App.utils.escapeHtml(item.planKey)}"
                  ${isActive ? "disabled" : ""}
                >
                  <strong>${App.utils.escapeDisplay(item.name)}</strong>
                  <small>${App.utils.formatCurrency(item.weeklyCost || 0)}/sem | ${App.players.formatMedicalPercent(item.recoveryPct)} recuperação | ${App.players.formatMedicalPercent(item.diagnosticsPct)} diagnóstico</small>
                </button>
              `;
            })
            .join("")}
        </div>

        <div class="medical-case-stack">
          ${
            injuryCases.length
              ? injuryCases
                  .map(({ event, meta }) => `
              <article class="medical-case-card tone-${meta.tone}">
                <div class="medical-case-head">
                  <div>
                    ${App.transfers.renderPlayerIdentity(event.JogadorAfetado, event.Titulo || "Lesao ativa", "injury-player-identity")}
                    <small>${App.utils.escapeDisplay(meta.caseType)} | ${App.utils.escapeDisplay(meta.stageSubtitle)} | ${App.utils.escapeDisplay(meta.riskLabel)}</small>
                  </div>
                  <div class="medical-case-pill-stack">
                    <b class="medical-case-pill tone-${meta.tone}">${App.utils.escapeDisplay(meta.stageLabel)}</b>
                    <b class="medical-case-pill tone-${meta.riskTone}">${App.utils.escapeDisplay(meta.riskLabel)}</b>
                    <b class="medical-case-pill tone-watch">${App.utils.escapeDisplay(meta.severityLabel)}</b>
                  </div>
                </div>

                <div class="medical-case-meta">
                  <span><b>Prazo</b><strong>${App.events.getEventDurationLabel(event)}</strong></span>
                  <span><b>Retorno alvo</b><strong>${meta.remainingDays} dia(s)</strong></span>
                  <span><b>Minutos sugeridos</b><strong>${meta.minutesCap ? `${meta.minutesCap} min` : "Sem uso"}</strong></span>
                  <span><b>Recaida</b><strong>${Math.round(meta.relapseRisk * 100)}%</strong></span>
                  <span><b>Carga</b><strong>${meta.workloadScore}/100</strong></span>
                  <span><b>Revisao</b><strong>${App.utils.escapeDisplay(meta.nextReviewLabel)}</strong></span>
                </div>

                <div class="medical-case-progress" aria-hidden="true">
                  <span style="width:${meta.progress}%"></span>
                </div>

                <div class="medical-case-foot">
                  <small>${App.utils.escapeDisplay(meta.recommendation)}</small>
                  <button
                    type="button"
                    data-medical-treatment
                    data-medical-action-type="intensive"
                    data-event-id="${App.utils.escapeHtml(event.Id || event.id || "") }"
                    data-event-key="${App.utils.escapeHtml(event.ChaveUnica || "") }"
                    data-event-owner="${App.utils.escapeHtml(event.Jogador || owner)}"
                    data-event-player="${App.utils.escapeHtml(event.JogadorAfetado || "") }"
                  >Tratamento intensivo</button>
                  ${
                    meta.allowManagedReturn
                      ? `
                        <button
                          type="button"
                          data-medical-treatment
                          data-medical-action-type="managed_return"
                          data-event-id="${App.utils.escapeHtml(event.Id || event.id || "") }"
                          data-event-key="${App.utils.escapeHtml(event.ChaveUnica || "") }"
                          data-event-owner="${App.utils.escapeHtml(event.Jogador || owner)}"
                          data-event-player="${App.utils.escapeHtml(event.JogadorAfetado || "") }"
                        >Retorno controlado</button>
                      `
                      : ""
                  }
                </div>
              </article>
            `)
                  .join("")
              : `<div class="coach-empty-state medical-empty-state"><span>DM</span><div><strong>Sem lesionados</strong><p>O elenco esta liberado. Mantenha a estrutura ativa para reduzir risco de recaida e fadiga.</p></div></div>`
          }
        </div>
      </article>
    `;
  },

  getPrivateTargetsKey(owner) {
    const session = App.auth?.getSession ? App.auth.getSession() : null;
    const ownerKey = App.utils.normalizeText(owner).replace(/[^a-z0-9]+/g, "-");
    const sessionKey = String(
      session?.managerId || ownerKey || "manager",
    ).replace(/[^a-zA-Z0-9_-]+/g, "-");
    return `mml-private-transfer-targets-v1:${sessionKey}:${ownerKey}`;
  },

  getPrivateTransferTargets(owner) {
    if (!App.auth?.canViewManagerPrivate?.(owner)) return [];
    const session = App.auth?.getSession ? App.auth.getSession() : null;
    if (
      session &&
      App.utils.normalizeText(session.managerName) ===
        App.utils.normalizeText(owner) &&
      App.auth.myTransferTargetsLoaded
    ) {
      return App.auth.myTransferTargets;
    }

    try {
      const raw = localStorage.getItem(App.players.getPrivateTargetsKey(owner));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },

  savePrivateTransferTargets(owner, targets = []) {
    if (!App.auth?.canViewManagerPrivate?.(owner)) return [];
    const cleanTargets = targets
      .map((item) => ({
        id:
          item.id ||
          `target-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        player: String(item.player || "").trim(),
        club: String(item.club || "").trim(),
        value: Number(item.value || 0),
        priority: String(item.priority || "Monitorar"),
        note: String(item.note || "").trim(),
        createdAt: item.createdAt || new Date().toISOString(),
      }))
      .filter((item) => item.player);

    localStorage.setItem(
      App.players.getPrivateTargetsKey(owner),
      JSON.stringify(cleanTargets),
    );
    return cleanTargets;
  },

  addPrivateTransferTarget(owner, payload = {}) {
    const targets = App.players.getPrivateTransferTargets(owner);
    const playerKey = App.transfers.normalizePlayerRatingKey(payload.player);
    const existing = targets.find(
      (item) =>
        App.transfers.normalizePlayerRatingKey(item.player) === playerKey,
    );
    const nextTarget = {
      ...(existing || {}),
      player: payload.player,
      club: payload.club,
      value: payload.value,
      priority: payload.priority,
      note: payload.note,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    const nextTargets = existing
      ? targets.map((item) =>
          item.id === existing.id ? { ...nextTarget, id: existing.id } : item,
        )
      : [{ ...nextTarget, id: `target-${Date.now()}` }, ...targets];

    return App.players.savePrivateTransferTargets(owner, nextTargets);
  },

  removePrivateTransferTarget(owner, targetId) {
    const targets = App.players
      .getPrivateTransferTargets(owner)
      .filter((item) => item.id !== targetId);
    return App.players.savePrivateTransferTargets(owner, targets);
  },

  renderCoachAlertDeck(alerts) {
    if (!alerts.length) {
      return `
        <div class="coach-empty-state">
          <span>âœ…</span>
          <strong>Sala tranquila</strong>
          <p>Nenhum alerta urgente neste momento. O tÃ©cnico pode focar no prÃ³ximo jogo.</p>
        </div>
      `;
    }

    return `
      <div class="coach-alert-deck">
        ${alerts
          .map((alert, index) => {
            const icon = index === 0 ? "ðŸš¨" : "ðŸ“Œ";
            return `
            <div class="coach-alert-card">
              <span>${icon}</span>
              <p>${App.utils.escapeHtml(alert)}</p>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  },

  renderCoachTransferDeck(transfers) {
    App.transfers.hydratePlayerPortraitsForTransfers?.(transfers);

    if (!transfers.length) {
      return `
        <div class="coach-empty-state">
          <span>ðŸ§¾</span>
          <strong>Nenhuma compra aprovada</strong>
          <p>Nenhuma contrataÃ§Ã£o aprovada para este tÃ©cnico atÃ© agora.</p>
        </div>
      `;
    }

    const visibleTransfers = transfers.slice(0, 6);
    const total = transfers.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0,
    );
    const topTransfer = transfers.reduce(
      (best, item) =>
        Number(item.totalCost || 0) > Number(best?.totalCost || 0)
          ? item
          : best,
      transfers[0],
    );

    return `
      <div class="coach-market-header">
        <div>
          <span>Ãšltimas compras</span>
          <strong>${visibleTransfers.length} de ${transfers.length}</strong>
          <small>contrataÃ§Ãµes aprovadas</small>
        </div>
        <div>
          <span>Maior compra geral</span>
          ${topTransfer ? App.transfers.renderPlayerIdentity(topTransfer.player, topTransfer.fromClub || "", "coach-header-player-identity", { club: topTransfer.fromClub }) : `<strong>-</strong>`}
        </div>
        <div>
          <span>Gasto em compras</span>
          <strong>${App.utils.formatCurrency(total)}</strong>
          <small>total aprovado no histÃ³rico</small>
        </div>
      </div>

      <div class="coach-transfer-timeline">
        ${visibleTransfers
          .map(
            (item) => `
          <div class="coach-transfer-item">
            ${App.transfers.renderPlayerIdentity(item.player, item.fromClub || "Clube nÃ£o informado", "coach-transfer-player-identity", { club: item.fromClub })}
            <span class="coach-transfer-value">
              <small>Custo final</small>
              <b>${App.utils.formatCurrency(item.totalCost)}</b>
            </span>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  },

  renderCoachEventDeck(events) {
    if (!events.length) {
      return `
        <div class="coach-empty-state">
          <span>•</span>
          <strong>Nada no radar</strong>
          <p>Nenhum evento recente registrado para este técnico.</p>
        </div>
      `;
    }

    return `
      <div class="coach-event-stack">
        ${events
          .map((event) => {
            const presentation = App.events.getEventPresentation
              ? App.events.getEventPresentation(event)
              : {
                  title: event.Titulo || "Evento",
                  description: event.Descricao || "",
                  categoryLabel: event.Tipo || "Evento",
                  icon: "•",
                };
            const impact = App.events.getEventImpactLabel
              ? App.events.getEventImpactLabel(event)
              : "";
            const duration = App.events.getEventDurationLabel
              ? App.events.getEventDurationLabel(event)
              : "";
            const impactValue = Number(event.ImpactoFinanceiro || 0);
            const impactClass =
              impactValue > 0
                ? "positive"
                : impactValue < 0
                  ? "negative"
                  : "neutral";
            const impactLabel =
              impactValue > 0
                ? "Entrada no caixa"
                : impactValue < 0
                  ? "Saída do caixa"
                  : "Efeito";
            return `
            <div class="coach-event-item ${impactClass}">
              <span class="coach-event-icon">${presentation.icon}</span>
              <div>
                <strong>${App.utils.escapeHtml(presentation.title)}</strong>
                <small>${App.utils.escapeHtml(presentation.categoryLabel)}${duration ? ` · ${App.utils.escapeHtml(duration)}` : ""}</small>
              </div>
              <span class="coach-event-impact ${impactClass}">
                <small>${impactLabel}</small>
                <b>${App.utils.escapeHtml(impact)}</b>
              </span>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  },

  renderPrivateTransferTargets(owner) {
    const targets = App.players.getPrivateTransferTargets(owner);

    return `
      <article class="coach-panel-card coach-targets-card" data-private-target-owner="${App.utils.escapeHtml(owner)}">
        <div class="home-panel-header">
          <h2>Alvos privados</h2>
          <span class="coach-section-kicker">SÃ³ vocÃª vÃª</span>
        </div>
        <form class="coach-target-form" data-private-target-form>
          <label>
            Jogador
            <input name="player" type="text" placeholder="Buscar no mercado..." autocomplete="off" required data-private-target-search />
          </label>
          <label>
            Clube atual
            <input name="club" type="text" placeholder="Clube ou liga" autocomplete="off" />
          </label>
          <label>
            Valor teto
            <input name="value" type="number" min="0" step="100000" placeholder="0" />
          </label>
          <label>
            Prioridade
            <select name="priority">
              <option>Prioridade alta</option>
              <option>Monitorar</option>
              <option>Plano B</option>
              <option>Oportunidade</option>
            </select>
          </label>
          <label class="target-note-field">
            Nota privada
            <input name="note" type="text" placeholder="Ex.: negociar depois da rodada" autocomplete="off" />
          </label>
          <button type="submit" class="secondary-button">Pinar alvo</button>
        </form>
        <div class="coach-target-search-results" data-private-target-results></div>
        <div class="coach-target-list">
          ${
            targets.length
              ? targets
                  .map((target) => {
                    const marketPlayer = App.transfers.findMarketPlayerByName(
                      target.player,
                      { club: target.club },
                    ) || {
                      name: target.player,
                      club: target.club,
                    };
                    const rating = App.transfers.getRatingForPlayerName(
                      target.player,
                      { club: target.club },
                    );
                    const favoriteKey = `target:${target.id || target.player}`;
                    const isFavorite = App.auth?.isFavorite?.(
                      "transfer_target",
                      favoriteKey,
                    );
                    return `
              <div class="coach-target-item">
                ${App.transfers.renderPlayerPhoto(marketPlayer, rating, "player-avatar")}
                <div class="coach-target-copy">
                  <strong>${App.utils.escapeHtml(target.player)}</strong>
                  <small>${App.utils.escapeHtml([target.priority, target.club, target.value ? App.utils.formatCurrency(target.value) : ""].filter(Boolean).join(" Â· "))}</small>
                  ${target.note ? `<span>${App.utils.escapeHtml(target.note)}</span>` : ""}
                </div>
                <div class="coach-target-actions">
                  <button
                    type="button"
                    class="favorite-action-button ${isFavorite ? "is-active" : ""}"
                    title="${isFavorite ? "Remover dos favoritos" : "Favoritar alvo"}"
                    aria-label="${isFavorite ? "Remover dos favoritos" : "Favoritar alvo"}"
                    data-favorite-target="${App.utils.escapeHtml(favoriteKey)}"
                    data-favorite-title="${App.utils.escapeHtml(target.player)}"
                    data-favorite-detail="${App.utils.escapeHtml([target.priority, target.club].filter(Boolean).join(" Â· "))}"
                  >
                    <span aria-hidden="true">${isFavorite ? "âœ“" : "+"}</span>
                    <b>${isFavorite ? "Salvo" : "Favoritar"}</b>
                  </button>
                  <button type="button" class="icon-action-button remove-action-button" title="Remover alvo" aria-label="Remover alvo" data-remove-private-target="${App.utils.escapeHtml(target.id)}"></button>
                </div>
              </div>
            `;
                  })
                  .join("")
              : `
            <div class="coach-empty-state compact">
              <strong>Nenhum alvo pinado</strong>
              <p>Use este bloco para guardar nomes sem expor sua lista para os outros tÃ©cnicos.</p>
            </div>
          `
          }
        </div>
      </article>
    `;
  },

  renderCoachSaleListCard(owner, transfers = []) {
    const data = App.auth?.myTransferSaleListings || {
      listings: [],
      ownedPlayers: [],
    };
    const listings = Array.isArray(data.listings) ? data.listings : [];
    const dbOwnedPlayers = Array.isArray(data.ownedPlayers)
      ? data.ownedPlayers
      : [];
    const ownedPlayers = dbOwnedPlayers.length
      ? dbOwnedPlayers
      : transfers.map((item) => ({
          player: item.player,
          playerName: item.player,
          fromClub: item.fromClub,
          overall: item.overall,
          baseValue: item.totalCost || item.marketValue || 0,
          listed: listings.some(
            (listing) =>
              App.utils.normalizeText(listing.player || listing.playerName) ===
              App.utils.normalizeText(item.player),
          ),
        }));
    const activeCount = listings.length;

    return `
      <article class="coach-panel-card coach-sale-list-card coach-targets-card" data-sale-list-owner="${App.utils.escapeHtml(owner)}">
        <div class="home-panel-header">
          <div>
            <h2>Lista de venda</h2>
            <p class="coach-card-subtitle">Jogadores sinalizados aqui entram primeiro nas sondagens externas de clubes reais.</p>
          </div>
          <span class="coach-section-kicker">${activeCount} ativo(s)</span>
        </div>
        <form class="coach-target-form" data-sale-listing-form>
          <label>
            Jogador
            <select name="player" required data-sale-listing-player>
              <option value="">Selecione do elenco</option>
              ${ownedPlayers
                .map((player) => {
                  const name = player.player || player.playerName || "";
                  const baseValue = Number(player.baseValue || 0);
                  return `<option value="${App.utils.escapeHtml(name)}" data-base-value="${baseValue}">${App.utils.escapeHtml(name)}${player.listed ? " Â· listado" : ""}</option>`;
                })
                .join("")}
            </select>
          </label>
          <label>
            Pedida
            <input name="askingPrice" type="number" min="0" step="100000" placeholder="Ex.: 11 ou 11000000" data-sale-listing-price />
          </label>
          <label class="target-note-field">
            Recado
            <input name="note" type="text" placeholder="Ex.: aceito proposta acima da pedida" autocomplete="off" />
          </label>
          <button type="submit" class="secondary-button" ${ownedPlayers.length ? "" : "disabled"}>Colocar na lista</button>
        </form>
        <div class="coach-target-list">
          ${
            listings.length
              ? listings
                  .map((item) => {
                    const name = item.player || item.playerName;
                    const fromClub = item.fromClub || item.from_club || "";
                    const askingPrice = Number(
                      item.askingPrice || item.asking_price || 0,
                    );
                    const baseValue = Number(
                      item.baseValue || item.base_value || 0,
                    );
                    const offerCount = Number(
                      item.offerCount || item.offer_count || 0,
                    );
                    const lastOfferAt =
                      item.lastOfferAt || item.last_offer_at || "";
                    const rating = App.transfers.getRatingForPlayerName(name, {
                      club: fromClub,
                    });
                    const marketPlayer = App.transfers.findMarketPlayerByName(
                      name,
                      { club: fromClub },
                    ) || { name, club: fromClub };
                    return `
              <div class="coach-target-item">
                ${App.transfers.renderPlayerPhoto(marketPlayer, rating, "player-avatar")}
                <div class="coach-target-copy">
                  <strong>${App.utils.escapeHtml(name)}</strong>
                  <small>${App.utils.escapeHtml([fromClub, item.overall ? `OVR ${item.overall}` : "", askingPrice ? App.utils.formatCurrency(askingPrice) : ""].filter(Boolean).join(" Â· "))}</small>
                  <span>${App.utils.escapeHtml(item.note || "DisponÃ­vel para propostas externas.")}</span>
                  <span>${offerCount ? `${offerCount} proposta(s) direcionada(s)${lastOfferAt ? ` Â· Ãºltima ${App.utils.formatDateTime(lastOfferAt)}` : ""}` : `Base ${App.utils.formatCurrency(baseValue)} Â· aguardando sondagem`}</span>
                </div>
                <div class="coach-target-actions">
                  <button type="button" class="icon-action-button remove-action-button" title="Remover da lista" aria-label="Remover da lista" data-remove-sale-listing="${App.utils.escapeHtml(item.id)}"></button>
                </div>
              </div>
            `;
                  })
                  .join("")
              : `
            <div class="coach-empty-state compact">
              <strong>NinguÃ©m listado</strong>
              <p>Liste jogadores fora do plano para aumentar a chance de receber ofertas externas por eles.</p>
            </div>
          `
          }
        </div>
      </article>
    `;
  },

  async renderPrivateTargetSearchResults(form) {
    const card = form.closest("[data-private-target-owner]");
    const target = card?.querySelector("[data-private-target-results]");
    const input = form.elements.player;
    if (!target || !input) return;

    const query = String(input.value || "").trim();
    if (query.length < 2) {
      App.dom.clear(target);
      target.classList.remove("is-visible");
      return;
    }

    target.classList.add("is-visible");
    App.dom.setHtml(
      target,
      `<div class="market-empty">Buscando jogadores no mercado...</div>`,
    );

    const players = await App.api
      .loadMarketPlayers(query, true, 8)
      .catch((error) => {
        console.warn("Busca de alvos privados indisponÃ­vel:", error);
        return [];
      });

    if (String(input.value || "").trim() !== query) return;

    if (!players.length) {
      App.dom.setHtml(
        target,
        `<div class="market-empty">Nenhum jogador encontrado no mercado.</div>`,
      );
      return;
    }

    const ratingRows = await Promise.all(
      players
        .slice(0, 8)
        .map((player) =>
          App.transfers.searchEaRatingsCached(player.name || "", 2),
        ),
    );
    App.api.mergeEaRatings?.(ratingRows.flat());

    App.dom.setHtml(
      target,
      `
      <div class="market-player-results">
        ${players
          .map((player) => {
            const eaRating = App.transfers.findEaRatingForMarketPlayer(player);
            const marketValue = App.transfers.getMarketPlayerValue(player);
            const overall = Number(eaRating?.overall || player.overall || 0);
            return `
        <button class="market-player-option private-target-option" type="button" data-private-target-player="${App.utils.escapeHtml(player.id || player.name)}">
          ${App.transfers.renderPlayerPhoto(player, eaRating)}
          <span class="market-player-main">
            <strong>${App.utils.escapeHtml(player.name || "-")}</strong>
            <small>${App.utils.escapeHtml([player.position, player.age ? `${player.age} anos` : "", player.league, player.club].filter(Boolean).join(" Â· "))}</small>
          </span>
          <span class="market-player-side">
            ${overall ? `<span class="market-player-overall">OVR ${overall}</span>` : ""}
            <span class="market-player-value">${App.utils.formatCurrency(marketValue)}</span>
          </span>
        </button>
      `;
          })
          .join("")}
      </div>
    `,
    );

    target
      .querySelectorAll("[data-private-target-player]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const player = players.find(
            (item) =>
              String(item.id || item.name) ===
              String(button.dataset.privateTargetPlayer),
          );
          if (!player) return;
          form.elements.player.value = player.name || "";
          form.elements.club.value = player.club || "";
          form.elements.value.value = Math.round(
            App.transfers.getMarketPlayerValue(player),
          );
          form.elements.player.dataset.marketPlayerId = player.id || "";
          App.dom.clear(target);
          target.classList.remove("is-visible");
        });
      });
  },

  getCoachAlerts(
    team,
    standing,
    budget,
    next,
    transfersToday,
    canViewPrivate = false,
  ) {
    const alerts = [];
    const activeEvents = App.events.getActiveEventsForBuyer(team.owner);
    const injuries = activeEvents.filter((event) =>
      String(event.JogadorAfetado || "").trim(),
    );
    const limit = Number(
      budget.transferLimit ?? App.config.baseDailyTransferLimit,
    );
    const remaining = Number(
      budget.remainingBudget ?? App.config.transferBudget,
    );

    if (next) alerts.push(`PrÃ³ximo jogo pendente: ${next.home} x ${next.away}`);
    if (canViewPrivate && injuries.length)
      alerts.push(`${injuries.length} jogador(es) afetado(s) por evento.`);
    if (canViewPrivate && transfersToday >= limit)
      alerts.push("Limite diÃ¡rio de transferÃªncias atingido.");
    else if (canViewPrivate && transfersToday >= Math.max(1, limit - 1))
      alerts.push("Limite diÃ¡rio de transferÃªncias quase atingido.");
    if (canViewPrivate && remaining < 10000000)
      alerts.push("Saldo de transferÃªncias baixo.");
    if (standing?.position <= 2) alerts.push("Zona de acesso direto.");
    else if (standing?.position <= 6) alerts.push("Zona de playoffs.");

    return alerts;
  },


  renderCoachControlTower(
    activeTeam,
    next,
    injuries = [],
    budget = {},
    transfersToday = 0,
    transferLimit = 0,
    alerts = [],
  ) {
    const canViewPrivate = App.auth?.canViewManagerPrivate
      ? App.auth.canViewManagerPrivate(activeTeam.owner)
      : false;
    const pendingDecisions = canViewPrivate
      ? App.auth.myDecisions.filter((item) => item.status === "pending").length
      : 0;
    const transferActionCount = canViewPrivate
      ? App.auth.myTransferProposals.filter(
          (item) =>
            App.auth.isOpenTransferProposal(item) &&
            (item.proposal_role !== "sent" || App.auth.isExternalTransferContractEmail(item)),
        ).length
      : 0;
    const sponsorOffers = canViewPrivate
      ? App.auth.getSponsorshipInboxOffers(activeTeam.owner).length
      : 0;
    const highRiskCount = injuries.filter(
      (event) =>
        App.players.getMedicalCaseMeta(
          event,
          App.players.getMedicalPlanForCoach(activeTeam.owner),
        ).riskTone === "danger",
    ).length;
    const agenda = [];
    const formatCount = (count, singular, plural) =>
      App.utils.formatCountLabel(count, singular, plural);

    if (next) {
      agenda.push({
        tone: "watch",
        label: "Jogo",
        title: `${next.home} x ${next.away}`,
        detail: `${next.competition} | ${App.utils.formatDate(next.date)}`,
      });
    }
    if (pendingDecisions) {
      agenda.push({
        tone: "danger",
        label: "Diretoria",
        title: formatCount(
          pendingDecisions,
          "decisão aguardando resposta",
          "decisões aguardando resposta",
        ),
        detail: "Abra o escritório para evitar fila atrasada no inbox.",
      });
    }
    if (transferActionCount) {
      agenda.push({
        tone: "warning",
        label: "Mercado",
        title: formatCount(
          transferActionCount,
          "negociacao pede retorno",
          "negociacoes pedem retorno",
        ),
        detail: "Revise proposta, contraoferta ou assinatura antes de perder o prazo.",
      });
    }
    if (sponsorOffers) {
      agenda.push({
        tone: "success",
        label: "Comercial",
        title: formatCount(
          sponsorOffers,
          "oferta de patrocínio na mesa",
          "ofertas de patrocínio na mesa",
        ),
        detail: "Compare contratos no escritório antes de trocar uma marca ativa.",
      });
    }
    if (highRiskCount) {
      agenda.push({
        tone: "danger",
        label: "DM",
        title: formatCount(
          highRiskCount,
          "caso com risco alto",
          "casos com risco alto",
        ),
        detail: "Considere preservar elenco e evitar retorno precoce.",
      });
    }
    if (budget.marketEmbargo) {
      agenda.push({
        tone: "danger",
        label: "Regra",
        title: "Mercado bloqueado por fair play",
        detail: "Regularize a folha antes de abrir novas assinaturas.",
      });
    }
    if (transfersToday >= transferLimit && transferLimit > 0) {
      agenda.push({
        tone: "warning",
        label: "Janela",
        title: "Limite diário de transferências atingido",
        detail: "Espere o próximo ciclo para disparar nova proposta.",
      });
    }
    if (!agenda.length) {
      agenda.push({
        tone: "success",
        label: "Sala",
        title: "Fluxo do dia sob controle",
        detail: "Sem urgências abertas. O técnico pode focar em preparação e observação de mercado.",
      });
    }

    return `
      <article class="coach-panel-card coach-central-card">
        <div class="home-panel-header">
          <div>
            <h2>Central do dia</h2>
            <p class="coach-card-subtitle">Fila executiva com o que exige resposta do técnico neste momento.</p>
          </div>
          <span class="coach-section-kicker">${formatCount(agenda.length, "foco", "focos")}</span>
        </div>

        <div class="coach-central-grid">
          <article><span>Diretoria</span><strong>${pendingDecisions}</strong><small>${App.utils.pluralize(pendingDecisions, "decisão pendente", "decisões pendentes")}</small></article>
          <article><span>Mercado</span><strong>${transferActionCount}</strong><small>${App.utils.pluralize(transferActionCount, "ação no escritório", "ações no escritório")}</small></article>
          <article><span>DM</span><strong>${injuries.length}</strong><small>${App.utils.pluralize(injuries.length, "caso monitorado", "casos monitorados")}</small></article>
          <article><span>Janela</span><strong>${transferLimit ? `${transfersToday}/${transferLimit}` : transfersToday}</strong><small>${budget.marketEmbargo ? "bloqueada" : "uso diário"}</small></article>
        </div>

        <div class="coach-central-agenda">
          ${agenda
            .slice(0, 5)
            .map(
              (item) => `
            <div class="coach-agenda-item tone-${item.tone}">
              <span>${App.utils.escapeDisplay(item.label)}</span>
              <strong>${App.utils.escapeDisplay(item.title)}</strong>
              <small>${App.utils.escapeDisplay(item.detail)}</small>
            </div>
          `,
            )
            .join("")}
        </div>

        ${
          alerts.length
            ? `
          <div class="coach-central-footnote">
            ${alerts.slice(0, 2).map((alert) => `<span>${App.utils.escapeDisplay(alert)}</span>`).join("")}
          </div>
        `
            : ""
        }
      </article>
    `;
  },

  renderLeaderboard(container, data, label) {
    if (!container) return;
    if (!data.length) {
      App.dom.setHtml(
        container,
        `<p class="calendar-muted">Sem dados de ${label} ainda.</p>`,
      );
      return;
    }

    App.dom.setHtml(
      container,
      data
        .map(
          (item, index) => `
      <div class="leaderboard-row">
        <div><strong>${index + 1}. ${item.name}</strong><br><span>${item.detail}</span></div>
        <strong>${item.count}</strong>
      </div>
    `,
        )
        .join(""),
    );
  },

  renderCoachSelector(teams, activeOwner) {
    return `
      <div class="coach-selector">
        ${teams
          .map(
            (team) => `
          <button type="button" class="coach-chip ${team.owner === activeOwner ? "active" : ""}" data-coach-owner="${team.owner}">
            ${App.clubs.getTeamBadgeHtml(team.team, "small")}
            <span>${team.owner}</span>
          </button>
        `,
          )
          .join("")}
      </div>
    `;
  },

  renderFormDots(form) {
    if (!form.length)
      return `<span class="form-empty">Sem jogos aprovados</span>`;
    return form
      .map(
        (item) =>
          `<span class="form-dot ${item.result.toLowerCase()}" title="${item.row.Mandante} ${item.row.GolsMandante} x ${item.row.GolsVisitante} ${item.row.Visitante}">${item.result}</span>`,
      )
      .join("");
  },

  getCoachObjectives(activeTeam, standing, budget, transfers) {
    const remaining = Number(
      budget.remainingBudget ?? App.config.transferBudget,
    );
    const totalBudget = Number(budget.totalBudget ?? App.config.transferBudget);
    const spent = Number(budget.spentTotal || 0);
    const spendPct = totalBudget > 0 ? spent / totalBudget : 0;
    const topSix = Number(standing?.position || 99) <= 6;
    const hasMoreWinsThanLosses =
      Number(standing?.wins || 0) >= Number(standing?.losses || 0);
    const cashDiscipline =
      remaining >= 0 && spendPct <= 0.85 && !budget.marketEmbargo;
    const squadDepth = transfers.length >= 4;

    return [
      {
        label: "Brigar pelo topo",
        status: topSix ? "ok" : "risk",
        detail: topSix
          ? "Dentro do G6."
          : `Atual: ${standing?.position || "-"}Âº. Diretoria quer G6.`,
      },
      {
        label: "Regularidade",
        status: hasMoreWinsThanLosses ? "ok" : "warn",
        detail: hasMoreWinsThanLosses
          ? "VitÃ³rias segurando a campanha."
          : "Diretoria quer reaÃ§Ã£o nos prÃ³ximos jogos.",
      },
      {
        label: "Fair play financeiro",
        status: cashDiscipline ? "ok" : "risk",
        detail: cashDiscipline
          ? "Gasto sob controle."
          : "OrÃ§amento pressionado, negativo ou bloqueado.",
      },
      {
        label: "Profundidade do elenco",
        status: squadDepth ? "ok" : "warn",
        detail: `${transfers.length} contrataÃ§Ã£o(Ãµes) vÃ¡lidas.`,
      },
    ];
  },

  getCoachMorale(activeTeam, standing, budget, injuries, recentForm) {
    let score = 55;
    recentForm.forEach((item) => {
      if (item.result === "W") score += 8;
      if (item.result === "D") score += 2;
      if (item.result === "L") score -= 7;
    });
    score += Math.min(
      12,
      Math.max(-12, Number(standing?.goalDifference || 0) * 2),
    );
    score -= injuries.length * 10;
    if (Number(budget.remainingBudget || 0) < 0) score -= 12;
    score = Math.max(0, Math.min(100, score));

    const label =
      score >= 75
        ? "VestiÃ¡rio em alta"
        : score >= 50
          ? "Ambiente estÃ¡vel"
          : "PressÃ£o no elenco";
    return { score, label };
  },

  getFairPlayFlags(owner, budget, transfers) {
    const remaining = Number(
      budget.remainingBudget ?? App.config.transferBudget,
    );
    const totalBudget = Number(budget.totalBudget ?? App.config.transferBudget);
    const spent = Number(budget.spentTotal || 0);
    const payrollWeekly = App.players.getWeeklyPayrollForBuyer(
      owner,
      transfers,
    );
    const payrollPressure =
      totalBudget > 0 ? (payrollWeekly * 4) / totalBudget : 0;
    const debt = App.players.getSalaryDebtForBuyer(owner);
    const flags = [];

    if (debt || budget.salaryDebtActive) {
      flags.push(
        `DÃ­vida salarial ativa: ${App.utils.formatCurrency(Number(debt?.debtAmount || budget.salaryDebtAmount || Math.abs(remaining)))}.`,
      );
    }
    if (budget.marketEmbargo || remaining < 0)
      flags.push("Mercado bloqueado atÃ© o saldo voltar ao positivo.");
    if (remaining < 0)
      flags.push("Saldo negativo: receitas vencidas quitam a dÃ­vida primeiro.");
    if (totalBudget > 0 && spent / totalBudget >= 0.9)
      flags.push("Gasto acima de 90% do orÃ§amento.");
    if (payrollPressure >= 0.18)
      flags.push(
        `Folha pesada: ${App.utils.formatCurrency(payrollWeekly)} por semana.`,
      );
    if (transfers.some((item) => Number(item.totalCost || 0) >= 30000000))
      flags.push("Compra pesada no radar da liga.");
    if (!flags.length) flags.push("Sem alerta financeiro grave.");

    return flags;
  },

  getPrivateBoardObjectives(
    activeTeam,
    standing,
    budget,
    transfers,
    recentForm,
  ) {
    const next = App.players.getNextMatchForTeam(activeTeam.team);
    const remaining = Number(
      budget.remainingBudget ?? App.config.transferBudget,
    );
    const totalBudget = Number(budget.totalBudget ?? App.config.transferBudget);
    const payrollWeekly = App.players.getWeeklyPayrollForBuyer(
      activeTeam.owner,
      transfers,
    );
    const lastFive = recentForm.slice(0, 5);
    const wins = lastFive.filter((item) => item.result === "W").length;
    const hasValueBuy = transfers.some(
      (item) =>
        Number(item.overall || 0) >= 78 &&
        Number(item.totalCost || 0) <= 14000000,
    );
    const hasBigBuy = transfers.some(
      (item) =>
        Number(item.totalCost || 0) >= 25000000 ||
        Number(item.overall || 0) >= 86,
    );
    const spendRatio = totalBudget > 0 ? 1 - remaining / totalBudget : 0;

    return [
      {
        label: "Alvo de mercado",
        status: hasValueBuy || hasBigBuy ? "ok" : "warn",
        detail: hasBigBuy
          ? "ContrataÃ§Ã£o de impacto jÃ¡ entrou no elenco."
          : hasValueBuy
            ? "Boa compra custo-benefÃ­cio registrada."
            : "Mapeie um titular acess\u00edvel antes do pr\u00f3ximo deadline.",
      },
      {
        label: "PrÃ³ximo jogo",
        status: next ? "warn" : "ok",
        detail: next
          ? `${next.competition} contra ${App.utils.sameTeamName(next.home, activeTeam.team) ? next.away : next.home}.`
          : "Sem compromisso pendente no calendÃ¡rio.",
      },
      {
        label: "Controle de caixa",
        status:
          remaining >= 0 &&
          spendRatio < 0.82 &&
          payrollWeekly * 4 < totalBudget * 0.18
            ? "ok"
            : "risk",
        detail: `${App.utils.formatCurrency(remaining)} livres Â· folha ${App.utils.formatCurrency(payrollWeekly)}/sem.`,
      },
      {
        label: "Momento competitivo",
        status:
          wins >= 2 || Number(standing?.points || 0) >= 10 ? "ok" : "warn",
        detail: `${wins} vitÃ³ria(s) nos Ãºltimos ${lastFive.length || 0} jogos rastreados.`,
      },
    ];
  },

  renderPrivateBoardObjectives(
    activeTeam,
    standing,
    budget,
    transfers,
    recentForm,
  ) {
    const objectives = App.players.getPrivateBoardObjectives(
      activeTeam,
      standing,
      budget,
      transfers,
      recentForm,
    );
    return `
      <div class="coach-full-row-v54">
        <article class="coach-panel-card coach-private-board-card">
          <div class="home-panel-header">
            <div>
              <span class="modal-kicker">SÃ³ vocÃª vÃª</span>
              <h2>Metas secretas</h2>
            </div>
            <span class="coach-section-kicker">${objectives.filter((item) => item.status === "ok").length}/${objectives.length}</span>
          </div>
          <div class="coach-objective-grid private-board-grid">
            ${objectives
              .map(
                (item) => `
              <div class="coach-objective-item ${item.status}">
                <strong>${App.utils.escapeHtml(item.label)}</strong>
                <span>${App.utils.escapeHtml(item.detail)}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </article>
      </div>
    `;
  },

  renderPrivateFavoritesCard(owner) {
    const session = App.auth?.getSession?.();
    if (
      !session ||
      App.utils.normalizeText(session.managerName) !==
        App.utils.normalizeText(owner)
    )
      return "";
    const favorites = App.auth.myFavorites || [];
    const favoriteNames = favorites
      .map((item) => String(item.title || "").trim())
      .filter(Boolean);
    const hydrationKey = favoriteNames.slice().sort().join("|");
    if (
      hydrationKey &&
      App.players.favoritePortraitHydrationKey !== hydrationKey &&
      App.api?.loadMarketPlayersForNames
    ) {
      App.players.favoritePortraitHydrationKey = hydrationKey;
      App.api
        .loadMarketPlayersForNames(favoriteNames, 2)
        .then(() => App.main?.renderCurrentView?.())
        .catch((error) =>
          console.warn("Fotos dos favoritos indisponÃ­veis:", error),
        );
    }

    return `
      <article class="coach-panel-card coach-favorites-card">
        <div class="home-panel-header">
          <h2>Favoritos privados</h2>
          <span class="coach-section-kicker">${favorites.length} item(ns)</span>
        </div>
        <div class="coach-target-list coach-favorite-list">
          ${
            favorites.length
              ? favorites
                  .map((item) => {
                    const title = item.title || "Favorito";
                    const detail = item.detail || item.item_type || "";
                    const detailParts = String(detail)
                      .split("Â·")
                      .map((part) => part.trim())
                      .filter(Boolean);
                    const club =
                      detailParts.find(
                        (part) =>
                          !/^prioridade/i.test(part) &&
                          !/^monitorar/i.test(part) &&
                          !/^plano b/i.test(part) &&
                          !/^oportunidade/i.test(part),
                      ) || "";
                    const marketPlayer = App.transfers.findMarketPlayerByName(
                      title,
                      { club },
                    ) || { name: title, club };
                    const rating = App.transfers.getRatingForPlayerName(title, {
                      club,
                    });

                    return `
            <div class="coach-target-item coach-favorite-item">
              ${App.transfers.renderPlayerPhoto(marketPlayer, rating, "player-avatar")}
              <div class="coach-target-copy">
                <strong>${App.utils.escapeHtml(title)}</strong>
                <small>${App.utils.escapeHtml(detail || "Atalho privado")}</small>
              </div>
              <div class="coach-target-actions">
                <button type="button" class="icon-action-button remove-action-button" title="Remover favorito" aria-label="Remover favorito" data-remove-favorite-type="${App.utils.escapeHtml(item.item_type)}" data-remove-favorite-key="${App.utils.escapeHtml(item.item_key)}"></button>
              </div>
            </div>
          `;
                  })
                  .join("")
              : `
            <div class="coach-empty-state compact">
              <strong>Nenhum favorito salvo</strong>
              <p>Use a estrela nos alvos privados para criar atalhos persistentes.</p>
            </div>
          `
          }
        </div>
      </article>
    `;
  },

  renderCoachStrategyCards(
    activeTeam,
    standing,
    budget,
    transfers,
    injuries,
    recentForm,
  ) {
    const objectives = App.players.getCoachObjectives(
      activeTeam,
      standing,
      budget,
      transfers,
    );
    const morale = App.players.getCoachMorale(
      activeTeam,
      standing,
      budget,
      injuries,
      recentForm,
    );
    const fairPlay = App.players.getFairPlayFlags(
      activeTeam.owner,
      budget,
      transfers,
    );
    const payrollWeekly = App.players.getWeeklyPayrollForBuyer(
      activeTeam.owner,
      transfers,
    );
    const runwayWeeks =
      payrollWeekly > 0
        ? Math.floor(
            Math.max(
              0,
              Number(budget.remainingBudget ?? App.config.transferBudget),
            ) / payrollWeekly,
          )
        : null;

    return `
      <div class="coach-full-row-v54">
        <article class="coach-panel-card coach-strategy-card">
          <div class="home-panel-header">
            <h2>Objetivos da diretoria</h2>
            <span class="coach-section-kicker">${objectives.filter((item) => item.status === "ok").length}/${objectives.length} em dia</span>
          </div>
          <div class="coach-objective-grid">
            ${objectives
              .map(
                (item) => `
              <div class="coach-objective-item ${item.status}">
                <strong>${App.utils.escapeHtml(item.label)}</strong>
                <span>${App.utils.escapeHtml(item.detail)}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </article>
      </div>
      <div class="coach-full-row-v54 coach-strategy-split">
        <article class="coach-panel-card coach-morale-card">
          <div class="home-panel-header">
            <h2>Moral do elenco</h2>
            <span class="coach-section-kicker">${Math.round(morale.score)}%</span>
          </div>
          <div class="morale-meter"><span style="width:${morale.score}%"></span></div>
          <p class="calendar-muted">${App.utils.escapeHtml(morale.label)}. Forma, saldo, caixa e DM pesam nessa leitura.</p>
        </article>
        <article class="coach-panel-card coach-fairplay-card">
          <div class="home-panel-header">
            <h2>Fair play financeiro</h2>
            <span class="coach-section-kicker">Folha ${App.utils.formatCurrency(payrollWeekly)}/sem</span>
          </div>
          <div class="fairplay-list">
            ${fairPlay.map((item) => `<span>${App.utils.escapeHtml(item)}</span>`).join("")}
            ${runwayWeeks !== null ? `<span>FÃ´lego estimado de caixa: ${runwayWeeks} semana(s) de folha.</span>` : ""}
          </div>
        </article>
      </div>
    `;
  },

  renderCoachDashboard(activeTeam, standings, budgetInfo) {
    const standing = standings.find((item) =>
      App.utils.sameTeamName(item.team, activeTeam.team),
    );
    const budget = budgetInfo[activeTeam.owner] || {};
    const salaryDebt = App.players.getSalaryDebtForBuyer(activeTeam.owner);
    const spent = App.players.getSpentByBuyer(activeTeam.owner);
    const breakdown = App.players.getBudgetBreakdown(budget, spent);
    const transfers = App.players.getApprovedTransfersForBuyer(
      activeTeam.owner,
    );
    const payrollWeekly = App.players.getWeeklyPayrollForBuyer(
      activeTeam.owner,
      transfers,
    );
    const next = App.players.getNextMatchForTeam(activeTeam.team);
    const recentForm = App.players.getRecentForm(activeTeam.team);
    const todayCount = App.transfers.getTodayTransferCountByBuyer(
      activeTeam.owner,
    );
    const transferLimit = Number(
      budget.transferLimit ??
        App.transfers.getTransferLimitForBuyer(activeTeam.owner),
    );
    const canViewPrivate = App.auth?.canViewManagerPrivate
      ? App.auth.canViewManagerPrivate(activeTeam.owner)
      : false;
    const events = App.players.getCoachEvents(activeTeam.owner);
    const injuries = App.players.getActiveInjuriesForCoach(activeTeam.owner);
    const color = App.data.ownerColors[activeTeam.owner] || "#2563eb";
    const alerts = App.players.getCoachAlerts(
      activeTeam,
      standing,
      budget,
      next,
      todayCount,
      canViewPrivate,
    );

    const nextMatchCard = `
      <article class="coach-panel-card coach-next-match">
        <div class="home-panel-header"><h2>Proximo compromisso</h2></div>
        ${
          next
            ? `
          <div class="coach-match-preview">
            ${App.clubs.getMatchupHtml(next.home, next.away, "card-match")}
            <p>${next.competition} | ${next.phase} | ${App.utils.formatDate(next.date)}</p>
            ${App.calendar.canSubmitResult(next) ? `<button class="mini-action-button" type="button" data-open-result-modal="${next.id}">Enviar resultado</button>` : `<span class="status-pill pending">${App.calendar.formatMatchResult(next)}</span>`}
          </div>
        `
            : `<p class="calendar-muted">Nenhum compromisso pendente encontrado.</p>`
        }
      </article>
    `;

    const controlTowerCard = canViewPrivate
      ? App.players.renderCoachControlTower(
          activeTeam,
          next,
          injuries,
          budget,
          todayCount,
          transferLimit,
          alerts,
        )
      : "";
    const medicalCard = App.players.renderCoachMedicalCenter(
      activeTeam.owner,
      injuries,
    );

    const decisionCard = App.auth?.renderCoachDecisionCard
      ? App.auth.renderCoachDecisionCard(activeTeam.owner)
      : "";
    const sponsorshipCard = App.auth?.renderCoachSponsorshipCard
      ? App.auth.renderCoachSponsorshipCard(activeTeam.owner)
      : "";
    const pinCard = App.auth?.renderPinChangeCard
      ? App.auth.renderPinChangeCard(activeTeam.owner)
      : "";
    const strategyCards = canViewPrivate
      ? App.players.renderCoachStrategyCards(
          activeTeam,
          standing,
          budget,
          transfers,
          injuries,
          recentForm,
        )
      : "";
    const privateBoardCard = canViewPrivate
      ? App.players.renderPrivateBoardObjectives(
          activeTeam,
          standing,
          budget,
          transfers,
          recentForm,
        )
      : "";
    const statementCard = canViewPrivate
      ? App.players.renderCoachFinancialStatement(
          activeTeam.owner,
          budget,
          breakdown,
        )
      : "";
    const targetsCard = canViewPrivate
      ? App.players.renderPrivateTransferTargets(activeTeam.owner)
      : "";
    const favoritesCard = canViewPrivate
      ? App.players.renderPrivateFavoritesCard(activeTeam.owner)
      : "";
    const saleListCard = canViewPrivate
      ? App.players.renderCoachSaleListCard(activeTeam.owner, transfers)
      : "";

    return `
      <section class="coach-dashboard" style="--coach-color:${color}">
        <article class="coach-hero-card">
          <div class="coach-hero-main">
            <div class="coach-club-mark">${App.clubs.getTeamBadgeHtml(activeTeam.team, "coach-crest")}</div>
            <div>
              <span class="modal-kicker">Escritório do técnico</span>
              <h2>${activeTeam.owner}</h2>
              <p>Técnico do ${activeTeam.team}</p>
              <div class="coach-form-line">
                <span>Forma recente</span>
                ${App.players.renderFormDots(recentForm)}
              </div>
            </div>
          </div>
          <div class="coach-hero-rank">
            <strong>${standing?.position || "-"}o</strong>
            <span>${standing?.points || 0} pts</span>
          </div>
        </article>

        <section class="coach-quick-grid ${canViewPrivate ? "" : "public-only"}">
          <article><span>Campanha</span><strong>${standing?.wins || 0}/${standing?.draws || 0}/${standing?.losses || 0}</strong><small>V/E/D</small></article>
          ${
            canViewPrivate
              ? `
            <article><span>Saldo mercado</span><strong>${App.utils.formatCurrency(breakdown.available)}</strong><small>${budget.marketEmbargo ? "Mercado bloqueado" : `Gasto ${App.utils.formatCurrency(breakdown.spent)}`}</small></article>
            <article><span>Transfers hoje</span><strong>${todayCount}/${transferLimit}</strong><small>${transfers.length} totais validas</small></article>
            <article><span>Folha semanal</span><strong>${App.utils.formatCurrency(payrollWeekly)}</strong><small>base salarial do elenco atual</small></article>
            ${budget.marketEmbargo || salaryDebt ? `<article><span>Fair play</span><strong>Embargo</strong><small>${App.utils.formatCurrency(Number(salaryDebt?.debtAmount || budget.salaryDebtAmount || Math.abs(Number(budget.remainingBudget || 0))))} em aberto</small></article>` : ""}
          `
              : ""
          }
        </section>

        <section class="coach-layout-v54">
          <div class="coach-top-row-v54 ${canViewPrivate ? "" : "public-only"}">
            ${canViewPrivate ? controlTowerCard : ""}
            ${nextMatchCard}
            ${canViewPrivate ? medicalCard : ""}
          </div>

          ${decisionCard ? `<div class="coach-full-row-v54">${decisionCard}</div>` : ""}
          ${sponsorshipCard ? `<div class="coach-full-row-v54">${sponsorshipCard}</div>` : ""}
          ${saleListCard ? `<div class="coach-full-row-v54">${saleListCard}</div>` : ""}
          ${statementCard}
          ${privateBoardCard}
          ${strategyCards}

          <div class="coach-flow-v55">
            <article class="coach-panel-card coach-market-card">
              <div class="home-panel-header">
                <h2>Contratacoes aprovadas</h2>
                <span class="coach-section-kicker">${transfers.length} no historico</span>
              </div>
              ${App.players.renderCoachTransferDeck(transfers)}
            </article>

            <article class="coach-panel-card coach-event-radar-card">
              <div class="home-panel-header">
                <h2>Extrato e ocorrencias</h2>
                <span class="coach-section-kicker">${events.length} lancamento(s)</span>
              </div>
              ${App.players.renderCoachEventDeck(events)}
            </article>

            ${pinCard || ""}
            ${favoritesCard}
            ${targetsCard}
          </div>
        </section>
      </section>
    `;
  },

  renderComparison(ranking) {
    const leader = ranking[0];
    return `
      <section class="coach-comparison coach-comparison-v47">
        <div class="home-panel-header">
          <h2>Termômetro da liga</h2>
          ${leader ? `<span class="coach-section-kicker">Líder: ${App.utils.escapeHtml(leader.team.owner)} · ${leader.standing?.points || 0} pts</span>` : ""}
        </div>
        <div class="coach-podium-grid">
          ${ranking
            .map(
              (item, index) => `
            <article class="coach-podium-card rank-${index + 1}" style="--coach-color:${App.data.ownerColors[item.team.owner] || "#2563eb"}">
              <span class="rank-number">${index + 1}</span>
              ${App.clubs.getTeamBadgeHtml(item.team.team, "small")}
              <div>
                <strong>${item.team.owner}</strong>
                <small>${item.team.team}</small>
              </div>
              <b>${item.standing?.points || 0} pts</b>
            </article>
          `,
            )
            .join("")}
        </div>
      </section>
    `;
  },

  bindCoachActions() {
    document.querySelectorAll("[data-coach-owner]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const select = document.getElementById("playersFilter");
        if (select) {
          select.value = button.dataset.coachOwner;
          localStorage.setItem("mml-filter-playersFilter", select.value);
        }
        App.players.render();
      });
    });

    App.calendar.bindCalendarActions?.();

    document.querySelectorAll("[data-medical-plan-key]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const card = button.closest("[data-medical-owner]");
        const owner = card?.dataset.medicalOwner || "";
        const planKey = button.dataset.medicalPlanKey || "base_dm";
        const option =
          App.players
            .getMedicalPlanOptions()
            .find((item) => item.planKey === planKey) || {};
        const confirmed = App.ui?.confirmAction
          ? await App.ui.confirmAction({
              kicker: "Departamento medico",
              title: "Contratar estrutura?",
              message: `${owner} vai ativar ${option.name || "estrutura medica"}.`,
              detail: [
                `Implantacao: ${App.utils.formatCurrency(option.setupCost || 0)}`,
                `Custo semanal: ${App.utils.formatCurrency(option.weeklyCost || 0)}`,
                `Prevenção: ${App.players.formatMedicalPercent(option.preventionPct)}`,
                `Recuperacao: ${App.players.formatMedicalPercent(option.recoveryPct)}`,
              ].join("\n"),
              tone: "market",
              cancelLabel: "Revisar",
              confirmLabel: "Contratar",
            })
          : confirm("Contratar estrutura medica?");
        if (!confirmed) return;

        try {
          button.disabled = true;
          App.main?.showLoader?.({
            variant: "market",
            title: "Atualizando DM",
            message: "Contratando estrutura medica e recalculando o painel.",
          });
          const result = await App.api.postToApi({
            action: "setMedicalPlan",
            planKey,
          });
          if (!result.ok)
            throw new Error(
              result.message || result.error || "Nao consegui contratar o DM.",
            );
          await App.api.loadApiData({
            force: true,
            showLoader: false,
            skipBackgroundRefresh: true,
          });
          await App.api.loadMedicalCenterData?.();
          App.players.render();
          if (App.ui?.openActionModal) {
            await App.ui.openActionModal({
              kicker: "Departamento medico",
              title: "Estrutura ativa",
              message: result.message || "Plano medico atualizado.",
              tone: "success",
              actions: [
                {
                  id: "confirm",
                  label: "Entendi",
                  variant: "primary",
                  autofocus: true,
                },
              ],
            });
          }
        } catch (error) {
          if (App.ui?.openActionModal) {
            await App.ui.openActionModal({
              kicker: "Departamento medico",
              title: "Nao consegui contratar",
              message: error.message || "Tente novamente depois de sincronizar.",
              tone: "danger",
              actions: [
                {
                  id: "confirm",
                  label: "Entendi",
                  variant: "primary",
                  autofocus: true,
                },
              ],
            });
          } else {
            alert(error.message);
          }
        } finally {
          App.main?.hideLoader?.();
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll("[data-medical-treatment]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const player = button.dataset.eventPlayer || "jogador";
        const actionType = button.dataset.medicalActionType || "intensive";
        const isManagedReturn = actionType === "managed_return";
        const confirmed = App.ui?.confirmAction
          ? await App.ui.confirmAction({
              kicker: "Tratamento medico",
              title: isManagedReturn
                ? "Liberar retorno controlado?"
                : "Aplicar tratamento intensivo?",
              message: isManagedReturn
                ? `${player} sera movido para retorno progressivo com carga e minutos controlados.`
                : `${player} tera o prazo de lesao recalculado pelo DM ativo.`,
              detail: isManagedReturn
                ? "O caso segue monitorado pelo staff e a próxima revisão fica registrada no escritório."
                : "O tratamento gera custo médico, reduz dias corridos restantes e atualiza o calendário da lesão.",
              tone: isManagedReturn ? "info" : "market",
              cancelLabel: "Cancelar",
              confirmLabel: isManagedReturn
                ? "Liberar retorno"
                : "Aplicar tratamento",
            })
          : confirm(
              isManagedReturn
                ? "Liberar retorno controlado?"
                : "Aplicar tratamento intensivo?",
            );
        if (!confirmed) return;

        try {
          button.disabled = true;
          App.main?.showLoader?.({
            variant: isManagedReturn ? "info" : "market",
            title: isManagedReturn ? "Liberando retorno" : "Tratando lesão",
            message: isManagedReturn
              ? "Aplicando restrição progressiva e atualizando o caso clínico."
              : "Aplicando atendimento intensivo e atualizando calendário.",
          });
          const result = await App.api.postToApi({
            action: "applyMedicalTreatment",
            eventId: button.dataset.eventId || "",
            eventKey: button.dataset.eventKey || "",
            eventOwner: button.dataset.eventOwner || "",
            playerName: button.dataset.eventPlayer || "",
            actionType,
          });
          if (!result.ok)
            throw new Error(
              result.message ||
                result.error ||
                (isManagedReturn
                  ? "Nao consegui liberar o retorno controlado."
                  : "Nao consegui tratar a lesao."),
            );
          await App.api.loadApiData({
            force: true,
            showLoader: false,
            skipBackgroundRefresh: true,
          });
          await App.api.loadMedicalCenterData?.();
          App.players.render();
          if (App.ui?.openActionModal) {
            await App.ui.openActionModal({
              kicker: isManagedReturn
                ? "Retorno controlado"
                : "Tratamento aplicado",
              title: isManagedReturn ? "Caso atualizado" : "Prazo atualizado",
              message:
                result.message ||
                (isManagedReturn
                  ? "O atleta agora aparece com restricao progressiva no elenco."
                  : "Lesao atualizada pelo calendario."),
              tone: "success",
              actions: [
                {
                  id: "confirm",
                  label: "Entendi",
                  variant: "primary",
                  autofocus: true,
                },
              ],
            });
          }
        } catch (error) {
          if (App.ui?.openActionModal) {
            await App.ui.openActionModal({
              kicker: "Tratamento medico",
              title: isManagedReturn
                ? "Nao consegui liberar"
                : "Nao consegui aplicar",
              message: error.message || "Tente novamente depois de sincronizar.",
              tone: "danger",
              actions: [
                {
                  id: "confirm",
                  label: "Entendi",
                  variant: "primary",
                  autofocus: true,
                },
              ],
            });
          } else {
            alert(error.message);
          }
        } finally {
          App.main?.hideLoader?.();
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll("[data-sale-listing-form]").forEach((form) => {
      if (form.dataset.bound === "true") return;
      form.dataset.bound = "true";
      const playerSelect = form.querySelector("[data-sale-listing-player]");
      const priceInput = form.querySelector("[data-sale-listing-price]");

      playerSelect?.addEventListener("change", () => {
        const option = playerSelect.selectedOptions?.[0];
        const baseValue = Number(option?.dataset.baseValue || 0);
        if (priceInput && baseValue > 0 && !priceInput.value) {
          priceInput.value = Math.round((baseValue * 1.12) / 100000) * 100000;
        }
      });

      priceInput?.addEventListener("blur", () => {
        const value = Number(priceInput.value || 0);
        if (value > 0 && value < 1000) {
          priceInput.value = String(value * 1000000);
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type='submit']");
        try {
          if (button) {
            button.disabled = true;
            button.textContent = "Salvando...";
          }
          await App.auth.upsertTransferSaleListing({
            player: form.elements.player.value,
            askingPrice: form.elements.askingPrice.value,
            note: form.elements.note.value,
          });
          form.reset();
          App.players.render();
        } catch (error) {
          alert(error.message);
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Colocar na lista";
          }
        }
      });
    });

    document
      .querySelectorAll("[data-remove-sale-listing]")
      .forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";
        button.addEventListener("click", async () => {
          if (!confirm("Remover este jogador da lista de venda?")) return;
          try {
            button.disabled = true;
            await App.auth.deleteTransferSaleListing(
              button.dataset.removeSaleListing,
            );
            App.players.render();
          } catch (error) {
            alert(error.message);
          } finally {
            button.disabled = false;
          }
        });
      });

    document.querySelectorAll("[data-private-target-form]").forEach((form) => {
      if (form.dataset.bound === "true") return;
      form.dataset.bound = "true";
      const searchInput = form.querySelector("[data-private-target-search]");
      let searchTimeout = null;
      searchInput?.addEventListener("input", () => {
        window.clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(
          () => App.players.renderPrivateTargetSearchResults(form),
          220,
        );
      });
      searchInput?.addEventListener("focus", () =>
        App.players.renderPrivateTargetSearchResults(form),
      );
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const card = form.closest("[data-private-target-owner]");
        const owner = card?.dataset.privateTargetOwner || "";
        const payload = {
          player: form.elements.player.value,
          club: form.elements.club.value,
          value: form.elements.value.value,
          priority: form.elements.priority.value,
          note: form.elements.note.value,
        };
        App.players.addPrivateTransferTarget(owner, payload);
        if (App.auth?.upsertMyTransferTarget) {
          try {
            const targets = await App.auth.upsertMyTransferTarget(payload);
            App.players.savePrivateTransferTargets(owner, targets);
          } catch (error) {
            console.warn(
              "NÃ£o consegui sincronizar alvo privado, mantive no cache local:",
              error,
            );
          }
        }
        form.reset();
        App.players.render();
      });
    });

    document
      .querySelectorAll("[data-remove-private-target]")
      .forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";
        button.addEventListener("click", async () => {
          const card = button.closest("[data-private-target-owner]");
          const owner = card?.dataset.privateTargetOwner || "";
          App.players.removePrivateTransferTarget(
            owner,
            button.dataset.removePrivateTarget,
          );
          if (App.auth?.deleteMyTransferTarget) {
            try {
              const targets = await App.auth.deleteMyTransferTarget(
                button.dataset.removePrivateTarget,
              );
              App.players.savePrivateTransferTargets(owner, targets);
            } catch (error) {
              console.warn(
                "NÃ£o consegui sincronizar remoÃ§Ã£o do alvo privado:",
                error,
              );
            }
          }
          App.players.render();
        });
      });

    document.querySelectorAll("[data-favorite-target]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const key = button.dataset.favoriteTarget;
        const isFavorite = App.auth?.isFavorite?.("transfer_target", key);
        try {
          if (isFavorite) await App.auth.deleteFavorite("transfer_target", key);
          else
            await App.auth.upsertFavorite({
              type: "transfer_target",
              key,
              title: button.dataset.favoriteTitle || "Alvo privado",
              detail: button.dataset.favoriteDetail || "",
              payload: { source: "private-target" },
            });
        } catch (error) {
          console.warn("Favorito privado indisponÃ­vel:", error);
        }
        App.players.render();
        App.auth?.renderAll?.();
      });
    });

    document
      .querySelectorAll("[data-remove-favorite-type]")
      .forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";
        button.addEventListener("click", async () => {
          try {
            await App.auth.deleteFavorite(
              button.dataset.removeFavoriteType,
              button.dataset.removeFavoriteKey,
            );
          } catch (error) {
            console.warn("NÃ£o consegui remover favorito:", error);
          }
          App.players.render();
          App.auth?.renderAll?.();
        });
      });
  },

  render() {
    App.react?.notify?.();
  },
};
