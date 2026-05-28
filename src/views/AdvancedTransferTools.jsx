import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { zodResolver } from "@hookform/resolvers/zod";
import Fuse from "fuse.js";
import { useForm } from "react-hook-form";
import { useMachine } from "@xstate/react";
import { z } from "zod";
import App from "../../js/app.js";
import { useLeagueUiStore } from "../state/useLeagueUiStore.js";
import {
  resolveTransferWorkflowState,
  transferWorkflowMachine,
  workflowEventPaths,
  workflowLabels,
} from "../state/transferWorkflowMachine.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

const numberFilter = z.preprocess(
  (value) => (value === "" || value == null ? 0 : Number(value)),
  z.number().min(0),
);

const marketFilterSchema = z.object({
  query: z.string().default(""),
  position: z.string().default("all"),
  league: z.string().default("all"),
  minOverall: numberFilter.default(0),
  maxValue: numberFilter.default(0),
  showContracted: z.boolean().default(false),
});

const proposalSchema = z.object({
  buyer: z.string().min(1, "Escolha o comprador."),
  player: z.string().min(2, "Informe o jogador."),
  fromClub: z.string().min(2, "Informe o clube de origem."),
  overall: z.coerce.number().min(1).max(99),
  marketValue: z.coerce.number().min(1),
  offerValue: z.coerce.number().min(0).optional(),
});

const DEFAULT_STAGES = [
  "Prioridade alta",
  "Monitorando",
  "Proposta pronta",
  "Negociando",
  "Perdido",
];

function formatMoney(value = 0) {
  return App.utils?.formatCurrency?.(Number(value || 0)) || `EUR ${value}`;
}

function normalizeText(value = "") {
  return App.utils?.normalizeText?.(value) || String(value || "").toLowerCase();
}

function getPlayerId(player = {}, fallback = "") {
  return String(
    player.id ||
      player.transfermarkt_id ||
      player.transfermarktId ||
      `${player.name || "player"}-${player.club || fallback}`,
  );
}

function buildMarketRow(player = {}, buyer = "") {
  const candidate = App.transfers?.buildCandidateFromMarketPlayer?.(player) || {
    player: player.name || "",
    club: player.club || "",
    fromClub: player.club || "",
    position: player.position || "",
    overall: Number(player.overall || 0),
    marketValue: Number(player.market_value_eur || player.marketValue || 0),
  };
  const fit =
    App.transfers?.evaluateCandidateFit?.(candidate, buyer) || {
      label: "Sem leitura",
      score: 0,
      tone: "watch",
    };
  const salaryReference =
    App.transfers?.getSalaryReferenceFromItem?.({
      ...player,
      overall: candidate.overall,
      marketValue: candidate.marketValue,
    }) || {};

  return {
    id: getPlayerId(player, buyer),
    raw: player,
    candidate,
    name: player.name || candidate.player || "-",
    club: player.club || candidate.club || "-",
    league: player.league || "",
    position: candidate.position || player.position || "-",
    overall: Number(
      candidate.overall ||
        App.transfers?.getResolvedOverall?.(player) ||
        player.overall ||
        0,
    ),
    marketValue: Number(candidate.marketValue || player.market_value_eur || 0),
    weeklySalary: Number(salaryReference.weeklySalary || candidate.weeklySalary || 0),
    contracted: Boolean(App.transfers?.isMarketPlayerContracted?.(player)),
    fit,
  };
}

function mergePlayers(...groups) {
  const byKey = new Map();
  groups.flat().forEach((player) => {
    if (!player) return;
    const key = `${normalizeText(player.name)}|${normalizeText(player.club)}`;
    if (!byKey.has(key)) byKey.set(key, player);
  });
  return [...byKey.values()];
}

function useTransferActive() {
  useAppRuntime();
  return (
    typeof document !== "undefined" &&
    document.getElementById("transfersView")?.classList.contains("active")
  );
}

