import { useState } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function TeamBadge({ teamName, className = "" }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const club = App.clubs.getClubByTeamName(teamName);
  const primary = club.CorPrimaria || "#64748b";
  const secondary = club.CorSecundaria || "#ffffff";
  const logo = String(club.LogoUrl || "").trim();
  const hasLogo =
    logo &&
    !App.clubs.isPlaceholder(teamName) &&
    !App.clubs.isDuplicateLogoUrl(teamName, logo) &&
    !App.clubs.isLogoUnavailable(logo) &&
    !logoFailed;
  const style = {
    "--club-primary": primary,
    "--club-secondary": secondary,
  };

  if (!hasLogo) {
    return (
      <span
        className={["club-badge", "fallback", className].join(" ")}
        style={style}
      >
        <span>{App.clubs.getInitials(teamName)}</span>
      </span>
    );
  }

  return (
    <span
      className={[
        "club-badge",
        "has-logo",
        logoLoaded ? "logo-loaded" : "",
        className,
      ].join(" ")}
      style={style}
    >
      <span className="logo-fallback">{App.clubs.getInitials(teamName)}</span>
      <img
        src={logo}
        alt={teamName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          App.clubs.handleLogoLoad(event.currentTarget);
          setLogoLoaded(true);
        }}
        onError={(event) => {
          App.clubs.handleLogoError(event.currentTarget);
          setLogoFailed(true);
        }}
      />
    </span>
  );
}

function Matchup({ home, away, className = "" }) {
  return (
    <span className={["matchup", className].filter(Boolean).join(" ")}>
      <span className="matchup-side home">
        <span className="matchup-name">{home}</span>
        <TeamBadge teamName={home} className="small" />
      </span>
      <strong className="matchup-x">x</strong>
      <span className="matchup-side away">
        <TeamBadge teamName={away} className="small" />
        <span className="matchup-name">{away}</span>
      </span>
    </span>
  );
}

function TeamIdentity({ teamName, className = "" }) {
  return (
    <span className={["team-identity", className].filter(Boolean).join(" ")}>
      <TeamBadge teamName={teamName} />
      <span className="team-identity-name">{teamName}</span>
    </span>
  );
}

function OwnerPills({ owners }) {
  if (!owners.length) {
    return <span className="calendar-chip calendar-chip-muted">CPU</span>;
  }

  return owners.map((owner) => (
    <span
      className="owner calendar-owner-pill"
      style={{ background: App.data.ownerColors[owner] || "#334155" }}
      key={owner}
    >
      {owner}
    </span>
  ));
}

function ResultAction({ event }) {
  const statusClass = App.calendar.getStatusClass(event);
  const formatted = App.calendar.formatMatchResult(event);

  if (App.calendar.canReverseResult(event)) {
    return (
      <div className="calendar-action-cell">
        <span className="status-pill done">{formatted}</span>
        <button
          className="mini-action-button danger"
          type="button"
          onClick={(clickEvent) =>
            App.calendar.handleReverseResult(event.id, clickEvent.currentTarget)
          }
        >
          Desfazer
        </button>
      </div>
    );
  }

  if (!App.calendar.canSubmitResult(event)) {
    return <span className={`status-pill ${statusClass}`}>{formatted}</span>;
  }

  return (
    <div className="calendar-action-cell">
      <span className="status-pill pending">{formatted}</span>
      <button
        className="mini-action-button"
        type="button"
        onClick={() => App.calendar.openResultModal(event.id)}
      >
        Enviar placar
      </button>
    </div>
  );
}

