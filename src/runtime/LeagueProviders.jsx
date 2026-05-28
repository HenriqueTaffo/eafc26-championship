import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import * as Toast from "@radix-ui/react-toast";
import clsx from "clsx";
import App from "../../js/app.js";
import { useLeagueUiStore } from "../state/useLeagueUiStore.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const REALTIME_TABLES = [
  "matches",
  "transfers",
  "events",
  "internal_transfer_proposals",
  "manager_notifications",
  "sponsorship_contracts",
];

function getRealtimeClient() {
  const supabaseUrl = App.config?.SUPABASE_URL;
  const publishableKey = App.config?.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return null;

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

function getRealtimeCopy(table = "") {
  const normalized = String(table || "").toLowerCase();
  if (normalized === "matches") {
    return {
      title: "Calendario sincronizado",
      description: "Resultados ou agenda acabaram de mudar.",
      tone: "info",
    };
  }
  if (normalized === "transfers") {
    return {
      title: "Mercado atualizado",
      description: "A mesa de transferencias recebeu um novo movimento.",
      tone: "market",
    };
  }
  if (normalized === "events") {
    return {
      title: "Evento novo na liga",
      description: "O escritorio recebeu impacto operacional recente.",
      tone: "warning",
    };
  }
  if (normalized === "internal_transfer_proposals") {
    return {
      title: "Negociacao em andamento",
      description: "Uma proposta mudou de etapa no escritorio.",
      tone: "market",
    };
  }
  if (normalized === "manager_notifications") {
    return {
      title: "Inbox privado atualizado",
      description: "Novos avisos chegaram ao tecnico.",
      tone: "info",
    };
  }
  if (normalized === "sponsorship_contracts") {
    return {
      title: "Comercial sincronizado",
      description: "Patrocinios e contratos acabaram de ser revistos.",
      tone: "success",
    };
  }
  return {
    title: "Liga sincronizada",
    description: "Houve uma atualizacao operacional recente.",
    tone: "info",
  };
}

function useRealtimeLeagueBridge() {
  const pushToast = useLeagueUiStore((state) => state.pushToast);
  const timersRef = useRef(new Map());

  useEffect(() => {
    const realtimeClient = getRealtimeClient();
    if (!realtimeClient) return undefined;

    const schedule = (key, task, delay = 1200) => {
      const current = timersRef.current.get(key);
      if (current) window.clearTimeout(current);
      const timeoutId = window.setTimeout(async () => {
        timersRef.current.delete(key);
        try {
          await task();
        } catch (error) {
          console.warn(`Realtime refresh failed for ${key}:`, error);
        }
      }, delay);
      timersRef.current.set(key, timeoutId);
    };

    const refreshLeagueState = () =>
      App.api.loadApiData({
        showLoader: false,
        force: true,
        skipBackgroundRefresh: true,
      });

    const refreshPrivateState = async () => {
      if (!App.auth?.isLoggedIn?.()) return;
      await Promise.allSettled([
        App.auth.loadMyTransferProposals?.(),
        App.auth.loadMySponsorships?.(),
        App.auth.loadMyQoL?.(),
        App.api.loadMedicalCenterData?.(),
        App.api.loadSquadManagementData?.({ force: true }),
        App.api.loadExperienceData?.(),
      ]);
    };

    const channel = REALTIME_TABLES.reduce((builder, table) => {
      return builder.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        (payload) => {
          const copy = getRealtimeCopy(table);
          pushToast(copy);
          queryClient.setQueryData(
            ["realtime", table],
            `${payload.eventType}:${payload.commit_timestamp || Date.now()}`,
          );
          schedule("league", refreshLeagueState);
          if (
            [
              "internal_transfer_proposals",
              "manager_notifications",
              "sponsorship_contracts",
              "events",
              "transfers",
            ].includes(table)
          ) {
            schedule("private", refreshPrivateState, 1450);
          }
        },
      );
    }, realtimeClient.channel("league-live-sync"));

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        pushToast({
          title: "Realtime online",
          description: "Mudancas da liga agora entram sem recarregar a pagina.",
          tone: "success",
          duration: 2600,
        });
      }
    });

    return () => {
      timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timersRef.current.clear();
      realtimeClient.removeChannel(channel);
    };
  }, [pushToast]);
}

function LeagueToastItem({ toast, onDismiss }) {
  const [open, setOpen] = useState(true);

  return (
    <Toast.Root
      className={clsx("league-toast", `tone-${toast.tone || "info"}`)}
      duration={toast.duration}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) onDismiss(toast.id);
      }}
    >
      <div className="league-toast-copy">
        <Toast.Title>{toast.title}</Toast.Title>
        {toast.description ? (
          <Toast.Description>{toast.description}</Toast.Description>
        ) : null}
      </div>
      <Toast.Close className="league-toast-close" aria-label="Fechar">
        x
      </Toast.Close>
    </Toast.Root>
  );
}

function ToastViewport() {
  const toasts = useLeagueUiStore((state) => state.toasts);
  const dismissToast = useLeagueUiStore((state) => state.dismissToast);

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <LeagueToastItem
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
        />
      ))}
      <Toast.Viewport className="league-toast-viewport" />
    </Toast.Provider>
  );
}

function LeagueRealtimeBridge() {
  useRealtimeLeagueBridge();
  return null;
}

export function LeagueProviders({ children }) {
  const providerValue = useMemo(() => queryClient, []);

  return (
    <QueryClientProvider client={providerValue}>
      <LeagueRealtimeBridge />
      <ToastViewport />
      {children}
    </QueryClientProvider>
  );
}

export default LeagueProviders;
