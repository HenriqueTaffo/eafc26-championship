import App from "./app.js";

App.experience = {
  clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  },

  getBudgetMap() {
    return App.transfers.getSpendingSummary().reduce((acc, item) => {
      acc[item.buyer] = item;
      return acc;
    }, {});
  },

  getHumanCalendarEvents() {
    return App.calendar.getCalendarEvents().filter(event => App.calendar.involvesOurTeam(event));
  },

  getCoachProfiles() {
    const standings = App.standings.getStandings();
    const budgetMap = App.experience.getBudgetMap();
    const humanEvents = App.experience.getHumanCalendarEvents();

    return App.data.teams
      .filter(team => team.status === "Nosso")
      .map(team => {
        const standing = standings.find(row => App.utils.sameTeamName(row.team, team.team)) || {};
        const budget = budgetMap[team.owner] || {};
        const transfers = App.players.getApprovedTransfersForBuyer(team.owner);
        const injuries = App.players.getActiveInjuriesForCoach(team.owner);
        const recent = App.players.getRecentForm(team.team, 5);
        const pendingMatches = humanEvents.filter(event =>
          App.calendar.getStatusClass(event) === "pending" &&
          (App.utils.sameTeamName(event.home, team.team) || App.utils.sameTeamName(event.away, team.team))
        );
        const nextMatch = pendingMatches[0] || App.players.getNextMatchForTeam(team.team);
        const transferLimit = Number(budget.transferLimit || App.config.baseDailyTransferLimit || 3);
        const transfersToday = Number(budget.transfersToday || 0);
        const transferSlots = Math.max(0, transferLimit - transfersToday);
        const wins = recent.filter(item => item.result === "V").length;
        const draws = recent.filter(item => item.result === "E").length;
        const losses = recent.filter(item => item.result === "D").length;
        const runwayWeeks = Number.isFinite(Number(budget.runwayWeeks)) ? Number(budget.runwayWeeks) : null;
        const spentPct = Number(budget.totalBudget || 0) > 0
          ? Number(budget.spent || 0) / Number(budget.totalBudget || 1)
          : 0;
        const sportScore = App.experience.clamp(
          Number(standing.points || 0) * 2.2 +
          Number(standing.goalDifference || 0) * 1.2 +
          wins * 7 +
          draws * 3 -
          losses * 5 +
          (standing.position <= 6 ? 8 : 0),
          0,
          40
        );
        const financeScore = App.experience.clamp(
          24 -
          (Number(budget.remaining || 0) < 0 ? 22 : 0) -
          Math.max(0, spentPct - .82) * 55 -
          Number(budget.payrollPressure || 0) * 35 +
          (runwayWeeks === null ? 3 : Math.min(9, runwayWeeks)),
          0,
          30
        );
        const operationScore = App.experience.clamp(
          22 -
          pendingMatches.length * 3 -
          injuries.length * 4 -
          (transferSlots <= 0 && transferLimit > 0 ? 4 : 0),
          0,
          22
        );
        const marketScore = App.experience.clamp(
          8 +
          transferSlots * 2 -
          (Number(budget.marketEmbargo) ? 8 : 0) -
          (Number(budget.remaining || 0) < 5000000 ? 3 : 0),
          0,
          12
        );
        const intelligenceScore = Math.round(sportScore + financeScore + operationScore + marketScore);

        const profile = {
          team,
          standing,
          budget,
          transfers,
          injuries,
          recent,
          pendingMatches,
          nextMatch,
          transferLimit,
          transfersToday,
          transferSlots,
          runwayWeeks,
          intelligenceScore
        };

        profile.alert = App.experience.getCoachAlert(profile);
        profile.marketPlan = App.experience.getMarketPlan(profile);
        profile.insight = App.experience.getCoachInsight(profile);
        return profile;
      });
  },

  getCoachAlert(profile) {
    if (Number(profile.budget.remaining || 0) < 0 || profile.budget.marketEmbargo) {
      return { tone: "critical", label: "Emergência", detail: "Caixa ou fair play travando margem de ação." };
    }
    if (profile.pendingMatches.length >= 2) {
      return { tone: "warning", label: "Rodada presa", detail: "Resultados pendentes estão segurando leitura da liga." };
    }
    if (profile.injuries.length >= 2) {
      return { tone: "warning", label: "DM pressionado", detail: "Elenco precisa de gestão antes da próxima rodada." };
    }
    if (profile.runwayWeeks !== null && profile.runwayWeeks <= 3 && Number(profile.budget.payrollWeekly || 0) > 0) {
      return { tone: "warning", label: "Folha pesada", detail: "Pouco fôlego de caixa para sustentar salários." };
    }
    if (profile.intelligenceScore >= 78) {
      return { tone: "positive", label: "Em alta", detail: "Boa combinação de resultado, caixa e operação." };
    }
    return { tone: "stable", label: "Controle", detail: "Sem bloqueio grave, mas há margem para otimizar." };
  },

  getMarketPlan(profile) {
    const remaining = Number(profile.budget.remaining || 0);
    const payrollPressure = Number(profile.budget.payrollPressure || 0);

    if (remaining < 0 || profile.budget.marketEmbargo) {
      return { tone: "critical", label: "Vender / quitar", detail: "Receitas e vendas devem limpar a dívida antes de nova compra." };
    }
    if (payrollPressure >= .18 || (profile.runwayWeeks !== null && profile.runwayWeeks <= 3)) {
      return { tone: "warning", label: "Aliviar folha", detail: "Prioridade é reduzir salário projetado e preservar caixa." };
    }
    if (profile.transferSlots <= 0 && profile.transferLimit > 0) {
      return { tone: "neutral", label: "Aguardar reset", detail: "Limite diário usado. Planeje alvos para o próximo ciclo." };
    }
    if (remaining >= 18000000 && profile.transferSlots > 0) {
      return { tone: "positive", label: "Pode atacar", detail: "Existe caixa e slot para uma negociação bem escolhida." };
    }
    return { tone: "stable", label: "Seletivo", detail: "Comprar só se o alvo resolver elenco ou gerar oportunidade clara." };
  },

  getCoachInsight(profile) {
    if (profile.alert.tone === "critical") return "Abrir plano de caixa antes de qualquer movimento agressivo.";
    if (profile.pendingMatches.length) return "Resolver placar pendente melhora leitura de tabela, bônus e calendário.";
    if (profile.injuries.length) return "Checar DM antes de aceitar troca ou vender reserva útil.";
    if (profile.transferSlots > 0 && Number(profile.budget.remaining || 0) > 12000000) return "Tem janela para compra cirúrgica sem virar all-in.";
    return "Manter disciplina e esperar oportunidade real de mercado.";
  },

  getDecisionQueue(profiles) {
    const queue = [];
    const push = item => queue.push({
      cta: "Abrir",
      ...item
    });

    profiles.forEach(profile => {
      const owner = profile.team.owner;
      const remaining = Number(profile.budget.remaining || 0);

      if (remaining < 0) {
        push({
          owner,
          severity: "critical",
          rank: 1,
          title: "Recuperar caixa negativo",
          body: `${owner} está ${App.utils.formatCurrency(Math.abs(remaining))} abaixo de zero. Vendas e receitas devem quitar a dívida primeiro.`,
          metric: App.utils.formatCurrency(remaining),
          target: "transfersView"
        });
      }

      if (profile.budget.marketEmbargo && remaining >= 0) {
        push({
          owner,
          severity: "critical",
          rank: 2,
          title: "Fair play bloqueando mercado",
          body: "Existe embargo ativo. Conferir folha, dívidas salariais e ajustes pendentes.",
          metric: "Embargo",
          target: "playersView"
        });
      }

      if (profile.pendingMatches.length) {
        const firstMatch = profile.pendingMatches[0];
        push({
          owner,
          severity: profile.pendingMatches.length >= 2 ? "warning" : "medium",
          rank: 3,
          title: `${profile.pendingMatches.length} placar(es) pendente(s)`,
          body: `${firstMatch.home} x ${firstMatch.away} é o próximo jogo que precisa de decisão.`,
          metric: App.utils.formatDate(firstMatch.date),
          target: "calendarView"
        });
      }

      if (profile.injuries.length) {
        push({
          owner,
          severity: profile.injuries.length >= 2 ? "warning" : "medium",
          rank: 4,
          title: "DM ativo",
          body: `${profile.injuries.length} jogador(es) com restrição. Impacta próximos jogos e profundidade do elenco.`,
          metric: `${profile.injuries.length} lesão(ões)`,
          target: "playersView"
        });
      }

      if (profile.runwayWeeks !== null && profile.runwayWeeks <= 3 && Number(profile.budget.payrollWeekly || 0) > 0) {
        push({
          owner,
          severity: "warning",
          rank: 5,
          title: "Fôlego salarial baixo",
          body: `Folha estimada de ${App.utils.formatCurrency(profile.budget.payrollWeekly)}/sem com só ${profile.runwayWeeks} semana(s) de fôlego.`,
          metric: `${profile.runwayWeeks} sem.`,
          target: "playersView"
        });
      }

      if (profile.transferLimit > 0 && profile.transferSlots <= 0) {
        push({
          owner,
          severity: "neutral",
          rank: 7,
          title: "Limite diário usado",
          body: "Evitar insistir em nova compra até o reset do mercado.",
          metric: `${profile.transfersToday}/${profile.transferLimit}`,
          target: "transfersView"
        });
      }
    });

    return queue.sort((a, b) =>
      a.rank - b.rank ||
      App.utils.normalizeText(a.owner).localeCompare(App.utils.normalizeText(b.owner)) ||
      a.title.localeCompare(b.title)
    ).slice(0, 8);
  },

  getImpactMatches(profiles) {
    const profilesByTeam = profiles.reduce((acc, profile) => {
      acc[App.utils.normalizeTeamName(profile.team.team)] = profile;
      return acc;
    }, {});

    return App.experience.getHumanCalendarEvents()
      .filter(event => App.calendar.getStatusClass(event) === "pending")
      .slice(0, 8)
      .map(event => {
        const owners = App.calendar.getMatchOwners(event);
        const profile = [event.home, event.away]
          .map(team => profilesByTeam[App.utils.normalizeTeamName(team)])
          .find(item => item?.alert?.tone === "critical" || item?.alert?.tone === "warning");
        const label = owners.length >= 2
          ? "Duelo entre técnicos"
          : event.competition !== "Championship"
            ? "Jogo de copa"
            : profile
              ? profile.alert.label
              : "Calendário";

        return {
          event,
          owners,
          label,
          detail: profile ? `${profile.team.owner}: ${profile.alert.detail}` : App.calendar.getMatchType(event)
        };
      })
      .slice(0, 5);
  },

  getLeagueHealth(profiles) {
    const queue = App.experience.getDecisionQueue(profiles);
    const pendingHuman = App.experience.getHumanCalendarEvents()
      .filter(event => App.calendar.getStatusClass(event) === "pending").length;
    const critical = profiles.filter(profile => profile.alert.tone === "critical").length;
    const negativeCash = profiles.reduce((sum, profile) => {
      const remaining = Number(profile.budget.remaining || 0);
      return remaining < 0 ? sum + Math.abs(remaining) : sum;
    }, 0);
    const openSlots = profiles.reduce((sum, profile) => sum + Number(profile.transferSlots || 0), 0);
    const payrollWeekly = profiles.reduce((sum, profile) => sum + Number(profile.budget.payrollWeekly || 0), 0);
    const avgScore = profiles.length
      ? Math.round(profiles.reduce((sum, profile) => sum + profile.intelligenceScore, 0) / profiles.length)
      : 0;

    return { queue, pendingHuman, critical, negativeCash, openSlots, payrollWeekly, avgScore };
  },

  getParityRows(profiles) {
    const sortedByScore = [...profiles].sort((a, b) => b.intelligenceScore - a.intelligenceScore);
    const budgets = profiles.map(profile => Number(profile.budget.remaining || 0));
    const maxBudget = budgets.length ? Math.max(...budgets) : 0;
    const minBudget = budgets.length ? Math.min(...budgets) : 0;
    const standings = profiles
      .map(profile => profile.standing)
      .filter(Boolean)
      .sort((a, b) => Number(a.position || 99) - Number(b.position || 99));
    const top = standings[0];
    const bottom = standings[standings.length - 1];
    const payrollLeader = [...profiles].sort((a, b) =>
      Number(b.budget.payrollWeekly || 0) - Number(a.budget.payrollWeekly || 0)
    )[0];

    return [
      {
        label: "Maior diferença de caixa",
        value: App.utils.formatCurrency(maxBudget - minBudget),
        detail: "Quanto maior, mais a liga tende a abrir distância no mercado."
      },
      {
        label: "Distância esportiva entre técnicos",
        value: top && bottom ? `${Number(top.points || 0) - Number(bottom.points || 0)} pts` : "-",
        detail: top && bottom ? `${top.owner} acima de ${bottom.owner}` : "Aguardando tabela."
      },
      {
        label: "Maior folha semanal",
        value: payrollLeader ? App.utils.formatCurrency(payrollLeader.budget.payrollWeekly || 0) : "-",
        detail: payrollLeader ? `${payrollLeader.team.owner} carrega o maior custo fixo.` : "Sem folha estimada."
      },
      {
        label: "Melhor momento operacional",
        value: sortedByScore[0] ? `${sortedByScore[0].team.owner} · ${sortedByScore[0].intelligenceScore}` : "-",
        detail: sortedByScore[0]?.insight || "Aguardando dados."
      }
    ];
  },

  renderSummary() {
    App.react?.notify?.();
  },

  renderCommandCenter(profiles) {
    const health = App.experience.getLeagueHealth(profiles);
    const topAction = health.queue[0];

    return `
      <article class="experience-card intelligence-command experience-wide" id="intelligenceQueue">
        <div class="intelligence-command-main">
          <span class="modal-kicker">Prioridade da liga</span>
          <h2>${topAction ? App.utils.escapeHtml(topAction.title) : "Liga sem bloqueios urgentes"}</h2>
          <p>${topAction ? App.utils.escapeHtml(topAction.body) : "Nenhum técnico aparece com travas críticas no momento. Acompanhe mercado, placares e folha para manter esse cenário."}</p>
          ${topAction ? `<button class="mini-action-button" type="button" data-view-target="${App.utils.escapeHtml(topAction.target)}">${App.utils.escapeHtml(topAction.cta)}</button>` : ""}
        </div>
        <div class="intelligence-pulse-grid">
          <article>
            <span>Caixa negativo</span>
            <strong>${App.utils.formatCurrency(health.negativeCash)}</strong>
          </article>
          <article>
            <span>Slots de mercado</span>
            <strong>${health.openSlots}</strong>
          </article>
          <article>
            <span>Folha semanal</span>
            <strong>${App.utils.formatCurrency(health.payrollWeekly)}</strong>
          </article>
          <article>
            <span>Jogos pendentes</span>
            <strong>${health.pendingHuman}</strong>
          </article>
        </div>
      </article>
    `;
  },

  renderDecisionQueue(profiles) {
    const queue = App.experience.getDecisionQueue(profiles);

    return `
      <article class="experience-card intelligence-queue experience-wide">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Fila de ação</span>
            <h2>O que precisa acontecer agora</h2>
          </div>
          <small>${queue.length} item(ns)</small>
        </div>
        <div class="intelligence-action-list">
          ${queue.length ? queue.map(item => `
            <div class="intelligence-action-row severity-${App.utils.escapeHtml(item.severity)}">
              <span>${App.utils.escapeHtml(item.owner)}</span>
              <div>
                <strong>${App.utils.escapeHtml(item.title)}</strong>
                <small>${App.utils.escapeHtml(item.body)}</small>
              </div>
              <b>${App.utils.escapeHtml(item.metric)}</b>
              <button type="button" data-view-target="${App.utils.escapeHtml(item.target)}">Abrir</button>
            </div>
          `).join("") : `
            <div class="intelligence-empty-state">
              <strong>Nenhuma ação urgente</strong>
              <span>A liga está sem travas críticas. Use os próximos jogos para atualizar tendência.</span>
            </div>
          `}
        </div>
      </article>
    `;
  },

  renderPowerIndex(profiles) {
    const rows = [...profiles].sort((a, b) =>
      b.intelligenceScore - a.intelligenceScore ||
      Number(a.standing.position || 99) - Number(b.standing.position || 99)
    );

    return `
      <article class="experience-card intelligence-power" id="intelligencePower">
        <span class="modal-kicker">Power index</span>
        <h2>Força real dos técnicos</h2>
        <div class="intelligence-power-list">
          ${rows.map((profile, index) => `
            <div class="intelligence-power-row tone-${App.utils.escapeHtml(profile.alert.tone)}">
              <i>${index + 1}</i>
              ${App.clubs.getTeamBadgeHtml(profile.team.team, "small")}
              <div>
                <strong>${App.utils.escapeHtml(profile.team.owner)}</strong>
                <small>${App.utils.escapeHtml(profile.alert.label)} · ${App.utils.escapeHtml(profile.team.team)}</small>
                <span><em style="width:${profile.intelligenceScore}%"></em></span>
              </div>
              <b>${profile.intelligenceScore}</b>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  },

  renderImpactMatches(profiles) {
    const matches = App.experience.getImpactMatches(profiles);

    return `
      <article class="experience-card intelligence-matchday">
        <span class="modal-kicker">Rodada de impacto</span>
        <h2>Jogos que mudam leitura</h2>
        <div class="intelligence-match-list">
          ${matches.length ? matches.map(item => `
            <div class="intelligence-match-card">
              <div>
                <span>${App.utils.escapeHtml(item.label)}</span>
                <div class="intelligence-matchup">${App.clubs.getMatchupHtml(item.event.home, item.event.away, "calendar-grid-match")}</div>
                <small>${App.utils.escapeHtml(item.event.phase)} · ${App.utils.formatDate(item.event.date)}</small>
              </div>
              <p>${App.utils.escapeHtml(item.detail)}</p>
            </div>
          `).join("") : `<p class="calendar-muted">Nenhum jogo pendente com técnico encontrado.</p>`}
        </div>
      </article>
    `;
  },

  renderMarketMap(profiles) {
    return `
      <article class="experience-card intelligence-market experience-wide" id="intelligenceMarket">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Mapa de mercado</span>
            <h2>Postura recomendada por técnico</h2>
          </div>
        </div>
        <div class="intelligence-market-grid">
          ${profiles.map(profile => `
            <article class="intelligence-market-card tone-${App.utils.escapeHtml(profile.marketPlan.tone)}">
              <div>
                ${App.ui.ownerBadge(profile.team.owner, App.data.ownerColors[profile.team.owner])}
                <strong>${App.utils.escapeHtml(profile.marketPlan.label)}</strong>
              </div>
              <p>${App.utils.escapeHtml(profile.marketPlan.detail)}</p>
              <dl>
                <div><dt>Saldo</dt><dd>${App.utils.formatCurrency(profile.budget.remaining || 0)}</dd></div>
                <div><dt>Slots</dt><dd>${profile.transfersToday}/${profile.transferLimit}</dd></div>
                <div><dt>Folha</dt><dd>${App.utils.formatCurrency(profile.budget.payrollWeekly || 0)}/sem</dd></div>
              </dl>
            </article>
          `).join("")}
        </div>
      </article>
    `;
  },

  renderParityBoard(profiles) {
    const rows = App.experience.getParityRows(profiles);

    return `
      <article class="experience-card intelligence-parity">
        <span class="modal-kicker">Saúde competitiva</span>
        <h2>Sinais que não aparecem na tabela</h2>
        <div class="intelligence-parity-list">
          ${rows.map(item => `
            <div>
              <span>${App.utils.escapeHtml(item.label)}</span>
              <strong>${App.utils.escapeHtml(item.value)}</strong>
              <small>${App.utils.escapeHtml(item.detail)}</small>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  },

  renderFallbackCard(title, error) {
    const message = error?.message || "Não consegui montar este bloco agora.";
    return `
      <article class="experience-card">
        <span class="modal-kicker">Inteligência</span>
        <h2>${App.utils.escapeHtml(title)}</h2>
        <p class="calendar-muted">${App.utils.escapeHtml(message)}</p>
      </article>
    `;
  },

  renderSafe(title, renderer) {
    try {
      return renderer();
    } catch (error) {
      console.warn(`Inteligência indisponível em ${title}:`, error);
      return App.experience.renderFallbackCard(title, error);
    }
  },

  render() {
    let profiles = [];

    try {
      profiles = App.experience.getCoachProfiles();
      App.experience.renderSummary();
    } catch (error) {
      console.warn("Resumo de inteligência indisponível:", error);
      const summary = document.getElementById("experienceSummary");
      if (summary) summary.innerHTML = App.ui.summaryCard("Inteligência", "Revisar dados");
    }

    const target = document.getElementById("experienceGrid");
    if (!target) return;

    target.innerHTML = `
      ${App.experience.renderSafe("Painel de controle", () => App.experience.renderCommandCenter(profiles))}
      ${App.experience.renderSafe("Fila de ação", () => App.experience.renderDecisionQueue(profiles))}
      ${App.experience.renderSafe("Power index", () => App.experience.renderPowerIndex(profiles))}
      ${App.experience.renderSafe("Rodada de impacto", () => App.experience.renderImpactMatches(profiles))}
      ${App.experience.renderSafe("Mapa de mercado", () => App.experience.renderMarketMap(profiles))}
      ${App.experience.renderSafe("Saúde competitiva", () => App.experience.renderParityBoard(profiles))}
    `;

    App.standings.bindHomeActions?.();
  }
};
