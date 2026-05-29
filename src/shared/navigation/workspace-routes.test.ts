import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_ROUTE,
  getUnauthorizedFallbackPath,
  getWorkspaceRouteByPath,
  isWorkspaceRouteVisible,
  workspaceRoutes,
} from "./workspace-routes";

describe("workspace-routes", () => {
  it("resolves the default route when path is unknown", () => {
    expect(getWorkspaceRouteByPath("/nao-existe")).toEqual(DEFAULT_WORKSPACE_ROUTE);
  });

  it("preserves the requested commercial route alias", () => {
    const route = getWorkspaceRouteByPath("/club/commercial");
    expect(route.viewId).toBe("playersView");
    expect(route.id).toBe("commercial");
  });

  it("hides commissioner routes from standard managers", () => {
    const commissionerRoute = workspaceRoutes.find((route) => route.id === "commissioner");
    expect(commissionerRoute).toBeTruthy();
    expect(isWorkspaceRouteVisible(commissionerRoute!, false)).toBe(false);
    expect(isWorkspaceRouteVisible(commissionerRoute!, true)).toBe(true);
  });

  it("redirects unauthenticated access to the public league entry", () => {
    expect(getUnauthorizedFallbackPath(false, false)).toBe("/league/standings");
    expect(getUnauthorizedFallbackPath(true, false)).toBe("/club/inbox");
  });
});
