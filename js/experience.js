window.App = window.App || {};

App.experience = {
  getCoachProfile(team) {
    const standings = App.standings.getStandings();
    const standing = standings.find(row => App.utils.sameTeamName(row.team, team.team)) || {};
    const budget = App.transfers.getBudgetInfoByBuyer()[team.owner] || {};
    const transfers = App.players.getApprovedTransfersForBuyer(team.owner);
    const injuries = App.players.getActiveInjuriesForCoach(team.owner);
    const recent = App.players.getRecentForm(team.team, 5);
    const wins = recent.filter(item => item.result === "V").length;
    const losses = recent.filter(item => item.result === "D").length;
    const spendPct = Number(budget.totalBudget || 0) > 0 ? Number(budget.spentTotal || 0) / Number(budget.totalBudget || 1) : 0;
    const morale = Math.max(0, Math.min(100,
      52 +
      Number(standing.points || 0) * 1.6 +
      Number(standing.goalDifference || 0) * 1.2 +
      wins * 5 -
      losses * 6 -
      injuries.length * 5 -
      (Number(budget.remainingBudget || 0) < 0 ? 18 : 0) -
      (spendPct > .9 ? 8 : 0)
    ));

    const reputation = morale >= 78 ? "Alta" : morale >= 58 ? "Estável" : morale >= 40 ? "Pressão" : "Crise";
    return { team, standing, budget, transfers, injuries, recent, morale: Math.round(morale), reputation };
  },

  getProfiles() {
    return App.data.teams.filter(team => team.status === "Nosso").map(team => App.experience.getCoachProfile(team));
  },

  getDirectorObjectives(profile) {
    const objectives = [
      {
        label: "Manter caixa positivo",
        status: Number(profile.budget.remainingBudget || 0) >= 0,
        reward: "+ moral financeira"
      },
      {
        label: "Pontuar no próximo jogo",
        status: profile.recent[0]?.result !== "D",
        reward: "+ reputação"
      },
      {
        label: "Evitar DM lotado",
        status: profile.injuries.length <= 1,
        reward: "+ confiança da diretoria"
      },
      {
        label: "Mercado sob controle",
        status: Number(profile.budget.spentTotal || 0) <= Number(profile.budget.totalBudget || 0) * .85,
        reward: "+ limite de negociação"
      }
    ];

    const done = objectives.filter(item => item.status).length;
    const verdict = done >= 3 ? "Diretoria satisfeita" : done >= 2 ? "Semana em observação" : "Cobrança interna";
    return { objectives, done, verdict };
  },

  getOpportunityRows() {
    const market = App.transfers.getMarketPlayers().map(item => {
      const rating = App.transfers.findEaRatingForMarketPlayer?.(item);
      return {
        name: item.name,
        club: item.club,
        position: item.position,
        overall: Number(rating?.overall || item.overall || 0),
        avatar_url: rating?.avatar_url || item.avatar_url || "",
        value: Number(item.market_value_eur || 0)
      };
    });

    const source = market;

    return source
      .filter(item => item.name)
      .sort((a, b) =>
        Number(b.overall || 0) - Number(a.overall || 0) ||
        Number(b.value || 0) - Number(a.value || 0) ||
        String(a.name).localeCompare(String(b.name))
      )
      .slice(0, 6)
      .map((item, index) => ({
        ...item,
        tag: index % 3 === 0 ? "Scout recomenda" : index % 3 === 1 ? "Preço observável" : "Janela curta",
        risk: Number(item.overall || 0) >= 84 ? "Disputa provável" : "Boa oportunidade"
      }));
  },

  getAuctionRows() {
    const transfers = App.transfers.getTransfersWithStats();
    const grouped = transfers.reduce((acc, item) => {
      const key = App.utils.normalizeText(item.player);
      if (!key) return acc;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});

    const duplicates = Object.values(grouped)
      .filter(items => new Set(items.map(item => item.buyer)).size > 1)
      .map(items => {
        const latest = items[items.length - 1];
        return {
          player: latest.player,
          detail: [...new Set(items.map(item => item.buyer))].join(" x "),
          value: Math.max(...items.map(item => Number(item.totalCost || 0))),
          status: "Disputa detectada"
        };
      });

    const expensive = App.transfers.getValidTransfers()
      .filter(item => Number(item.overall || 0) >= 85 || Number(item.totalCost || 0) >= 35000000)
      .slice(0, 4)
      .map(item => ({
        player: item.player,
        detail: item.buyer,
        value: item.totalCost,
        status: "Candidato a leilão"
      }));

    const persisted = (App.state.apiExperience?.auctions || []).map(item => ({
      player: item.player_name,
      detail: item.trigger_reason,
      value: Number(item.current_value || 0),
      status: item.status || "open"
    }));

    return [...persisted, ...duplicates, ...expensive].slice(0, 6);
  },

  getNewsRows() {
    const profiles = App.experience.getProfiles();
    const rows = profiles.map(profile => {
      const result = profile.recent[0];
      if (profile.reputation === "Crise") {
        return {
          topic: "Diretoria",
          tone: "pressure",
          headline: `${profile.team.owner} entra em semana decisiva`,
          summary: "Pressão financeira e esportiva elevou o tom da cobrança interna.",
          impact: "Risco de crise"
        };
      }
      if (result?.result === "V") {
        return {
          topic: "Vestiário",
          tone: "positive",
          headline: `${profile.team.team} ganha respiro`,
          summary: `A vitória fortaleceu a moral do elenco de ${profile.team.owner}.`,
          impact: "Moral em alta"
        };
      }
      return {
        topic: "Bastidores",
        tone: profile.reputation === "Pressão" ? "pressure" : "neutral",
        headline: `${profile.team.owner} sob leitura da diretoria`,
        summary: `Reputação atual: ${profile.reputation.toLowerCase()}. A próxima rodada pesa na avaliação.`,
        impact: "Monitoramento"
      };
    });

    const sponsorGroups = (App.auth?.mySponsorships?.recentRewards || []).reduce((groups, item) => {
      const sponsor = item.sponsor_name || "Patrocinador";
      groups[sponsor] = groups[sponsor] || { sponsor, count: 0, total: 0 };
      groups[sponsor].count += 1;
      groups[sponsor].total += Number(item.reward_value || 0);
      return groups;
    }, {});

    const sponsorRewards = Object.values(sponsorGroups).map(item => ({
      topic: "Comercial",
      tone: "money",
      headline: item.count > 1 ? `${item.sponsor} mantém fluxo de caixa` : `${item.sponsor} ativa bônus`,
      summary: item.count > 1
        ? `${item.count} pagamento(s) comercial(is) consolidados no escritório.`
        : "Meta cumprida e pagamento comercial confirmado.",
      impact: item.total > 0 ? `+${App.utils.formatCurrency(item.total)}` : "Bônus confirmado"
    }));

    const persisted = (App.state.apiExperience?.news || [])
      .map(item => ({
        topic: item.category || "Liga",
        tone: "neutral",
        headline: item.title || "Informe da liga",
        summary: item.body || item.description || "A liga publicou uma atualização oficial.",
        impact: item.impact || "Atualização"
      }))
      .filter(item => item.headline || item.summary);

    const seen = new Set();
    return [...persisted, ...sponsorRewards, ...rows]
      .filter(item => {
        const key = App.utils.normalizeText(`${item.topic}|${item.headline}|${item.summary}`);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  },

  renderSummary() {
    const target = document.getElementById("experienceSummary");
    if (!target) return;

    const profiles = App.experience.getProfiles();
    const avgMorale = profiles.length
      ? Math.round(profiles.reduce((sum, item) => sum + item.morale, 0) / profiles.length)
      : 0;
    const opportunities = App.experience.getOpportunityRows();
    const auctions = App.experience.getAuctionRows();
    const ratings = App.state.apiRatings || [];

    target.innerHTML = `
      ${App.ui.summaryCard("Moral média", `${avgMorale}/100`)}
      ${App.ui.summaryCard("Oportunidades", opportunities.length)}
      ${App.ui.summaryCard("Radar de leilão", auctions.length)}
      ${App.ui.summaryCard("Cache ratings", ratings.length ? `${ratings.length} jogador(es)` : "Aguardando import")}
    `;
  },

  renderDirectorBoard(profiles) {
    return `
      <article class="experience-card experience-wide" id="directorBoard">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Central de Diretoria</span>
            <h2>Objetivos da semana</h2>
          </div>
        </div>
        <div class="director-grid">
          ${profiles.map(profile => {
            const board = App.experience.getDirectorObjectives(profile);
            return `
              <div class="director-card">
                <div class="director-card-top">
                  ${App.ui.ownerBadge(profile.team.owner)}
                  <strong>${board.done}/4</strong>
                </div>
                <h3>${App.utils.escapeHtml(board.verdict)}</h3>
                ${board.objectives.map(item => `
                  <span class="${item.status ? "is-done" : "is-open"}">${App.utils.escapeHtml(item.label)} <b>${App.utils.escapeHtml(item.reward)}</b></span>
                `).join("")}
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  },

  renderMoraleBoard(profiles) {
    return `
      <article class="experience-card">
        <span class="modal-kicker">Moral e reputação</span>
        <h2>Técnicos sob análise</h2>
        <div class="morale-list">
          ${profiles.map(profile => `
            <div class="morale-row">
              <span>${App.utils.escapeHtml(profile.team.owner)}</span>
              <div class="morale-bar"><i style="width:${profile.morale}%"></i></div>
              <strong>${profile.morale}</strong>
              <small>${App.utils.escapeHtml(profile.reputation)}</small>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  },

  renderScoutBoard() {
    const ratings = (App.state.apiRatings || []).filter(item => App.transfers.isPlayableRating?.(item) !== false);
    return `
      <article class="experience-card" id="eaScoutBoard">
        <span class="modal-kicker">Base de ratings</span>
        <h2>Scout de overall</h2>
        <p class="calendar-muted">Use a tabela local importada de fontes confiáveis para validar OVR, posição e clube antes de enviar transferência.</p>
        <div class="scout-list">
          ${ratings.length ? ratings.slice(0, 6).map(item => `
            <div>
              ${App.transfers.renderPlayerPhoto(item, null, "scout-photo")}
              <p>
                <strong>${App.utils.escapeHtml(item.name)}</strong>
                <span>${App.utils.escapeHtml([item.position, item.club].filter(Boolean).join(" · "))}</span>
              </p>
              <b>OVR ${Number(item.overall || 0)}</b>
            </div>
          `).join("") : `<p class="calendar-muted">Cache ainda vazio. Importe uma base de ratings antes de usar o scout.</p>`}
        </div>
      </article>
    `;
  },

  renderOpportunities() {
    const persisted = (App.state.apiExperience?.opportunities || []).map(item => ({
      name: item.player_name || item.title,
      club: item.club,
      position: item.position,
      overall: Number(item.overall || 0),
      value: Number(item.suggested_value || 0),
      avatar_url: item.avatar_url || "",
      tag: item.tag || "Scout recomenda",
      risk: item.risk || "Boa oportunidade"
    }));
    const rows = [...persisted, ...App.experience.getOpportunityRows()].slice(0, 6);
    return `
      <article class="experience-card experience-wide" id="opportunityBoard">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Mercado de Oportunidades</span>
            <h2>Alvos recomendados</h2>
          </div>
        </div>
        <div class="opportunity-grid">
          ${rows.length ? rows.map(item => `
            <div class="opportunity-card">
              ${App.transfers.renderPlayerPhoto(item, null, "scout-photo")}
              <span>${App.utils.escapeHtml(item.tag)}</span>
              <strong>${App.utils.escapeHtml(item.name)}</strong>
              <small>${App.utils.escapeHtml([item.position, item.club].filter(Boolean).join(" · "))}</small>
              ${Number(item.overall || 0) ? `<b>OVR ${Number(item.overall || 0)}</b>` : `<b>${App.utils.formatCurrency(Number(item.value || 0))}</b>`}
              <em>${App.utils.escapeHtml(item.risk)}</em>
            </div>
          `).join("") : `<p class="calendar-muted">Sem oportunidades enquanto a base de mercado/rating estiver vazia.</p>`}
        </div>
      </article>
    `;
  },

  renderAuctionsAndNews() {
    const auctions = App.experience.getAuctionRows();
    const news = App.experience.getNewsRows();
    const leadNews = news[0];
    const secondaryNews = news.slice(1, 5);

    return `
      <article class="experience-card">
        <span class="modal-kicker">Leilão automático</span>
        <h2>Radar de disputa</h2>
        <div class="experience-list">
          ${auctions.length ? auctions.map(item => `
            <div>
              ${App.transfers.renderPlayerIdentity(item.player, `${item.detail} · ${App.utils.formatCurrency(item.value)}`, "experience-player-identity")}
              <b>${App.utils.escapeHtml(item.status)}</b>
            </div>
          `).join("") : `<p class="calendar-muted">Nenhuma disputa automática detectada.</p>`}
        </div>
      </article>
      <article class="experience-card">
        <div class="home-panel-header">
          <div>
            <span class="modal-kicker">Jornal da Liga</span>
            <h2>Boletim editorial</h2>
          </div>
          <small class="experience-news-count">${news.length} nota(s)</small>
        </div>
        ${leadNews ? `
          <div class="experience-news-board">
            <article class="experience-news-lead tone-${App.utils.escapeHtml(leadNews.tone || "neutral")}">
              <span>${App.utils.escapeHtml(leadNews.topic || "Liga")}</span>
              <strong>${App.utils.escapeHtml(leadNews.headline)}</strong>
              <p>${App.utils.escapeHtml(leadNews.summary)}</p>
              <b>${App.utils.escapeHtml(leadNews.impact || "")}</b>
            </article>
            ${secondaryNews.length ? `
              <div class="experience-news-briefs">
                ${secondaryNews.map(item => `
                  <article class="tone-${App.utils.escapeHtml(item.tone || "neutral")}">
                    <span>${App.utils.escapeHtml(item.topic || "Liga")}</span>
                    <strong>${App.utils.escapeHtml(item.headline)}</strong>
                    <small>${App.utils.escapeHtml(item.impact || "")}</small>
                  </article>
                `).join("")}
              </div>
            ` : ""}
          </div>
        ` : `<p class="calendar-muted">Sem notícia relevante para publicar agora.</p>`}
      </article>
    `;
  },

  renderFallbackCard(title, error) {
    const message = error?.message || "Não consegui montar este bloco agora.";
    return `
      <article class="experience-card">
        <span class="modal-kicker">Liga+</span>
        <h2>${App.utils.escapeHtml(title)}</h2>
        <p class="calendar-muted">${App.utils.escapeHtml(message)}</p>
      </article>
    `;
  },

  renderSafe(title, renderer) {
    try {
      return renderer();
    } catch (error) {
      console.warn(`Liga+ indisponível em ${title}:`, error);
      return App.experience.renderFallbackCard(title, error);
    }
  },

  render() {
    try {
      App.experience.renderSummary();
    } catch (error) {
      console.warn("Resumo Liga+ indisponível:", error);
      const summary = document.getElementById("experienceSummary");
      if (summary) summary.innerHTML = App.ui.summaryCard("Liga+", "Revisar dados");
    }

    const target = document.getElementById("experienceGrid");
    if (!target) return;

    target.innerHTML = `
      ${App.experience.renderSafe("Central de Diretoria", () => App.experience.renderDirectorBoard(App.experience.getProfiles()))}
      ${App.experience.renderSafe("Moral e reputação", () => App.experience.renderMoraleBoard(App.experience.getProfiles()))}
      ${App.experience.renderSafe("Scout EA", () => App.experience.renderScoutBoard())}
      ${App.experience.renderSafe("Oportunidades", () => App.experience.renderOpportunities())}
      ${App.experience.renderSafe("Leilões e notícias", () => App.experience.renderAuctionsAndNews())}
    `;
  }
};
