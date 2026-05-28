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
        const nextToast = {
          id: createToastId(),
          title: payload.title || "Atualizacao da liga",
          description: payload.description || "",
          tone: payload.tone || "info",
          duration: Number(payload.duration || 4200),
          createdAt: Date.now(),
        };
        const recent = get().toasts.find(
          (item) =>
            item.title === nextToast.title &&
            item.description === nextToast.description &&
            Date.now() - Number(item.createdAt || 0) < 1800,
        );
        if (recent) return recent.id;

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
