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
    if (owners.length >= 2) return "Humano x Humano";
    if (owners.length === 1) return "Humano x CPU";
    return "CPU x CPU";
  },

  getStatusClass(event) {
    return typeof event.homeScore === "number" && typeof event.awayScore === "number" ? "done" : "pending";
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

  getFilteredEvents() {
    const search = App.utils.normalizeText(document.getElementById("calendarSearchInput")?.value);
    const competition = document.getElementById("calendarCompetitionFilter")?.value || "all";
    const ownerFilter = document.getElementById("calendarOwnerFilter")?.value || "all";
    const week = document.getElementById("calendarWeekFilter")?.value || "all";

    return App.calendar.getCalendarEvents().filter(event => {
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

      return matchesSearch && matchesCompetition && matchesWeek && matchesOwner;
    });
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
    const pendingHuman = events.filter(event => App.calendar.involvesOurTeam(event) && App.calendar.getStatusClass(event) === "pending").length;
    const done = events.filter(event => App.calendar.getStatusClass(event) === "done").length;

    summary.innerHTML = `
      <article class="summary-card"><span>Início</span><strong>19/05/2026</strong></article>
      <article class="summary-card"><span>Eventos</span><strong>${events.length}</strong></article>
      <article class="summary-card"><span>Realizados</span><strong>${done}</strong></article>
      <article class="summary-card"><span>Humanos pendentes</span><strong>${pendingHuman}</strong></article>
    `;
  },

  render() {
    App.calendar.populateWeeks();
    App.calendar.renderSummary();

    const table = document.getElementById("calendarTable");
    const mobile = document.getElementById("calendarMobile");
    if (!table || !mobile) return;

    const events = App.calendar.getFilteredEvents();

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
          <td>${owners.length ? owners.map(owner => `<span class="owner" style="background:${App.data.ownerColors[owner]}">${owner}</span>`).join(" ") : "CPU"}</td>
          <td>${App.calendar.getMatchType(event)}</td>
          <td><span class="status-pill ${App.calendar.getStatusClass(event)}">${App.calendar.formatMatchResult(event)}</span></td>
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
          <p>${owners.map(owner => `<span class="owner" style="background:${App.data.ownerColors[owner]}">${owner}</span>`).join(" ")}</p>
          <span class="status-pill ${App.calendar.getStatusClass(event)}">${App.calendar.formatMatchResult(event)}</span>
        </article>
      `;
    }).join("");
  }
};
