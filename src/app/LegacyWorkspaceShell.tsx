import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { StaticShell } from "../shell/StaticShell.jsx";
import { useScopedManagerSession } from "../features/session/useScopedManagerSession";
import {
  getUnauthorizedFallbackPath,
  getWorkspaceRouteByPath,
  isWorkspaceRouteVisible,
} from "../shared/navigation/workspace-routes";
import { getLegacyApp } from "../shared/platform/legacy-app";

export function LegacyWorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useScopedManagerSession();
  const legacyApp = getLegacyApp();
  const route = getWorkspaceRouteByPath(location.pathname);
  const isCommissioner = Boolean(session?.isCommissioner);
  const isLoggedIn = Boolean(session?.managerId);

  useEffect(() => {
    if (!isWorkspaceRouteVisible(route, isCommissioner)) {
      const fallbackPath = getUnauthorizedFallbackPath(isLoggedIn, isCommissioner);
      if (fallbackPath !== location.pathname) {
        navigate(fallbackPath, { replace: true });
      }
      return;
    }

    const callback = () => {
      const legacySession = legacyApp.auth?.getSession?.();
      if (isLoggedIn && !legacySession?.managerId) return false;

      legacyApp.main?.switchToView?.(route.viewId, { syncRoute: false });
      return document.querySelector(".view.active")?.id === route.viewId;
    };

    if (typeof window !== "undefined") {
      const frameId = window.requestAnimationFrame(callback);
      const settleIds = [isLoggedIn ? 240 : 180, 750, 1500].map((delay) =>
        window.setTimeout(() => {
          if (document.querySelector(".view.active")?.id !== route.viewId) {
            callback();
          }
        }, delay),
      );
      return () => {
        window.cancelAnimationFrame(frameId);
        settleIds.forEach((settleId) => window.clearTimeout(settleId));
      };
    }

    callback();
    return undefined;
  }, [
    isCommissioner,
    isLoggedIn,
    legacyApp,
    location.pathname,
    navigate,
    route.path,
    route.viewId,
  ]);

  return <StaticShell activePath={route.path} />;
}

export default LegacyWorkspaceShell;
