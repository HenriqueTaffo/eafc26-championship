import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Command } from "cmdk";
import App from "../../js/app.js";
import { useLeagueUiStore } from "../state/useLeagueUiStore.js";

const NAV_COMMANDS = [
  {
    id: "view-standings",
    type: "Tela",
    title: "Classificação",
    detail: "Tabela, forma e pressão de campanha",
    view: "standingsView",
  },
  {
    id: "view-calendar",
    type: "Tela",
    title: "Calendário",
    detail: "Agenda mensal, semanas e placares pendentes",
    view: "calendarView",
  },
  {
    id: "view-cups",
    type: "Tela",
    title: "Copas",
    detail: "Chaves, avanco de fase e bonus",
    view: "cupsView",
  },
  {
    id: "view-events",
    type: "Tela",
    title: "Eventos",
    detail: "Bastidores, punicoes e impactos",
    view: "eventsView",
  },
  {
    id: "view-office",
    type: "Tela",
    title: "Escritório",
    detail: "Inbox, caixa, diretoria e contratos",
    view: "playersView",
  },
  {
    id: "view-squad",
    type: "Tela",
    title: "Elenco",
    detail: "Formacao, disponibilidade e folha",
    view: "squadView",
  },
  {
    id: "view-transfers",
    type: "Tela",
    title: "Transferências",
    detail: "Mesa ativa, scouting e negociações",
    view: "transfersView",
  },
  {
    id: "view-intelligence",
    type: "Tela",
    title: "Inteligência",
    detail: "Risco, prioridades e leitura do momento",
    view: "experienceView",
    role: "commissioner",
  },
];

function getSnapshot() {
  return App.react?.getSnapshot?.() || 0;
}

function subscribe(listener) {
  return App.react?.subscribe?.(listener) || (() => {});
}

function normalizeCommandItem(item, index, source = "runtime") {
  if (!item?.title) return null;
  return {
    id:
      item.id ||
      `${source}-${item.view || "action"}-${item.filterId || "none"}-${index}`,
    type: item.type || "Acao",
    title: item.title,
    detail: item.detail || "",
    meta: item.meta || "",
    view: item.view,
    filterId: item.filterId,
    filterValue: item.filterValue,
    action: item.action,
    role: item.role || "all",
    haystack: item.haystack || "",
  };
}

