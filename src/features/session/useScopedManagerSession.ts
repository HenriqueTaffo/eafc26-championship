import { useSyncExternalStore } from "react";
import { normalizeLegacySession, type ScopedManagerSession } from "./normalizeLegacySession";
import { getLegacyApp } from "../../shared/platform/legacy-app";

const noopSubscribe = () => () => undefined;
const emptySessionSnapshot = "";

function getSessionSnapshot() {
  const legacyApp = getLegacyApp();
  const session = legacyApp.auth?.getSession?.();
  if (!session) return emptySessionSnapshot;

  return JSON.stringify({
    managerId: session.managerId || "",
    managerName: session.managerName || "",
    clubName: session.clubName || "",
    isCommissioner: Boolean(session.isCommissioner),
    scope: session.scope || {},
  });
}

export function useScopedManagerSession(): ScopedManagerSession | null {
  const legacyApp = getLegacyApp();
  const subscribe = legacyApp.react?.subscribe || noopSubscribe;

  useSyncExternalStore(subscribe, getSessionSnapshot, getSessionSnapshot);

  return normalizeLegacySession(
    legacyApp.auth?.getSession?.() || null,
    legacyApp.config?.defaultScope || {},
  );
}
