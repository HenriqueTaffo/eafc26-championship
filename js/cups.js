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
    App.react?.notify?.();
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

  render() {
    App.react?.notify?.();
  }
};
