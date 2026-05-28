import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useLeagueUiStore = create(
  persist(
    (set, get) => ({
      workspacePrefs: {},
      toasts: [],

      patchWorkspacePrefs(scope = "default", patch = {}) {
        set((state) => ({
          workspacePrefs: {
            ...state.workspacePrefs,
            [scope]: {
              ...(state.workspacePrefs?.[scope] || {}),
              ...(patch || {}),
            },
          },
        }));
      },

      pushToast(payload = {}) {
        const now = Date.now();
        const dedupeWindowMs = Number(payload.dedupeWindowMs || 6500);
        const nextToast = {
          id: createToastId(),
          title: payload.title || "Atualizacao da liga",
          description: payload.description || "",
          tone: payload.tone || "info",
          duration: Number(payload.duration || 6200),
          createdAt: now,
        };
        const recent = get().toasts.find(
          (item) =>
            item.title === nextToast.title &&
            item.description === nextToast.description &&
            now - Number(item.createdAt || 0) < dedupeWindowMs,
        );
        if (recent) {
          set((state) => ({
            toasts: state.toasts.map((item) =>
              item.id === recent.id
                ? {
                    ...item,
                    duration: Math.max(
                      Number(item.duration || 0),
                      Number(nextToast.duration || 0),
                    ),
                    createdAt: now,
                  }
                : item,
            ),
          }));
          return recent.id;
        }

        set((state) => ({
          toasts: [...state.toasts, nextToast].slice(-5),
        }));
        return nextToast.id;
      },

      dismissToast(id) {
        set((state) => ({
          toasts: state.toasts.filter((item) => item.id !== id),
        }));
      },
    }),
    {
      name: "eafc26-ui-store-v1",
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        workspacePrefs: state.workspacePrefs,
      }),
    },
  ),
);

export default useLeagueUiStore;
