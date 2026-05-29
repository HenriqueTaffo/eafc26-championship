import { Suspense, lazy, useEffect, useState } from "react";
import {
  ActivityPanel,
  AttentionPanel,
  FullStandingsRows,
  HomeNextGames,
  HomeStandingsRows,
  RoundCenter,
  ScrollButton,
  StandingsMobileList,
  ViewButton,
} from "../views/StandingsView.jsx";
import {
  CalendarSummary,
  CommissionerSummary,
  CupsSummary,
  EventsSummary,
  ExperienceSummary,
  PlayersSummary,
  SquadSummary,
  StandingsSummary,
  TransfersSummary,
  useAppRuntime,
} from "../views/ViewSummaries.jsx";
import {
  ArrowLeftRight,
  BarChart3,
  Brain,
  CalendarDays,
  Scale,
  Sparkles,
  Trophy,
  UploadCloud,
  Users,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import App from "../../js/app.js";
import {
  getWorkspaceRouteByPath,
  getWorkspaceRoutesForGroup,
  isWorkspaceRouteVisible,
  workspaceRouteGroups,
} from "../shared/navigation/workspace-routes";

const CalendarMonthBoard = lazy(() =>
  import("../views/CalendarCupsViews.jsx").then((module) => ({
    default: module.CalendarMonthBoard,
  })),
);
const CalendarWeekBoard = lazy(() =>
  import("../views/CalendarCupsViews.jsx").then((module) => ({
    default: module.CalendarWeekBoard,
  })),
);
const CupsBracket = lazy(() =>
  import("../views/CalendarCupsViews.jsx").then((module) => ({
    default: module.CupsBracket,
  })),
);
const CommissionerRuntime = lazy(() =>
  import("../views/CommissionerView.jsx").then((module) => ({
    default: module.CommissionerRuntime,
  })),
);
const ExperienceGrid = lazy(() =>
  import("../views/ExperienceView.jsx").then((module) => ({
    default: module.ExperienceGrid,
  })),
);
const EventsGrid = lazy(() =>
  import("../views/EventsView.jsx").then((module) => ({
    default: module.EventsGrid,
  })),
);
const EventSlotList = lazy(() =>
  import("../views/EventsView.jsx").then((module) => ({
    default: module.EventSlotList,
  })),
);
const PlayerLeaderboards = lazy(() =>
  import("../views/PlayersView.jsx").then((module) => ({
    default: module.PlayerLeaderboards,
  })),
);
const PlayersGrid = lazy(() =>
  import("../views/PlayersView.jsx").then((module) => ({
    default: module.PlayersGrid,
  })),
);
const SquadManagementView = lazy(() =>
  import("../views/SquadView.jsx").then((module) => ({
    default: module.SquadManagementView,
  })),
);
const TransfersRuntime = lazy(() =>
  import("../views/TransfersView.jsx").then((module) => ({
    default: module.TransfersRuntime,
  })),
);
const AdvancedTransferTools = lazy(() =>
  import("../views/AdvancedTransferTools.jsx").then((module) => ({
    default: module.AdvancedTransferTools,
  })),
);

const BRAND_ASSET_VERSION = "20260525-4linhas-brand-v1";
const APP_BASE_URL = import.meta.env.BASE_URL || "/";
const BRAND_NAME = "4 Linhas";

function resolveAssetUrl(relativePath = "", version = "") {
  const normalizedBase = APP_BASE_URL.endsWith("/")
    ? APP_BASE_URL
    : `${APP_BASE_URL}/`;
  const normalizedPath = String(relativePath || "").replace(/^\/+/, "");
  const assetUrl = `${normalizedBase}${normalizedPath}`;
  return version ? `${assetUrl}?v=${version}` : assetUrl;
}

const BRAND_ICON_SRC = resolveAssetUrl(
  "assets/4linhas-icon-light.png",
  BRAND_ASSET_VERSION,
);
const BRAND_WORDMARK_SRC = resolveAssetUrl(
  "assets/4linhas-wordmark-light.png",
  BRAND_ASSET_VERSION,
);
const WORKSPACE_NAV_GROUPS = [
  {
    key: "league",
    label: "Liga",
    detail: "Rodada, agenda e leitura macro da temporada.",
    views: [
      {
        view: "standingsView",
        label: "ClassificaÃ§Ã£o",
        detail: "Tabela, forma e pressÃ£o de campanha",
        icon: BarChart3,
      },
      {
        view: "calendarView",
        label: "CalendÃ¡rio",
        detail: "Agenda mensal, semanas e placares pendentes",
        icon: CalendarDays,
      },
      {
        view: "cupsView",
        label: "Copas",
        detail: "Chaves, avanÃ§o de fase e bÃ´nus",
        icon: Trophy,
      },
      {
        view: "eventsView",
        label: "Eventos",
        detail: "Caos, bastidores, puniÃ§Ãµes e impactos",
        icon: Sparkles,
      },
    ],
  },
  {
    key: "club",
    label: "Clube",
    detail: "Fluxo privado do tÃ©cnico, elenco e mercado.",
    views: [
      {
        view: "playersView",
        label: "EscritÃ³rio",
        detail: "Inbox, caixa, diretoria e contratos",
        icon: WalletCards,
      },
      {
        view: "squadView",
        label: "Elenco",
        detail: "FormaÃ§Ã£o, disponibilidade e folha",
        icon: Users,
      },
      {
        view: "transfersView",
        label: "TransferÃªncias",
        detail: "Mesa ativa, scouting e negociaÃ§Ãµes",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    key: "admin",
    label: "Liga / Admin",
    detail: "GovernanÃ§a, auditoria e fechamento operacional.",
    role: "commissioner",
    views: [
      {
        view: "commissionerView",
        label: "ComissÃ¡rio",
        detail: "LeilÃµes, auditoria e aÃ§Ãµes mÃ©dicas",
        icon: Scale,
      },
      {
        view: "submitView",
        label: "Enviar dados",
        detail: "Resultados, CPU e rotinas da rodada",
        icon: UploadCloud,
      },
      {
        view: "experienceView",
        label: "InteligÃªncia",
        detail: "Risco, prioridades e leitura do momento",
        icon: Brain,
      },
    ],
  },
];

function ViewLoadingPlaceholder({
  title = "Carregando painel",
  detail = "Preparando a tela selecionada...",
}) {
  return (
    <section className="app-skeleton-stack view-loading-placeholder" aria-live="polite">
      <div className="home-panel-header">
        <h2>{title}</h2>
      </div>
      <p className="calendar-muted">{detail}</p>
      <div className="app-skeleton-row">
        <i></i>
        <b></b>
        <em></em>
      </div>
      <div className="app-skeleton-row">
        <i></i>
        <b></b>
        <em></em>
      </div>
    </section>
  );
}

function useViewActivation(viewId) {
  useAppRuntime();
  const isActive =
    typeof document !== "undefined" &&
    document.getElementById(viewId)?.classList.contains("active");
  const [hasActivated, setHasActivated] = useState(Boolean(isActive));

  useEffect(() => {
    if (isActive) setHasActivated(true);
  }, [isActive]);

  return hasActivated || Boolean(isActive);
}

function DeferredViewSection({ viewId, title, detail, children }) {
  const isReady = useViewActivation(viewId);
  const fallback = <ViewLoadingPlaceholder title={title} detail={detail} />;
  if (!isReady) return fallback;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

function GlobalLoader() {
  return (
    <>
      <div
        id="globalLoader"
        className="global-loader is-visible"
        aria-live="polite"
        aria-busy="true"
        role="status"
      >
        <div id="globalLoaderCard" className="loader-card loader-card-match">
          <div id="globalLoaderChip" className="loader-chip">
            Montando a rodada
          </div>
          <div
            id="globalLoaderSpeech"
            className="loader-speech"
            aria-hidden="true"
          >
            Conferindo a rodada...
          </div>

          <div className="loader-stage" aria-hidden="true">
            <div className="loader-shadow"></div>
            <div className="loader-sweat"></div>
            <div className="loader-scan-line"></div>

            <div className="loader-mascot-wrap">
              <div className="loader-ring"></div>
              <div className="loader-orbit"></div>
              <img
                className="loader-mascot brand-icon-img"
                src={BRAND_ICON_SRC}
                alt=""
              />
            </div>

            <div className="loader-tactical-board">
              <i></i>
              <i></i>
              <i></i>
            </div>

            <div className="loader-market-card">
              <span id="globalLoaderMarketLabel">Scout report</span>
              <b id="globalLoaderMarketValue">OVR 87?</b>
              <span id="globalLoaderMarketDetail">taxa subindo...</span>
            </div>

            <div className="loader-chaos-list">
              <span id="globalLoaderChaosItem1">conferindo lesÃµes</span>
              <span id="globalLoaderChaosItem2">validando mercado</span>
              <span id="globalLoaderChaosItem3">organizando bastidores</span>
            </div>
          </div>

          <div className="loader-copy">
            <strong id="globalLoaderTitle">Carregando dados da liga</strong>
            <span id="globalLoaderText">
              Aguarde enquanto a classificaÃ§Ã£o, o calendÃ¡rio e os painÃ©is sÃ£o
              atualizados.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

void WORKSPACE_NAV_GROUPS;

function WorkspaceNavigation({ activePath }) {
  useAppRuntime();
  const navigate = useNavigate();

  const session = App.auth?.getSession?.() || null;
  const isCommissioner = Boolean(
    session?.isCommissioner || App.auth?.isCommissioner?.(),
  );
  const visibleGroups = workspaceRouteGroups
    .map((group) => ({
      ...group,
      views: getWorkspaceRoutesForGroup(group.key).filter((route) =>
        isWorkspaceRouteVisible(route, isCommissioner),
      ),
    }))
    .filter((group) => group.views.length > 0);

  return (
    <nav className="tabs workspace-nav" aria-label="NavegaÃ§Ã£o principal">
      {visibleGroups.map((group) => (
        <section
          className="workspace-nav-group"
          data-role={group.key}
          key={group.key}
        >
          <header className="workspace-nav-group-header">
            <div>
              <span className="workspace-nav-group-kicker">{group.label}</span>
              <p>{group.detail}</p>
            </div>
            <b>{group.views.length}</b>
          </header>
          <div className="workspace-nav-grid">
            {group.views.map((item) => {
              const Icon = item.icon;
              const isActive = item.path === activePath;
              return (
                <button
                  className={`tab-button workspace-nav-tab${isActive ? " active" : ""}`}
                  data-view={item.viewId}
                  key={item.path}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => navigate(item.path)}
                >
                  <span className="workspace-nav-tab-icon" aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} />
                  </span>
                  <span className="workspace-nav-tab-copy">
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

function ShellChrome({ activeRoute }) {
  const session = App.auth?.getSession?.() || null;
  const audienceLabel = session?.isCommissioner
    ? "OperaÃ§Ã£o da liga"
    : session?.managerName
      ? `${session.managerName} Â· ${session.clubName || "Clube ativo"}`
      : "Produto operacional da liga";

  return (
    <>
      <section className="shell-top-cluster">
        <header className="hero league-hero league-hero-brand">
          <div className="league-brand-lockup" aria-hidden="true">
            <img
              className="league-brand-wordmark"
              src={BRAND_WORDMARK_SRC}
              alt=""
            />
          </div>
          <div className="league-hero-divider" aria-hidden="true"></div>
          <div className="league-hero-copy">
            <h1 className="sr-only">{BRAND_NAME}</h1>
            <span className="league-brand-meta">{activeRoute.kicker}</span>
            <strong className="league-route-title">{activeRoute.label}</strong>
            <p>{activeRoute.detail}</p>
          </div>
          <aside className="route-focus-panel">
            <span>{audienceLabel}</span>
            <strong>{activeRoute.groupLabel}</strong>
            <p>{activeRoute.groupDetail}</p>
          </aside>
        </header>

        <section
          id="managerLoginPanel"
          className="manager-login-panel"
        ></section>
        <section
          id="transferProposalPanel"
          className={`decision-center${
            activeRoute.groupKey !== "club" ? " is-collapsed" : ""
          }`}
        ></section>

        <WorkspaceNavigation activePath={activeRoute.path} />

        <section className="app-status-bar" aria-live="polite">
          <div className="status-primary">
            <span className="status-kicker">Estado da liga</span>
            <strong id="syncStatusText">Sincronizando dados da liga...</strong>
          </div>
          <div className="status-actions">
            <div className="global-search" data-global-search>
              <input
                id="globalSearchInput"
                type="search"
                placeholder="Buscar jogo, tÃ©cnico, jogador..."
                autoComplete="off"
                aria-label="Busca global da liga"
              />
              <div
                id="globalSearchResults"
                className="global-search-results"
                role="listbox"
                aria-label="Resultados da busca global"
              ></div>
            </div>
            <button type="button" data-manual-sync>
              Sincronizar agora
            </button>
          </div>
        </section>
      </section>
    </>
  );
}

function StandingsView() {
  return (
    <>
      <section id="standingsView" className="view active">
        <section className="summary home-summary" id="standingsSummary">
          <StandingsSummary />
        </section>

        <RoundCenter />

        <AttentionPanel />

        <section id="leagueNewsPanel" className="league-news-panel"></section>

        <section className="home-grid">
          <article className="home-panel home-standings-panel">
            <div className="home-panel-header">
              <h2>ClassificaÃ§Ã£o geral</h2>
            </div>
            <div className="home-standings-table-wrap">
              <table className="home-standings-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Time</th>
                    <th>Pts</th>
                    <th>J</th>
                    <th>V</th>
                    <th>E</th>
                    <th>D</th>
                    <th>SG</th>
                  </tr>
                </thead>
                <tbody id="homeStandingsTable">
                  <HomeStandingsRows />
                </tbody>
              </table>
            </div>
            <ScrollButton className="home-link" target="standingsFullBlock">
              Ver classificaÃ§Ã£o completa <span>â€º</span>
            </ScrollButton>
          </article>

          <article className="home-panel home-next-panel">
            <div className="home-panel-header">
              <h2>PrÃ³ximos jogos</h2>
            </div>
            <div className="next-games-list" id="homeNextGames">
              <HomeNextGames />
            </div>
            <ViewButton className="home-link" target="calendarView">
              Ver calendÃ¡rio completo <span>â€º</span>
            </ViewButton>
          </article>
        </section>

        <section className="home-cup-card">
          <div className="cup-icon">ðŸ†</div>
          <div>
            <h2>Copas oficiais</h2>
            <p>
              Carabao Cup e The Emirates FA Cup: chaveamento, prÃ³ximos jogos e
              classificaÃ§Ã£o.
            </p>
          </div>
          <ViewButton className="cup-action" target="cupsView">
            Ver copas <span>â€º</span>
          </ViewButton>
        </section>

        <ActivityPanel />

        <section className="legend-block compact-legend">
          <p className="legend-title">Legendas de classificaÃ§Ã£o</p>
          <div className="legend">
            <span className="badge">
              <span className="dot promotion"></span>Acesso direto
            </span>
            <span className="badge">
              <span className="dot playoff"></span>Playoffs
            </span>
            <span className="badge">
              <span className="dot relegation"></span>Rebaixamento
            </span>
            <span className="badge">
              <span className="dot ours"></span>Times com tÃ©cnico
            </span>
          </div>
        </section>

        <section id="standingsFullBlock" className="full-standings-block">
          <div className="home-panel-header">
            <h2>Tabela completa</h2>
          </div>
          <section className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Time</th>
                  <th>Dono</th>
                  <th>J</th>
                  <th>V</th>
                  <th>E</th>
                  <th>D</th>
                  <th>GP</th>
                  <th>GC</th>
                  <th>SG</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody id="standingsTable">
                <FullStandingsRows />
              </tbody>
            </table>
          </section>
          <StandingsMobileList />
        </section>
      </section>
    </>
  );
}

function CalendarView() {
  return (
    <>
      <section id="calendarView" className="view">
        <section className="summary" id="calendarSummary">
          <CalendarSummary />
        </section>
        <section className="controls">
          <input
            id="calendarSearchInput"
            type="search"
            placeholder="Buscar time, competiÃ§Ã£o, rodada ou tÃ©cnico..."
          />
          <select id="calendarCompetitionFilter">
            <option value="all">Todas as competiÃ§Ãµes</option>
            <option value="Championship">Championship</option>
            <option value="Copa da Liga">Carabao Cup</option>
            <option value="FA Cup">The Emirates FA Cup</option>
          </select>
          <select id="calendarOwnerFilter">
            <option value="all">Todos os tÃ©cnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
            <option value="human">Apenas jogos com tÃ©cnico</option>
            <option value="human-vs-human">TÃ©cnico x TÃ©cnico</option>
            <option value="cpu">CPU x CPU</option>
          </select>
          <select id="calendarWeekFilter">
            <option value="all">Todas as semanas</option>
          </select>
          <select id="calendarStatusFilter" defaultValue="pending">
            <option value="pending">Somente pendentes</option>
            <option value="next">PrÃ³ximos 30 jogos</option>
            <option value="done">Somente realizados</option>
            <option value="all">Todos os jogos</option>
          </select>
        </section>
        <section className="legend-block">
          <p className="legend-title">Destaques</p>
          <div className="legend">
            <span className="badge">
              <span className="dot ours"></span>Jogo com tÃ©cnico
            </span>
            <span className="badge">
              <span className="dot pending"></span>Pendente
            </span>
            <span className="badge">
              <span className="dot done"></span>Realizado
            </span>
          </div>
        </section>
        <DeferredViewSection
          viewId="calendarView"
          title="Carregando calendÃ¡rio"
          detail="Montando agenda mensal e semana atual."
        >
          <>
            <CalendarWeekBoard />
            <CalendarMonthBoard />
          </>
        </DeferredViewSection>
      </section>
    </>
  );
}

function CupsView() {
  return (
    <>
      <section id="cupsView" className="view">
        <section className="summary" id="cupsSummary">
          <CupsSummary />
        </section>
        <section className="controls">
          <input
            id="cupsSearchInput"
            type="search"
            placeholder="Buscar time, fase ou confronto..."
          />
          <select id="cupsCompetitionFilter">
            <option value="all">Todas as copas</option>
            <option value="Copa da Liga">Carabao Cup</option>
            <option value="FA Cup">The Emirates FA Cup</option>
          </select>
        </section>
        <section className="legend-block">
          <p className="legend-title">Chaveamento das copas</p>
          <div className="legend">
            <span className="badge">
              <span className="dot league-cup"></span>Carabao Cup
            </span>
            <span className="badge">
              <span className="dot fa-cup"></span>The Emirates FA Cup
            </span>
            <span className="badge">
              <span className="dot promotion"></span>Classificado
            </span>
          </div>
        </section>
        <section className="cup-prize-card">
          <div className="cup-prize-copy">
            <span className="modal-kicker">PremiaÃ§Ã£o das copas</span>
            <h2>BÃ´nus por avanÃ§o de fase</h2>
            <p>
              AlÃ©m da bilheteria, cada tÃ©cnico recebe orÃ§amento extra quando seu
              time avanÃ§a nas copas.
            </p>
          </div>
          <div className="cup-prize-grid">
            <span>
              <small>Fase inicial</small>
              <strong>+â‚¬ 1M</strong>
            </span>
            <span>
              <small>Oitavas</small>
              <strong>+â‚¬ 3M</strong>
            </span>
            <span>
              <small>Quartas</small>
              <strong>+â‚¬ 5M</strong>
            </span>
            <span>
              <small>Semifinal</small>
              <strong>+â‚¬ 8M</strong>
            </span>
            <span>
              <small>CampeÃ£o</small>
              <strong>+â‚¬ 12M</strong>
            </span>
          </div>
        </section>
        <DeferredViewSection
          viewId="cupsView"
          title="Carregando copas"
          detail="Montando chaves, rodadas pendentes e classificaÃ§Ã£o."
        >
          <CupsBracket />
        </DeferredViewSection>
      </section>
    </>
  );
}

function PlayersView() {
  return (
    <>
      <section id="playersView" className="view">
        <section className="summary" id="playersSummary">
          <PlayersSummary />
        </section>
        <section className="controls">
          <input
            id="playersSearchInput"
            type="search"
            placeholder="Buscar tÃ©cnico, jogador, time, e-mail ou prÃ³ximo jogo..."
          />
          <select id="playersFilter">
            <option value="all">Todos os tÃ©cnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
        </section>
        <DeferredViewSection
          viewId="playersView"
          title="Carregando escritÃ³rio"
          detail="Buscando dados privados, DM e alertas do tÃ©cnico."
        >
          <>
            <PlayersGrid />
            <PlayerLeaderboards />
          </>
        </DeferredViewSection>
        <p className="footer-note">
          Os gols por time consideram apenas os clubes controlados por tÃ©cnicos.
          A lista ao lado mostra as cinco contrataÃ§Ãµes mais caras aprovadas atÃ©
          agora.
        </p>
      </section>
    </>
  );
}

function SquadView() {
  return (
    <>
      <section id="squadView" className="view">
        <section className="summary squad-summary" id="squadSummary">
          <SquadSummary />
        </section>
        <DeferredViewSection
          viewId="squadView"
          title="Carregando elenco"
          detail="Sincronizando formaÃ§Ã£o, folha e disponibilidade."
        >
          <SquadManagementView />
        </DeferredViewSection>
      </section>
    </>
  );
}

function EventsView() {
  return (
    <>
      <section id="eventsView" className="view">
        <section className="summary events-summary-v45" id="eventsSummary">
          <EventsSummary />
        </section>
        <section className="countdown-card events-command-card">
          <div>
            <span>Central de Eventos</span>
            <strong id="nextEventCountdown">Calculando...</strong>
            <p>
              A sala do caos da liga: dinheiro inesperado, puniÃ§Ãµes, lesÃµes,
              travas de mercado e premiaÃ§Ãµes aparecem aqui com impacto direto
              nos tÃ©cnicos.
            </p>
          </div>
          <DeferredViewSection
            viewId="eventsView"
            title="Carregando eventos"
            detail="Sincronizando slots, impactos e estado atual da rodada."
          >
            <EventSlotList />
          </DeferredViewSection>
        </section>
        <section className="controls">
          <input
            id="eventsSearchInput"
            type="search"
            placeholder="Buscar evento, jogador ou efeito..."
          />
          <select id="eventsOwnerFilter">
            <option value="all">Todos os tÃ©cnicos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
          <select id="eventsTypeFilter">
            <option value="all">Todos os tipos</option>
            <option value="positive">Positivos</option>
            <option value="negative">Negativos</option>
            <option value="neutral">Neutros / mercado</option>
          </select>
          <select id="eventsPeriodFilter" defaultValue="latest">
            <option value="latest">Ãšltima rodada</option>
            <option value="active">Ativos / em duraÃ§Ã£o</option>
            <option value="today">Todos de hoje</option>
            <option value="last12">Ãšltimos 12</option>
            <option value="all">HistÃ³rico completo</option>
          </select>
        </section>
        <section className="form-card events-intro-card">
          <div>
            <h2>Radar da Liga</h2>
            <p>
              Por padrÃ£o, exibimos a Ãºltima rodada para manter a tela leve. Use
              os filtros para investigar histÃ³rico, lesÃµes ativas, puniÃ§Ãµes de
              mercado, premiaÃ§Ãµes e impactos financeiros.
            </p>
          </div>
          <div className="event-legend-pills">
            <span>Caixa</span>
            <span>DM</span>
            <span>Mercado</span>
            <span>Copas</span>
            <span>Punições</span>
          </div>
          <span className="app-message" id="eventsMessage"></span>
        </section>
        <DeferredViewSection
          viewId="eventsView"
          title="Carregando eventos"
          detail="Organizando histÃ³rico, filtros e eventos ativos."
        >
          <EventsGrid />
        </DeferredViewSection>
        <p className="footer-note">
          Central de eventos: impactos financeiros, mercado, lesÃµes, puniÃ§Ãµes e
          premiaÃ§Ãµes ficam consolidados por tÃ©cnico com status e efeitos
          atualizados.
        </p>
      </section>
    </>
  );
}

function ExperienceView() {
  return (
    <>
      <section id="experienceView" className="view">
        <section className="summary" id="experienceSummary">
          <ExperienceSummary />
        </section>
        <section className="submit-hero experience-hero">
          <div>
            <span className="modal-kicker">Sala de anÃ¡lise</span>
            <h2>Central de InteligÃªncia</h2>
            <p>
              DiagnÃ³stico operacional da liga: aÃ§Ãµes urgentes, risco financeiro,
              rodada de impacto e postura recomendada para cada tÃ©cnico.
            </p>
          </div>
          <div className="submit-hero-actions">
            <a href="#intelligenceQueue">Fila de aÃ§Ã£o</a>
            <a href="#intelligencePower">Power index</a>
            <a href="#intelligenceMarket">Mercado</a>
          </div>
        </section>
        <DeferredViewSection
          viewId="experienceView"
          title="Carregando inteligÃªncia"
          detail="Preparando painÃ©is de risco, mercado e operaÃ§Ã£o."
        >
          <ExperienceGrid />
        </DeferredViewSection>
      </section>
    </>
  );
}

function TransfersView() {
  return (
    <>
      <section id="transfersView" className="view">
        <DeferredViewSection
          viewId="transfersView"
          title="Carregando mercado"
          detail="Sincronizando negociaÃ§Ãµes, scouting e diagnÃ³stico financeiro."
        >
          <TransfersRuntime />
        </DeferredViewSection>
        <DeferredViewSection
          viewId="transfersView"
          title="Carregando mercado inteligente"
          detail="Preparando filtros virtuais, kanban e assistente de proposta."
        >
          <AdvancedTransferTools />
        </DeferredViewSection>
        <section className="summary" id="transferSummary">
          <TransfersSummary />
        </section>
        <section className="countdown-card">
          <span>Janela de transferÃªncias</span>
          <strong id="nextTransferCountdown">Calculando...</strong>
          <p>
            O limite diário reinicia à meia-noite. Eventos podem aumentar ou
            reduzir o limite do dia.
          </p>
        </section>

        <section className="transfer-lock-card" aria-live="polite">
          <span className="modal-kicker">Mercado travado</span>
          <h2>Janela de transferÃªncias fechada</h2>
          <p>
            As contrataÃ§Ãµes ficam bloqueadas atÃ© a liga considerar o app pronto.
            HistÃ³rico e orÃ§amento seguem visÃ­veis para conferÃªncia.
          </p>
        </section>

        <section
          className="transfer-budget-board"
          id="transferBudgetBoard"
        ></section>

        <section className="transfer-ops-board" id="transferOpsBoard"></section>

        <section className="transfer-workbench">
          <section className="form-card submit-card submit-card-transfer">
            <div className="submit-card-header">
              <span className="submit-card-icon">â‡„</span>
              <div>
                <h2>Abrir negociaÃ§Ã£o</h2>
                <p>
                  Mercado externo, propostas entre tÃ©cnicos e troca de jogador
                  no mesmo fluxo.
                </p>
              </div>
            </div>
            <form id="transferForm" noValidate>
              <div className="form-grid">
                <div
                  className="submit-mode-switch full"
                  aria-label="Tipo de transferÃªncia"
                >
                  <label>
                    <input
                      name="transferType"
                      type="radio"
                      value="market"
                      defaultChecked
                    />
                    <span>Mercado externo</span>
                  </label>
                  <label>
                    <input name="transferType" type="radio" value="internal" />
                    <span>Entre tÃ©cnicos</span>
                  </label>
                </div>
                <label>
                  Comprador
                  <select name="buyer" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label
                  className="internal-transfer-field"
                  data-internal-transfer-field
                  hidden
                >
                  Vendedor
                  <select name="seller">
                    <option value="">Selecione o vendedor</option>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label
                  className="internal-transfer-field full"
                  data-internal-transfer-field
                  hidden
                >
                  Jogador do vendedor
                  <select id="internalTransferPlayer" name="internalPlayer">
                    <option value="">Escolha vendedor e jogador</option>
                  </select>
                </label>
                <label className="full" data-market-transfer-field>
                  Buscar jogador no mercado
                  <input
                    id="marketPlayerSearch"
                    type="search"
                    placeholder="Digite nome, clube, liga ou posiÃ§Ã£o..."
                    autoComplete="off"
                  />
                </label>
                <div
                  className="market-player-toolbar full"
                  data-market-transfer-field
                >
                  <span>
                    Por padrÃ£o, jogadores jÃ¡ contratados ficam escondidos.
                  </span>
                  <label className="market-toggle">
                    <input id="showContractedPlayers" type="checkbox" />
                    <span>Mostrar jÃ¡ contratados</span>
                  </label>
                </div>
                <div
                  className="market-player-results full"
                  id="marketPlayerResults"
                  data-market-transfer-field
                >
                  <div className="market-empty">
                    Digite o nome, clube, liga ou posiÃ§Ã£o para buscar jogadores.
                  </div>
                </div>
                <div
                  className="transfer-exchange-box full"
                  data-market-transfer-field
                >
                  <div className="transfer-exchange-copy">
                    <span>Troca na negociaÃ§Ã£o</span>
                    <strong>Jogador + dinheiro</strong>
                    <small id="transferExchangeHint">
                      Opcional. O abatimento aparece na prÃ©via antes do envio.
                    </small>
                  </div>
                  <label className="transfer-exchange-control">
                    <span>Jogador oferecido</span>
                    <select id="transferExchangePlayer" name="exchangePlayer">
                      <option value="">Sem jogador na troca</option>
                    </select>
                  </label>
                </div>
                <label>
                  Jogador
                  <input
                    name="player"
                    type="text"
                    placeholder="Nome do jogador"
                    required
                  />
                </label>
                <label>
                  Clube origem
                  <input
                    name="fromClub"
                    type="text"
                    placeholder="Clube atual"
                    required
                  />
                </label>
                <label>
                  Overall EAFC
                  <input
                    name="overall"
                    type="number"
                    min="1"
                    max="99"
                    placeholder="Ex: 82"
                    required
                  />
                </label>
                <label className="full">
                  <span id="transferValueLabel">Referencia de mercado</span>
                  <input
                    name="marketValue"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="Ex: 32000000"
                    required
                  />
                </label>
                <div
                  className="market-offer-field transfer-offer-composer full"
                  data-market-transfer-field
                  data-offer-composer
                >
                  <div className="offer-composer-head">
                    <div>
                      <span>Oferta ao clube</span>
                      <strong id="transferOfferStrategy">
                        Defina a abertura da mesa
                      </strong>
                    </div>
                    <small id="transferOfferReference">
                      Selecione um jogador para carregar a referÃªncia.
                    </small>
                  </div>
                  <div className="offer-value-row">
                    <label className="offer-input-shell">
                      <span>Valor ofertado</span>
                      <div className="currency-input-shell">
                        <b>â‚¬</b>
                        <input
                          name="offerValue"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="1.800.000"
                          aria-describedby="transferOfferGuidance"
                        />
                      </div>
                    </label>
                    <div
                      className="offer-guidance-strip"
                      id="transferOfferGuidance"
                    >
                      <span id="transferOfferGuidanceText">
                        A oferta inicial pode ficar abaixo ou acima da
                        referÃªncia.
                      </span>
                      <div
                        className="offer-strength-meter"
                        aria-hidden="true"
                      >
                        <i id="transferOfferStrength"></i>
                      </div>
                    </div>
                  </div>
                  <div className="offer-quick-actions">
                    <button type="button" data-offer-multiplier="0.9">
                      <strong>90%</strong>
                      <span>Testar baixo</span>
                    </button>
                    <button type="button" data-offer-multiplier="1">
                      <strong>100%</strong>
                      <span>Valor base</span>
                    </button>
                    <button type="button" data-offer-multiplier="1.1">
                      <strong>110%</strong>
                      <span>Competitivo</span>
                    </button>
                    <button type="button" data-offer-multiplier="1.25">
                      <strong>125%</strong>
                      <span>Fechar rÃ¡pido</span>
                    </button>
                  </div>
                </div>
                <label
                  className="transfer-salary-field"
                  data-market-transfer-field
                >
                  <span>Salario semanal de folha</span>
                  <input
                    name="weeklySalary"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    placeholder="Auto: Capology ou SalarySport"
                  />
                </label>
                <input type="hidden" name="salarySourceName" value="" />
                <input type="hidden" name="salarySourceUrl" value="" />
              </div>

              <div className="transfer-live-preview" id="transferFormPreview">
                <strong>PrÃ©via da contrataÃ§Ã£o</strong>
                <span>
                  Preencha comprador, jogador, overall e valor para calcular
                  custo final, folha e travas antes de enviar.
                </span>
              </div>

              <label className="checkbox-row transfer-confirmation-row">
                <input
                  name="confirmTransferBuyer"
                  type="checkbox"
                  value="yes"
                  required
                />
                <span>
                  Confirmo que o comprador selecionado estÃ¡ correto para esta
                  negociaÃ§Ã£o.
                </span>
              </label>

              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Enviar proposta
                </button>
                <span className="app-message" id="transferMessage"></span>
              </div>
            </form>
          </section>

          <aside className="transfer-command-stack">
            <section
              className="coach-panel-card transfer-deal-card"
              id="transferDealCenter"
            ></section>
            <section
              className="coach-panel-card transfer-scout-card"
              id="transferScoutBoard"
            ></section>
            <section
              className="coach-panel-card transfer-shortlist-card"
              id="transferShortlistBoard"
            ></section>
          </aside>
        </section>

        <section
          className="transfer-compare-board coach-panel-card"
          id="transferCompareBoard"
        ></section>

        <section
          className="transfer-negotiation-hub"
          id="transferNegotiationHub"
        ></section>

        <section className="controls">
          <input
            id="transferSearchInput"
            type="search"
            placeholder="Buscar jogador, tÃ©cnico, destino ou clube..."
          />
          <select id="transferOwnerFilter">
            <option value="all">Todos os tÃ©cnicos/destinos</option>
            <option value="Henrique">Henrique</option>
            <option value="Willian">Willian</option>
            <option value="Rafael">Rafael</option>
            <option value="Renato">Renato</option>
            <option value="Bruno Silva">Bruno Silva</option>
          </select>
          <select id="transferStatusFilter">
            <option value="all">Todos os status</option>
            <option value="valid">VÃ¡lidas</option>
            <option value="sale">Vendas CPU</option>
            <option value="duplicate">Duplicadas</option>
          </select>
        </section>
        <section className="transfer-insights" id="transferInsights"></section>

        <section className="rule-card">
          <h2>Regras de transferÃªncia</h2>
          <ul>
            <li>
              OrÃ§amento base por jogador: <strong>22 milhÃµes</strong>.
            </li>
            <li>
              Receita semanal: <strong>+2M</strong> por semana ativa da
              temporada.
            </li>
            <li>
              BÃ´nus por mando: <strong>+400k</strong> por partida em casa.
            </li>
            <li>
              BÃ´nus por vitÃ³ria: <strong>+250k</strong> por vitÃ³ria.
            </li>
            <li>
              BÃ´nus de campanha: blocos de 5 jogos rendem atÃ©
              <strong>+5M</strong> conforme pontuaÃ§Ã£o.
            </li>
            <li>Eventos financeiros podem aumentar ou reduzir o orÃ§amento.</li>
            <li>Copas geram premiaÃ§Ã£o automÃ¡tica por avanÃ§o de fase.</li>
            <li>
              Limite base: <strong>3 transferÃªncias por dia</strong>. Eventos
              podem alterar esse limite.
            </li>
              <li>Proposta inicial = referencia de mercado + percentual por overall.</li>
            <li>
              Salario do jogador: somente com referencia publica. Nao usamos
              overall para estimar folha.
            </li>
          </ul>
        </section>
        <section className="table-wrapper transfer-history-shell">
          <div className="transfer-history-grid transfer-history-grid-head" aria-hidden="true">
            <span>Jogador</span>
            <span>Destino</span>
            <span>Origem</span>
            <span>OVR</span>
            <span>Base/Oferta</span>
            <span>% Overall</span>
            <span>Valor</span>
            <span>Status</span>
          </div>
          <div id="transferTable" className="transfer-history-grid-body"></div>
        </section>
        <section className="mobile-list" id="transferMobile"></section>
        <p className="footer-note">
          Mostrando apenas as 5 movimentaÃ§Ãµes aprovadas mais recentes.
        </p>
      </section>
    </>
  );
}

function CommissionerView() {
  return (
    <>
      <section id="commissionerView" className="view">
        <DeferredViewSection
          viewId="commissionerView"
          title="Carregando governanÃ§a"
          detail="Preparando auditoria, aÃ§Ãµes mÃ©dicas e controles da liga."
        >
          <CommissionerRuntime />
        </DeferredViewSection>
        <section
          className="summary commissioner-summary"
          id="commissionerSummary"
        >
          <CommissionerSummary />
        </section>
        <section className="submit-hero commissioner-hero">
          <div>
            <span className="modal-kicker">GovernanÃ§a da liga</span>
            <h2>Mesa do comissÃ¡rio</h2>
            <p>
              LeilÃµes, centro mÃ©dico, fair play, fechamento semanal e aÃ§Ãµes
              especiais para manter a temporada divertida e controlada.
            </p>
          </div>
          <div className="submit-hero-actions">
            <a href="#commissionerAuctions">LeilÃµes</a>
            <a href="#commissionerMedical">Centro mÃ©dico</a>
            <a href="#commissionerWeekly">Semana</a>
          </div>
        </section>
        <section className="commissioner-grid" id="commissionerGrid"></section>
        <span className="app-message" id="commissionerMessage"></span>
      </section>
    </>
  );
}

function SubmitView() {
  return (
    <>
      <section id="submitView" className="view">
        <section className="submit-hero">
          <div>
            <span className="modal-kicker">Central de lanÃ§amentos</span>
            <h2>Enviar dados da liga</h2>
            <p>
              Resultados oficiais e simulaÃ§Ãµes CPU x CPU em uma tela mais
              direta.
            </p>
          </div>
          <div className="submit-hero-actions">
            <a href="#resultForm">Resultado</a>
            <a href="#cpuSimulationForm">CPU x CPU</a>
          </div>
        </section>

        <section className="submit-form-grid">
          <section className="form-card submit-card submit-card-result">
            <div className="submit-card-header">
              <span className="submit-card-icon">â–¦</span>
              <div>
                <h2>Enviar resultado</h2>
                <p>
                  Registre placares. Em jogos de copa empatados, informe o
                  vencedor nos pÃªnaltis.
                </p>
              </div>
            </div>
            <form id="resultForm">
              <div className="form-grid">
                <label>
                  CompetiÃ§Ã£o
                  <select name="competition" required>
                    <option value="Championship">Championship</option>
                    <option value="Copa da Liga">Carabao Cup</option>
                    <option value="FA Cup">The Emirates FA Cup</option>
                  </select>
                </label>
                <label>
                  Semana
                  <input
                    name="week"
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    required
                  />
                </label>
                <label>
                  Rodada/Fase
                  <input
                    name="phase"
                    type="text"
                    placeholder="Ex: Rodada 1"
                    required
                  />
                </label>
                <label>
                  Enviado por
                  <select name="submittedBy" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
                <label>
                  Mandante
                  <input
                    name="home"
                    list="teamOptions"
                    type="text"
                    placeholder="Ex: Coventry City"
                    required
                  />
                </label>
                <label>
                  Visitante
                  <input
                    name="away"
                    list="teamOptions"
                    type="text"
                    placeholder="Ex: Birmingham City"
                    required
                  />
                </label>
                <label>
                  Gols mandante
                  <input name="homeScore" type="number" min="0" required />
                </label>
                <label>
                  Gols visitante
                  <input name="awayScore" type="number" min="0" required />
                </label>
                <div
                  className="penalty-section full"
                  data-penalty-section
                  hidden
                >
                  <label className="checkbox-row">
                    <input name="hasPenalties" type="checkbox" value="yes" />
                    <span>Houve disputa de pÃªnaltis?</span>
                  </label>
                  <div className="penalty-fields" data-penalty-fields hidden>
                    <label>
                      Vencedor nos pÃªnaltis
                      <input
                        name="penaltyWinner"
                        list="teamOptions"
                        type="text"
                        placeholder="Ex: Middlesbrough"
                      />
                    </label>
                    <label>
                      Placar dos pÃªnaltis
                      <input
                        name="penaltyScore"
                        type="text"
                        placeholder="Ex: 4 x 3"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Enviar resultado
                </button>
                <span className="app-message" id="resultMessage"></span>
              </div>
            </form>
          </section>

          <section className="form-card submit-card submit-card-cpu">
            <div className="submit-card-header">
              <span className="submit-card-icon">â˜</span>
              <div>
                <h2>Simular CPU x CPU da semana</h2>
                <p>
                  Confira a auditoria oficial e simule apenas confrontos CPU x
                  CPU pendentes.
                </p>
              </div>
            </div>
            <form id="cpuSimulationForm">
              <div className="form-grid">
                <label>
                  Semana
                  <input
                    name="week"
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    required
                  />
                </label>
                <label>
                  Enviado por
                  <select name="submittedBy" required>
                    <option value="Henrique">Henrique</option>
                    <option value="Willian">Willian</option>
                    <option value="Rafael">Rafael</option>
                    <option value="Renato">Renato</option>
                    <option value="Bruno Silva">Bruno Silva</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Simular semana
                </button>
                <span className="app-message" id="cpuSimulationMessage"></span>
              </div>
              <div className="simulation-preview" id="cpuSimulationPreview">
                <div className="sim-preview-empty">
                  Informe ou selecione uma semana para carregar a auditoria CPU
                  x CPU.
                </div>
              </div>
            </form>
          </section>
        </section>
        <datalist id="teamOptions"></datalist>
      </section>
    </>
  );
}

function CalendarResultModal() {
  return (
    <>
      <section
        className="result-modal"
        id="calendarResultModal"
        aria-hidden="true"
      >
        <div className="result-modal-backdrop" data-close-result-modal></div>
        <article
          className="result-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendarResultModalTitle"
        >
          <button
            className="result-modal-close"
            type="button"
            data-close-result-modal
          >
            Ã—
          </button>
          <div className="result-modal-header">
            <span className="modal-kicker">
              Enviar resultado pelo calendÃ¡rio
            </span>
            <h2 id="calendarResultModalTitle">Resultado da partida</h2>
            <p id="calendarResultModalSubtitle">
              Preencha o placar para atualizar a liga.
            </p>
          </div>

          <form id="calendarResultForm">
            <input type="hidden" name="competition" />
            <input type="hidden" name="week" />
            <input type="hidden" name="phase" />
            <input type="hidden" name="home" />
            <input type="hidden" name="away" />

            <div
              className="modal-match-preview"
              id="calendarResultMatchPreview"
            ></div>

            <div className="form-grid">
              <label>
                Gols mandante
                <input name="homeScore" type="number" min="0" required />
              </label>
              <label>
                Gols visitante
                <input name="awayScore" type="number" min="0" required />
              </label>
              <label>
                Enviado por
                <select name="submittedBy" required>
                  <option value="Henrique">Henrique</option>
                  <option value="Willian">Willian</option>
                  <option value="Rafael">Rafael</option>
                  <option value="Renato">Renato</option>
                  <option value="Bruno Silva">Bruno Silva</option>
                </select>
              </label>

              <div className="penalty-section full" data-penalty-section hidden>
                <label className="checkbox-row">
                  <input name="hasPenalties" type="checkbox" value="yes" />
                  <span>Houve disputa de pÃªnaltis?</span>
                </label>
                <div className="penalty-fields" data-penalty-fields hidden>
                  <label>
                    Vencedor nos pÃªnaltis
                    <input
                      name="penaltyWinner"
                      list="teamOptions"
                      type="text"
                      placeholder="Ex: Middlesbrough"
                    />
                  </label>
                  <label>
                    Placar dos pÃªnaltis
                    <input
                      name="penaltyScore"
                      type="text"
                      placeholder="Ex: 4 x 3"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                Salvar resultado
              </button>
              <span className="app-message" id="calendarResultMessage"></span>
            </div>
          </form>
        </article>
      </section>
    </>
  );
}

export function StaticShell({ activePath = "/league/standings" }) {
  const activeRoute = getWorkspaceRouteByPath(activePath);

  return (
    <>
      <GlobalLoader />
      <main className="app">
        <ShellChrome activeRoute={activeRoute} />
        <StandingsView />
        <CalendarView />
        <CupsView />
        <PlayersView />
        <SquadView />
        <EventsView />
        <ExperienceView />
        <TransfersView />
        <CommissionerView />
        <SubmitView />
        <CalendarResultModal />
      </main>
    </>
  );
}

export default StaticShell;

