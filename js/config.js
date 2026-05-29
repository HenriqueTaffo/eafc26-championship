import App from "./app.js";

function normalizeBasePath(value = "/") {
  let normalized = String(value || "/").trim() || "/";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (!normalized.endsWith("/")) normalized = `${normalized}/`;
  return normalized;
}

const assetBaseMeta =
  typeof document !== "undefined"
    ? document.querySelector('meta[name="app-base-path"]')?.content || "/"
    : "/";
const assetBaseUrl = normalizeBasePath(assetBaseMeta);
const resolveAssetUrl = (relativePath = "", version = "") => {
  const normalizedPath = String(relativePath || "").replace(/^\/+/, "");
  const assetUrl = `${assetBaseUrl}${normalizedPath}`;
  return version ? `${assetUrl}?v=${version}` : assetUrl;
};

App.config = {
  API_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  SUPABASE_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_9YyrYEk9jH5CuatQK_Ejpg_VfQq6qCK",
  assetVersion: "20260525-login-icon-teal-v1",
  assetBaseUrl,
  getAssetUrl: resolveAssetUrl,
  enableRealtimeSync: false,
  enableScopedSessions: false,
  defaultScope: {
    organizationId: "4linhas",
    organizationName: "4 Linhas",
    leagueId: "championship",
    leagueName: "Championship Managers Hub",
    seasonId: "2026-championship",
    seasonName: "Temporada 2026",
    membershipRole: "manager"
  },
  transferBudget: 18000000,
  homeMatchBonus: 150000,
  winBonus: 100000,
  transferWindowLocked: false,
  transferWindowOpenUntil: "2026-05-31T23:59:59-03:00",
  transferWindowLockedMessage:
    "Janela de transferencias encerrada em 31/05/2026, 23:59.",
  sponsorshipSigningLocked: false,
  sponsorshipSigningLockedMessage:
    "Assinaturas de patrocinio indisponiveis no momento.",
  baseDailyTransferLimit: 3,
  eventSlots: [9, 12, 15, 18],
  calendarConfig: {
    championshipRoundsPerWeek: 3,
    startDate: "2026-05-26",
    championshipDayOffsets: [0, 2, 5],
    cupDayOffset: 4
  }
};

App.state = {
  apiResults: [],
  apiTransfers: [],
  apiEvents: [],
  apiClubs: [],
  apiBudgets: {},
  apiMatches: [],
  apiMarketPlayers: [],
  apiRatings: [],
  apiOnboarding: {},
  apiExperience: {
    opportunities: [],
    auctions: [],
    news: []
  },
  apiGovernance: {
    auctions: [],
    medicalActions: [],
    weeklyReviews: []
  },
  apiOperationAudit: {
    ok: false,
    summary: {},
    byOperation: [],
    recent: []
  },
  apiWeeklyCloseStatus: null,
  apiFinanceForecast: [],
  apiSalaryDebts: [],
  apiSalaryReferences: [],
  apiFinanceRules: null,
  apiMedicalCenter: {
    ok: false,
    options: [],
    plans: {}
  },
  apiSquadManagement: null,
  apiSquadManagementLoading: false,
  apiLoaded: false,
  apiLoadPromise: null,
  loadingCount: 0,
  silentSyncRunning: false,
  lastSecondaryHydrationAt: 0,
  autoEventGenerationRunning: false,
  lastAutoEventCheckKey: "",
  lastApiPayload: null,
  lastApiLoadAt: 0
};
