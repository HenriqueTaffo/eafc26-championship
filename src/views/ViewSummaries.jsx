import { useSyncExternalStore } from "react";
import App from "../../js/app.js";

export function useAppRuntime() {
  return useSyncExternalStore(
    App.react.subscribe,
    App.react.getSnapshot,
    App.react.getSnapshot,
  );
}

function SummaryCard({ label, value, detail = "", className = "" }) {
  return (
    <article className={["summary-card", className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function MetricCard({ icon, label, value, detail = "", className = "" }) {
  return (
    <article
      className={["summary-card", "home-metric", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}

function SafeSummary({ children, fallbackLabel = "Dados" }) {
  try {
    return children();
  } catch (error) {
    console.warn("Resumo React indisponível:", error);
    return <SummaryCard label={fallbackLabel} value="Revisar dados" />;
  }
}

export function StandingsSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Classificação">
      {() => {
        if (!App.state?.apiLoaded) {
          return (
            <>
              <SummaryCard
                label="Liga"
                value="Sincronizando"
                detail="Buscando jogos aprovados"
              />
              <SummaryCard
                label="Classificação"
                value="Aguarde"
                detail="Calculando tabela"
              />
              <SummaryCard
                label="Mercado"
                value="Aguarde"
                detail="Carregando orçamentos"
              />
              <SummaryCard
                label="Times"
                value={App.data?.teams?.length || 0}
                detail="Na competição"
              />
            </>
          );
        }

        const standings = App.standings.getStandings();
        const leader = standings[0];
        const bestCoach = standings.find((team) => team.status === "Nosso");
        const played = App.standings
          .getApprovedApiResults()
          .filter(
            (row) => App.utils.normalizeText(row.Competicao) === "championship",
          ).length;

        return (
          <>
            <MetricCard
              className="leader-metric"
              icon="♜"
              label="Líder"
              value={leader?.team || "-"}
              detail={leader ? `${leader.points} pts` : ""}
            />
            <MetricCard
              icon="●"
              label="Melhor técnico"
              value={
                bestCoach ? `${bestCoach.owner} (${bestCoach.position}º)` : "-"
              }
              detail={bestCoach ? `${bestCoach.points} pts` : ""}
            />
            <MetricCard
              icon="✓"
              label="Jogos aprovados"
              value={played}
              detail="Esta temporada"
            />
            <MetricCard
              icon="♟"
              label="Times"
              value={standings.length}
              detail="Na competição"
            />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function CalendarSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Calendário">
      {() => {
        const events = App.calendar.getCurrentMonthEvents(
          App.calendar.getSessionScopedEvents(),
        );
        const pendingTech = events.filter(
          (event) =>
            App.calendar.involvesOurTeam(event) &&
            App.calendar.getStatusClass(event) === "pending",
        ).length;
        const done = events.filter(
          (event) => App.calendar.getStatusClass(event) === "done",
        ).length;

        return (
          <>
            <SummaryCard
              label="Início"
              value={App.calendar.getCalendarStartDateLabel()}
            />
            <SummaryCard label="Jogos no mês" value={events.length} />
            <SummaryCard label="Realizados" value={done} />
            <SummaryCard label="Técnicos pendentes" value={pendingTech} />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function CupsSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Copas">
      {() => {
        const cupEvents = App.calendar
          .getCalendarEvents()
          .filter((event) => event.competition !== "Championship");
        const finished = cupEvents.filter(
          (event) => App.calendar.getStatusClass(event) === "done",
        ).length;
        const pending = cupEvents.filter(
          (event) => event.status === "Pendente",
        ).length;
        const waiting = cupEvents.filter((event) =>
          String(event.status || "").includes("Aguardando"),
        ).length;

        return (
          <>
            <SummaryCard label="Jogos de copa" value={cupEvents.length} />
            <SummaryCard label="Finalizados" value={finished} />
            <SummaryCard label="Pendentes" value={pending} />
            <SummaryCard label="Aguardando chave" value={waiting} />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function PlayersSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Escritório">
      {() => {
        if (!App.state?.apiLoaded) {
          return (
            <>
              <SummaryCard
                label="Técnicos"
                value={
                  (App.data?.teams || []).filter(
                    (team) => team.status === "Nosso",
                  ).length
                }
              />
              <SummaryCard
                label="Dados"
                value="Sincronizando"
                detail="Buscando campanha e orçamento"
              />
              <SummaryCard
                label="Transferências"
                value="Aguarde"
                detail="Carregando mercado"
              />
              <SummaryCard
                label="Alertas"
                value="Aguarde"
                detail="Calculando escritório"
              />
            </>
          );
        }

        const standings = App.standings.getStandings();
        const budgetInfo = App.transfers.getBudgetInfoByBuyer();
        const ranking = App.players.getCoachRanking();
        const teams = App.players.getPlayerTeams();
        const totalTransfers = App.transfers
          .getTransfersWithStats()
          .filter((item) => !item.isBlockedDuplicate).length;
        const totalAlerts = teams.reduce((sum, team) => {
          const standing = standings.find((item) =>
            App.utils.sameTeamName(item.team, team.team),
          );
          const budget = budgetInfo[team.owner] || {};
          const next = App.players.getNextMatchForTeam(team.team);
          const todayCount = App.transfers.getTodayTransferCountByBuyer(
            team.owner,
          );
          const canViewPrivate = App.auth?.canViewManagerPrivate
            ? App.auth.canViewManagerPrivate(team.owner)
            : false;
          return (
            sum +
            App.players.getCoachAlerts(
              team,
              standing,
              budget,
              next,
              todayCount,
              canViewPrivate,
            ).length
          );
        }, 0);

        return (
          <>
            <SummaryCard label="Técnicos" value={teams.length} />
            <SummaryCard
              label="Líder entre técnicos"
              value={ranking[0]?.team.owner || "-"}
            />
            <SummaryCard label="Transferências" value={totalTransfers} />
            <SummaryCard label="Alertas ativos" value={totalAlerts} />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function SquadSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Elenco">
      {() => {
        const data = App.state?.apiSquadManagement || {};
        const rosters = data.rosters || {};
        const managers = Array.isArray(data.managers) ? data.managers : [];
        const finance = Array.isArray(data.finance) ? data.finance : [];
        const session = App.auth?.getSession ? App.auth.getSession() : null;
        const isCommissioner = App.auth?.isCommissioner?.() === true;
        const sessionKey = App.utils.normalizeText(session?.managerName || "");
        const scopedManagers = isCommissioner
          ? managers
          : managers.filter(
              (manager) =>
                App.utils.normalizeText(manager.managerName) === sessionKey,
            );
        const scopedManagerNames = scopedManagers.map(
          (manager) => manager.managerName,
        );
        const rosterRows = scopedManagerNames.flatMap(
          (managerName) => rosters[managerName] || [],
        );
        const scopedFinance = isCommissioner
          ? finance
          : finance.filter(
              (item) =>
                App.utils.normalizeText(
                  item.manager_name || item.managerName,
                ) === sessionKey,
            );
        const totalWeekly = scopedFinance.reduce(
          (sum, item) => sum + Number(item.payroll_weekly || 0),
          0,
        );
        const avgOverall = rosterRows.length
          ? Math.round(
              rosterRows.reduce(
                (sum, player) => sum + Number(player.overall || 0),
                0,
              ) / rosterRows.length,
            )
          : 0;
        const savedLineups = Object.values(data.lineups || {}).filter(
          (item) =>
            (isCommissioner ||
              App.utils.normalizeText(item?.managerName) === sessionKey) &&
            Object.keys(item?.lineup || {}).length,
        ).length;
        const scopeDetail = isCommissioner ? "somando clubes" : "seu clube";

        return (
          <>
            <SummaryCard
              label={isCommissioner ? "Clubes" : "Clube"}
              value={scopedManagers.length || "-"}
            />
            <SummaryCard label="Jogadores" value={rosterRows.length || "-"} />
            <SummaryCard
              label="OVR medio"
              value={avgOverall || "-"}
              detail={isCommissioner ? "elencos EA FC 26" : "elenco EA FC 26"}
            />
            <SummaryCard
              label="Folha semanal"
              value={totalWeekly ? App.utils.formatCurrency(totalWeekly) : "-"}
              detail={scopeDetail}
            />
            <SummaryCard label="Escalacoes salvas" value={savedLineups} />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function EventsSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Eventos">
      {() => {
        const todayText = new Date().toLocaleDateString("pt-BR");
        const dynamicEvents = (App.state?.apiEvents || []).filter(
          (event) => !App.events.isCupPrizeEvent(event),
        );
        const todayEvents = dynamicEvents.filter(
          (event) =>
            App.events.formatEventDate(event.Data || event.Timestamp) ===
            todayText,
        );
        const automaticTodayEvents = todayEvents.filter((event) => {
          const hour = Number(App.events.getEventDateTime(event).getHours());
          return (App.config.eventSlots || []).map(Number).includes(hour);
        });
        const activeEvents = dynamicEvents.filter((event) =>
          App.events.isActiveOrDurationEvent(event),
        );
        const totalImpact = (App.state?.apiEvents || []).reduce(
          (sum, event) => sum + Number(event.ImpactoFinanceiro || 0),
          0,
        );
        const slots = (App.config.eventSlots || []).map(Number);
        const lastSlot = slots.length ? Math.max(...slots) : 0;
        const pendingSlots = Math.max(
          0,
          slots.length * App.utils.getHumanBuyers().length -
            automaticTodayEvents.length,
        );

        return (
          <>
            <SummaryCard
              className="event-summary-main"
              label="Automáticos hoje"
              value={automaticTodayEvents.length}
              detail="eventos com slot da liga"
            />
            <SummaryCard
              label="Ativos agora"
              value={activeEvents.length}
              detail="lesões, mercado ou duração"
            />
            <SummaryCard
              label="Impacto líquido"
              value={App.utils.formatCurrency(totalImpact)}
              detail="somando histórico carregado"
            />
            <SummaryCard
              label="Slots restantes"
              value={pendingSlots}
              detail={
                lastSlot ? `até ${String(lastSlot).padStart(2, "0")}h` : ""
              }
            />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function ExperienceSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Inteligência">
      {() => {
        const profiles = App.experience.getCoachProfiles();
        const health = App.experience.getLeagueHealth(profiles);

        return (
          <>
            <SummaryCard label="Ações abertas" value={health.queue.length} />
            <SummaryCard label="Técnicos críticos" value={health.critical} />
            <SummaryCard label="Placar pendente" value={health.pendingHuman} />
            <SummaryCard
              label="Índice médio"
              value={`${health.avgScore}/100`}
            />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function TransfersSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Transferências">
      {() => {
        const data = App.transfers.getValidTransfers();
        const purchases = data.filter(
          (item) => !App.transfers.isCpuSaleTransfer(item),
        );
        const cpuSales = data.filter((item) =>
          App.transfers.isCpuSaleTransfer(item),
        );
        const recent = App.transfers.getRecentTransferMovements(1)[0];
        const totalMoved = data.reduce(
          (sum, item) => sum + Number(item.totalCost || 0),
          0,
        );
        const biggest = purchases.reduce(
          (best, item) =>
            Number(item.totalCost || 0) > Number(best?.totalCost || 0)
              ? item
              : best,
          purchases[0],
        );
        const buyersActive = new Set(purchases.map((item) => item.buyer)).size;
        const recentLabel =
          recent && App.transfers.isCpuSaleTransfer(recent)
            ? `${recent.player} (venda externa)`
            : recent?.player;

        return (
          <>
            <SummaryCard
              label="Contratações válidas"
              value={purchases.length}
            />
            <SummaryCard
              label="Total movimentado"
              value={App.utils.formatCurrency(totalMoved)}
            />
            <SummaryCard
              label="Maior compra"
              value={
                biggest ? App.utils.formatCurrency(biggest.totalCost) : "-"
              }
            />
            <SummaryCard label="Vendas externas" value={cpuSales.length} />
            <SummaryCard label="Compradores ativos" value={buyersActive} />
            <SummaryCard
              label="Última movimentação"
              value={recentLabel || "-"}
            />
          </>
        );
      }}
    </SafeSummary>
  );
}

export function CommissionerSummary() {
  useAppRuntime();

  return (
    <SafeSummary fallbackLabel="Comissário">
      {() => {
        const phase = App.governance.getMarketPhase();
        const injuries = App.governance.getActiveInjuries();
        const auctions = App.state?.apiGovernance?.auctions || [];
        const fairPlay = App.transfers.getFairPlayWatchlist();
        const audit = App.governance.getIntegrityAudit();

        return (
          <>
            <SummaryCard
              label="Fase do mercado"
              value={phase.name}
              detail={phase.detail}
            />
            <SummaryCard label="Lesões ativas" value={injuries.length} />
            <SummaryCard
              label="Leilões abertos"
              value={auctions.filter((item) => item.status === "open").length}
            />
            <SummaryCard
              label="Fair play"
              value={fairPlay.length ? `${fairPlay.length} alerta(s)` : "OK"}
            />
            <SummaryCard
              label="Integridade"
              value={`${audit.score}%`}
              detail={
                audit.issues.length
                  ? `${audit.issues.length} ponto(s) para revisar`
                  : "Liga sincronizada"
              }
            />
          </>
        );
      }}
    </SafeSummary>
  );
}
