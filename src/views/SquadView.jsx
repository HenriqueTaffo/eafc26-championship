import { useEffect, useMemo, useState } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

const goalkeeper = () => [["GK", "GK", 50, 84]];

const backThree = () => [
  ["LCB", "CB", 32, 69],
  ["CB", "CB", 50, 70],
  ["RCB", "CB", 68, 69],
];

const backFour = () => [
  ["LB", "LB", 18, 69],
  ["LCB", "CB", 38, 70],
  ["RCB", "CB", 62, 70],
  ["RB", "RB", 82, 69],
];

const backFive = () => [
  ["LWB", "LWB", 12, 67],
  ["LCB", "CB", 31, 71],
  ["CB", "CB", 50, 72],
  ["RCB", "CB", 69, 71],
  ["RWB", "RWB", 88, 67],
];

const FORMATIONS = {
  "3-1-4-2": [
    ...goalkeeper(),
    ...backThree(),
    ["CDM", "CDM", 50, 54],
    ["LM", "LM", 17, 42],
    ["LCM", "CM", 38, 43],
    ["RCM", "CM", 62, 43],
    ["RM", "RM", 83, 42],
    ["LS", "ST", 41, 16],
    ["RS", "ST", 59, 16],
  ],
  "3-4-1-2": [
    ...goalkeeper(),
    ...backThree(),
    ["LM", "LM", 16, 45],
    ["LCM", "CM", 38, 47],
    ["RCM", "CM", 62, 47],
    ["RM", "RM", 84, 45],
    ["CAM", "CAM", 50, 31],
    ["LS", "ST", 40, 15],
    ["RS", "ST", 60, 15],
  ],
  "3-4-2-1": [
    ...goalkeeper(),
    ...backThree(),
    ["LM", "LM", 16, 44],
    ["LCM", "CM", 38, 47],
    ["RCM", "CM", 62, 47],
    ["RM", "RM", 84, 44],
    ["LF", "LW", 39, 26],
    ["RF", "RW", 61, 26],
    ["ST", "ST", 50, 13],
  ],
  "3-4-3": [
    ...goalkeeper(),
    ...backThree(),
    ["LM", "LM", 16, 45],
    ["LCM", "CM", 38, 47],
    ["RCM", "CM", 62, 47],
    ["RM", "RM", 84, 45],
    ["LW", "LW", 24, 18],
    ["ST", "ST", 50, 13],
    ["RW", "RW", 76, 18],
  ],
  "3-5-2": [
    ...goalkeeper(),
    ...backThree(),
    ["LM", "LM", 16, 43],
    ["LCM", "CM", 36, 47],
    ["CM", "CM", 50, 42],
    ["RCM", "CM", 64, 47],
    ["RM", "RM", 84, 43],
    ["LS", "ST", 40, 16],
    ["RS", "ST", 60, 16],
  ],
  "4-1-2-1-2": [
    ...goalkeeper(),
    ...backFour(),
    ["CDM", "CDM", 50, 55],
    ["LM", "LM", 22, 40],
    ["RM", "RM", 78, 40],
    ["CAM", "CAM", 50, 29],
    ["LS", "ST", 41, 14],
    ["RS", "ST", 59, 14],
  ],
  "4-1-2-1-2 (2)": [
    ...goalkeeper(),
    ...backFour(),
    ["CDM", "CDM", 50, 55],
    ["LCM", "CM", 38, 42],
    ["RCM", "CM", 62, 42],
    ["CAM", "CAM", 50, 28],
    ["LS", "ST", 41, 14],
    ["RS", "ST", 59, 14],
  ],
  "4-1-3-2": [
    ...goalkeeper(),
    ...backFour(),
    ["CDM", "CDM", 50, 55],
    ["LM", "LM", 21, 40],
    ["CM", "CM", 50, 40],
    ["RM", "RM", 79, 40],
    ["LS", "ST", 41, 15],
    ["RS", "ST", 59, 15],
  ],
  "4-1-4-1": [
    ...goalkeeper(),
    ...backFour(),
    ["CDM", "CDM", 50, 56],
    ["LM", "LM", 20, 39],
    ["LCM", "CM", 40, 42],
    ["RCM", "CM", 60, 42],
    ["RM", "RM", 80, 39],
    ["ST", "ST", 50, 14],
  ],
  "4-2-1-3": [
    ...goalkeeper(),
    ...backFour(),
    ["LDM", "CDM", 39, 53],
    ["RDM", "CDM", 61, 53],
    ["CAM", "CAM", 50, 34],
    ["LW", "LW", 24, 18],
    ["ST", "ST", 50, 12],
    ["RW", "RW", 76, 18],
  ],
  "4-2-2-2": [
    ...goalkeeper(),
    ...backFour(),
    ["LDM", "CDM", 39, 53],
    ["RDM", "CDM", 61, 53],
    ["LAM", "CAM", 35, 33],
    ["RAM", "CAM", 65, 33],
    ["LS", "ST", 42, 14],
    ["RS", "ST", 58, 14],
  ],
  "4-2-3-1": [
    ...goalkeeper(),
    ...backFour(),
    ["LDM", "CDM", 39, 53],
    ["RDM", "CDM", 61, 53],
    ["LAM", "CAM", 34, 32],
    ["CAM", "CAM", 50, 29],
    ["RAM", "CAM", 66, 32],
    ["ST", "ST", 50, 13],
  ],
  "4-2-3-1 (2)": [
    ...goalkeeper(),
    ...backFour(),
    ["LDM", "CDM", 39, 53],
    ["RDM", "CDM", 61, 53],
    ["LM", "LM", 20, 34],
    ["CAM", "CAM", 50, 31],
    ["RM", "RM", 80, 34],
    ["ST", "ST", 50, 14],
  ],
  "4-2-4": [
    ...goalkeeper(),
    ...backFour(),
    ["LCM", "CM", 40, 47],
    ["RCM", "CM", 60, 47],
    ["LW", "LW", 22, 18],
    ["LS", "ST", 42, 13],
    ["RS", "ST", 58, 13],
    ["RW", "RW", 78, 18],
  ],
  "4-3-1-2": [
    ...goalkeeper(),
    ...backFour(),
    ["LCM", "CM", 35, 47],
    ["CM", "CM", 50, 50],
    ["RCM", "CM", 65, 47],
    ["CAM", "CAM", 50, 31],
    ["LS", "ST", 41, 14],
    ["RS", "ST", 59, 14],
  ],
  "4-3-2-1": [
    ...goalkeeper(),
    ...backFour(),
    ["LCM", "CM", 35, 48],
    ["CM", "CM", 50, 50],
    ["RCM", "CM", 65, 48],
    ["LF", "LW", 39, 27],
    ["RF", "RW", 61, 27],
    ["ST", "ST", 50, 12],
  ],
  "4-3-3": [
    ...goalkeeper(),
    ...backFour(),
    ["LCM", "CM", 34, 47],
    ["CM", "CM", 50, 43],
    ["RCM", "CM", 66, 47],
    ["LW", "LW", 23, 18],
    ["ST", "ST", 50, 13],
    ["RW", "RW", 77, 18],
  ],
  "4-3-3 (2)": [
    ...goalkeeper(),
    ...backFour(),
    ["CDM", "CDM", 50, 54],
    ["LCM", "CM", 37, 43],
    ["RCM", "CM", 63, 43],
    ["LW", "LW", 23, 18],
    ["ST", "ST", 50, 13],
    ["RW", "RW", 77, 18],
  ],
  "4-3-3 (3)": [
    ...goalkeeper(),
    ...backFour(),
    ["LDM", "CDM", 39, 54],
    ["CM", "CM", 50, 43],
    ["RDM", "CDM", 61, 54],
    ["LW", "LW", 23, 18],
    ["ST", "ST", 50, 13],
    ["RW", "RW", 77, 18],
  ],
  "4-3-3 (4)": [
    ...goalkeeper(),
    ...backFour(),
    ["LCM", "CM", 38, 47],
    ["RCM", "CM", 62, 47],
    ["CAM", "CAM", 50, 31],
    ["LW", "LW", 23, 18],
    ["ST", "ST", 50, 13],
    ["RW", "RW", 77, 18],
  ],
  "4-4-1-1 (2)": [
    ...goalkeeper(),
    ...backFour(),
    ["LM", "LM", 18, 43],
    ["LCM", "CM", 39, 45],
    ["RCM", "CM", 61, 45],
    ["RM", "RM", 82, 43],
    ["CF", "CAM", 50, 28],
    ["ST", "ST", 50, 13],
  ],
  "4-4-2": [
    ...goalkeeper(),
    ...backFour(),
    ["LM", "LM", 18, 42],
    ["LCM", "CM", 38, 44],
    ["RCM", "CM", 62, 44],
    ["RM", "RM", 82, 42],
    ["LS", "ST", 40, 17],
    ["RS", "ST", 60, 17],
  ],
  "4-4-2 (2)": [
    ...goalkeeper(),
    ...backFour(),
    ["LM", "LM", 18, 42],
    ["LDM", "CDM", 39, 50],
    ["RDM", "CDM", 61, 50],
    ["RM", "RM", 82, 42],
    ["LS", "ST", 40, 17],
    ["RS", "ST", 60, 17],
  ],
  "4-5-1": [
    ...goalkeeper(),
    ...backFour(),
    ["LM", "LM", 17, 42],
    ["LCM", "CM", 36, 45],
    ["CM", "CM", 50, 48],
    ["RCM", "CM", 64, 45],
    ["RM", "RM", 83, 42],
    ["ST", "ST", 50, 14],
  ],
  "4-5-1 (2)": [
    ...goalkeeper(),
    ...backFour(),
    ["LM", "LM", 18, 41],
    ["LCM", "CM", 40, 47],
    ["RCM", "CM", 60, 47],
    ["RM", "RM", 82, 41],
    ["CAM", "CAM", 50, 30],
    ["ST", "ST", 50, 13],
  ],
  "5-2-1-2": [
    ...goalkeeper(),
    ...backFive(),
    ["LCM", "CM", 39, 46],
    ["RCM", "CM", 61, 46],
    ["CAM", "CAM", 50, 30],
    ["LS", "ST", 41, 14],
    ["RS", "ST", 59, 14],
  ],
  "5-2-3": [
    ...goalkeeper(),
    ...backFive(),
    ["LCM", "CM", 40, 47],
    ["RCM", "CM", 60, 47],
    ["LW", "LW", 23, 18],
    ["ST", "ST", 50, 13],
    ["RW", "RW", 77, 18],
  ],
  "5-3-2": [
    ...goalkeeper(),
    ...backFive(),
    ["LCM", "CM", 35, 45],
    ["CM", "CM", 50, 41],
    ["RCM", "CM", 65, 45],
    ["LS", "ST", 41, 16],
    ["RS", "ST", 59, 16],
  ],
  "5-4-1": [
    ...goalkeeper(),
    ...backFive(),
    ["LM", "LM", 18, 41],
    ["LCM", "CM", 39, 45],
    ["RCM", "CM", 61, 45],
    ["RM", "RM", 82, 41],
    ["ST", "ST", 50, 13],
  ],
};

