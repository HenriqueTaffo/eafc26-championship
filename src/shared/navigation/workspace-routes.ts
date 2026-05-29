import {
  ArrowLeftRight,
  BarChart3,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Scale,
  Sparkles,
  Trophy,
  UploadCloud,
  Users,
  WalletCards,
} from "lucide-react";
import type { WorkspaceRouteRecord } from "../platform/legacy-app";

export const workspaceRoutes: WorkspaceRouteRecord[] = [
  {
    id: "standings",
    path: "/league/standings",
    viewId: "standingsView",
    label: "Classificação",
    detail: "Tabela, forma recente e leitura de campanha.",
    kicker: "Liga",
    groupKey: "league",
    groupLabel: "Liga",
    groupDetail: "Rodada, agenda e leitura macro da temporada.",
    icon: BarChart3,
  },
  {
    id: "calendar",
    path: "/league/calendar",
    viewId: "calendarView",
    label: "Calendário",
    detail: "Agenda semanal, mês corrente e jogos pendentes.",
    kicker: "Liga",
    groupKey: "league",
    groupLabel: "Liga",
    groupDetail: "Rodada, agenda e leitura macro da temporada.",
    icon: CalendarDays,
  },
  {
    id: "cups",
    path: "/league/cups",
    viewId: "cupsView",
    label: "Copas",
    detail: "Chaveamento, bônus por fase e pressão de mata-mata.",
    kicker: "Liga",
    groupKey: "league",
    groupLabel: "Liga",
    groupDetail: "Rodada, agenda e leitura macro da temporada.",
    icon: Trophy,
  },
  {
    id: "events",
    path: "/league/events",
    viewId: "eventsView",
    label: "Eventos",
    detail: "Bastidores, caos, punições e impactos operacionais.",
    kicker: "Liga",
    groupKey: "league",
    groupLabel: "Liga",
    groupDetail: "Rodada, agenda e leitura macro da temporada.",
    icon: Sparkles,
  },
  {
    id: "inbox",
    path: "/club/inbox",
    viewId: "playersView",
    label: "Escritório",
    detail: "Inbox privado, caixa, diretoria e contratos.",
    kicker: "Clube",
    groupKey: "club",
    groupLabel: "Clube",
    groupDetail: "Fluxo privado do técnico, elenco e mercado.",
    icon: WalletCards,
    context: "inbox",
  },
  {
    id: "commercial",
    path: "/club/commercial",
    viewId: "playersView",
    label: "Comercial",
    detail: "Patrocínio, caixa, contratos e monetização do clube.",
    kicker: "Clube",
    groupKey: "club",
    groupLabel: "Clube",
    groupDetail: "Fluxo privado do técnico, elenco e mercado.",
    icon: BriefcaseBusiness,
    context: "commercial",
  },
  {
    id: "squad",
    path: "/club/squad",
    viewId: "squadView",
    label: "Elenco",
    detail: "Formação, disponibilidade, folha e profundidade.",
    kicker: "Clube",
    groupKey: "club",
    groupLabel: "Clube",
    groupDetail: "Fluxo privado do técnico, elenco e mercado.",
    icon: Users,
  },
  {
    id: "transfers",
    path: "/club/transfers",
    viewId: "transfersView",
    label: "Transferências",
    detail: "Mesa ativa, scouting, shortlist e negociação.",
    kicker: "Clube",
    groupKey: "club",
    groupLabel: "Clube",
    groupDetail: "Fluxo privado do técnico, elenco e mercado.",
    icon: ArrowLeftRight,
  },
  {
    id: "commissioner",
    path: "/ops/commissioner",
    viewId: "commissionerView",
    label: "Comissário",
    detail: "Governança, auditoria e ações da liga.",
    kicker: "Operação",
    groupKey: "ops",
    groupLabel: "Operação",
    groupDetail: "Governança, automações e fechamento operacional.",
    icon: Scale,
    role: "commissioner",
  },
  {
    id: "intelligence",
    path: "/ops/intelligence",
    viewId: "experienceView",
    label: "Inteligência",
    detail: "Risco, prioridades e leitura de momento da liga.",
    kicker: "Operação",
    groupKey: "ops",
    groupLabel: "Operação",
    groupDetail: "Governança, automações e fechamento operacional.",
    icon: Brain,
    role: "commissioner",
  },
  {
    id: "results",
    path: "/ops/results",
    viewId: "submitView",
    label: "Enviar dados",
    detail: "Resultados, CPU x CPU e rotinas oficiais.",
    kicker: "Operação",
    groupKey: "ops",
    groupLabel: "Operação",
    groupDetail: "Governança, automações e fechamento operacional.",
    icon: UploadCloud,
    role: "commissioner",
  },
];

export const DEFAULT_WORKSPACE_ROUTE = workspaceRoutes[0];

export const workspaceRouteGroups = [
  {
    key: "league",
    label: "Liga",
    detail: "Rodada, agenda e leitura macro da temporada.",
  },
  {
    key: "club",
    label: "Clube",
    detail: "Fluxo privado do técnico, elenco e mercado.",
  },
  {
    key: "ops",
    label: "Operação",
    detail: "Governança, automações e fechamento operacional.",
  },
] as const;

export function getWorkspaceRouteByPath(pathname: string): WorkspaceRouteRecord {
  return (
    workspaceRoutes.find((route) => route.path === pathname) ||
    DEFAULT_WORKSPACE_ROUTE
  );
}

export function isWorkspaceRouteVisible(
  route: WorkspaceRouteRecord,
  isCommissioner: boolean,
): boolean {
  if (!route.role) return true;
  return route.role === "commissioner" ? isCommissioner : false;
}

export function getUnauthorizedFallbackPath(
  isLoggedIn: boolean,
  isCommissioner: boolean,
): string {
  if (!isLoggedIn) return DEFAULT_WORKSPACE_ROUTE.path;
  if (isCommissioner) return "/ops/commissioner";
  return "/club/inbox";
}

export function getWorkspaceRoutesForGroup(groupKey: string): WorkspaceRouteRecord[] {
  return workspaceRoutes.filter((route) => route.groupKey === groupKey);
}
