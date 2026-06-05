import { useMemo } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  Inbox,
  ShieldAlert,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { createEvents } from "ics";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";
import { useLeagueUiStore } from "../state/useLeagueUiStore.js";

function formatMoney(value = 0) {
  return App.utils?.formatCurrency?.(Number(value || 0)) || `EUR ${value}`;
}

function normalizeText(value = "") {
  return App.utils?.normalizeText?.(value) || String(value || "").toLowerCase();
}

function getSession() {
  return App.auth?.getSession?.() || null;
}

function isCommissionerSession(session = getSession()) {
  return Boolean(session?.isCommissioner || App.auth?.isCommissioner?.());
}

function getManagerName(session = getSession()) {
  return session?.managerName || "";
}

function getManagerFinance(managerName = "") {
  if (!managerName || !App.transfers?.getBudgetInfoByBuyer) return null;
  return App.transfers.getBudgetInfoByBuyer()?.[managerName] || null;
}

function getOpenTransferProposals() {
  const proposals = Array.isArray(App.auth?.myTransferProposals)
    ? App.auth.myTransferProposals
    : [];
  return proposals.filter((item) => App.auth?.isOpenTransferProposal?.(item));
}

function getPendingDecisions() {
  return Array.isArray(App.auth?.myDecisions)
    ? App.auth.myDecisions.filter((item) => item.status === "pending")
    : [];
}

function getSponsorshipOffers(managerName = "") {
  return App.auth?.getSponsorshipInboxOffers?.(managerName) || [];
}

function getRoster(managerName = "") {
  const rosters = App.state?.apiSquadManagement?.rosters || {};
  return Array.isArray(rosters[managerName]) ? rosters[managerName] : [];
}

function getActiveMedicalCases(managerName = "") {
  return App.players?.getActiveInjuriesForCoach?.(managerName) || [];
}

function getMyUpcomingMatches(managerName = "") {
  const teams = App.data?.teams || [];
  const myTeams = teams
    .filter((team) => normalizeText(team.owner) === normalizeText(managerName))
    .map((team) => normalizeText(team.name));
  if (!myTeams.length) return [];

  const matches = App.calendar?.getAllMatches?.() || [];
  return matches
    .filter((match) => {
      const status = normalizeText(match.Status || match.status || "");
      if (status.includes("aprov") || status.includes("done")) return false;
      const home = normalizeText(match.Mandante || match.home || "");
      const away = normalizeText(match.Visitante || match.away || "");
      return myTeams.includes(home) || myTeams.includes(away);
    })
    .slice(0, 3);
}

function getLeaguePendingMatches() {
  const matches = App.calendar?.getAllMatches?.() || [];
  return matches.filter((match) => {
    const status = normalizeText(match.Status || match.status || "");
    return !status.includes("aprov") && !status.includes("done");
  });
}