function CalendarEventCard({ event }) {
  const owners = App.calendar.getMatchOwners(event);
  const statusClass = App.calendar.getStatusClass(event);
  const oursClass = App.calendar.involvesOurTeam(event) ? "is-ours" : "";
  const statusLabel = statusClass === "done" ? "Realizado" : "Pendente";

  return (
    <article className={`calendar-event-card ${statusClass} ${oursClass}`}>
      <div className="calendar-event-head">
        <span className={`competition-badge ${event.className || ""}`}>
          {App.calendar.getCompetitionLabel(event.competition)}
        </span>
        <span className={`calendar-event-status-dot ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <div className="calendar-event-match">
        <Matchup
          home={event.home}
          away={event.away}
          className="calendar-grid-match"
        />
      </div>
      <div className="calendar-event-phase">
        <span>{event.phase}</span>
        <span>Semana {event.week}</span>
      </div>
      <div className="calendar-event-meta">
        <div>
          <OwnerPills owners={owners} />
        </div>
        <span>{App.calendar.getMatchType(event)}</span>
      </div>
      <div className="calendar-event-action">
        <ResultAction event={event} />
      </div>
    </article>
  );
}

function CalendarWeekBoardContent({ events }) {
  const weeks = [
    ...events
      .reduce((acc, event) => {
        const key = String(event.week || "-");
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(event);
        return acc;
      }, new Map())
      .entries(),
  ]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(0, 4);

  if (!weeks.length) return null;

  return (
    <>
      <div className="calendar-week-header">
        <div>
          <span className="modal-kicker">Agenda por semana</span>
          <h2>Visão rápida</h2>
        </div>
        <small>{events.length} jogo(s) no filtro atual</small>
      </div>
      <div className="calendar-week-grid">
        {weeks.map(([week, weekEvents]) => {
          const pending = weekEvents.filter(
            (event) => App.calendar.getStatusClass(event) === "pending",
          );
          const human = weekEvents.filter((event) =>
            App.calendar.involvesOurTeam(event),
          );
          const next = pending[0] || weekEvents[0];

          return (
            <article className="calendar-week-card" key={week}>
              <div>
                <span>Semana {week}</span>
                <strong>{pending.length} pendente(s)</strong>
              </div>
              <p>{human.length} jogo(s) com técnico</p>
              {next ? (
                <small>
                  {next.home} x {next.away}
                </small>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}

function CalendarDayCell({ date, dayEvents }) {
  if (!date) {
    return (
      <span
        className="calendar-day-cell calendar-day-cell-empty"
        aria-hidden="true"
      ></span>
    );
  }

  const dateKey = App.calendar.getCalendarDateKey(date);
  const parts = App.calendar.formatCalendarDayParts(date);
  const pendingCount = dayEvents.filter(
    (event) => App.calendar.getStatusClass(event) === "pending",
  ).length;
  const humanCount = dayEvents.filter((event) =>
    App.calendar.involvesOurTeam(event),
  ).length;
  const dayClass = [
    "calendar-day-cell",
    dayEvents.length ? "has-events" : "",
    pendingCount ? "has-pending" : "",
    humanCount ? "has-human-match" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={dayClass}>
      <div className="calendar-day-top">
        <time dateTime={dateKey}>
          <span>{parts.day}</span>
          <small>{parts.weekday}</small>
        </time>
        {dayEvents.length ? (
          <span className="calendar-day-count">{dayEvents.length} jogo(s)</span>
        ) : null}
      </div>
      {dayEvents.length ? (
        <div className="calendar-day-events">
          {dayEvents.map((event) => (
            <CalendarEventCard event={event} key={event.id} />
          ))}
        </div>
      ) : (
        <span className="calendar-day-empty">Sem jogos</span>
      )}
    </article>
  );
}

function CalendarMonth({ monthKey, eventsByDate, events }) {
  const cells = App.calendar.getCalendarMonthCells(monthKey);
  const monthEvents = events.filter(
    (event) => App.calendar.getCalendarMonthKey(event.date) === monthKey,
  );
  const pendingCount = monthEvents.filter(
    (event) => App.calendar.getStatusClass(event) === "pending",
  ).length;
  const humanCount = monthEvents.filter((event) =>
    App.calendar.involvesOurTeam(event),
  ).length;

  return (
    <section className="calendar-month-card">
      <header className="calendar-month-header">
        <div>
          <span className="modal-kicker">Calendário oficial</span>
          <h2>{App.calendar.formatCalendarMonth(monthKey)}</h2>
        </div>
        <div className="calendar-month-stats">
          <span>{monthEvents.length} jogo(s)</span>
          <span>{pendingCount} pendente(s)</span>
          <span>{humanCount} com técnico</span>
        </div>
      </header>
      <div className="calendar-weekday-row" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-month-grid">
        {cells.map((date, index) => {
          const key = date
            ? App.calendar.getCalendarDateKey(date)
            : `empty-${index}`;
          return (
            <CalendarDayCell
              date={date}
              dayEvents={date ? eventsByDate.get(key) || [] : []}
              key={key}
            />
          );
        })}
      </div>
    </section>
  );
}

export function CalendarWeekBoard() {
  useAppRuntime();
  const events = App.calendar.getFilteredEvents();

  return (
    <section className="calendar-week-board" id="calendarWeekBoard">
      <CalendarWeekBoardContent events={events} />
    </section>
  );
}

export function CalendarMonthBoard() {
  useAppRuntime();
  const events = App.calendar.getFilteredEvents();
  const datedEvents = events.filter((event) =>
    App.calendar.normalizeCalendarDate(event.date),
  );

  if (!datedEvents.length) {
    return (
      <section
        className="calendar-month-board"
        id="calendarBoard"
        aria-live="polite"
      >
        <article className="calendar-empty-panel">
          <strong>Nenhum jogo encontrado</strong>
          <span>
            Ajuste os filtros para ver partidas realizadas ou o calendário
            completo.
          </span>
        </article>
      </section>
    );
  }

  const eventsByDate = datedEvents.reduce((map, event) => {
    const key = App.calendar.getCalendarDateKey(event.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
    return map;
  }, new Map());

  eventsByDate.forEach((dayEvents) => {
    dayEvents.sort(
      (a, b) =>
        (App.calendar.getStatusClass(a) === "pending" ? 0 : 1) -
          (App.calendar.getStatusClass(b) === "pending" ? 0 : 1) ||
        (a.competition || "").localeCompare(b.competition || "") ||
        (a.phase || "").localeCompare(b.phase || ""),
    );
  });

  const monthKeys = [
    ...new Set(
      datedEvents
        .map((event) => App.calendar.getCalendarMonthKey(event.date))
        .filter(Boolean),
    ),
  ].sort();

  return (
    <section
      className="calendar-month-board"
      id="calendarBoard"
      aria-live="polite"
    >
      {monthKeys.map((monthKey) => (
        <CalendarMonth
          monthKey={monthKey}
          eventsByDate={eventsByDate}
          events={datedEvents}
          key={monthKey}
        />
      ))}
    </section>
  );
}

function CupHero({ competition, events }) {
  const stats = App.cups.getCompetitionStats(events);
  const meta = App.cups.getCompetitionMeta(competition);
  const className = meta.className || App.cups.getCompetitionClass(competition);
  const nextLabel = stats.champion
    ? `Campeão: ${stats.champion}`
    : stats.next
      ? `${stats.next.phase}: ${stats.next.home} x ${stats.next.away}`
      : "Chave completa";

  return (
    <header className={`cup-board-hero ${className}`}>
      <div className="cup-board-title">
        <span className="cup-mark">
          {meta.mark ? (
            <img
              src={meta.mark}
              alt={meta.displayName}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            meta.shortName || competition
          )}
        </span>
        <div>
          <span className="modal-kicker">
            {meta.shortName || meta.displayName}
          </span>
          <h2>{stats.champion || `${stats.progress}% concluída`}</h2>
          <p>{nextLabel}</p>
        </div>
      </div>
      <div className="cup-board-metrics">
        <span>
          <b>{stats.done}</b> finalizados
        </span>
        <span>
          <b>{stats.pending}</b> pendentes
        </span>
        <span>
          <b>{stats.waiting}</b> aguardando
        </span>
      </div>
      <div className="cup-progress" aria-label="Progresso da copa">
        <span style={{ width: `${stats.progress}%` }}></span>
      </div>
    </header>
  );
}

function CupTeamRow({ event, side, winner }) {
  const isHome = side === "home";
  const teamName = isHome ? event.home : event.away;
  const score = isHome ? event.homeScore : event.awayScore;
  const isWinner = winner && App.utils.sameTeamName(winner, teamName);
  const isLoser =
    winner &&
    !isWinner &&
    typeof event.homeScore === "number" &&
    typeof event.awayScore === "number";

  return (
    <div
      className={[
        "cup-match-team",
        isWinner ? "is-winner" : "",
        isLoser ? "is-loser" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <TeamBadge teamName={teamName} className="cup-team-badge" />
      <span>{teamName}</span>
      <strong>{typeof score === "number" ? score : "-"}</strong>
    </div>
  );
}

function CupMatch({ event }) {
  const winner = App.cups.getCupWinner(event);
  const statusClass = App.calendar.getStatusClass(event);
  const statusLabel =
    statusClass === "done"
      ? winner
        ? `${winner} avança`
        : "Finalizado"
      : event.status || "Pendente";

  return (
    <article className={`cup-match-card ${statusClass}`}>
      <div className="cup-match-topline">
        <span>{event.phase.replace(/^.*- /, "")}</span>
        <b>{statusLabel}</b>
      </div>
      <div className="cup-match-teams">
        <CupTeamRow event={event} side="home" winner={winner} />
        <CupTeamRow event={event} side="away" winner={winner} />
      </div>
      <div className="cup-match-foot">
        <span>
          {App.utils.formatDate(event.date)} · Semana {event.week}
        </span>
        {App.calendar.canReverseResult(event) ? (
          <button
            className="mini-action-button danger"
            type="button"
            onClick={(clickEvent) =>
              App.calendar.handleReverseResult(
                event.id,
                clickEvent.currentTarget,
              )
            }
          >
            Desfazer resultado
          </button>
        ) : null}
      </div>
    </article>
  );
}

function CupBoard({ competition, events }) {
  const meta = App.cups.getCompetitionMeta(competition);
  const className = meta.className || App.cups.getCompetitionClass(competition);
  const rounds = [
    ...new Set(events.map((event) => event.phase.split(" - Jogo")[0])),
  ];

  return (
    <section className={`cup-board ${className}`}>
      <CupHero competition={competition} events={events} />
      <div className="cup-rounds">
        {rounds.map((round) => {
          const roundEvents = events.filter((event) =>
            event.phase.startsWith(round),
          );
          const roundStatus = App.cups.getRoundStatus(roundEvents);
          const done = roundEvents.filter(
            (event) => App.calendar.getStatusClass(event) === "done",
          ).length;

          return (
            <div className={`cup-round-column ${roundStatus}`} key={round}>
              <div className="cup-round-header">
                <span>{round}</span>
                <b>
                  {done}/{roundEvents.length}
                </b>
              </div>
              <div className="cup-match-stack">
                {roundEvents.map((event) => (
                  <CupMatch event={event} key={event.id} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CupsBracket() {
  useAppRuntime();
  const search = App.utils.normalizeText(
    document.getElementById("cupsSearchInput")?.value,
  );
  const competitionFilter =
    document.getElementById("cupsCompetitionFilter")?.value || "all";
  const cupEvents = App.calendar
    .getCalendarEvents()
    .filter((event) => event.competition !== "Championship");
  const competitions = [
    ...new Set(cupEvents.map((event) => event.competition)),
  ].filter(
    (competition) =>
      competitionFilter === "all" || competition === competitionFilter,
  );

  return (
    <section id="cupsBracket">
      {competitions.map((competition) => {
        const events = cupEvents
          .filter((event) => event.competition === competition)
          .filter((event) => {
            if (!search) return true;
            return App.utils
              .normalizeText(
                `${event.home} ${event.away} ${event.phase} ${App.calendar.formatMatchResult(event)}`,
              )
              .includes(search);
          });

        return (
          <CupBoard
            competition={competition}
            events={events}
            key={competition}
          />
        );
      })}
    </section>
  );
}

export { TeamBadge, TeamIdentity, Matchup };
