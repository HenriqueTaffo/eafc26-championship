import App from "./app.js";

App.cups = {
  getCupDefinitions() {
    return [
      {
        name: "Copa da Liga",
        displayName: "Carabao Cup",
        shortName: "Carabao",
        mark: "https://www.efl.com/sponsors/carabao.png",
        className: "league-cup",
        rounds: [
          { phase: "Primeira fase", week: 2, matches: [
            { home: "Coventry City", away: "Oxford United" },
            { home: "Birmingham City", away: "Stoke City" },
            { home: "Middlesbrough", away: "Hull City" },
            { home: "Southampton", away: "Portsmouth" },
            { home: "Norwich City", away: "Watford" },
            { home: "West Bromwich Albion", away: "Derby County" },
            { home: "Sheffield United", away: "Swansea City" },
            { home: "Wrexham", away: "Millwall" }
          ]},
          { phase: "Quartas", week: 4 },
          { phase: "Semifinal", week: 6 },
          { phase: "Final", week: 8 }
        ]
      },
      {
        name: "FA Cup",
        displayName: "The Emirates FA Cup",
        shortName: "Emirates FA Cup",
        mark: "https://brandlogos.net/wp-content/uploads/2022/02/emirates_fa_cup-logo-brandlogos.net_-512x512.png",
        className: "fa-cup",
        rounds: [
          { phase: "3ª fase", week: 5, matches: [
            { home: "Coventry City", away: "Everton" },
            { home: "Birmingham City", away: "Crystal Palace" },
            { home: "Middlesbrough", away: "Fulham" },
            { home: "Southampton", away: "Brentford" },
            { home: "Leicester City", away: "Bolton Wanderers" },
            { home: "Ipswich Town", away: "Reading" },
            { home: "Blackburn Rovers", away: "Wigan Athletic" },
            { home: "Bristol City", away: "Barnsley" }
          ]},
          { phase: "Oitavas", week: 7, entrants: [
            "Manchester City",
            "Liverpool",
            "Arsenal",
            "Chelsea",
            "Manchester United",
            "Tottenham Hotspur",
            "Newcastle United",
            "Aston Villa"
          ]},
          { phase: "Quartas", week: 9 },
          { phase: "Semifinal", week: 11 },
          { phase: "Final", week: 13 }
        ]
      }
    ];
  },

  normalizeCupPhase(value = "") {
    return App.utils.normalizeText(value)
      .replace(/1\s*[ªa]?\s*fase/g, "primeira fase")
      .replace(/primeira\s+fase/g, "primeira fase")
      .replace(/2\s*[ªa]?\s*fase/g, "segunda fase")
      .replace(/3\s*[ªa]?\s*fase/g, "terceira fase")
      .replace(/quartas de final/g, "quartas")
      .replace(/quarta de final/g, "quartas")
      .replace(/semi final/g, "semifinal")
      .replace(/semi-final/g, "semifinal")
      .replace(/\s+/g, " ")
      .trim();
  },

  getGameNumber(value = "") {
    const match = App.utils.normalizeText(value).match(/jogo\s*(\d+)/);
    return match ? Number(match[1]) : null;
  },

  cupPhasesAreCompatible(left = "", right = "") {
    const leftPhase = App.cups.normalizeCupPhase(left);
    const rightPhase = App.cups.normalizeCupPhase(right);
    if (!leftPhase || !rightPhase) return false;
    if (leftPhase === rightPhase) return true;
    if (leftPhase.includes(rightPhase) || rightPhase.includes(leftPhase)) return true;

    const leftBase = leftPhase.replace(/\bjogo\s*\d+\b/g, "").trim();
    const rightBase = rightPhase.replace(/\bjogo\s*\d+\b/g, "").trim();
    return Boolean(leftBase && rightBase && (leftBase === rightBase || leftBase.includes(rightBase) || rightBase.includes(leftBase)));
  },

  sameCupTeams(aHome, aAway, bHome, bAway) {
    const ah = App.utils.normalizeTeamName(aHome);
    const aa = App.utils.normalizeTeamName(aAway);
    const bh = App.utils.normalizeTeamName(bHome);
    const ba = App.utils.normalizeTeamName(bAway);
    return (ah === bh && aa === ba) || (ah === ba && aa === bh);
  },

  hasPlaceholderTeam(match) {
    return [match.home, match.away].some(team => App.utils.normalizeText(team).startsWith("vencedor"));
  },

  findCupResult(competition, phase, home, away) {
    const wantedPhase = App.cups.normalizeCupPhase(phase);
    const wantedGame = App.cups.getGameNumber(phase);
    const approved = App.standings.getApprovedApiResults().filter(row =>
      App.utils.normalizeText(row.Competicao) === App.utils.normalizeText(competition)
    );

    const sameTeams = approved.find(row => {
      const rowPhase = App.cups.normalizeCupPhase(row.RodadaFase || "");
      const rowGame = App.cups.getGameNumber(row.RodadaFase || "");
      const phaseMatches = rowPhase === wantedPhase || rowPhase.includes(wantedPhase) || wantedPhase.includes(rowPhase);
      const gameMatches = wantedGame === null || rowGame === null || wantedGame === rowGame;
      return phaseMatches && gameMatches && App.cups.sameCupTeams(row.Mandante, row.Visitante, home, away);
    });

    if (sameTeams) return sameTeams;

    return approved.find(row => {
      const rowPhase = App.cups.normalizeCupPhase(row.RodadaFase || "");
      const rowGame = App.cups.getGameNumber(row.RodadaFase || "");
      const phaseMatches = rowPhase === wantedPhase || rowPhase.includes(wantedPhase) || wantedPhase.includes(rowPhase);
      const gameMatches = wantedGame !== null && rowGame !== null && wantedGame === rowGame;
      return phaseMatches && gameMatches;
    }) || null;
  },

  hydrateCupMatchWithApiResult(match, competition, phase) {
    const result = App.cups.findCupResult(competition, phase, match.home, match.away);
    if (!result) return match;

    const sameTeams = App.cups.sameCupTeams(result.Mandante, result.Visitante, match.home, match.away);
    const useResultTeams = App.cups.hasPlaceholderTeam(match) || !sameTeams;
    const displayHome = useResultTeams ? App.utils.resolveTeamName(result.Mandante) : match.home;
    const displayAway = useResultTeams ? App.utils.resolveTeamName(result.Visitante) : match.away;
    const sameOrder = App.utils.normalizeTeamName(result.Mandante) === App.utils.normalizeTeamName(displayHome);

    return {
      ...match,
      home: displayHome,
      away: displayAway,
      homeScore: sameOrder ? Number(result.GolsMandante) : Number(result.GolsVisitante),
      awayScore: sameOrder ? Number(result.GolsVisitante) : Number(result.GolsMandante),
      penaltyWinner: result.VencedorPenaltis || "",
      penaltyScore: result.PlacarPenaltis || "",
      status: "Finalizado"
    };
  },

  getCupWinner(match) {
    if (typeof match.homeScore === "number" && typeof match.awayScore === "number") {
      if (match.homeScore > match.awayScore) return match.home;
      if (match.awayScore > match.homeScore) return match.away;
      if (match.penaltyWinner) return App.utils.resolveTeamName(match.penaltyWinner);
    }
    return null;
  },

  getCupEvents() {
    const allEvents = [];

    App.cups.getCupDefinitions().forEach(cup => {
      let previousRoundMatches = [];

      cup.rounds.forEach((round, roundIndex) => {
        let currentRoundMatches = [];

        if (roundIndex === 0) {
          currentRoundMatches = round.matches.map((match, index) => {
            const phaseLabel = `${round.phase} - Jogo ${index + 1}`;
            const hydrated = App.cups.hydrateCupMatchWithApiResult(match, cup.name, phaseLabel);
            return {
              ...hydrated,
              id: `${cup.name}-${round.phase}-${index + 1}`,
              date: App.utils.getCupDate(round.week),
              week: round.week,
              competition: cup.name,
              className: cup.className,
              phase: phaseLabel,
              bracketCode: `${round.phase} Jogo ${index + 1}`,
              status: typeof hydrated.homeScore === "number" && typeof hydrated.awayScore === "number" ? "Finalizado" : "Pendente"
            };
          });
        } else if (Array.isArray(round.entrants) && round.entrants.length) {
          currentRoundMatches = previousRoundMatches.map((match, index) => {
            const previousWinner = match ? App.cups.getCupWinner(match) : null;
            const entrant = round.entrants[index] || `Cabeça de chave ${index + 1}`;
            const phaseLabel = `${round.phase} - Jogo ${index + 1}`;
            const baseMatch = {
              home: previousWinner || `Vencedor ${match?.bracketCode || ""}`,
              away: entrant,
              homeScore: null,
              awayScore: null,
              penaltyWinner: "",
              penaltyScore: ""
            };
            const hydrated = App.cups.hydrateCupMatchWithApiResult(baseMatch, cup.name, phaseLabel);
            return {
              ...hydrated,
              id: `${cup.name}-${round.phase}-${index + 1}`,
              date: App.utils.getCupDate(round.week),
              week: round.week,
              competition: cup.name,
              className: cup.className,
              phase: phaseLabel,
              bracketCode: `${round.phase} Jogo ${index + 1}`,
              status: typeof hydrated.homeScore === "number" && typeof hydrated.awayScore === "number" ? "Finalizado" : previousWinner ? "Pendente" : "Aguardando classificados"
            };
          });
        } else {
          for (let index = 0; index < previousRoundMatches.length; index += 2) {
            const matchA = previousRoundMatches[index];
            const matchB = previousRoundMatches[index + 1];
            const winnerA = matchA ? App.cups.getCupWinner(matchA) : null;
            const winnerB = matchB ? App.cups.getCupWinner(matchB) : null;
            const phaseLabel = `${round.phase} - Jogo ${Math.floor(index / 2) + 1}`;
            const baseMatch = {
              home: winnerA || `Vencedor ${matchA?.bracketCode || ""}`,
              away: winnerB || `Vencedor ${matchB?.bracketCode || ""}`,
              homeScore: null,
              awayScore: null,
              penaltyWinner: "",
              penaltyScore: ""
            };
            const hydrated = App.cups.hydrateCupMatchWithApiResult(baseMatch, cup.name, phaseLabel);
            currentRoundMatches.push({
              ...hydrated,
              id: `${cup.name}-${round.phase}-${Math.floor(index / 2) + 1}`,
              date: App.utils.getCupDate(round.week),
              week: round.week,
              competition: cup.name,
              className: cup.className,
              phase: phaseLabel,
              bracketCode: `${round.phase} Jogo ${Math.floor(index / 2) + 1}`,
              status: typeof hydrated.homeScore === "number" && typeof hydrated.awayScore === "number" ? "Finalizado" : winnerA && winnerB ? "Pendente" : "Aguardando classificados"
            });
          }
        }

        allEvents.push(...currentRoundMatches);
        previousRoundMatches = currentRoundMatches;
      });
    });

    const dbCupEvents = App.api?.getDbMatchEvents ? App.api.getDbMatchEvents().filter(event => event.competition !== "Championship") : [];
    dbCupEvents.forEach(dbEvent => {
      const exists = allEvents.some(event =>
        App.utils.normalizeText(event.competition) === App.utils.normalizeText(dbEvent.competition) &&
        App.cups.cupPhasesAreCompatible(event.phase, dbEvent.phase) &&
        App.cups.sameCupTeams(event.home, event.away, dbEvent.home, dbEvent.away)
      );

      if (!exists) {
        allEvents.push({
          ...dbEvent,
          bracketCode: dbEvent.phase,
          status: typeof dbEvent.homeScore === "number" && typeof dbEvent.awayScore === "number" ? "Finalizado" : "Pendente"
        });
      }
    });

    return allEvents;
  },

  renderSummary() {
    const summary = document.getElementById("cupsSummary");
    if (!summary) return;
    const cupEvents = App.calendar.getCalendarEvents().filter(event => event.competition !== "Championship");
    const finished = cupEvents.filter(event => App.calendar.getStatusClass(event) === "done").length;
    const pending = cupEvents.filter(event => event.status === "Pendente").length;
    const waiting = cupEvents.filter(event => String(event.status || "").includes("Aguardando")).length;

    summary.innerHTML = `
      ${App.ui.summaryCard("Jogos de copa", cupEvents.length)}
      ${App.ui.summaryCard("Finalizados", finished)}
      ${App.ui.summaryCard("Pendentes", pending)}
      ${App.ui.summaryCard("Aguardando chave", waiting)}
    `;
  },

  getCompetitionClass(competition) {
    return competition === "Copa da Liga" ? "league-cup" : "fa-cup";
  },

  getCompetitionMeta(competition) {
    return App.cups.getCupDefinitions().find(cup =>
      App.utils.normalizeText(cup.name) === App.utils.normalizeText(competition)
    ) || {
      name: competition,
      displayName: competition,
      shortName: competition,
      mark: "",
      className: App.cups.getCompetitionClass(competition)
    };
  },

  getCompetitionDisplayName(competition) {
    return App.cups.getCompetitionMeta(competition).displayName || competition;
  },

  getRoundStatus(events = []) {
    const done = events.filter(event => App.calendar.getStatusClass(event) === "done").length;
    const waiting = events.filter(event => String(event.status || "").includes("Aguardando")).length;
    if (done === events.length) return "done";
    if (waiting === events.length) return "waiting";
    if (done > 0) return "live";
    return "pending";
  },

  getCompetitionStats(events = []) {
    const total = events.length;
    const done = events.filter(event => App.calendar.getStatusClass(event) === "done").length;
    const pending = events.filter(event => event.status === "Pendente").length;
    const waiting = events.filter(event => String(event.status || "").includes("Aguardando")).length;
    const next = events.find(event => event.status === "Pendente") || events.find(event => String(event.status || "").includes("Aguardando"));
    const final = events.find(event => App.cups.normalizeCupPhase(event.phase).startsWith("final"));
    const champion = final && App.calendar.getStatusClass(final) === "done" ? App.cups.getCupWinner(final) : "";

    return {
      total,
      done,
      pending,
      waiting,
      next,
      champion,
      progress: total ? Math.round((done / total) * 100) : 0
    };
  },

  renderCupHero(competition, events = []) {
    const stats = App.cups.getCompetitionStats(events);
    const meta = App.cups.getCompetitionMeta(competition);
    const className = meta.className || App.cups.getCompetitionClass(competition);
    const nextLabel = stats.champion
      ? `Campeão: ${stats.champion}`
      : stats.next
        ? `${stats.next.phase}: ${stats.next.home} x ${stats.next.away}`
        : "Chave completa";

    return `
      <header class="cup-board-hero ${className}">
        <div class="cup-board-title">
          <span class="cup-mark">
            ${meta.mark ? `<img src="${App.utils.escapeHtml(meta.mark)}" alt="${App.utils.escapeHtml(meta.displayName)}" loading="lazy" referrerpolicy="no-referrer" />` : App.utils.escapeHtml(meta.shortName || competition)}
          </span>
          <div>
            <span class="modal-kicker">${App.utils.escapeHtml(meta.shortName || meta.displayName)}</span>
            <h2>${stats.champion ? App.utils.escapeHtml(stats.champion) : `${stats.progress}% concluída`}</h2>
            <p>${App.utils.escapeHtml(nextLabel)}</p>
          </div>
        </div>
        <div class="cup-board-metrics">
          <span><b>${stats.done}</b> finalizados</span>
          <span><b>${stats.pending}</b> pendentes</span>
          <span><b>${stats.waiting}</b> aguardando</span>
        </div>
        <div class="cup-progress" aria-label="Progresso da copa">
          <span style="width:${stats.progress}%"></span>
        </div>
      </header>
    `;
  },

  renderCupTeamRow(event, side, winner) {
    const isHome = side === "home";
    const teamName = isHome ? event.home : event.away;
    const score = isHome ? event.homeScore : event.awayScore;
    const isWinner = winner && App.utils.sameTeamName(winner, teamName);
    const isLoser = winner && !isWinner && typeof event.homeScore === "number" && typeof event.awayScore === "number";

    return `
      <div class="cup-match-team ${isWinner ? "is-winner" : ""} ${isLoser ? "is-loser" : ""}">
        ${App.clubs.getTeamBadgeHtml(teamName, "cup-team-badge")}
        <span>${App.utils.escapeHtml(teamName)}</span>
        <strong>${typeof score === "number" ? score : "-"}</strong>
      </div>
    `;
  },

  renderCupMatch(event) {
    const winner = App.cups.getCupWinner(event);
    const statusClass = App.calendar.getStatusClass(event);
    const statusLabel = statusClass === "done"
      ? (winner ? `${winner} avança` : "Finalizado")
      : event.status || "Pendente";

    return `
      <article class="cup-match-card ${statusClass}">
        <div class="cup-match-topline">
          <span>${App.utils.escapeHtml(event.phase.replace(/^.*- /, ""))}</span>
          <b>${App.utils.escapeHtml(statusLabel)}</b>
        </div>
        <div class="cup-match-teams">
          ${App.cups.renderCupTeamRow(event, "home", winner)}
          ${App.cups.renderCupTeamRow(event, "away", winner)}
        </div>
        <div class="cup-match-foot">
          <span>${App.utils.formatDate(event.date)} · Semana ${event.week}</span>
          ${App.calendar.getReverseResultButtonHtml(event)}
        </div>
      </article>
    `;
  },

  renderBracket() {
    const container = document.getElementById("cupsBracket");
    if (!container) return;

    const search = App.utils.normalizeText(document.getElementById("cupsSearchInput")?.value);
    const competitionFilter = document.getElementById("cupsCompetitionFilter")?.value || "all";
    const cupEvents = App.calendar.getCalendarEvents().filter(event => event.competition !== "Championship");
    const competitions = [...new Set(cupEvents.map(event => event.competition))]
      .filter(competition => competitionFilter === "all" || competition === competitionFilter);

    container.innerHTML = competitions.map(competition => {
      const events = cupEvents.filter(event => event.competition === competition).filter(event => {
        if (!search) return true;
        return App.utils.normalizeText(`${event.home} ${event.away} ${event.phase} ${App.calendar.formatMatchResult(event)}`).includes(search);
      });

      const rounds = [...new Set(events.map(event => event.phase.split(" - Jogo")[0]))];
      const meta = App.cups.getCompetitionMeta(competition);
      const className = meta.className || App.cups.getCompetitionClass(competition);

      return `
        <section class="cup-board ${className}">
          ${App.cups.renderCupHero(competition, events)}
          <div class="cup-rounds">
            ${rounds.map(round => {
              const roundEvents = events.filter(event => event.phase.startsWith(round));
              const roundStatus = App.cups.getRoundStatus(roundEvents);
              const done = roundEvents.filter(event => App.calendar.getStatusClass(event) === "done").length;
              return `
                <div class="cup-round-column ${roundStatus}">
                  <div class="cup-round-header">
                    <span>${App.utils.escapeHtml(round)}</span>
                    <b>${done}/${roundEvents.length}</b>
                  </div>
                  <div class="cup-match-stack">
                    ${roundEvents.map(event => App.cups.renderCupMatch(event)).join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }).join("");

    App.calendar.bindCalendarActions();
  },

  render() {
    App.cups.renderSummary();
    App.cups.renderBracket();
  }
};
