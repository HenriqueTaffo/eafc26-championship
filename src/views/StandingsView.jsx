import App from "../../js/app.js";
import {
  Matchup,
  TeamBadge,
  TeamIdentity,
} from "./SharedClubComponents.jsx";
import { useAppRuntime } from "./ViewSummaries.jsx";

function ViewButton({ target, className = "", children }) {
  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        App.main.switchToView(target);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {children}
    </button>
  );
}

function ScrollButton({ target, className = "", children }) {
  return (
    <button
      className={className}
      type="button"
      onClick={() =>
        document
          .getElementById(target)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    >
      {children}
    </button>
  );
}

function OwnerPill({ owner }) {
  return (
    <span
      className="owner"
      style={{ background: App.data.ownerColors[owner] || "#334155" }}
    >
      {owner}
    </span>
  );
}

function LoadingRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="calendar-muted">
        {children}
      </td>
    </tr>
  );
}

function HomeStandingsRows() {
  useAppRuntime();

  if (!App.state.apiLoaded) {
    return (
      <LoadingRow colSpan={8}>
        Sincronizando dados oficiais da liga...
      </LoadingRow>
    );
  }

  return App.standings
    .getStandings()
    .slice(0, 5)
    .map((row) => (
      <tr
        className={row.position === 1 ? "home-leader-row" : ""}
        key={row.team}
      >
        <td className="numeric">{row.position}</td>
        <td>
          <TeamIdentity teamName={row.team} />
        </td>
        <td className="numeric">
          <strong>{row.points}</strong>
        </td>
        <td className="numeric">{row.played}</td>
        <td className="numeric">{row.wins}</td>
        <td className="numeric">{row.draws}</td>
        <td className="numeric">{row.losses}</td>
        <td className="numeric">
          {App.utils.formatGoalDifference(row.goalDifference)}
        </td>
      </tr>
    ));
}

function HomeNextGames() {
  useAppRuntime();
  const events = App.standings.getHomeNextEvents();

  if (!events.length) {
    return (
      <div className="next-game-empty">Nenhum jogo pendente encontrado.</div>
    );
  }

  return events.map((event, index) => (
    <article className="next-game-card" key={event.id}>
      <div className="next-game-date">
        <strong>{App.standings.formatHomeDate(event.date)}</strong>
        <span>{App.standings.getHomeKickoff(index)}</span>
      </div>
      <div className="next-game-teams">
        <span className="next-team">
          <span>{event.home}</span>
          <TeamBadge teamName={event.home} className="small" />
        </span>
        <strong className="match-x">x</strong>
        <span className="next-team away">
          <TeamBadge teamName={event.away} className="small" />
          <span>{event.away}</span>
        </span>
      </div>
      <span className="round-pill">{event.phase}</span>
    </article>
  ));
}

