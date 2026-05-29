import { useSyncExternalStore } from "react";
import { normalizeLegacySession, type ScopedManagerSession } from "./normalizeLegacySession";
import { getLegacyApp } from "../../shared/platform/legacy-app";

const noopSubscribe = () => () => undefined;
const noopSnapshot = () => 0;

export function useScopedManagerSession(): ScopedManagerSession | null {
  const legacyApp = getLegacyApp();
  const subscribe = legacyApp.react?.subscribe || noopSubscribe;
  const getSnapshot = legacyApp.react?.getSnapshot || noopSnapshot;

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return normalizeLegacySession(
    legacyApp.auth?.getSession?.() || null,
    legacyApp.config?.defaultScope || {},
  );
}
