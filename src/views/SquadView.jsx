import { useEffect, useMemo, useState } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

const FORMATIONS = {
  "4-2-3-1": [
    ["GK", "GK", 50, 88],
    ["LB", "LB", 18, 68],
    ["LCB", "CB", 38, 68],
    ["RCB", "CB", 62, 68],
    ["RB", "RB", 82, 68],
    ["LDM", "CDM", 38, 51],
    ["RDM", "CDM", 62, 51],
    ["LM", "LM", 20, 34],
    ["CAM", "CAM", 50, 31],
    ["RM", "RM", 80, 34],
    ["ST", "ST", 50, 14],
  ],
  "4-4-2": [
    ["GK", "GK", 50, 88],
    ["LB", "LB", 18, 68],
    ["LCB", "CB", 38, 68],
    ["RCB", "CB", 62, 68],
    ["RB", "RB", 82, 68],
    ["LM", "LM", 18, 42],
    ["LCM", "CM", 38, 44],
    ["RCM", "CM", 62, 44],
    ["RM", "RM", 82, 42],
    ["LS", "ST", 40, 17],
    ["RS", "ST", 60, 17],
  ],
  "4-3-3": [
    ["GK", "GK", 50, 88],
    ["LB", "LB", 18, 68],
    ["LCB", "CB", 38, 68],
    ["RCB", "CB", 62, 68],
    ["RB", "RB", 82, 68],
    ["LCM", "CM", 34, 47],
    ["CM", "CM", 50, 43],
    ["RCM", "CM", 66, 47],
    ["LW", "LW", 23, 18],
    ["ST", "ST", 50, 13],
    ["RW", "RW", 77, 18],
  ],
  "3-5-2": [
    ["GK", "GK", 50, 88],
    ["LCB", "CB", 32, 69],
    ["CB", "CB", 50, 70],
    ["RCB", "CB", 68, 69],
    ["LM", "LM", 16, 43],
    ["LCM", "CM", 36, 47],
    ["CM", "CM", 50, 42],
    ["RCM", "CM", 64, 47],
    ["RM", "RM", 84, 43],
    ["LS", "ST", 40, 16],
    ["RS", "ST", 60, 16],
  ],
  "5-3-2": [
    ["GK", "GK", 50, 88],
    ["LWB", "LWB", 13, 66],
    ["LCB", "CB", 32, 70],
    ["CB", "CB", 50, 72],
    ["RCB", "CB", 68, 70],
    ["RWB", "RWB", 87, 66],
    ["LCM", "CM", 35, 45],
    ["CM", "CM", 50, 41],
    ["RCM", "CM", 65, 45],
    ["LS", "ST", 41, 16],
    ["RS", "ST", 59, 16],
  ],
};

const POSITION_FILTERS = [
  ["all", "Todas"],
  ["GK", "Goleiros"],
  ["DEF", "Defesa"],
  ["MID", "Meio"],
  ["ATT", "Ataque"],
];

function getSlots(formation) {
  return (FORMATIONS[formation] || FORMATIONS["4-2-3-1"]).map(
    ([id, label, x, y]) => ({ id, label, x, y }),
  );
}

function getPositionGroup(position = "") {
  const normalized = String(position).toUpperCase();
  if (normalized === "GK") return "GK";
  if (["CB", "LB", "RB", "LWB", "RWB"].includes(normalized)) return "DEF";
  if (["CM", "CDM", "CAM", "LM", "RM"].includes(normalized)) return "MID";
  return "ATT";
}

function isCompatible(slotLabel, playerPosition) {
  const slotGroup = getPositionGroup(slotLabel);
  const playerGroup = getPositionGroup(playerPosition);
  if (slotGroup === "GK" || playerGroup === "GK") return slotGroup === playerGroup;
  if (slotGroup === playerGroup) return true;
  if (slotGroup === "ATT" && ["LM", "RM"].includes(playerPosition)) return true;
  if (slotGroup === "MID" && ["LW", "RW"].includes(playerPosition)) return true;
  return false;
}

