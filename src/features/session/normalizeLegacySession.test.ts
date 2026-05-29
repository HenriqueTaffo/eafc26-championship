import { describe, expect, it } from "vitest";
import { normalizeLegacySession } from "./normalizeLegacySession";

describe("normalizeLegacySession", () => {
  it("returns null without a valid manager identity", () => {
    expect(normalizeLegacySession(null)).toBeNull();
    expect(normalizeLegacySession({ managerId: "", managerName: "" })).toBeNull();
  });

  it("hydrates scoped metadata from session payload when available", () => {
    const result = normalizeLegacySession({
      managerId: "henrique",
      managerName: "Henrique",
      isCommissioner: false,
      scope: {
        organizationId: "org-1",
        organizationName: "Liga 1",
        leagueId: "league-1",
        leagueName: "Championship",
        seasonId: "season-1",
        seasonName: "2026",
        membershipRole: "manager",
      },
    });

    expect(result?.scope.organizationId).toBe("org-1");
    expect(result?.scope.leagueName).toBe("Championship");
    expect(result?.scope.membershipRole).toBe("manager");
  });

  it("falls back to default scope and commissioner role", () => {
    const result = normalizeLegacySession(
      {
        managerId: "comissario",
        managerName: "Comissário da Liga",
        isCommissioner: true,
      },
      {
        organizationId: "4linhas",
        organizationName: "4 Linhas",
        leagueId: "championship",
        leagueName: "Championship Managers Hub",
        seasonId: "2026-championship",
        seasonName: "Temporada 2026",
      },
    );

    expect(result?.scope.membershipRole).toBe("commissioner");
    expect(result?.scope.organizationName).toBe("4 Linhas");
  });
});
