import type { LucideIcon } from "lucide-react";

export type WorkspaceViewId =
  | "standingsView"
  | "calendarView"
  | "cupsView"
  | "eventsView"
  | "playersView"
  | "squadView"
  | "transfersView"
  | "commissionerView"
  | "submitView"
  | "experienceView";

export type WorkspaceRole = "commissioner";

export interface ScopedSessionScope {
  organizationId: string;
  organizationName: string;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  membershipRole: "commissioner" | "manager";
}

export interface LegacyManagerSession {
  managerId: string;
  managerName: string;
  clubName?: string;
  isCommissioner?: boolean;
  accessCode?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
  scope?: Partial<ScopedSessionScope>;
}

export interface LegacyAppRuntime {
  react?: {
    subscribe?: (listener: () => void) => () => void;
    getSnapshot?: () => number;
    notify?: () => void;
  };
  auth?: {
    getSession?: () => LegacyManagerSession | null;
    isCommissioner?: () => boolean;
    isLoggedIn?: () => boolean;
  };
  main?: {
    switchToView?: (viewId: WorkspaceViewId) => void;
    canAccessView?: (viewId: WorkspaceViewId) => boolean;
  };
  config?: {
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    defaultScope?: Partial<ScopedSessionScope>;
  };
  api?: {
    rpc?: <TResult = unknown>(
      functionName: string,
      payload?: Record<string, unknown>,
      timeoutMs?: number,
      options?: Record<string, unknown>,
    ) => Promise<TResult>;
  };
}

export interface WorkspaceRouteRecord {
  id: string;
  path: string;
  viewId: WorkspaceViewId;
  label: string;
  detail: string;
  kicker: string;
  groupKey: "league" | "club" | "ops";
  groupLabel: string;
  groupDetail: string;
  icon: LucideIcon;
  role?: WorkspaceRole;
  context?: "inbox" | "commercial";
}

declare global {
  interface Window {
    App?: LegacyAppRuntime;
  }
}

export function getLegacyApp(): LegacyAppRuntime {
  if (typeof window === "undefined") return {};
  return window.App || {};
}