function normalizeLineup(lineup = {}) {
  return Object.entries(lineup || {}).reduce((acc, [slot, value]) => {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) acc[slot] = String(id);
    return acc;
  }, {});
}

function getPlayerInitials(name = "") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getRosterStats(roster = [], lineupPlayers = []) {
  const rosterWeekly = roster.reduce(
    (sum, player) => sum + Number(player.weeklySalary || 0),
    0,
  );
  const lineupWeekly = lineupPlayers.reduce(
    (sum, player) => sum + Number(player?.weeklySalary || 0),
    0,
  );
  const lineupAvg = lineupPlayers.length
    ? Math.round(
        lineupPlayers.reduce(
          (sum, player) => sum + Number(player?.overall || 0),
          0,
        ) / lineupPlayers.length,
      )
    : 0;

  return {
    rosterWeekly,
    lineupWeekly,
    lineupAvg,
    rosterSize: roster.length,
    filledSlots: lineupPlayers.length,
  };
}

function PlayerAvatar({ player, className = "" }) {
  return (
    <span className={`squad-avatar ${className}`.trim()}>
      <span>{getPlayerInitials(player?.name || "")}</span>
      {player?.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </span>
  );
}

function PitchSlot({
  slot,
  player,
  selected,
  compatible,
  onSelect,
  onClear,
}) {
  return (
    <button
      type="button"
      className={[
        "squad-slot",
        selected ? "is-selected" : "",
        player ? "is-filled" : "",
        compatible ? "is-compatible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--slot-x": `${slot.x}%`, "--slot-y": `${slot.y}%` }}
      onClick={onSelect}
    >
      {player ? (
        <>
          <span className="squad-card-ovr">{player.overall}</span>
          <PlayerAvatar player={player} />
          <strong>{player.name}</strong>
          <small>{slot.label}</small>
          <span
            className="squad-slot-remove"
            role="button"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
          >
            x
          </span>
        </>
      ) : (
        <>
          <span className="squad-empty-plus">+</span>
          <strong>{slot.label}</strong>
          <small>Selecionar</small>
        </>
      )}
    </button>
  );
}

function SquadRosterRow({ player, assigned, onPick }) {
  return (
    <button
      type="button"
      className={`squad-roster-row ${assigned ? "is-assigned" : ""}`}
      onClick={onPick}
    >
      <PlayerAvatar player={player} />
      <span className="squad-roster-main">
        <strong>{player.name}</strong>
        <small>
          {player.position || "-"} · {player.nation || "EA FC 26"}
        </small>
      </span>
      <span className="squad-roster-meta">
        <b>{player.overall}</b>
        <small>{App.utils.formatCurrency(player.weeklySalary || 0)}/sem</small>
      </span>
    </button>
  );
}

function SquadManagementView() {
  const runtimeVersion = useAppRuntime();
  const [selectedManager, setSelectedManager] = useState("");
  const [formation, setFormation] = useState("4-2-3-1");
  const [lineup, setLineup] = useState({});
  const [selectedSlot, setSelectedSlot] = useState("ST");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const isActive =
    typeof document !== "undefined" &&
    document.getElementById("squadView")?.classList.contains("active");
  const data = App.state.apiSquadManagement || {};
  const managers = Array.isArray(data.managers) ? data.managers : [];
  const session = App.auth?.getSession ? App.auth.getSession() : null;
  const canSwitchManagers = App.auth?.isCommissioner?.() === true;
  const defaultManager = canSwitchManagers
    ? managers[0]?.managerName || ""
    : session?.managerName || managers[0]?.managerName || "";

  useEffect(() => {
    if (!isActive) return;
    App.api?.loadSquadManagementData?.();
  }, [isActive, runtimeVersion]);

  useEffect(() => {
    if (!defaultManager) return;
    if (!selectedManager || (!canSwitchManagers && selectedManager !== defaultManager)) {
      setSelectedManager(defaultManager);
    }
  }, [canSwitchManagers, defaultManager, selectedManager]);

  const activeManager = useMemo(
    () =>
      managers.find(
        (item) =>
          App.utils.normalizeText(item.managerName) ===
          App.utils.normalizeText(selectedManager),
      ) || managers[0],
    [managers, selectedManager],
  );
  const activeManagerName = activeManager?.managerName || selectedManager || "";
  const roster = data.rosters?.[activeManagerName] || [];
  const savedLineup = data.lineups?.[activeManagerName] || {};
  const savedLineupKey = JSON.stringify(savedLineup.lineup || {});

  useEffect(() => {
    if (!activeManagerName) return;
    setFormation(savedLineup.formation || "4-2-3-1");
    setLineup(normalizeLineup(savedLineup.lineup || {}));
    setSelectedSlot(getSlots(savedLineup.formation || "4-2-3-1")[0]?.id || "GK");
    setMessage("");
  }, [activeManagerName, savedLineup.formation, savedLineupKey]);

  const slots = getSlots(formation);
  const playerById = useMemo(
    () => new Map(roster.map((player) => [Number(player.id), player])),
    [roster],
  );
  const assignedIds = new Set(Object.values(lineup).map((value) => Number(value)));
  const lineupPlayers = slots
    .map((slot) => playerById.get(Number(lineup[slot.id])))
    .filter(Boolean);
  const stats = getRosterStats(roster, lineupPlayers);
  const forecast = (data.finance || []).find(
    (item) =>
      App.utils.normalizeText(item.manager_name || item.managerName) ===
      App.utils.normalizeText(activeManagerName),
  );

  const filteredRoster = roster.filter((player) => {
    const group = getPositionGroup(player.position);
    const normalizedSearch = App.utils.normalizeText(search);
    const matchesPosition =
      positionFilter === "all" || group === positionFilter;
    const matchesSearch =
      !normalizedSearch ||
      App.utils
        .normalizeText(
          `${player.name} ${player.position} ${player.nation} ${player.overall}`,
        )
        .includes(normalizedSearch);
    return matchesPosition && matchesSearch;
  });

  function getBestSlotForPlayer(player) {
    const selected = slots.find((slot) => slot.id === selectedSlot);
    if (selected) return selected.id;

    const compatibleEmpty = slots.find(
      (slot) => !lineup[slot.id] && isCompatible(slot.label, player.position),
    );
    if (compatibleEmpty) return compatibleEmpty.id;

    const empty = slots.find((slot) => !lineup[slot.id]);
    return empty?.id || slots[0]?.id || "GK";
  }

  function assignPlayer(player) {
    const targetSlot = getBestSlotForPlayer(player);
    setLineup((current) => {
      const next = Object.entries(current).reduce((acc, [slotId, playerId]) => {
        if (Number(playerId) !== Number(player.id)) acc[slotId] = playerId;
        return acc;
      }, {});
      next[targetSlot] = String(player.id);
      return next;
    });
    setSelectedSlot(targetSlot);
  }

  async function saveLineup() {
    try {
      setSaving(true);
      setMessage("");
      await App.api.saveSquadLineup({
        clubName: activeManager?.clubName || "",
        formation,
        lineup,
      });
      setMessage("Escalacao salva.");
    } catch (error) {
      setMessage(error.message || "Nao consegui salvar a escalacao.");
    } finally {
      setSaving(false);
    }
  }

  if (!isActive) return <section className="squad-shell"></section>;

  if (!App.state.apiLoaded || App.state.apiSquadManagementLoading) {
    return (
      <section className="squad-shell">
        <article className="coach-panel-card">
          <div className="home-panel-header">
            <h2>Carregando elenco</h2>
          </div>
          <p className="calendar-muted">
            Sincronizando ratings, folha salarial e formacoes salvas.
          </p>
        </article>
      </section>
    );
  }

  if (!activeManager || !roster.length) {
    return (
      <section className="squad-shell">
        <article className="coach-panel-card">
          <div className="home-panel-header">
            <h2>Elenco indisponivel</h2>
          </div>
          <p className="calendar-muted">
            Ainda nao ha jogadores vinculados para este clube.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="squad-shell">
      <section className="squad-hero-panel">
        <div className="squad-club-identity">
          {activeManager.logoUrl ? <img src={activeManager.logoUrl} alt="" /> : null}
          <div>
            <span className="modal-kicker">Gestao de elenco</span>
            <h2>{activeManager.clubName}</h2>
            <p>
              {activeManager.managerName} · folha total baseada no elenco EA FC
              26.
            </p>
          </div>
        </div>
        <div className="squad-source-stack">
          <span>EA FC 26</span>
          <span>Capology payroll</span>
          <span>Budget Championship</span>
        </div>
      </section>

      <section className="squad-controls controls">
        {canSwitchManagers ? (
          <select
            value={activeManagerName}
            onChange={(event) => setSelectedManager(event.target.value)}
          >
            {managers.map((manager) => (
              <option key={manager.managerId} value={manager.managerName}>
                {manager.managerName} · {manager.clubName}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={formation}
          onChange={(event) => {
            const nextFormation = event.target.value;
            setFormation(nextFormation);
            const nextSlots = new Set(getSlots(nextFormation).map((slot) => slot.id));
            setLineup((current) =>
              Object.entries(current).reduce((acc, [slot, playerId]) => {
                if (nextSlots.has(slot)) acc[slot] = playerId;
                return acc;
              }, {}),
            );
            setSelectedSlot(getSlots(nextFormation)[0]?.id || "GK");
          }}
        >
          {Object.keys(FORMATIONS).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar jogador, posicao ou overall..."
        />
        <select
          value={positionFilter}
          onChange={(event) => setPositionFilter(event.target.value)}
        >
          {POSITION_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>

      <section className="squad-balance-grid">
        <article>
          <span>Elenco</span>
          <strong>{stats.rosterSize}</strong>
          <small>jogadores oficiais</small>
        </article>
        <article>
          <span>Folha semanal</span>
          <strong>{App.utils.formatCurrency(forecast?.payroll_weekly || stats.rosterWeekly)}</strong>
          <small>elenco inteiro</small>
        </article>
        <article>
          <span>Escalacao</span>
          <strong>{stats.filledSlots}/11</strong>
          <small>{stats.lineupAvg ? `media OVR ${stats.lineupAvg}` : "sem titulares"}</small>
        </article>
        <article>
          <span>Risco financeiro</span>
          <strong>{forecast?.risk || "Saudavel"}</strong>
          <small>
            {forecast?.runway_weeks
              ? `${forecast.runway_weeks} semanas de caixa`
              : "sem pressao imediata"}
          </small>
        </article>
      </section>

      <section className="squad-builder-grid">
        <article className="squad-pitch-card">
          <div className="squad-pitch-toolbar">
            <div>
              <span>Squad builder</span>
              <strong>{formation}</strong>
            </div>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setLineup({})}
              >
                Limpar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={saveLineup}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
          <div className="squad-pitch">
            <div className="squad-pitch-lines" aria-hidden="true"></div>
            {slots.map((slot) => {
              const player = playerById.get(Number(lineup[slot.id]));
              return (
                <PitchSlot
                  key={slot.id}
                  slot={slot}
                  player={player}
                  selected={selectedSlot === slot.id}
                  compatible={
                    selectedSlot === slot.id &&
                    filteredRoster.some((item) => isCompatible(slot.label, item.position))
                  }
                  onSelect={() => setSelectedSlot(slot.id)}
                  onClear={() =>
                    setLineup((current) => {
                      const next = { ...current };
                      delete next[slot.id];
                      return next;
                    })
                  }
                />
              );
            })}
          </div>
          <div className="squad-pitch-footer">
            <span>{message}</span>
            <strong>{App.utils.formatCurrency(stats.lineupWeekly)}/sem titulares</strong>
          </div>
        </article>

        <aside className="squad-roster-panel">
          <div className="home-panel-header">
            <h2>Elenco disponivel</h2>
            <span>{filteredRoster.length}</span>
          </div>
          <div className="squad-roster-list">
            {filteredRoster.map((player) => (
              <SquadRosterRow
                key={player.id}
                player={player}
                assigned={assignedIds.has(Number(player.id))}
                onPick={() => assignPlayer(player)}
              />
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

export { SquadManagementView };
