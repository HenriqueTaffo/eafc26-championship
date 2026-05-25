import { useEffect } from "react";
import App from "../../js/app.js";
import { HtmlFragment } from "./HtmlFragment.jsx";
import { useAppRuntime } from "./ViewSummaries.jsx";

function getPlayersViewModel() {
  const session = App.auth?.getSession ? App.auth.getSession() : null;
  const canSwitchCoaches = App.auth?.isCommissioner?.() === true;
  const searchInput = document.getElementById("playersSearchInput");
  const filterInput = document.getElementById("playersFilter");
  const isPersonalOffice = !canSwitchCoaches && Boolean(session?.managerName);

  const search = App.utils.normalizeText(searchInput?.value);
  const filter = isPersonalOffice
    ? session.managerName
    : filterInput?.value || "all";
  const standings = App.standings.getStandings();
  const budgetInfo = App.transfers.getBudgetInfoByBuyer();
  const ranking = App.players.getCoachRanking();
  const teams = App.players.getPlayerTeams();

  let filteredTeams = teams.filter(
    (team) => filter === "all" || team.owner === filter,
  );

  if (search) {
    filteredTeams = filteredTeams.filter((team) => {
      const next = App.players.getNextMatchForTeam(team.team);
      const transfersText = App.players
        .getApprovedTransfersForBuyer(team.owner)
        .map((item) => item.player)
        .join(" ");
      const eventsText = App.players
        .getCoachEvents(team.owner, 20)
        .map((event) => event.Titulo)
        .join(" ");
      return App.utils
        .normalizeText(
          `${team.owner} ${team.team} ${next?.home || ""} ${
            next?.away || ""
          } ${transfersText} ${eventsText}`,
        )
        .includes(search);
    });
  }

  const sessionTeam = session?.managerName
    ? teams.find(
        (team) =>
          App.utils.normalizeText(team.owner) ===
          App.utils.normalizeText(session.managerName),
      )
    : null;
  const activeTeam =
    filteredTeams[0] || (isPersonalOffice ? sessionTeam : null) || teams[0];

  return {
    activeTeam,
    budgetInfo,
    canSwitchCoaches,
    isPersonalOffice,
    ranking,
    session,
    standings,
    teams,
  };
}

function PlayersGrid() {
  useAppRuntime();

  const model = App.state.apiLoaded ? getPlayersViewModel() : null;

  useEffect(() => {
    const { isPersonalOffice, session } = model || {};
    const searchInput = document.getElementById("playersSearchInput");
    const filterInput = document.getElementById("playersFilter");
    const controls = document.querySelector("#playersView .controls");

    if (isPersonalOffice && filterInput)
      filterInput.value = session.managerName;
    if (filterInput) filterInput.hidden = Boolean(isPersonalOffice);
    if (controls) {
      controls.classList.toggle(
        "coach-personal-controls",
        Boolean(isPersonalOffice),
      );
    }
    if (searchInput) {
      searchInput.placeholder = isPersonalOffice
        ? "Buscar jogador, e-mail, patrocínio ou próximo jogo..."
        : "Buscar técnico, jogador, time, e-mail ou próximo jogo...";
    }
  }, [model]);

  if (!App.state.apiLoaded) {
    return (
      <section className="player-grid" id="playersGrid">
        <article className="coach-panel-card">
          <div className="home-panel-header">
            <h2>Sincronizando escritório</h2>
          </div>
          <p className="calendar-muted">
            Carregando dados oficiais da liga antes de exibir saldo, campanha e
            transferências.
          </p>
        </article>
      </section>
    );
  }

  if (!model.activeTeam) {
    return (
      <section className="player-grid" id="playersGrid">
        <article className="calendar-card">
          <h3>Nenhum técnico encontrado</h3>
        </article>
      </section>
    );
  }

  const html = `
    ${
      model.canSwitchCoaches
        ? App.players.renderCoachSelector(model.teams, model.activeTeam.owner)
        : ""
    }
    ${App.players.renderCoachDashboard(
      model.activeTeam,
      model.standings,
      model.budgetInfo,
    )}
    ${App.players.renderComparison(model.ranking)}
  `;

  return (
    <HtmlFragment
      as="section"
      className="player-grid"
      id="playersGrid"
      html={html}
      onRendered={(root) => {
        App.players.bindCoachActions();
        App.auth?.bindPinChangeForm?.();
        App.auth?.bindDecisionAnswerButtons?.(root);
        App.auth?.bindTransferProposalButtons?.(root);
        App.auth?.bindSponsorshipButtons?.(root);
      }}
    />
  );
}

function Leaderboard({ data, label }) {
  if (!data.length) {
    return <p className="calendar-muted">Sem dados de {label} ainda.</p>;
  }

  return data.map((item, index) => (
    <div className="leaderboard-row" key={`${item.name}-${index}`}>
      <span>{index + 1}</span>
      <div>
        <strong>{item.name}</strong>
        <small>{item.detail}</small>
      </div>
      <b>{item.count}</b>
    </div>
  ));
}

function PlayerLeaderboards() {
  useAppRuntime();

  return (
    <section className="leaderboard-grid">
      <article className="leaderboard-card">
        <h2>Gols por time</h2>
        <div id="topScorers">
          <Leaderboard
            data={App.players.getGoalsByHumanTeams()}
            label="gols por time"
          />
        </div>
      </article>
      <article className="leaderboard-card">
        <h2>Top 5 transferências mais caras</h2>
        <div id="topAssists">
          <Leaderboard
            data={App.players.getTopExpensiveTransfers(5)}
            label="transferências caras"
          />
        </div>
      </article>
    </section>
  );
}

export { PlayerLeaderboards, PlayersGrid };