const FORMATION_OPTIONS = Object.keys(FORMATIONS).map((name) => ({
  name,
  group: name.startsWith("3-")
    ? "3 zagueiros"
    : name.startsWith("5-")
      ? "5 zagueiros"
      : "4 zagueiros",
}));

const POSITION_FILTERS = [
  ["all", "Todas"],
  ["GK", "Goleiros"],
  ["DEF", "Defesa"],
  ["MID", "Meio"],
  ["ATT", "Ataque"],
];

function getSlots(formation) {
  return (FORMATIONS[formation] || FORMATIONS["4-2-3-1"]).map(
    ([id, label, x, y]) => ({ id, label, displayLabel: id, x, y }),
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

function FormationPicker({ formation, onChange, open, onToggle, onClose }) {
  const groupedOptions = FORMATION_OPTIONS.reduce((acc, option) => {
    acc[option.group] = acc[option.group] || [];
    acc[option.group].push(option.name);
    return acc;
  }, {});

  return (
    <div
      className={`formation-picker ${open ? "is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose();
      }}
    >
      <button
        type="button"
        className="formation-picker-button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={onToggle}
      >
        <span>
          <small>Formacao</small>
          <strong>{formation}</strong>
        </span>
        <i aria-hidden="true"></i>
      </button>
      {open ? (
        <div className="formation-picker-menu" role="listbox">
          {Object.entries(groupedOptions).map(([group, names]) => (
            <section key={group}>
              <span>{group}</span>
              <div>
                {names.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={formation === name}
                    className={formation === name ? "is-active" : ""}
                    onClick={() => onChange(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PitchSlot({
  slot,
  player,
  selected,
  compatible,
  dropActive,
  dragging,
  onSelect,
  onClear,
  onDragStart,
  onDropPlayer,
  onDragOverSlot,
  onDragLeaveSlot,
  onDragEnd,
}) {
  return (
    <button
      type="button"
      className={[
        "squad-slot",
        selected ? "is-selected" : "",
        player ? "is-filled" : "",
        compatible ? "is-compatible" : "",
        dropActive ? "is-drop-target" : "",
        dragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={Boolean(player)}
      style={{ "--slot-x": `${slot.x}%`, "--slot-y": `${slot.y}%` }}
      onClick={onSelect}
      onDragStart={(event) => {
        if (!player) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(player.id));
        onDragStart(player, slot.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOverSlot(slot.id);
      }}
      onDragLeave={() => onDragLeaveSlot(slot.id)}
      onDrop={(event) => {
        event.preventDefault();
        onDropPlayer(event.dataTransfer.getData("text/plain"), slot.id);
      }}
      onDragEnd={onDragEnd}
      aria-label={
        player
          ? `${player.name}, ${slot.displayLabel}, overall ${player.overall}`
          : `Selecionar jogador para ${slot.displayLabel}`
      }
    >
      {player ? (
        <>
          <span className="squad-card-top">
            <span className="squad-card-ovr">{player.overall}</span>
            <small>{slot.displayLabel}</small>
          </span>
          <PlayerAvatar player={player} className="squad-card-avatar" />
          <span className="squad-card-name">
            <strong>{player.name}</strong>
            <em>{player.position || slot.label}</em>
          </span>
          <span
            className="squad-slot-remove"
            aria-label={`Remover ${player.name}`}
            title={`Remover ${player.name}`}
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
          <span className="squad-empty-target">
            <span className="squad-empty-plus">+</span>
            <strong>{slot.displayLabel}</strong>
          </span>
          <small>Selecionar</small>
        </>
      )}
    </button>
  );
}

function SquadRosterRow({
  player,
  assigned,
  selected,
  onPick,
  onDragStart,
  onDragEnd,
}) {
  return (
    <button
      type="button"
      className={[
        "squad-roster-row",
        assigned ? "is-assigned" : "",
        selected ? "is-selected-player" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable
      aria-pressed={selected}
      onClick={onPick}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(player.id));
        onDragStart(player, "");
      }}
      onDragEnd={onDragEnd}
      title={`${player.name} · ${player.position || "-"} · OVR ${player.overall} · ${player.salarySourceName || "Fonte salarial publica"}`}
    >
      <span className="squad-drag-grip" aria-hidden="true"></span>
      <PlayerAvatar player={player} />
      <span className="squad-roster-main">
        <strong>{player.name}</strong>
        <small>
          {player.position || "-"} · {player.nation || "EA FC 26"}
        </small>
      </span>
      <span className="squad-roster-meta">
        <b>{player.overall}</b>
        <small>
          {assigned
            ? "Em campo"
            : `${App.utils.formatCurrency(player.weeklySalary || 0)}/sem`}
        </small>
        {!assigned && player.salarySourceName ? (
          <small>{player.salarySourceName}</small>
        ) : null}
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
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [formationMenuOpen, setFormationMenuOpen] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState("");
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
    setSelectedPlayerId(null);
    setMessage("");
  }, [activeManagerName, savedLineup.formation, savedLineupKey]);

  const slots = getSlots(formation);
  const playerById = useMemo(
    () => new Map(roster.map((player) => [Number(player.id), player])),
    [roster],
  );
  const draggingPlayer = dragState?.playerId
    ? playerById.get(Number(dragState.playerId))
    : null;
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

  function changeFormation(nextFormation) {
    setFormation(nextFormation);
    const nextSlots = new Set(getSlots(nextFormation).map((slot) => slot.id));
    setLineup((current) =>
      Object.entries(current).reduce((acc, [slot, playerId]) => {
        if (nextSlots.has(slot)) acc[slot] = playerId;
        return acc;
      }, {}),
    );
    setSelectedSlot(getSlots(nextFormation)[0]?.id || "GK");
    setFormationMenuOpen(false);
    setMessage("");
  }

  function assignPlayerToSlot(player, targetSlot, fromSlot = "") {
    const playerId = Number(player?.id);
    if (!playerId || !targetSlot) return;
    setLineup((current) => {
      const replacedPlayerId = current[targetSlot];
      const next = Object.entries(current).reduce((acc, [slotId, assignedId]) => {
        if (Number(assignedId) !== Number(player?.id)) acc[slotId] = assignedId;
        return acc;
      }, {});
      if (
        fromSlot &&
        fromSlot !== targetSlot &&
        replacedPlayerId &&
        Number(replacedPlayerId) !== Number(player.id)
      ) {
        next[fromSlot] = replacedPlayerId;
      }
      next[targetSlot] = String(player.id);
      return next;
    });
    setSelectedSlot(targetSlot);
    setSelectedPlayerId(playerId);
  }

  function assignPlayer(player) {
    assignPlayerToSlot(player, getBestSlotForPlayer(player));
  }

  function getPlayerSlot(playerId) {
    return (
      Object.entries(lineup).find(
        ([, assignedId]) => Number(assignedId) === Number(playerId),
      )?.[0] || ""
    );
  }

  function startPlayerDrag(player, fromSlot = "") {
    setDragState({
      playerId: Number(player.id),
      fromSlot: fromSlot || getPlayerSlot(player.id),
    });
    setSelectedPlayerId(Number(player.id));
  }

  function finishPlayerDrag() {
    setDragState(null);
    setDragOverSlot("");
  }

  function dropPlayerOnSlot(playerId, targetSlot) {
    const draggedPlayer =
      playerById.get(Number(playerId)) || playerById.get(Number(dragState?.playerId));
    if (!draggedPlayer) {
      finishPlayerDrag();
      return;
    }
    assignPlayerToSlot(draggedPlayer, targetSlot, dragState?.fromSlot || "");
    finishPlayerDrag();
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
        <FormationPicker
          formation={formation}
          open={formationMenuOpen}
          onToggle={() => setFormationMenuOpen((current) => !current)}
          onClose={() => setFormationMenuOpen(false)}
          onChange={changeFormation}
        />
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
                    draggingPlayer
                      ? isCompatible(slot.label, draggingPlayer.position)
                      : selectedSlot === slot.id &&
                        filteredRoster.some((item) => isCompatible(slot.label, item.position))
                  }
                  dropActive={dragOverSlot === slot.id}
                  dragging={Number(player?.id) === Number(dragState?.playerId)}
                  onSelect={() => setSelectedSlot(slot.id)}
                  onClear={() =>
                    setLineup((current) => {
                      const next = { ...current };
                      delete next[slot.id];
                      return next;
                    })
                  }
                  onDragStart={startPlayerDrag}
                  onDropPlayer={dropPlayerOnSlot}
                  onDragOverSlot={setDragOverSlot}
                  onDragLeaveSlot={(slotId) => {
                    if (dragOverSlot === slotId) setDragOverSlot("");
                  }}
                  onDragEnd={finishPlayerDrag}
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
                selected={Number(selectedPlayerId) === Number(player.id)}
                onPick={() => assignPlayer(player)}
                onDragStart={startPlayerDrag}
                onDragEnd={finishPlayerDrag}
              />
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

export { SquadManagementView };