function RoundCenter() {
  useAppRuntime();
  const data = App.standings.getRoundCenterData();
  if (!data) return null;

  const pendingText =
    data.weekTechPending.length === 0
      ? "Todos os jogos com técnico da semana estão enviados."
      : `${data.weekTechPending.length} jogo(s) com técnico pendente(s).`;
  const cpuText = data.cpuReady
    ? `${data.weekCpuPending.length} jogo(s) CPU x CPU prontos para simular.`
    : `${data.weekCpuPending.length} jogo(s) CPU x CPU pendente(s).`;
  const cpuContent = (
    <>
      <span>CPU x CPU</span>
      <strong>{data.cpuReady ? "Pode simular" : "Aguardando técnicos"}</strong>
      <small>
        {App.auth?.isCommissioner?.()
          ? `${data.weekCpuPending.length} jogo(s) pendente(s)`
          : "Simulação liberada ao comissário"}
      </small>
    </>
  );

  return (
    <section className="round-center" id="roundCenter">
      <article className="round-center-card">
        <div className="round-center-main">
          <span className="modal-kicker">Central da rodada</span>
          <h2>Semana {data.currentWeek}</h2>
          <p>
            {pendingText} {cpuText}
          </p>
        </div>
        <div className="round-center-grid">
          {data.byManager.map((item) => (
            <div
              className={`round-manager-card ${
                item.pending === 0 ? "done" : "pending"
              }`}
              key={item.manager}
            >
              <OwnerPill owner={item.manager} />
              <strong>
                {item.pending === 0
                  ? "Completo"
                  : `${item.pending} pendente(s)`}
              </strong>
              <small>
                {item.done}/{item.total || 0} enviados
              </small>
            </div>
          ))}
          {App.auth?.isCommissioner?.() ? (
            <ViewButton
              className={`round-cpu-card ${data.cpuReady ? "is-ready" : ""}`}
              target="submitView"
            >
              {cpuContent}
            </ViewButton>
          ) : (
            <div
              className={`round-cpu-card ${data.cpuReady ? "is-ready" : ""}`}
            >
              {cpuContent}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function AttentionPanel() {
  useAppRuntime();
  const items = App.standings.getAttentionItems();

  return (
    <section className="attention-panel" id="attentionPanel">
      <article className="attention-card">
        <div className="home-panel-header">
          <div>
            <span className="modal-kicker">Atenção agora</span>
            <h2>O que pede ação</h2>
          </div>
        </div>
        {items.length ? (
          <div className="attention-grid">
            {items.map((item) => (
              <ViewButton
                className="attention-item"
                target={item.target}
                key={`${item.type}-${item.title}-${item.target}`}
              >
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
                <b>{item.action} ›</b>
              </ViewButton>
            ))}
          </div>
        ) : (
          <div className="next-game-empty">
            Nada urgente agora. A liga está respirando.
          </div>
        )}
      </article>
    </section>
  );
}

function ActivityPanel() {
  useAppRuntime();
  const items = App.standings.getActivityItems();

  return (
    <section className="activity-panel" id="activityPanel">
      <article className="activity-card">
        <div className="home-panel-header">
          <div>
            <span className="modal-kicker">Linha do tempo</span>
            <h2>Movimentos oficiais</h2>
          </div>
        </div>
        {items.length ? (
          <div className="activity-list">
            {items.map((item) => (
              <div
                className={`activity-item activity-${item.tone || "event"}`}
                key={`${item.type}-${item.title}-${item.date}`}
              >
                <span className="activity-type">{item.type}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
                <b>{item.metric || App.utils.formatDateTime(item.date)}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="next-game-empty">
            Nenhuma atividade recente encontrada.
          </div>
        )}
      </article>
    </section>
  );
}

function FullStandingsRows() {
  useAppRuntime();

  if (!App.state.apiLoaded) {
    return (
      <LoadingRow colSpan={11}>
        Sincronizando dados oficiais da liga...
      </LoadingRow>
    );
  }

  return App.standings.getStandings().map((row) => (
    <tr
      className={`${App.standings.getPositionClass(row.position)} ${
        row.status === "Nosso" ? "standings-human-row" : ""
      }`}
      key={row.team}
    >
      <td className="numeric">{row.position}</td>
      <td className="calendar-match">
        <TeamIdentity teamName={row.team} />
      </td>
      <td>
        <span className="owner-name">{row.owner}</span>
      </td>
      <td className="numeric">{row.played}</td>
      <td className="numeric">{row.wins}</td>
      <td className="numeric">{row.draws}</td>
      <td className="numeric">{row.losses}</td>
      <td className="numeric">{row.goalsFor}</td>
      <td className="numeric">{row.goalsAgainst}</td>
      <td className="numeric">
        {App.utils.formatGoalDifference(row.goalDifference)}
      </td>
      <td className="numeric">
        <strong>{row.points}</strong>
      </td>
    </tr>
  ));
}

function StandingsMobileList() {
  useAppRuntime();

  if (!App.state.apiLoaded) {
    return (
      <section className="mobile-list" id="standingsMobile">
        <article className="calendar-card standings-mobile-card">
          <p className="calendar-muted">
            Sincronizando dados oficiais da liga...
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="mobile-list" id="standingsMobile">
      {App.standings.getStandings().map((row) => {
        const classificationClass = App.standings.getPositionClass(
          row.position,
        );
        const badgeClass = App.standings.getPositionBadgeClass(row.position);

        return (
          <article
            className={`calendar-card standings-mobile-card ${classificationClass} ${
              row.status === "Nosso" ? "standings-human-card" : ""
            }`}
            key={row.team}
          >
            <div className="calendar-card-header">
              <span className={`position-badge ${badgeClass}`}>
                {row.position}º
              </span>
              <span className="calendar-muted">{row.points} pts</span>
            </div>
            <h3 className="standings-team-title">
              <TeamIdentity teamName={row.team} />
            </h3>
            <div className="mobile-owner-line">
              <span className="calendar-muted owner-plain">{row.owner}</span>
            </div>
            <p className="calendar-muted">
              J {row.played} · V {row.wins} · E {row.draws} · D {row.losses} ·
              SG {App.utils.formatGoalDifference(row.goalDifference)}
            </p>
          </article>
        );
      })}
    </section>
  );
}

export {
  ActivityPanel,
  AttentionPanel,
  FullStandingsRows,
  HomeNextGames,
  HomeStandingsRows,
  RoundCenter,
  ScrollButton,
  ViewButton,
  StandingsMobileList,
};
