import { useSyncExternalStore } from "react";
import { normalizeLegacySession, type ScopedManagerSession } from "./normalizeLegacySession";
import {
  getLegacyApp,
  type LegacyManagerSession,
} from "../../shared/platform/legacy-app";

const noopSubscribe = () => () => undefined;
const emptySessionSnapshot = "";
const legacySessionStorageKey = "mistura_manager_session_v2";

function readStoredLegacySession(): LegacyManagerSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage?.getItem(legacySessionStorageKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as LegacyManagerSession;
    return session?.managerId ? session : null;
  } catch {
    return null;
  }
}

function getSessionSnapshot() {
  const legacyApp = getLegacyApp();
  const session = legacyApp.auth?.getSession?.() || readStoredLegacySession();
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
    legacyApp.auth?.getSession?.() || readStoredLegacySession(),
    legacyApp.config?.defaultScope || {},
  );
}