function TransferProposalAssistant() {
  const pushToast = useLeagueUiStore((state) => state.pushToast);
  const buyers = App.utils?.getHumanBuyers?.() || [
    "Henrique",
    "Willian",
    "Rafael",
    "Renato",
    "Bruno Silva",
  ];
  const session = App.auth?.getSession?.();
  const form = useForm({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      buyer: session?.managerName || buyers[0] || "",
      player: "",
      fromClub: "",
      overall: "",
      marketValue: "",
      offerValue: "",
    },
  });

  const fillLegacyForm = (values) => {
    const target = document.getElementById("transferForm");
    if (!target) return;
    const fields = target.elements;
    if (fields.buyer) fields.buyer.value = values.buyer;
    if (fields.player) fields.player.value = values.player;
    if (fields.fromClub) fields.fromClub.value = values.fromClub;
    if (fields.overall) fields.overall.value = values.overall;
    if (fields.marketValue) fields.marketValue.value = values.marketValue || "";
    if (fields.offerValue && values.offerValue) {
      if (typeof App.transfers?.setTransferOfferInputValue === "function") {
        App.transfers.setTransferOfferInputValue(target, Number(values.offerValue));
      } else {
        fields.offerValue.value = values.offerValue;
      }
    }
    App.transfers?.refreshWorkspace?.(target);
    App.transfers?.renderTransferPreview?.(target);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    pushToast({
      title: "Formulario preenchido",
      description: `${values.player} foi carregado na mesa de negociacao.`,
      tone: "success",
    });
  };

  return (
    <article className="advanced-tool-card transfer-assistant-card">
      <div className="advanced-tool-head">
        <span className="modal-kicker">Assistente validado</span>
        <h2>Montar proposta sem erro</h2>
      </div>
      <form onSubmit={form.handleSubmit(fillLegacyForm)} noValidate>
        <div className="advanced-form-grid">
          <label>
            Comprador
            <select {...form.register("buyer")}>
              {buyers.map((buyer) => (
                <option key={buyer} value={buyer}>
                  {buyer}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jogador
            <input {...form.register("player")} placeholder="Nome do jogador" />
          </label>
          <label>
            Clube origem
            <input {...form.register("fromClub")} placeholder="Clube atual" />
          </label>
          <label>
            OVR
            <input
              {...form.register("overall")}
              inputMode="numeric"
              placeholder="82"
            />
          </label>
          <label>
            Valor base
            <input
              {...form.register("marketValue")}
              inputMode="numeric"
              placeholder="32000000"
            />
          </label>
          <label>
            Oferta
            <input
              {...form.register("offerValue")}
              inputMode="numeric"
              placeholder="Opcional"
            />
          </label>
        </div>
        <div className="assistant-errors" aria-live="polite">
          {Object.values(form.formState.errors)
            .map((error) => error?.message)
            .filter(Boolean)
            .slice(0, 2)
            .join(" ")}
        </div>
        <button className="primary-button" type="submit">
          Preencher mesa
        </button>
      </form>
    </article>
  );
}

function TransferMarketTable() {
  const active = useTransferActive();
  const pushToast = useLeagueUiStore((state) => state.pushToast);
  const parentRef = useRef(null);
  const [searchRows, setSearchRows] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sorting, setSorting] = useState([{ id: "fit", desc: true }]);
  const session = App.auth?.getSession?.();
  const form = useForm({
    resolver: zodResolver(marketFilterSchema),
    defaultValues: {
      query: "",
      position: "all",
      league: "all",
      minOverall: 0,
      maxValue: 0,
      showContracted: false,
    },
  });
  const filters = form.watch();
  const buyer =
    document.getElementById("transferForm")?.elements?.buyer?.value ||
    session?.managerName ||
    "";

  useEffect(() => {
    if (!active) return undefined;
    const query = String(filters.query || "").trim();
    const legacyToggle = document.getElementById("showContractedPlayers");
    if (legacyToggle) legacyToggle.checked = Boolean(filters.showContracted);
    if (query.length < 2) return undefined;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await App.transfers.searchMarketPlayers(query);
        if (!cancelled) {
          setSearchRows(rows || []);
          App.react?.notify?.();
        }
      } catch (error) {
        if (!cancelled) {
          pushToast({
            title: "Busca de mercado indisponivel",
            description: error?.message || "Nao foi possivel consultar o mercado.",
            tone: "danger",
          });
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, filters.query, filters.showContracted, pushToast]);

  const baseRows = useMemo(() => {
    const loaded = App.transfers?.getMarketPlayers?.() || [];
    return mergePlayers(loaded, searchRows).map((player) =>
      buildMarketRow(player, buyer),
    );
  }, [searchRows, buyer]);

  const filterOptions = useMemo(() => {
    const positions = new Set();
    const leagues = new Set();
    baseRows.forEach((row) => {
      if (row.position && row.position !== "-") positions.add(row.position);
      if (row.league) leagues.add(row.league);
    });
    return {
      positions: [...positions].sort(),
      leagues: [...leagues].sort(),
    };
  }, [baseRows]);

  const rows = useMemo(() => {
    let next = baseRows;
    const query = String(filters.query || "").trim();
    if (query.length >= 2 && next.length) {
      const fuse = new Fuse(next, {
        keys: ["name", "club", "league", "position"],
        threshold: 0.32,
        ignoreLocation: true,
      });
      const fuzzy = fuse.search(query).map((item) => item.item);
      if (fuzzy.length) next = fuzzy;
    }
    if (!filters.showContracted) next = next.filter((row) => !row.contracted);
    if (filters.position !== "all") {
      next = next.filter((row) => row.position === filters.position);
    }
    if (filters.league !== "all") {
      next = next.filter((row) => row.league === filters.league);
    }
    if (Number(filters.minOverall || 0) > 0) {
      next = next.filter((row) => row.overall >= Number(filters.minOverall));
    }
    if (Number(filters.maxValue || 0) > 0) {
      next = next.filter((row) => row.marketValue <= Number(filters.maxValue));
    }
    return next.slice(0, 600);
  }, [baseRows, filters]);

  const selectPlayer = (row) => {
    if (row.contracted) return;
    App.transfers?.selectMarketPlayer?.(row.id);
    App.transfers?.loadCandidateIntoForm?.(row.candidate);
    document
      .getElementById("transferForm")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    pushToast({
      title: "Jogador carregado",
      description: `${row.name} esta pronto para proposta.`,
      tone: "market",
    });
  };

  const pinPlayer = async (row) => {
    try {
      await App.transfers.pinCandidate(row.candidate, "Monitorando");
      App.react?.notify?.();
      pushToast({
        title: "Shortlist atualizada",
        description: `${row.name} entrou no radar privado.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Shortlist nao atualizada",
        description: error?.message || "Nao foi possivel salvar o alvo.",
        tone: "danger",
      });
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Jogador",
        cell: ({ row }) => (
          <div className="market-table-player">
            <strong>{row.original.name}</strong>
            <small>{row.original.club}</small>
          </div>
        ),
      },
      {
        accessorKey: "position",
        header: "Pos",
      },
      {
        accessorKey: "overall",
        header: "OVR",
      },
      {
        accessorKey: "marketValue",
        header: "Valor",
        cell: ({ row }) =>
          row.original.marketValue
            ? formatMoney(row.original.marketValue)
            : "TM pendente",
      },
      {
        accessorKey: "weeklySalary",
        header: "Folha",
        cell: ({ row }) =>
          row.original.weeklySalary
            ? `${formatMoney(row.original.weeklySalary)}/sem`
            : "Pendente",
      },
      {
        id: "fit",
        accessorFn: (row) => Number(row.fit?.score || 0),
        header: "Fit",
        cell: ({ row }) => (
          <span className={`fit-pill tone-${row.original.fit?.tone || "watch"}`}>
            {row.original.fit?.label || "Sem leitura"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="market-table-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => selectPlayer(row.original)}
              disabled={row.original.contracted}
            >
              Selecionar
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => pinPlayer(row.original)}
            >
              Shortlist
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const tableRows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  if (!active) return null;

  return (
    <article className="advanced-tool-card advanced-market-table-card">
      <div className="advanced-tool-head">
        <div>
          <span className="modal-kicker">Radar virtualizado</span>
          <h2>Mercado avancado</h2>
        </div>
        <small>
          {searching ? "Buscando..." : `${rows.length} jogador(es) filtrados`}
        </small>
      </div>
      <form className="advanced-market-filters" noValidate>
        <input
          {...form.register("query")}
          type="search"
          placeholder="Nome, clube, liga ou posicao"
        />
        <select {...form.register("position")}>
          <option value="all">Todas as posicoes</option>
          {filterOptions.positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
        <select {...form.register("league")}>
          <option value="all">Todas as ligas</option>
          {filterOptions.leagues.map((league) => (
            <option key={league} value={league}>
              {league}
            </option>
          ))}
        </select>
        <input
          {...form.register("minOverall")}
          inputMode="numeric"
          placeholder="OVR min"
        />
        <input
          {...form.register("maxValue")}
          inputMode="numeric"
          placeholder="Valor max"
        />
        <label className="advanced-check">
          <input type="checkbox" {...form.register("showContracted")} />
          <span>Contratados</span>
        </label>
      </form>
      <div className="advanced-market-table">
        <div className="advanced-market-header">
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => (
              <button
                type="button"
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
                <span>{header.column.getIsSorted() || ""}</span>
              </button>
            )),
          )}
        </div>
        <div className="advanced-market-viewport" ref={parentRef}>
          <div
            className="advanced-market-spacer"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              if (!row) return null;
              return (
                <div
                  className={`advanced-market-row ${
                    row.original.contracted ? "is-contracted" : ""
                  }`}
                  key={row.id}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        {!rows.length ? (
          <div className="advanced-empty">
            Busque pelo menos 2 letras para carregar jogadores do mercado.
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DraggableTarget({ target }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `shortlist:${target.id}`,
      data: { target },
    });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <article
      className={`kanban-target-card ${isDragging ? "is-dragging" : ""}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <strong>{target.player}</strong>
      <small>{target.club || "Clube nao informado"}</small>
      <span>{formatMoney(target.value || 0)}</span>
    </article>
  );
}

function KanbanColumn({ stage, targets }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  const meta = App.transfers?.getShortlistStageMeta?.(stage) || {
    label: stage,
    hint: "",
    tone: "watch",
  };

  return (
    <section
      className={`kanban-column tone-${meta.tone || "watch"} ${
        isOver ? "is-over" : ""
      }`}
      ref={setNodeRef}
    >
      <header>
        <span>{meta.label}</span>
        <b>{targets.length}</b>
      </header>
      <p>{meta.hint}</p>
      <div>
        {targets.map((target) => (
          <DraggableTarget key={target.id} target={target} />
        ))}
        {!targets.length ? <em>Nenhum alvo nesta etapa.</em> : null}
      </div>
    </section>
  );
}

function TransferKanbanBoard() {
  const active = useTransferActive();
  const pushToast = useLeagueUiStore((state) => state.pushToast);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );
  const [dragTarget, setDragTarget] = useState(null);
  const [moving, setMoving] = useState(false);
  const targets = App.transfers?.getShortlistTargets?.() || [];
  const stages = App.transfers?.shortlistStages || DEFAULT_STAGES;
  const proposals = Array.isArray(App.auth?.myTransferProposals)
    ? App.auth.myTransferProposals
    : [];

  const grouped = useMemo(() => {
    const byStage = Object.fromEntries(stages.map((stage) => [stage, []]));
    targets.forEach((target) => {
      const stage = App.transfers?.normalizeShortlistStage?.(target.priority) ||
        target.priority ||
        "Monitorando";
      const match =
        stages.find((item) => normalizeText(item) === normalizeText(stage)) ||
        "Monitorando";
      byStage[match] = byStage[match] || [];
      byStage[match].push(target);
    });
    return byStage;
  }, [targets, stages]);

  const onDragEnd = async (event) => {
    const target = event.active?.data?.current?.target;
    const nextStage = event.over?.id;
    setDragTarget(null);
    if (!target || !nextStage) return;
    const currentStage = target.priority || "Monitorando";
    if (normalizeText(currentStage) === normalizeText(nextStage)) return;

    setMoving(true);
    try {
      await App.transfers.updateShortlistStage(target.id, nextStage);
      App.transfers.renderShortlistBoard?.();
      App.transfers.renderOpsBoard?.();
      App.react?.notify?.();
      pushToast({
        title: "Kanban atualizado",
        description: `${target.player} movido para ${nextStage}.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Kanban nao atualizado",
        description: error?.message || "Nao foi possivel mover o alvo.",
        tone: "danger",
      });
    } finally {
      setMoving(false);
    }
  };

  if (!active) return null;

  return (
    <article className="advanced-tool-card transfer-kanban-card">
      <div className="advanced-tool-head">
        <div>
          <span className="modal-kicker">Pipeline privado</span>
          <h2>Kanban de transferencias</h2>
        </div>
        <small>
          {moving
            ? "Salvando..."
            : `${targets.length} alvo(s) / ${proposals.length} proposta(s)`}
        </small>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={(event) => setDragTarget(event.active?.data?.current?.target)}
        onDragCancel={() => setDragTarget(null)}
        onDragEnd={onDragEnd}
      >
        <div className="transfer-kanban-board">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              targets={grouped[stage] || []}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragTarget ? (
            <article className="kanban-target-card is-overlay">
              <strong>{dragTarget.player}</strong>
              <small>{dragTarget.club}</small>
              <span>{formatMoney(dragTarget.value || 0)}</span>
            </article>
          ) : null}
        </DragOverlay>
      </DndContext>
    </article>
  );
}

function TransferWorkflowInspector() {
  const [snapshot, send] = useMachine(transferWorkflowMachine);
  const form = document.getElementById("transferForm");
  const candidate = App.transfers?.getCurrentCandidate?.(form);
  const shortlist = candidate?.player
    ? App.transfers?.findShortlistTarget?.(candidate)
    : null;
  const proposals = Array.isArray(App.auth?.myTransferProposals)
    ? App.auth.myTransferProposals
    : [];
  const targetState = resolveTransferWorkflowState({
    candidate,
    shortlist,
    proposals,
    locked: App.transfers?.isTransferWindowLocked?.(),
  });

  useEffect(() => {
    send({ type: "RESET" });
    const events = workflowEventPaths[targetState] || [];
    events.forEach((eventType) => send({ type: eventType }));
  }, [send, targetState]);

  const activeState = String(snapshot.value || "idle");
  const labels = [
    "idle",
    "scouting",
    "shortlisted",
    "proposal",
    "sellerReview",
    "buyerReview",
    "signature",
    "completed",
  ];

  return (
    <article className="advanced-tool-card workflow-inspector-card">
      <div className="advanced-tool-head">
        <div>
          <span className="modal-kicker">XState</span>
          <h2>Fluxo da negociacao</h2>
        </div>
        <small>{workflowLabels[activeState] || activeState}</small>
      </div>
      <div className="workflow-steps">
        {labels.map((state) => (
          <span
            key={state}
            className={state === activeState ? "is-active" : ""}
          >
            {workflowLabels[state]}
          </span>
        ))}
      </div>
      <p>
        {candidate?.player
          ? `${candidate.player} esta em ${workflowLabels[activeState] || activeState}.`
          : "Escolha um alvo no mercado ou no assistente para ativar a leitura."}
      </p>
    </article>
  );
}

function AdvancedTransferTools() {
  const active = useTransferActive();
  if (!active) return null;

  return (
    <section className="advanced-transfer-tools" id="advancedTransferTools">
      <div className="advanced-transfer-title">
        <span className="modal-kicker">Nova camada operacional</span>
        <h2>Mercado inteligente</h2>
        <p>
          Busca fuzzy, filtros avancados, tabela virtualizada, shortlist por
          kanban e proposta validada antes de entrar no fluxo legado.
        </p>
      </div>
      <TransferProposalAssistant />
      <TransferWorkflowInspector />
      <TransferMarketTable />
      <TransferKanbanBoard />
    </section>
  );
}

export { AdvancedTransferTools };
export default AdvancedTransferTools;
