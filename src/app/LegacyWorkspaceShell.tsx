import { useEffect, useSyncExternalStore } from "react";
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
  const snapshot = useSyncExternalStore(
    legacyApp.react?.subscribe || (() => () => undefined),
    legacyApp.react?.getSnapshot || (() => 0),
    legacyApp.react?.getSnapshot || (() => 0),
  );
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

    const callback = () => legacyApp.main?.switchToView?.(route.viewId);

    if (typeof window !== "undefined") {
      const frameId = window.requestAnimationFrame(callback);
      const settleId = window.setTimeout(callback, isLoggedIn ? 1600 : 180);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(settleId);
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
    snapshot,
  ]);

  return <StaticShell activePath={route.path} />;
}

export default LegacyWorkspaceShell;
