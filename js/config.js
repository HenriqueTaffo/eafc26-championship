window.App = window.App || {};

App.config = {
  API_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  SUPABASE_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_9YyrYEk9jH5CuatQK_Ejpg_VfQq6qCK",
  assetVersion: "20260524-auth-gate-v1",
  transferBudget: 65000000,
  homeMatchBonus: 1500000,
  winBonus: 1250000,
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
  apiFinanceRules: null,
  apiLoaded: false,
  apiLoadPromise: null,
  loadingCount: 0,
  silentSyncRunning: false,
  autoEventGenerationRunning: false,
  lastAutoEventCheckKey: "",
  lastApiPayload: null,
  lastApiLoadAt: 0
};
