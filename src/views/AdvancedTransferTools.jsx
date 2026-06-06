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
import { useForm } from "react-hook-form";
import { useMachine } from "@xstate/react";
import { z } from "zod";
import Decimal from "decimal.js-light";
import { mean, quantileSorted } from "simple-statistics";
import * as Comlink from "comlink";
import App from "../../js/app.js";
import { useLeagueUiStore } from "../state/useLeagueUiStore.js";
import { InlineLoader, LoadingState } from "./LoadingState.jsx";
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

function formatMarketFacetLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!raw.includes("-")) return raw;
  return raw
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function safeMean(values = []) {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  return clean.length ? mean(clean) : 0;
}

function safeQuantile(values = [], percentile = 0.5) {
  const clean = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  return clean.length ? quantileSorted(clean, percentile) : 0;
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

function getFastMarketSearchRows(query = "", showContracted = false, limit = 18) {
  const normalized = normalizeText(query);
  if (normalized.length < 2) return [];
  const marketPlayers = App.transfers?.getMarketPlayers?.() || [];
  const ranked =
    App.transfers?.rankMarketSearchPlayers?.(query, marketPlayers) ||
    marketPlayers.filter((player) =>
      normalizeText(
        [player.name, player.club, player.league, player.position]
          .filter(Boolean)
          .join(" "),
      ).includes(normalized),
    );
  return App.api
    .applyMarketPlayerOverrides(ranked, { showContracted })
    .slice(0, Math.max(1, Number(limit || 18)));
}

function mergeProgressiveMarketRows(
  query = "",
  currentRows = [],
  nextRows = [],
  showContracted = false,
  limit = 60,
) {
  const normalizedLimit = Math.max(1, Number(limit || 60));
  const incoming = Array.isArray(nextRows) ? nextRows : [];
  if (!incoming.length) {
    return Array.isArray(currentRows) ? currentRows.slice(0, normalizedLimit) : [];
  }

  const merged =
    App.api?.mergeMarketSearchRows?.(
      currentRows,
      incoming,
      Math.max(normalizedLimit, currentRows.length + incoming.length),
    ) || [...(currentRows || []), ...incoming];
  const overridden =
    App.api?.applyMarketPlayerOverrides?.(merged, { showContracted }) || merged;
  const ranked =
    App.transfers?.consolidateMarketSearchPlayers?.(query, overridden) ||
    overridden;
  return ranked.slice(0, normalizedLimit);
}

function useTransferActive() {
  useAppRuntime();
  return (
    typeof document !== "undefined" &&
    document.getElementById("transfersView")?.classList.contains("active")
  );
}

function TransferNegotiationIntelligence() {
  useAppRuntime();
  const [workerStats, setWorkerStats] = useState(null);
  const session = App.auth?.getSession?.();
  const managerName = session?.managerName || "";
  const marketPlayers = App.transfers?.getMarketPlayers?.() || [];
  const compare = App.transfers?.getCompareCandidates?.() || [];
  const proposals = Array.isArray(App.auth?.myTransferProposals)
    ? App.auth.myTransferProposals
    : [];
  const openProposals = proposals.filter((item) =>
    App.auth?.isOpenTransferProposal?.(item),
  );
  const finance = managerName
    ? App.transfers?.getBudgetInfoByBuyer?.()?.[managerName]
    : null;
  const budget = new Decimal(
    Number(finance?.remainingBudget ?? finance?.availableBudget ?? 0) || 0,
  );
  const values = marketPlayers.map((player) =>
    Number(player.market_value_eur || player.marketValue || 0),
  );
  const salaryValues = marketPlayers.map((player) =>
    Number(player.weeklySalary || player.weekly_salary_eur || 0),
  );
  const marketSignature = marketPlayers
    .slice(0, 24)
    .map(
      (player) =>
        `${player.id || player.name}:${player.market_value_eur || player.marketValue || 0}:${
          player.weeklySalary || player.weekly_salary_eur || 0
        }`,
    )
    .join("|");
  useEffect(() => {
    if (typeof Worker === "undefined" || !marketPlayers.length) {
      setWorkerStats(null);
      return undefined;
    }
    let cancelled = false;
    const worker = new Worker(
      new URL("../workers/market-intelligence.worker.js", import.meta.url),
      { type: "module" },
    );
    const api = Comlink.wrap(worker);
    api
      .summarizeMarket(
        marketPlayers.slice(0, 1000).map((player) => ({
          marketValue: player.market_value_eur || player.marketValue || 0,
          weeklySalary: player.weeklySalary || player.weekly_salary_eur || 0,
        })),
      )
      .then((result) => {
        if (!cancelled) setWorkerStats(result);
      })
      .catch(() => {
        if (!cancelled) setWorkerStats(null);
      });
    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [marketPlayers.length, marketSignature]);

  const medianValue = Number(workerStats?.medianValue || safeQuantile(values, 0.5));
  const upperValue = Number(workerStats?.upperValue || safeQuantile(values, 0.75));
  const avgSalary = Number(workerStats?.avgSalary || safeMean(salaryValues));
  const target = compare[0] || null;
  const targetValue = Number(target?.marketValue || 0);
  const conservativeOffer = targetValue
    ? new Decimal(targetValue).mul(1.05).toNumber()
    : upperValue;
  const aggressiveOffer = targetValue
    ? new Decimal(targetValue).mul(1.18).toNumber()
    : upperValue
      ? new Decimal(upperValue).mul(1.1).toNumber()
      : 0;
  const budgetAfterAggressive = budget.minus(aggressiveOffer);
  const budgetTone = !finance
    ? "neutral"
    : budgetAfterAggressive.isNegative()
      ? "danger"
      : budgetAfterAggressive.lt(2000000)
        ? "warning"
        : "success";

  return (
    <article className={`transfer-intelligence-card tone-${budgetTone}`}>
      <div className="advanced-tool-head">
        <span className="modal-kicker">Mesa inteligente</span>
        <h2>Recomendacao da janela</h2>
      </div>
      <div className="transfer-intelligence-grid">
        <span>
          <small>Mediana mercado</small>
          <strong>{formatMoney(medianValue)}</strong>
        </span>
        <span>
          <small>75 percentil</small>
          <strong>{formatMoney(upperValue)}</strong>
        </span>
        <span>
          <small>Folha media</small>
          <strong>{avgSalary ? `${formatMoney(avgSalary)}/sem` : "Pendente"}</strong>
        </span>
        <span>
          <small>Mesas abertas</small>
          <strong>{openProposals.length}</strong>
        </span>
      </div>
      <div className="transfer-intelligence-callout">
        <strong>
          {target
            ? `Atacar ${target.player}`
            : "Selecione um alvo no comparador"}
        </strong>
        <p>
          {target
            ? `Faixa sugerida: ${formatMoney(conservativeOffer)} a ${formatMoney(
                aggressiveOffer,
              )}. Saldo apos teto: ${formatMoney(
                budgetAfterAggressive.toNumber(),
              )}.`
            : "Adicione ate 3 nomes no comparador para gerar faixa de oferta e risco de caixa."}
        </p>
      </div>
      <div className="transfer-intelligence-actions">
        <button
          type="button"
          onClick={() => App.main?.switchToView?.("transfersView")}
        >
          Abrir mercado
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => App.main?.switchToView?.("playersView")}
        >
          Ver contratos
        </button>
      </div>
    </article>
  );
}

function TransferMarketTable({ onSelectPlayer } = {}) {
  const active = useTransferActive();
  const pushToast = useLeagueUiStore((state) => state.pushToast);
  const parentRef = useRef(null);
  const searchRequestRef = useRef(0);
  const [catalogMeta, setCatalogMeta] = useState({ positions: [], leagues: [] });
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
  const isCommissioner = App.auth?.isCommissioner?.() === true;
  const sessionBuyer = !isCommissioner ? session?.managerName || "" : "";
  const buyer =
    sessionBuyer ||
    document.getElementById("transferForm")?.elements?.buyer?.value ||
    session?.managerName ||
    "";

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    App.api
      ?.loadMarketCatalogMeta?.()
      .then((meta) => {
        if (cancelled || !meta) return;
        setCatalogMeta({
          positions: Array.isArray(meta.positions) ? meta.positions : [],
          leagues: Array.isArray(meta.leagues) ? meta.leagues : [],
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const query = String(filters.query || "").trim();
    const searchSeed =
      query ||
      (filters.league !== "all" ? String(filters.league || "") : "") ||
      (filters.position !== "all" ? String(filters.position || "") : "");
    if (searchSeed.trim().length < 2) {
      searchRequestRef.current += 1;
      setSearchRows([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const resultLimit = 60;
    const applyRows = (incomingRows = []) => {
      if (
        cancelled ||
        searchRequestRef.current !== requestId ||
        !Array.isArray(incomingRows) ||
        !incomingRows.length
      ) {
        return;
      }
      setSearchRows((currentRows) =>
        mergeProgressiveMarketRows(
          searchSeed,
          currentRows,
          incomingRows,
          filters.showContracted,
          resultLimit,
        ),
      );
    };

    const immediateRows = getFastMarketSearchRows(
      searchSeed,
      filters.showContracted,
      resultLimit,
    );
    const isSpecificNameSearch =
      query.split(/\s+/).filter(Boolean).length >= 2 &&
      filters.position === "all" &&
      filters.league === "all";
    setSearchRows(immediateRows);
    setSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const rows = await App.transfers.searchMarketPlayers(searchSeed, {
          showContracted: filters.showContracted,
          limit: resultLimit,
          directTimeoutMs: 5000,
          fallbackSourceDelayMs: isSpecificNameSearch ? 3600 : 1200,
          marketSourceGraceMs: isSpecificNameSearch
            ? 1500
            : immediateRows.length
              ? 800
              : 1200,
          onProgress: applyRows,
        });
        applyRows(rows);
      } catch (error) {
        if (!cancelled) {
          pushToast({
            title: "Busca de mercado indisponivel",
            description: error?.message || "Nao foi possivel consultar o mercado.",
            tone: "danger",
          });
        }
      } finally {
        if (!cancelled && searchRequestRef.current === requestId) {
          setSearching(false);
        }
      }
    }, immediateRows.length ? 90 : 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    active,
    filters.league,
    filters.position,
    filters.query,
    filters.showContracted,
    pushToast,
  ]);

  const baseRows = useMemo(() => {
    return (searchRows || []).map((player) => buildMarketRow(player, buyer));
  }, [searchRows, buyer]);

  const filterOptions = useMemo(() => {
    const positions = new Set();
    const leagues = new Set();
    (catalogMeta.positions || []).forEach((position) => {
      if (position && position !== "-") positions.add(position);
    });
    (catalogMeta.leagues || []).forEach((league) => {
      if (league) leagues.add(league);
    });
    baseRows.forEach((row) => {
      if (row.position && row.position !== "-") positions.add(row.position);
      if (row.league) leagues.add(row.league);
    });
    return {
      positions: [...positions].sort(),
      leagues: [...leagues].sort(),
    };
  }, [baseRows, catalogMeta]);

  const rows = useMemo(() => {
    let next = baseRows;
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

  const hasRowsWithPendingMarket = rows.some((row) => !row.marketValue);

  const selectPlayer = (row) => {
    if (row.contracted) return;
    const form = document.getElementById("transferForm");
    if (!form && typeof onSelectPlayer === "function") {
      App.transfers.pendingCandidateForProposal = row.candidate;
      onSelectPlayer(row);
      pushToast({
        title: "Jogador selecionado",
        description: `${row.name} foi enviado para a tela de proposta.`,
        tone: "market",
      });
      return;
    }
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
          {searching && rows.length ? (
            <InlineLoader
              label={
                hasRowsWithPendingMarket
                  ? "Atualizando valores"
                  : "Refinando mercado"
              }
            />
          ) : searching ? (
            <InlineLoader label="Buscando mercado" />
          ) : (
            `${rows.length} jogador(es) filtrados`
          )}
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
              {formatMarketFacetLabel(league)}
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
        {searching && !rows.length ? (
          <LoadingState
            className="advanced-empty"
            title="Buscando jogadores"
            detail="Consultando mercado, filtros e fallback regional."
            skeleton={3}
          />
        ) : !rows.length ? (
          <div className="advanced-empty">
            Busque por nome, clube, liga ou posicao, ou selecione uma liga para carregar o mercado.
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
      } ${targets.length ? "" : "is-empty"}`}
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
            ? <InlineLoader label="Salvando etapa" />
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
          : "Escolha um alvo no mercado para ativar a leitura."}
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
          Busca fuzzy, filtros avancados, tabela virtualizada e shortlist por
          kanban.
        </p>
      </div>
      <div className="advanced-transfer-body">
        <div className="advanced-transfer-sidebar">
          <TransferNegotiationIntelligence />
          <TransferWorkflowInspector />
        </div>
        <div className="advanced-transfer-main">
          <TransferMarketTable />
          <TransferKanbanBoard />
        </div>
      </div>
    </section>
  );
}

export {
  AdvancedTransferTools,
  TransferKanbanBoard,
  TransferNegotiationIntelligence,
  TransferMarketTable,
  TransferWorkflowInspector,
};
export default AdvancedTransferTools;