function applyFilter(item) {
  if (!item?.filterId) return;
  const field = document.getElementById(item.filterId);
  if (!field) return;
  field.value = item.filterValue || item.title || "";
  try {
    localStorage.setItem(`mml-filter-${item.filterId}`, field.value);
  } catch (_) {
    // localStorage can be unavailable in private browser contexts.
  }
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function normalizeSearch(value = "") {
  return App.utils?.normalizeText?.(value) || String(value || "").toLowerCase();
}

function isCommissionerOnly(item) {
  return item?.role === "commissioner";
}

function isCoachScopedRuntimeItem(item, session) {
  const type = normalizeSearch(item?.type || "");
  if (type === "favorito") return true;
  if (type === "jogo" || type === "copa") return true;

  const sessionKey = normalizeSearch(session?.managerName || "");
  if (!sessionKey) return false;

  const haystack = normalizeSearch(
    `${item?.title || ""} ${item?.detail || ""} ${item?.meta || ""}`,
  );

  if (type.includes("transfer")) return haystack.includes(sessionKey);
  if (type.includes("evento")) return haystack.includes(sessionKey);
  return false;
}

function limitRuntimeItems(items, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  return items.slice(0, limit);
}

export function LeagueCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const pushToast = useLeagueUiStore((state) => state.pushToast);
  const session = App.auth?.getSession?.() || null;
  const isCommissioner = Boolean(
    session?.isCommissioner || App.auth?.isCommissioner?.(),
  );
  const normalizedQuery = normalizeSearch(query).trim();

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (key === "escape" && open) {
        setOpen(false);
      }
      if (!event.metaKey && !event.ctrlKey && key === "/" && !open) {
        const activeTag = document.activeElement?.tagName;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const commands = useMemo(() => {
    const runtimeItems =
      typeof App.main?.getGlobalSearchItems === "function"
        ? App.main.getGlobalSearchItems()
        : [];
    const actions = [
      {
        id: "action-sync",
        type: "Acao",
        title: "Sincronizar dados",
        detail: "Recarrega liga, mercado, eventos e estados privados",
        action: async () => {
          App.main?.markSyncing?.("Sincronizando manualmente...");
          await App.api?.loadApiData?.({
            showLoader: false,
            force: true,
            skipBackgroundRefresh: true,
          });
          App.main?.renderCurrentView?.();
          App.main?.markSynced?.("Dados sincronizados");
          pushToast({
            title: "Liga sincronizada",
            description: "Dados atualizados pela command palette.",
            tone: "success",
          });
        },
      },
      {
        id: "action-market-top",
        type: "Acao",
        title: "Abrir mesa de mercado",
        detail: "Vai para transferencias e posiciona no radar avancado",
        view: "transfersView",
        action: () => {
          requestAnimationFrame(() => {
            document
              .getElementById("advancedTransferTools")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        },
      },
      {
        id: "action-today-center",
        type: "Acao",
        title: "Abrir central hoje",
        detail: "Mostra fila urgente, proximo contexto e caixa disponivel",
        action: () => {
          document
            .querySelector(".today-command-center")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      },
      {
        id: "action-system-health",
        type: "Acao",
        title: "Ver saude do sistema",
        detail: "Abre inteligencia e mostra auditoria, vitals e filas",
        view: "experienceView",
        role: "commissioner",
        action: () => {
          requestAnimationFrame(() => {
            document
              .querySelector(".ops-qol-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        },
      },
      {
        id: "action-weekly-close",
        type: "Acao",
        title: "Fechamento semanal",
        detail: "Vai para resultados, CPU x CPU e rotinas oficiais",
        view: "submitView",
        role: "commissioner",
      },
      {
        id: "action-clear-local-cache",
        type: "Acao",
        title: "Limpar cache local",
        detail: "Remove cache de queries e pesquisas locais desta sessao",
        role: "commissioner",
        action: async () => {
          try {
            localStorage.removeItem("4linhas-query-cache-v1");
            App.api?.rpcMemoryCache?.clear?.();
            App.transfers.marketSearchCache = {};
            App.transfers.eaRatingSearchCache = {};
            pushToast({
              title: "Cache local limpo",
              description: "Sincronize novamente para recarregar os dados.",
              tone: "success",
            });
          } catch (error) {
            pushToast({
              title: "Cache nao limpo",
              description: error?.message || "O navegador bloqueou a acao.",
              tone: "danger",
            });
          }
        },
      },
    ];

    const visibleNavCommands = NAV_COMMANDS.filter(
      (item) => isCommissioner || !isCommissionerOnly(item),
    );
    const visibleActions = actions.filter(
      (item) => isCommissioner || !isCommissionerOnly(item),
    );
    const coachFavorites = runtimeItems.filter(
      (item) => normalizeSearch(item?.type || "") === "favorito",
    );
    const scopedRuntimeItems = isCommissioner
      ? limitRuntimeItems(runtimeItems, 80)
      : normalizedQuery.length >= 2
        ? limitRuntimeItems(
            runtimeItems.filter((item) =>
              isCoachScopedRuntimeItem(item, session),
            ),
            12,
          )
        : limitRuntimeItems(coachFavorites, 5);

    return [...visibleNavCommands, ...visibleActions, ...scopedRuntimeItems]
      .map((item, index) => normalizeCommandItem(item, index))
      .filter(Boolean);
  }, [
    snapshot,
    pushToast,
    isCommissioner,
    normalizedQuery,
    session?.managerName,
  ]);

  const runCommand = async (item) => {
    if (!item) return;
    setOpen(false);
    applyFilter(item);
    if (item.view) App.main?.switchToView?.(item.view);
    if (typeof item.action === "function") {
      try {
        await item.action();
      } catch (error) {
        pushToast({
          title: "Acao nao concluida",
          description: error?.message || "A command palette encontrou um erro.",
          tone: "danger",
        });
      }
    }
  };

  const getBestCommandForQuery = (inputValue = query) => {
    const normalized = normalizeSearch(inputValue).trim();
    if (!normalized) return commands[0];
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return (
      commands.find(
        (item) =>
          normalizeSearch(`${item.type} ${item.title}`) === normalized,
      ) ||
      commands.find((item) =>
        normalizeSearch(`${item.type} ${item.title}`).includes(normalized),
      ) ||
      commands.find((item) => {
        const haystack = normalizeSearch(
          `${item.type} ${item.title} ${item.detail} ${item.meta}`,
        );
        return tokens.every((token) => haystack.includes(token));
      }) ||
      commands[0]
    );
  };
  const palettePlaceholder = isCommissioner
    ? "Buscar tela, jogador, partida, transferencia ou acao..."
    : "Buscar atalho, jogo, favorito ou sua negociacao...";
  const paletteGroupTitle = isCommissioner
    ? "Navegacao e acoes"
    : "Atalhos do tecnico";

  return (
    <>
      <button
        className="command-palette-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir command palette"
      >
        <span>Buscar</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open ? (
        <div className="league-command-overlay" onClick={() => setOpen(false)}>
          <div
            className="league-command-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leagueCommandTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="sr-only" id="leagueCommandTitle">
              Command palette da liga
            </h2>
            <Command label="Command palette da liga">
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  runCommand(getBestCommandForQuery(event.currentTarget.value));
                }}
                placeholder={palettePlaceholder}
              />
              <Command.List>
                <Command.Empty>Nenhum resultado encontrado.</Command.Empty>
                <Command.Group heading={paletteGroupTitle}>
                  {commands.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.type} ${item.title} ${item.detail} ${item.meta}`}
                      onSelect={() => runCommand(item)}
                    >
                      <span>{item.type}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default LeagueCommandPalette;
