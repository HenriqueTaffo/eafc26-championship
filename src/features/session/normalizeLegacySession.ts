import {
  type LegacyManagerSession,
  type ScopedSessionScope,
} from "../../shared/platform/legacy-app";

const FALLBACK_SCOPE: ScopedSessionScope = {
  organizationId: "4linhas",
  organizationName: "4 Linhas",
  leagueId: "championship",
  leagueName: "Championship Managers Hub",
  seasonId: "2026-championship",
  seasonName: "Temporada 2026",
  membershipRole: "manager",
};

export interface ScopedManagerSession extends LegacyManagerSession {
  isCommissioner: boolean;
  scope: ScopedSessionScope;
}

export function normalizeLegacySession(
  session: LegacyManagerSession | null | undefined,
  defaultScope: Partial<ScopedSessionScope> = {},
): ScopedManagerSession | null {
  if (!session?.managerId || !session?.managerName) return null;

  const resolvedCommissioner = Boolean(session.isCommissioner);
  const scope = session.scope || {};

  return {
    ...session,
    isCommissioner: resolvedCommissioner,
    scope: {
      organizationId:
        scope.organizationId || defaultScope.organizationId || FALLBACK_SCOPE.organizationId,
      organizationName:
        scope.organizationName ||
        defaultScope.organizationName ||
        FALLBACK_SCOPE.organizationName,
      leagueId: scope.leagueId || defaultScope.leagueId || FALLBACK_SCOPE.leagueId,
      leagueName:
        scope.leagueName || defaultScope.leagueName || FALLBACK_SCOPE.leagueName,
      seasonId: scope.seasonId || defaultScope.seasonId || FALLBACK_SCOPE.seasonId,
      seasonName:
        scope.seasonName || defaultScope.seasonName || FALLBACK_SCOPE.seasonName,
      membershipRole:
        scope.membershipRole ||
        defaultScope.membershipRole ||
        (resolvedCommissioner ? "commissioner" : FALLBACK_SCOPE.membershipRole),
    },
  };
}
