window.App = window.App || {};

App.calendar = {
  generateChampionshipRounds() {
    const teamNames = App.data.teams.map(team => team.team);
    const fixedTeam = teamNames[0];
    let rotation = teamNames.slice(1);
    const firstLegRounds = [];

    for (let roundIndex = 0; roundIndex < teamNames.length - 1; roundIndex++) {
      const arranged = [fixedTeam, ...rotation];
      const matches = [];

      for (let index = 0; index < teamNames.length / 2; index++) {
        let home = arranged[index];
        let away = arranged[teamNames.length - 1 - index];
        if (roundIndex % 2 === 1) [home, away] = [away, home];
        matches.push({ home, away });
      }

      firstLegRounds.push(matches);
      rotation = [rotation[rotation.length - 1], ...rotation.slice(0, -1)];
    }

    const secondLegRounds = firstLegRounds.map(round => round.map(match => ({ home: match.away, away: match.home })));
    return [...firstLegRounds, ...secondLegRounds];
  },

  getChampionshipResult(roundNumber, home, away) {
    const phase = `Rodada ${roundNumber}`;
    const row = App.standings.getApprovedApiResults().find(result =>
      App.utils.normalizeText(result.Competicao) === "championship" &&
      App.utils.normalizeText(result.RodadaFase) === App.utils.normalizeText(phase) &&
      App.utils.sameTeamName(result.Mandante, home) &&
      App.utils.sameTeamName(result.Visitante, away)
    );

    if (!row) return null;
    return [Number(row.GolsMandante), Number(row.GolsVisitante)];
  },

  getChampionshipEvents() {
    const rounds = App.calendar.generateChampionshipRounds();
    const events = [];

    rounds.forEach((round, roundIndex) => {
      const roundNumber = roundIndex + 1;
      const week = Math.ceil(roundNumber / App.config.calendarConfig.championshipRoundsPerWeek);

      round.forEach((match, index) => {
        const result = App.calendar.getChampionshipResult(roundNumber, match.home, match.away);
        events.push({
          id: `Championship-${roundNumber}-${index + 1}`,
          date: App.utils.getChampionshipDate(roundNumber),
          week,
          competition: "Championship",
          className: "championship",
          phase: `Rodada ${roundNumber}`,
          home: match.home,
          away: match.away,
          homeScore: result ? result[0] : null,
          awayScore: result ? result[1] : null,
          status: result ? "Finalizado" : "Pendente"
        });
      });
    });

    return events;
  },

  getCalendarEvents() {
    const events = [...App.calendar.getChampionshipEvents(), ...App.cups.getCupEvents()];
    const order = { "Championship": 1, "Copa da Liga": 2, "FA Cup": 3 };
    return events.sort((a, b) => a.date - b.date || (order[a.competition] || 99) - (order[b.competition] || 99) || a.phase.localeCompare(b.phase));
  },

  getEventById(eventId) {
    return App.calendar.getCalendarEvents().find(event => String(event.id) === String(eventId));
  },

  involvesOurTeam(event) {
    return [event.home, event.away].some(teamName => App.utils.getTeamByName(teamName)?.status === "Nosso");
  },

  getMatchOwners(event) {
    return [event.home, event.away]
      .map(teamName => App.utils.getTeamByName(teamName))
      .filter(team => team?.status === "Nosso")
      .map(team => team.owner);
  },

  getMatchType(event) {
    const owners = App.calendar.getMatchOwners(event);
    if (owners.length >= 2) return "Técnico x Técnico";
    if (owners.length === 1) return "Técnico x CPU";
    return "CPU x CPU";
  },

  getStatusClass(event) {
    return typeof event.homeScore === "number" && typeof event.awayScore === "number" ? "done" : "pending";
  },

  canSubmitResult(event) {
    if (!event) return false;
    if (App.calendar.getStatusClass(event) === "done") return false;
    if (String(event.status || "").toLowerCase().includes("aguardando")) return false;
    return App.calendar.involvesOurTeam(event);
  },

  canReverseResult(event) {
    return Boolean(
      event &&
      App.auth?.isCommissioner?.() &&
      App.calendar.getStatusClass(event) === "done"
    );
  },

  formatMatchResult(event) {
    if (typeof event.homeScore === "number" && typeof event.awayScore === "number") {
      const winner = event.competition !== "Championship" ? App.cups.getCupWinner(event) : null;
      const penaltyText = event.penaltyWinner ? `, ${App.utils.resolveTeamName(event.penaltyWinner)} nos pênaltis${event.penaltyScore ? ` (${event.penaltyScore})` : ""}` : "";
      const winnerText = event.competition !== "Championship" && winner ? ` - ${winner} classificado${penaltyText}` : "";
      return `${event.homeScore} x ${event.awayScore}${winnerText}`;
    }
    return event.status || "Pendente";
  },

  getResultActionHtml(event) {
    if (App.calendar.canReverseResult(event)) {
      return `
        <div class="calendar-action-cell">
          <span class="status-pill done">${App.calendar.formatMatchResult(event)}</span>
          <button class="mini-action-button danger" type="button" data-reverse-result="${App.utils.escapeHtml(event.id)}">Desfazer</button>
        </div>
      `;
    }

    if (!App.calendar.canSubmitResult(event)) {
      return `<span class="status-pill ${App.calendar.getStatusClass(event)}">${App.calendar.formatMatchResult(event)}</span>`;
    }

    return `
      <div class="calendar-action-cell">
        <span class="status-pill pending">${App.calendar.formatMatchResult(event)}</span>
        <button class="mini-action-button" type="button" data-open-result-modal="${App.utils.escapeHtml(event.id)}">Enviar placar</button>
      </div>
    `;
  },

  getReverseResultButtonHtml(event) {
    if (!App.calendar.canReverseResult(event)) return "";
    return `<button class="mini-action-button danger" type="button" data-reverse-result="${App.utils.escapeHtml(event.id)}">Desfazer resultado</button>`;
  },

  getFilteredEvents() {
    const search = App.utils.normalizeText(document.getElementById("calendarSearchInput")?.value);
    const competition = document.getElementById("calendarCompetitionFilter")?.value || "all";
    const ownerFilter = document.getElementById("calendarOwnerFilter")?.value || "all";
    const week = document.getElementById("calendarWeekFilter")?.value || "all";
    const statusFilter = document.getElementById("calendarStatusFilter")?.value || "pending";

    let filteredEvents = App.calendar.getCalendarEvents().filter(event => {
      const owners = App.calendar.getMatchOwners(event);
      const matchType = App.calendar.getMatchType(event);

      const matchesSearch = !search || App.utils.normalizeText(`${event.home} ${event.away} ${event.competition} ${event.phase} ${owners.join(" ")} ${matchType}`).includes(search);
      const matchesCompetition = competition === "all" || event.competition === competition;
      const matchesWeek = week === "all" || String(event.week) === String(week);

      let matchesOwner = true;
      if (ownerFilter === "human") {
        matchesOwner = owners.length > 0;
      } else if (ownerFilter === "human-vs-human") {
        matchesOwner = owners.length >= 2;
      } else if (ownerFilter === "cpu") {
        matchesOwner = owners.length === 0;
      } else if (ownerFilter !== "all") {
        matchesOwner = owners.includes(ownerFilter);
      }

      const status = App.calendar.getStatusClass(event);
      let matchesStatus = true;

      if (statusFilter === "pending") {
        matchesStatus = status === "pending";
      } else if (statusFilter === "done") {
        matchesStatus = status === "done";
      }

      return matchesSearch && matchesCompetition && matchesWeek && matchesOwner && matchesStatus;
    });

    if (statusFilter === "next") {
      filteredEvents = filteredEvents
        .filter(event => App.calendar.getStatusClass(event) === "pending")
        .slice(0, 30);
    }

    if (statusFilter === "all" && !search && week === "all") {
      filteredEvents = filteredEvents.slice(0, 80);
    }

    return filteredEvents;
  },

  populateWeeks() {
    const select = document.getElementById("calendarWeekFilter");
    if (!select || select.dataset.ready) return;
    for (let week = 1; week <= 16; week++) {
      const option = document.createElement("option");
      option.value = String(week);
      option.textContent = `Semana ${week}`;
      select.appendChild(option);
    }
    select.dataset.ready = "true";
  },

  renderSummary() {
    const summary = document.getElementById("calendarSummary");
    if (!summary) return;

    const events = App.calendar.getCalendarEvents();
    const pendingTech = events.filter(event => App.calendar.involvesOurTeam(event) && App.calendar.getStatusClass(event) === "pending").length;
    const done = events.filter(event => App.calendar.getStatusClass(event) === "done").length;

    summary.innerHTML = `
      ${App.ui.summaryCard("Início", "19/05/2026")}
      ${App.ui.summaryCard("Jogos", events.length)}
      ${App.ui.summaryCard("Realizados", done)}
      ${App.ui.summaryCard("Técnicos pendentes", pendingTech)}
    `;
  },

  renderWeekBoard(events) {
    const target = document.getElementById("calendarWeekBoard");
    if (!target) return;

    const source = events?.length ? events : App.calendar.getFilteredEvents();
    const weeks = [...source.reduce((acc, event) => {
      const key = String(event.week || "-");
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(event);
      return acc;
    }, new Map()).entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .slice(0, 4);

    if (!weeks.length) {
      target.innerHTML = "";
      return;
    }

    target.innerHTML = `
      <div class="calendar-week-header">
        <div>
          <span class="modal-kicker">Agenda por semana</span>
          <h2>Visão rápida</h2>
        </div>
        <small>${source.length} jogo(s) no filtro atual</small>
      </div>
      <div class="calendar-week-grid">
        ${weeks.map(([week, weekEvents]) => {
          const pending = weekEvents.filter(event => App.calendar.getStatusClass(event) === "pending");
          const human = weekEvents.filter(event => App.calendar.involvesOurTeam(event));
          const next = pending[0] || weekEvents[0];
          return `
            <article class="calendar-week-card">
              <div>
                <span>Semana ${App.utils.escapeHtml(week)}</span>
                <strong>${pending.length} pendente(s)</strong>
              </div>
              <p>${human.length} jogo(s) com técnico</p>
              ${next ? `<small>${App.utils.escapeHtml(next.home)} x ${App.utils.escapeHtml(next.away)}</small>` : ""}
            </article>
          `;
        }).join("")}
      </div>
    `;
  },

  openResultModal(eventId) {
    const event = App.calendar.getEventById(eventId);
    const modal = document.getElementById("calendarResultModal");
    const form = document.getElementById("calendarResultForm");
    const message = document.getElementById("calendarResultMessage");
    const preview = document.getElementById("calendarResultMatchPreview");
    const title = document.getElementById("calendarResultModalTitle");
    const subtitle = document.getElementById("calendarResultModalSubtitle");

    if (!event || !modal || !form) {
      document.body.classList.remove("modal-active");
      return;
    }

    form.reset();
    App.utils.setMessage(message, "", "");

    form.elements.competition.value = event.competition;
    form.elements.week.value = event.week;
    form.elements.phase.value = event.phase;
    form.elements.home.value = event.home;
    form.elements.away.value = event.away;

    const owners = App.calendar.getMatchOwners(event);
    if (owners.length === 1 && form.elements.submittedBy) {
      form.elements.submittedBy.value = owners[0];
    }

    if (title) title.textContent = `${event.home} x ${event.away}`;
    if (subtitle) subtitle.textContent = `${event.competition} · ${event.phase} · Semana ${event.week}`;

    if (preview) {
      preview.innerHTML = `
        <div>${App.clubs.getTeamIdentityHtml(event.home)}</div>
        <strong>x</strong>
        <div>${App.clubs.getTeamIdentityHtml(event.away)}</div>
      `;
    }

    App.forms.updatePenaltyVisibility(form);
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");

    const opened = modal.classList.contains("is-visible") && modal.getAttribute("aria-hidden") === "false";
    if (opened) {
      document.body.classList.add("modal-active");
      setTimeout(() => form.elements.homeScore?.focus(), 50);
    } else {
      document.body.classList.remove("modal-active");
    }
  },

  closeResultModal() {
    const modal = document.getElementById("calendarResultModal");
    if (!modal) return;
    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-active");
  },

  bindCalendarActions() {
    document.querySelectorAll("[data-open-result-modal]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", event => {
        event.stopPropagation();
        App.calendar.openResultModal(button.dataset.openResultModal);
      });
    });

    document.querySelectorAll("[data-reverse-result]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", event => {
        event.stopPropagation();
        App.calendar.handleReverseResult(button.dataset.reverseResult, button);
      });
    });
  },

  async handleReverseResult(eventId, button) {
    const event = App.calendar.getEventById(eventId);
    const message = document.getElementById("resultMessage") || document.getElementById("calendarResultMessage");
    if (!event) return;

    const confirmation = [
      "Desfazer este resultado?",
      "",
      `${event.competition} · ${event.phase}`,
      `${event.home} ${event.homeScore} x ${event.awayScore} ${event.away}`,
      "",
      "A partida voltará a ficar pendente e as premiações vinculadas a este placar serão removidas."
    ].join("\n");

    if (!window.confirm(confirmation)) return;

    if (button) button.disabled = true;
    App.main.showLoader({
      variant: "match",
      title: "Desfazendo resultado",
      message: "Removendo placar, avanço indevido e premiações associadas."
    });

    try {
      const data = await App.api.postToApi({
        action: "reverseResult",
        competition: event.competition,
        phase: event.phase,
        home: event.home,
        away: event.away
      });

      if (!data.ok) throw new Error(data.message || data.error || "Não foi possível desfazer o resultado.");
      App.utils.setMessage(message, data.message || "Resultado desfeito.", "success");
      await App.api.loadApiData({
        variant: "match",
        title: "Atualizando dados",
        message: "Resultado desfeito. Atualizando calendário, copas e orçamento..."
      });
    } catch (error) {
      App.utils.setMessage(message, error.message, "error");
    } finally {
      App.main.hideLoader();
      if (button) button.disabled = false;
    }
  },

  render() {
    App.calendar.populateWeeks();
    App.calendar.renderSummary();

    const table = document.getElementById("calendarTable");
    const mobile = document.getElementById("calendarMobile");
    if (!table || !mobile) return;

    const events = App.calendar.getFilteredEvents();
    App.calendar.renderWeekBoard(events);

    if (!events.length) {
      const emptyMessage = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <strong>Nenhum jogo encontrado</strong>
              <span>Ajuste os filtros para ver partidas realizadas ou o calendário completo.</span>
            </div>
          </td>
        </tr>
      `;

      table.innerHTML = emptyMessage;
      mobile.innerHTML = `<article class="calendar-card"><h3>Nenhum jogo encontrado</h3><p class="calendar-muted">Ajuste os filtros para ver partidas realizadas ou o calendário completo.</p></article>`;
      return;
    }

    table.innerHTML = events.map(event => {
      const owners = App.calendar.getMatchOwners(event);
      const rowClass = App.calendar.involvesOurTeam(event) ? "ours-row" : "";
      const visualClass = App.calendar.getStatusClass(event) === "done" ? "calendar-completed-row" : "calendar-pending-row";
      return `
        <tr class="${rowClass} ${visualClass}">
          <td>${App.utils.formatDate(event.date)}</td>
          <td class="numeric">${event.week}</td>
          <td><span class="competition-badge ${event.className}">${event.competition}</span></td>
          <td>${event.phase}</td>
          <td class="calendar-match">${App.clubs.getMatchupHtml(event.home, event.away, "table-match")}</td>
          <td class="calendar-owner-cell">${owners.length ? owners.map(owner => `<span class="owner" style="background:${App.data.ownerColors[owner]}">${owner}</span>`).join(" ") : "<span class='calendar-muted'>CPU</span>"}</td>
          <td>${App.calendar.getMatchType(event)}</td>
          <td>${App.calendar.getResultActionHtml(event)}</td>
        </tr>
      `;
    }).join("");

    mobile.innerHTML = events.map(event => {
      const owners = App.calendar.getMatchOwners(event);
      const visualClass = App.calendar.getStatusClass(event) === "done" ? "calendar-completed-row" : "calendar-pending-row";
      return `
        <article class="calendar-card ${App.calendar.involvesOurTeam(event) ? "ours-row" : ""} ${visualClass}">
          <div class="calendar-card-header"><span class="competition-badge ${event.className}">${event.competition}</span><span class="calendar-muted">${App.utils.formatDate(event.date)}</span></div>
          <h3>${App.clubs.getMatchupHtml(event.home, event.away, "card-match")}</h3>
          <p class="calendar-muted">${event.phase} · Semana ${event.week} · ${App.calendar.getMatchType(event)}</p>
          <p>${owners.length ? owners.map(owner => `<span class="owner" style="background:${App.data.ownerColors[owner]}">${owner}</span>`).join(" ") : "<span class='calendar-muted'>CPU</span>"}</p>
          <div class="mobile-card-footer">${App.calendar.getResultActionHtml(event)}</div>
        </article>
      `;
    }).join("");

    App.calendar.bindCalendarActions();
  }
};
