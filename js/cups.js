window.App = window.App || {};

App.cups = {
  getCupDefinitions() {
    return [
      {
        name: "Copa da Liga",
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
          { phase: "Oitavas", week: 7 },
          { phase: "Quartas", week: 9 },
          { phase: "Semifinal", week: 11 },
          { phase: "Final", week: 13 }
        ]
      }
    ];
  },

  hydrateCupMatchWithApiResult(match, competition, phase) {
    const cleanPhase = String(phase || "").split(" - Jogo")[0];
    const result = App.standings.getApprovedApiResults().find(row =>
      App.utils.normalizeText(row.Competicao) === App.utils.normalizeText(competition) &&
      App.utils.normalizeText(row.RodadaFase).includes(App.utils.normalizeText(cleanPhase)) &&
      App.utils.sameTeamName(row.Mandante, match.home) &&
      App.utils.sameTeamName(row.Visitante, match.away)
    );

    if (!result) return match;

    return {
      ...match,
      homeScore: Number(result.GolsMandante),
      awayScore: Number(result.GolsVisitante),
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
      <article class="summary-card"><span>Jogos de copa</span><strong>${cupEvents.length}</strong></article>
      <article class="summary-card"><span>Finalizados</span><strong>${finished}</strong></article>
      <article class="summary-card"><span>Pendentes</span><strong>${pending}</strong></article>
      <article class="summary-card"><span>Aguardando chave</span><strong>${waiting}</strong></article>
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

      return `
        <section class="legend-block">
          <p class="legend-title">${competition}</p>
          <div class="bracket-grid">
            ${rounds.map(round => {
              const roundEvents = events.filter(event => event.phase.startsWith(round));
              return `
                <article class="bracket-round">
                  <h2>${round}</h2>
                  ${roundEvents.map(event => {
                    const winner = App.cups.getCupWinner(event);
                    return `
                      <div class="bracket-match">
                        <div class="bracket-team ${winner && App.utils.sameTeamName(winner, event.home) ? "winner" : ""}"><span>${event.home}</span><span>${typeof event.homeScore === "number" ? event.homeScore : "-"}</span></div>
                        <div class="bracket-team ${winner && App.utils.sameTeamName(winner, event.away) ? "winner" : ""}"><span>${event.away}</span><span>${typeof event.awayScore === "number" ? event.awayScore : "-"}</span></div>
                        <div class="bracket-meta">${App.utils.formatDate(event.date)} · ${event.phase}<br>${App.calendar.formatMatchResult(event)}</div>
                      </div>
                    `;
                  }).join("")}
                </article>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }).join("");
  },

  render() {
    App.cups.renderSummary();
    App.cups.renderBracket();
  }
};
