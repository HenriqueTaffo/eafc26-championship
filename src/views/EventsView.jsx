import { useEffect, useState } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

function EventSlotList() {
  return (
    <div
      className="event-slot-list"
      id="eventSlotList"
      aria-label="Horários de eventos"
    >
      {(App.config.eventSlots || []).map((hour) => (
        <b key={hour}>{String(Number(hour)).padStart(2, "0")}h</b>
      ))}
    </div>
  );
}

function PlayerPhoto({ playerName, className = "player-avatar" }) {
  const marketPlayer = App.transfers.findMarketPlayerByName(playerName);
  const rating = App.transfers.getRatingForPlayerName(playerName);
  const candidates = App.transfers.getPlayerAvatarCandidates(
    marketPlayer || { name: playerName },
    rating,
  );
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const availableCandidates = candidates.filter(
    (candidate) => !App.transfers.isAvatarUnavailable(candidate),
  );
  const avatar =
    availableCandidates[avatarIndex] || availableCandidates[0] || "";
  const sourceClass = avatar
    ? App.transfers.getPlayerAvatarSourceClass(avatar)
    : "";
  const shellClass = [
    className,
    "player-photo-shell",
    sourceClass,
    avatar ? "has-player-image" : "",
    avatar && avatarLoaded ? "avatar-loaded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => setAvatarLoaded(false), [avatar]);

  return (
    <span className={shellClass}>
      {avatar ? (
        <img
          key={`${avatar}-${avatarRefreshKey}`}
          src={avatar}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setAvatarLoaded(true)}
          onError={() => {
            App.transfers.failedAvatarUrls.add(avatar);
            setAvatarLoaded(false);
            setAvatarIndex(0);
            setAvatarRefreshKey((key) => key + 1);
          }}
        />
      ) : null}
      <i>{String(playerName || "?").charAt(0)}</i>
    </span>
  );
}

function PlayerIdentity({ playerName, detail = "", className }) {
  return (
    <span className={className}>
      <PlayerPhoto playerName={playerName} />
      <span className="player-identity-copy">
        <strong>{playerName || "-"}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </span>
  );
}

function EventCard({ event }) {
  const presentation = App.events.getEventPresentation(event);
  const typeClass = App.events.getEventTypeClass(event);
  const color =
    App.data.ownerColors[event.Jogador] || App.data.ownerColors["Livre / CPU"];
  const modifier = Number(event.ModificadorTransferencias || 0);
  const durationLabel = App.events.getEventDurationLabel(event);
  const metaItems = [
    App.events.formatEventDate(event.Data),
    App.events.formatEventTime(event.Horario),
    event.Status || "Gerado",
  ].filter(Boolean);

  return (
    <article
      className={`event-card event-card-v45 event-category-${presentation.category}`}
      style={{ "--event-color": color }}
    >
      <div className="event-card-topline">
        <span className="event-icon" aria-hidden="true">
          {presentation.icon}
        </span>
        <span className="event-category-label">
          {presentation.categoryLabel}
        </span>
        <span className="owner" style={{ background: color }}>
          {event.Jogador || "Liga"}
        </span>
      </div>

      <div className="event-card-header">
        <div>
          <h2>{presentation.title}</h2>
          <p className="event-flavor">{presentation.description}</p>
        </div>
        <span className={`event-impact ${typeClass}`}>
          {App.events.getEventImpactLabel(event)}
        </span>
      </div>

      <div className="event-effect-box">
        <strong>Impacto</strong>
        <span>{presentation.effect}</span>
      </div>

      <div className="event-badges">
        {modifier !== 0 ? (
          <span className="limit-pill">
            {modifier > 0 ? "+" : ""}
            {modifier} transferência(s) hoje
          </span>
        ) : null}
        {event.JogadorAfetado ? (
          <span className="injury-pill">
            <PlayerIdentity
              playerName={event.JogadorAfetado}
              className="event-pill-player-identity"
            />
          </span>
        ) : null}
        {durationLabel ? (
          <span className="duration-pill">{durationLabel}</span>
        ) : null}
      </div>

      <div className="event-meta">{metaItems.join(" · ")}</div>
    </article>
  );
}

function EventWorkspace({ events }) {
  const stats = App.events.getEventStats(events);
  const periodSelect = document.getElementById("eventsPeriodFilter");
  const periodLabel = periodSelect
    ? periodSelect.options[periodSelect.selectedIndex]?.textContent
    : "Eventos filtrados";
  const activeFilteredEvents = events
    .filter((event) => App.events.isActiveOrDurationEvent(event))
    .slice(0, 4);

  return (
    <section className="event-workspace">
      <section className="event-board-header event-board-header-v66">
        <div>
          <span className="modal-kicker">Mesa de controle</span>
          <strong>{periodLabel}</strong>
          <span>
            {events.length} ocorrência(s) na tela, organizadas por impacto,
            técnico e duração.
          </span>
        </div>
        <div className="event-mini-stats">
          <span>Caixa +{stats.positive}</span>
          <span>Risco {stats.negative}</span>
          <span>DM {stats.injuries}</span>
          <span>Mercado {stats.market}</span>
        </div>
      </section>

      <section className="event-focus-strip">
        <article>
          <span>Ativos</span>
          <strong>{activeFilteredEvents.length}</strong>
          <small>
            {activeFilteredEvents.length
              ? activeFilteredEvents
                  .map(
                    (event) =>
                      `${event.Jogador || "Liga"}: ${
                        event.Titulo || "Evento ativo"
                      }`,
                  )
                  .join(" · ")
              : "Nenhuma duração ativa no filtro atual."}
          </small>
        </article>
        <article>
          <span>Financeiro</span>
          <strong>{stats.positive + stats.negative}</strong>
          <small>
            {stats.positive} positivo(s), {stats.negative} negativo(s)
          </small>
        </article>
        <article>
          <span>DM / Mercado</span>
          <strong>{stats.injuries + stats.market}</strong>
          <small>
            {stats.injuries} lesão(ões), {stats.market} trava(s)
          </small>
        </article>
      </section>

      <section className="event-card-grid-v45 event-card-grid-v66">
        {events.map((event) => (
          <EventCard
            event={event}
            key={
              event.Id ||
              event.id ||
              `${event.Jogador}-${event.Titulo}-${event.Timestamp}-${event.Data}-${event.Horario}`
            }
          />
        ))}
      </section>
    </section>
  );
}

function EventsEmptyState() {
  return (
    <article className="event-empty-v45">
      <strong>Nenhum evento encontrado</strong>
      <p>
        Troque o período, remova filtros ou pesquise por técnico, jogador,
        punição, premiação ou impacto financeiro.
      </p>
    </article>
  );
}

function EventsGrid() {
  useAppRuntime();
  const events = App.events.getFilteredEvents();

  return (
    <section className="event-grid" id="eventsGrid">
      {events.length ? <EventWorkspace events={events} /> : <EventsEmptyState />}
    </section>
  );
}

export { EventSlotList, EventsGrid, PlayerIdentity, PlayerPhoto };
