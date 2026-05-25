import App from "./app.js";

App.config = {
  API_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  SUPABASE_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_9YyrYEk9jH5CuatQK_Ejpg_VfQq6qCK",
  assetVersion: "20260525-public-salary-references-v1",
  transferBudget: 22000000,
  homeMatchBonus: 400000,
  winBonus: 250000,
  transferWindowLocked: true,
  transferWindowLockedMessage:
    "Janela de transferências fechada enquanto consolidamos o app.",
  baseDailyTransferLimit: 3,
  eventSlots: [9, 12, 15, 18],
  calendarConfig: {
    championshipRoundsPerWeek: 3,
    startDate: "2026-05-19",
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
  apiWeeklyCloseStatus: null,
  apiFinanceForecast: [],
  apiSalaryDebts: [],
  apiSalaryReferences: [],
  apiFinanceRules: null,
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