function getMatchDate(match = {}) {
  const candidates = [
    match.DataISO,
    match.data_iso,
    match.date,
    match.Data,
    match.Timestamp,
    match.timestamp,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function exportMatchesToIcs(matches = [], notify = () => {}) {
  const events = matches
    .map((match) => {
      const date = getMatchDate(match);
      if (!date) return null;
      return {
        title: `${match.Mandante || match.home || "Mandante"} x ${
          match.Visitante || match.away || "Visitante"
        }`,
        description: [
          match.Competicao || match.competition || "",
          match.Rodada || match.week ? `Rodada ${match.Rodada || match.week}` : "",
        ]
          .filter(Boolean)
          .join(" - "),
        start: [
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate(),
          date.getHours() || 20,
          date.getMinutes() || 0,
        ],
        duration: { hours: 2 },
      };
    })
    .filter(Boolean);

  if (!events.length) {
    notify({
      title: "Agenda vazia",
      description: "Nenhum jogo com data valida para exportar.",
      tone: "warning",
    });
    return;
  }

  createEvents(events, (error, value) => {
    if (error || !value) {
      notify({
        title: "Exportacao falhou",
        description: "Nao foi possivel gerar o calendario.",
        tone: "danger",
      });
      return;
    }
    const blob = new Blob([value], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "4linhas-agenda.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

function getTransferIntegrityAlerts() {
  const marketRows = App.state?.apiMarketPlayers || [];
  const transfers = App.transfers?.getValidTransfers?.() || [];
  const approvedKeys = new Set(
    transfers.map((item) => normalizeText(item.player)).filter(Boolean),
  );
  const contractedWithoutApproved = marketRows.filter((player) => {
    const key = normalizeText(player.name || "");
    return (
      key &&
      (player.is_contracted || player.alreadyContracted) &&
      !approvedKeys.has(key)
    );
  });

  return {
    contractedWithoutApproved,
    duplicateTransfers: transfers.filter((item) => item.hasDuplicate),
  };
}

function ActionButton({ view, children, className = "" }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => App.main?.switchToView?.(view)}
    >
      {children}
    </button>
  );
}

function MetricPill({ icon, label, value, detail = "", tone = "neutral" }) {
  const Icon = icon;
  return (
    <article className={`qol-metric-card tone-${tone}`}>
      <span className="qol-metric-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {detail ? <p>{detail}</p> : null}
      </div>
    </article>
  );
}

function ActionRow({ title, detail, view, tone = "neutral", icon = Sparkles }) {
  const Icon = icon;
  return (
    <button
      type="button"
      className={`qol-action-row tone-${tone}`}
      onClick={() => App.main?.switchToView?.(view)}
    >
      <span aria-hidden="true">
        <Icon size={18} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </button>
  );
}

export function TodayCommandCenter({ activeRoute }) {
  useAppRuntime();
  const session = getSession();
  const managerName = getManagerName(session);
  const isCommissioner = isCommissionerSession(session);

  const model = useMemo(() => {
    const pendingDecisions = getPendingDecisions();
    const openProposals = getOpenTransferProposals();
    const sponsorshipOffers = getSponsorshipOffers(managerName);
    const medicalCases = getActiveMedicalCases(managerName);
    const upcomingMatches = getMyUpcomingMatches(managerName);
    const finance = getManagerFinance(managerName);
    const pendingMatches = getLeaguePendingMatches();
    const integrity = getTransferIntegrityAlerts();
    const remainingBudget = Number(
      finance?.remainingBudget ?? finance?.availableBudget ?? 0,
    );
    const transferLimit = Number(finance?.transferLimit ?? 0);
    const transfersToday = Number(finance?.transfersToday ?? 0);
    const actionCount =
      pendingDecisions.length +
      openProposals.length +
      sponsorshipOffers.length +
      medicalCases.length +
      (isCommissioner ? pendingMatches.length : 0);

    return {
      pendingDecisions,
      openProposals,
      sponsorshipOffers,
      medicalCases,
      upcomingMatches,
      finance,
      pendingMatches,
      integrity,
      remainingBudget,
      transferLimit,
      transfersToday,
      actionCount,
    };
  }, [managerName, isCommissioner]);

  const routeLabel = activeRoute?.label || "Painel";
  const nextMatch = model.upcomingMatches[0];
  const nextMatchLabel = nextMatch
    ? `${nextMatch.Mandante || nextMatch.home || "-"} x ${
        nextMatch.Visitante || nextMatch.away || "-"
      }`
    : isCommissioner
      ? `${model.pendingMatches.length} jogo(s) pendente(s)`
      : "Sem jogo pendente";

  const financeTone =
    model.remainingBudget < 0
      ? "danger"
      : model.remainingBudget < 2000000
        ? "warning"
        : "success";

  const actions = [
    model.openProposals.length
      ? {
          title: `${model.openProposals.length} negociacao(oes) aberta(s)`,
          detail: "Responder, assinar ou revisar mesas em andamento.",
          view: "playersView",
          tone: "market",
          icon: Inbox,
        }
      : null,
    model.pendingDecisions.length
      ? {
          title: `${model.pendingDecisions.length} decisao(oes) da diretoria`,
          detail: "E-mails de impacto esperando resposta.",
          view: "playersView",
          tone: "warning",
          icon: BellRing,
        }
      : null,
    model.medicalCases.length
      ? {
          title: `${model.medicalCases.length} caso(s) no DM`,
          detail: "Checar disponibilidade antes do proximo jogo.",
          view: "playersView",
          tone: "danger",
          icon: HeartPulse,
        }
      : null,
    model.sponsorshipOffers.length
      ? {
          title: `${model.sponsorshipOffers.length} oferta(s) comercial(is)`,
          detail: "Comparar marcas e contratos ativos.",
          view: "playersView",
          tone: "success",
          icon: WalletCards,
        }
      : null,
    isCommissioner && model.pendingMatches.length
      ? {
          title: `${model.pendingMatches.length} jogo(s) para fechar`,
          detail: "Revisar resultados pendentes e rotina semanal.",
          view: "submitView",
          tone: "warning",
          icon: ClipboardCheck,
        }
      : null,
  ].filter(Boolean);

  return (
    <section className="today-command-center" aria-label="Central do dia">
      <div className="today-command-hero">
        <span>Central hoje</span>
        <strong>
          {isCommissioner
            ? "Operacao da liga"
            : managerName
              ? `Mesa de ${managerName}`
              : "Entre para personalizar"}
        </strong>
        <p>
          {model.actionCount
            ? `${model.actionCount} item(ns) pedem atencao agora em ${routeLabel}.`
            : `Nada critico em ${routeLabel}. Use a busca ou sincronize se algo estiver faltando.`}
        </p>
        <div className="today-command-actions">
          <ActionButton view="playersView">Abrir escritorio</ActionButton>
          <ActionButton view="calendarView" className="ghost-button">
            Ver agenda
          </ActionButton>
          {isCommissioner ? (
            <ActionButton view="commissionerView" className="ghost-button">
              Auditoria
            </ActionButton>
          ) : null}
        </div>
      </div>

      <div className="today-metric-strip">
        <MetricPill
          icon={Inbox}
          label="Acoes"
          value={model.actionCount}
          detail="Fila privada e operacional"
          tone={model.actionCount ? "warning" : "success"}
        />
        <MetricPill
          icon={CalendarClock}
          label="Proximo contexto"
          value={nextMatchLabel}
          detail={nextMatch ? "Jogo com impacto de agenda" : "Sem foco imediato"}
          tone={nextMatch || model.pendingMatches.length ? "market" : "neutral"}
        />
        <MetricPill
          icon={WalletCards}
          label="Caixa disponivel"
          value={
            managerName && model.finance
              ? formatMoney(model.remainingBudget)
              : "Login tecnico"
          }
          detail={
            model.finance
              ? `${model.transfersToday}/${model.transferLimit || "-"} transf. hoje`
              : "Sem leitura privada"
          }
          tone={model.finance ? financeTone : "neutral"}
        />
      </div>

      <div className="today-action-stack">
        {actions.length ? (
          actions
            .slice(0, 5)
            .map((item) => <ActionRow key={item.title} {...item} />)
        ) : (
          <ActionRow
            title="Fila limpa"
            detail="Nenhuma acao critica detectada no estado atual."
            view={activeRoute?.viewId || "standingsView"}
            tone="success"
            icon={CheckCircle2}
          />
        )}
      </div>
    </section>
  );
}

export function OfficeQoLPanel() {
  useAppRuntime();
  const managerName = getManagerName();
  const openProposals = getOpenTransferProposals();
  const pendingDecisions = getPendingDecisions();
  const offers = getSponsorshipOffers(managerName);
  const medical = getActiveMedicalCases(managerName);

  return (
    <section className="qol-panel office-qol-panel">
      <header>
        <span>QoL escritorio</span>
        <strong>Triagem automatica</strong>
        <p>Os assuntos com acao aparecem agrupados antes de voce entrar na caixa.</p>
      </header>
      <div className="qol-grid">
        <MetricPill
          icon={Inbox}
          label="Mercado"
          value={openProposals.length}
          detail="Propostas e assinaturas abertas"
          tone={openProposals.length ? "market" : "success"}
        />
        <MetricPill
          icon={BellRing}
          label="Diretoria"
          value={pendingDecisions.length}
          detail="Decisoes pendentes"
          tone={pendingDecisions.length ? "warning" : "success"}
        />
        <MetricPill
          icon={WalletCards}
          label="Comercial"
          value={offers.length}
          detail="Patrocinios em disputa"
          tone={offers.length ? "success" : "neutral"}
        />
        <MetricPill
          icon={HeartPulse}
          label="DM"
          value={medical.length}
          detail="Casos clinicos ativos"
          tone={medical.length ? "danger" : "success"}
        />
      </div>
    </section>
  );
}

export function SquadQoLPanel() {
  useAppRuntime();
  const managerName = getManagerName();
  const roster = getRoster(managerName);
  const medical = getActiveMedicalCases(managerName);
  const positions = roster.reduce((acc, player) => {
    const key = String(player.position || player.positionLabel || "UNK");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const thinPositions = Object.entries(positions)
    .filter(([, count]) => count < 2)
    .map(([position]) => position)
    .slice(0, 4);
  const payroll = roster.reduce(
    (sum, player) => sum + Number(player.weeklySalary || 0),
    0,
  );

  return (
    <section className="qol-panel squad-qol-panel">
      <header>
        <span>QoL elenco</span>
        <strong>Saude do grupo</strong>
        <p>Profundidade, folha e disponibilidade antes de mexer na escalacao.</p>
      </header>
      <div className="qol-grid">
        <MetricPill icon={Users} label="Atletas" value={roster.length || "-"} />
        <MetricPill
          icon={WalletCards}
          label="Folha semanal"
          value={payroll ? formatMoney(payroll) : "Pendente"}
          detail="Base do elenco carregado"
          tone={payroll ? "market" : "neutral"}
        />
        <MetricPill
          icon={HeartPulse}
          label="Indisponiveis"
          value={medical.length}
          tone={medical.length ? "danger" : "success"}
        />
        <MetricPill
          icon={ShieldAlert}
          label="Setores finos"
          value={thinPositions.length ? thinPositions.join(", ") : "OK"}
          detail="Menos de 2 nomes por posicao"
          tone={thinPositions.length ? "warning" : "success"}
        />
      </div>
    </section>
  );
}

export function LeagueQoLPanel() {
  useAppRuntime();
  const pushToast = useLeagueUiStore((state) => state.pushToast);
  const pendingMatches = getLeaguePendingMatches();
  const activeEvents = (App.state?.apiEvents || []).filter((event) =>
    ["aplicado", "ativo", "gerado"].includes(
      normalizeText(event.Status || event.status || ""),
    ),
  );
  const transfers = App.transfers?.getValidTransfers?.() || [];

  return (
    <section className="qol-panel league-qol-panel">
      <header>
        <span>QoL liga</span>
        <strong>Leitura macro</strong>
        <p>Agenda, eventos e mercado resumidos em sinais operacionais.</p>
      </header>
      <div className="qol-grid">
        <MetricPill
          icon={CalendarClock}
          label="Jogos pendentes"
          value={pendingMatches.length}
          tone={pendingMatches.length ? "warning" : "success"}
        />
        <MetricPill
          icon={Sparkles}
          label="Eventos ativos"
          value={activeEvents.length}
          tone={activeEvents.length ? "market" : "neutral"}
        />
        <MetricPill
          icon={WalletCards}
          label="Movimentos"
          value={transfers.length}
          detail="Transferencias aprovadas"
        />
      </div>
      <div className="qol-action-strip">
        <button
          type="button"
          onClick={() => exportMatchesToIcs(pendingMatches, pushToast)}
        >
          Exportar agenda
        </button>
        <ActionButton view="calendarView" className="ghost-button">
          Abrir calendario
        </ActionButton>
      </div>
    </section>
  );
}

export function CommissionerOpsQoLPanel() {
  useAppRuntime();
  const pendingMatches = getLeaguePendingMatches();
  const integrity = getTransferIntegrityAlerts();
  const financeRows = Object.values(App.transfers?.getBudgetInfoByBuyer?.() || {});
  const financeRisk = financeRows.filter(
    (item) => Number(item.remainingBudget ?? item.availableBudget ?? 0) < 0,
  );
  const vitals =
    typeof window !== "undefined" && Array.isArray(window.__leagueVitals)
      ? window.__leagueVitals.slice(-4)
      : [];

  return (
    <section className="qol-panel ops-qol-panel">
      <header>
        <span>QoL comissario</span>
        <strong>Auditoria operacional</strong>
        <p>Fila de reparos e sinais de saude do sistema antes do fechamento.</p>
      </header>
      <div className="qol-grid">
        <MetricPill
          icon={ClipboardCheck}
          label="Jogos pendentes"
          value={pendingMatches.length}
          tone={pendingMatches.length ? "warning" : "success"}
        />
        <MetricPill
          icon={AlertTriangle}
          label="Mercado inconsistente"
          value={integrity.contractedWithoutApproved.length}
          detail="Contratado sem movimento aprovado visivel"
          tone={integrity.contractedWithoutApproved.length ? "danger" : "success"}
        />
        <MetricPill
          icon={WalletCards}
          label="Risco financeiro"
          value={financeRisk.length}
          detail="Tecnicos com saldo negativo"
          tone={financeRisk.length ? "danger" : "success"}
        />
        <MetricPill
          icon={Sparkles}
          label="Web vitals"
          value={
            vitals.length
              ? vitals.map((item) => `${item.name}:${item.rating}`).join(" ")
              : "Coletando"
          }
          detail="Metrica local da sessao"
          tone="neutral"
        />
      </div>
      <div className="qol-action-strip">
        <ActionButton view="submitView">Fechamento semanal</ActionButton>
        <ActionButton view="commissionerView" className="ghost-button">
          Reparos oficiais
        </ActionButton>
      </div>
    </section>
  );
}
