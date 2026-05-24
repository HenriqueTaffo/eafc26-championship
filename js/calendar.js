import App from "./app.js";

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

  getCompetitionLabel(competition) {
    if (competition === "Championship") return "Championship";
    return App.cups?.getCompetitionDisplayName ? App.cups.getCompetitionDisplayName(competition) : competition;
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
    App.react?.notify?.();
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

  normalizeCalendarDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    }

    const raw = String(value);
    const date = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  },

  getCalendarDateKey(value) {
    const date = App.calendar.normalizeCalendarDate(value);
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  getCalendarMonthKey(value) {
    const date = App.calendar.normalizeCalendarDate(value);
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  },

  formatCalendarMonth(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1, 1, 12);
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric"
    }).format(date);
  },

  formatCalendarDayParts(value) {
    const date = App.calendar.normalizeCalendarDate(value);
    if (!date) {
      return { day: "--", weekday: "data", month: "a definir" };
    }

    return {
      day: String(date.getDate()).padStart(2, "0"),
      weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date),
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date)
    };
  },

  getCalendarMonthCells(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1, 12);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];

    for (let index = 0; index < startOffset; index++) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(year, month - 1, day, 12));
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  },

  getCalendarOwnersHtml(owners) {
    if (!owners.length) {
      return `<span class="calendar-chip calendar-chip-muted">CPU</span>`;
    }

    return owners.map(owner => {
      const color = App.data.ownerColors[owner] || "#334155";
      return `<span class="owner calendar-owner-pill" style="background:${App.utils.escapeHtml(color)}">${App.utils.escapeHtml(owner)}</span>`;
    }).join("");
  },

  renderCalendarEventCard(event) {
    const owners = App.calendar.getMatchOwners(event);
    const statusClass = App.calendar.getStatusClass(event);
    const oursClass = App.calendar.involvesOurTeam(event) ? "is-ours" : "";
    const statusLabel = statusClass === "done" ? "Realizado" : "Pendente";

    return `
      <article class="calendar-event-card ${statusClass} ${oursClass}">
        <div class="calendar-event-head">
          <span class="competition-badge ${App.utils.escapeHtml(event.className || "")}">${App.utils.escapeHtml(App.calendar.getCompetitionLabel(event.competition))}</span>
          <span class="calendar-event-status-dot ${statusClass}">${App.utils.escapeHtml(statusLabel)}</span>
        </div>
        <div class="calendar-event-match">
          ${App.clubs.getMatchupHtml(event.home, event.away, "calendar-grid-match")}
        </div>
        <div class="calendar-event-phase">
          <span>${App.utils.escapeHtml(event.phase)}</span>
          <span>Semana ${App.utils.escapeHtml(event.week)}</span>
        </div>
        <div class="calendar-event-meta">
          <div>${App.calendar.getCalendarOwnersHtml(owners)}</div>
          <span>${App.utils.escapeHtml(App.calendar.getMatchType(event))}</span>
        </div>
        <div class="calendar-event-action">
          ${App.calendar.getResultActionHtml(event)}
        </div>
      </article>
    `;
  },

  renderCalendarDayCell(date, dayEvents) {
    const dateKey = App.calendar.getCalendarDateKey(date);
    const parts = App.calendar.formatCalendarDayParts(date);
    const pendingCount = dayEvents.filter(event => App.calendar.getStatusClass(event) === "pending").length;
    const humanCount = dayEvents.filter(event => App.calendar.involvesOurTeam(event)).length;
    const dayClass = [
      "calendar-day-cell",
      dayEvents.length ? "has-events" : "",
      pendingCount ? "has-pending" : "",
      humanCount ? "has-human-match" : ""
    ].filter(Boolean).join(" ");

    return `
      <article class="${dayClass}">
        <div class="calendar-day-top">
          <time datetime="${App.utils.escapeHtml(dateKey)}">
            <span>${App.utils.escapeHtml(parts.day)}</span>
            <small>${App.utils.escapeHtml(parts.weekday)}</small>
          </time>
          ${dayEvents.length ? `<span class="calendar-day-count">${dayEvents.length} jogo(s)</span>` : ""}
        </div>
        ${dayEvents.length ? `
          <div class="calendar-day-events">
            ${dayEvents.map(event => App.calendar.renderCalendarEventCard(event)).join("")}
          </div>
        ` : `<span class="calendar-day-empty">Sem jogos</span>`}
      </article>
    `;
  },

  renderCalendarMonth(monthKey, eventsByDate, events) {
    const cells = App.calendar.getCalendarMonthCells(monthKey);
    const monthEvents = events.filter(event => App.calendar.getCalendarMonthKey(event.date) === monthKey);
    const pendingCount = monthEvents.filter(event => App.calendar.getStatusClass(event) === "pending").length;
    const humanCount = monthEvents.filter(event => App.calendar.involvesOurTeam(event)).length;
    const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

    return `
      <section class="calendar-month-card">
        <header class="calendar-month-header">
          <div>
            <span class="modal-kicker">Calendário oficial</span>
            <h2>${App.utils.escapeHtml(App.calendar.formatCalendarMonth(monthKey))}</h2>
          </div>
          <div class="calendar-month-stats">
            <span>${monthEvents.length} jogo(s)</span>
            <span>${pendingCount} pendente(s)</span>
            <span>${humanCount} com técnico</span>
          </div>
        </header>
        <div class="calendar-weekday-row" aria-hidden="true">
          ${weekdays.map(day => `<span>${day}</span>`).join("")}
        </div>
        <div class="calendar-month-grid">
          ${cells.map(date => {
            if (!date) return `<span class="calendar-day-cell calendar-day-cell-empty" aria-hidden="true"></span>`;
            const key = App.calendar.getCalendarDateKey(date);
            const dayEvents = eventsByDate.get(key) || [];
            return App.calendar.renderCalendarDayCell(date, dayEvents);
          }).join("")}
        </div>
      </section>
    `;
  },

  renderCalendarBoard(events) {
    const target = document.getElementById("calendarBoard");
    if (!target) return;

    const datedEvents = events.filter(event => App.calendar.normalizeCalendarDate(event.date));
    if (!datedEvents.length) {
      target.innerHTML = `
        <article class="calendar-empty-panel">
          <strong>Nenhum jogo encontrado</strong>
          <span>Ajuste os filtros para ver partidas realizadas ou o calendário completo.</span>
        </article>
      `;
      return;
    }

    const eventsByDate = datedEvents.reduce((map, event) => {
      const key = App.calendar.getCalendarDateKey(event.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
      return map;
    }, new Map());

    eventsByDate.forEach(dayEvents => {
      dayEvents.sort((a, b) =>
        (App.calendar.getStatusClass(a) === "pending" ? 0 : 1) -
        (App.calendar.getStatusClass(b) === "pending" ? 0 : 1) ||
        (a.competition || "").localeCompare(b.competition || "") ||
        (a.phase || "").localeCompare(b.phase || "")
      );
    });

    const monthKeys = [...new Set(datedEvents.map(event => App.calendar.getCalendarMonthKey(event.date)).filter(Boolean))]
      .sort();

    target.innerHTML = monthKeys
      .map(monthKey => App.calendar.renderCalendarMonth(monthKey, eventsByDate, datedEvents))
      .join("");
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
    if (subtitle) subtitle.textContent = `${App.calendar.getCompetitionLabel(event.competition)} · ${event.phase} · Semana ${event.week}`;

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
      `${App.calendar.getCompetitionLabel(event.competition)} · ${event.phase}`,
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

    const events = App.calendar.getFilteredEvents();
    App.calendar.renderWeekBoard(events);
    App.calendar.renderCalendarBoard(events);

    App.calendar.bindCalendarActions();
  }
};
