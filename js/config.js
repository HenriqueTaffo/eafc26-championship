const API_URL = "https://fdippspwpugnxwxmjnqf.supabase.co";
window.App = window.App || {};

App.config = {
  API_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  API_PIN: "eafc26",
  SUPABASE_URL: "https://fdippspwpugnxwxmjnqf.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_9YyrYEk9jH5CuatQK_Ejpg_VfQq6qCK",
  transferBudget: 65000000,
  homeMatchBonus: 1250000,
  winBonus: 500000,
  baseDailyTransferLimit: 3,
  eventSlots: [5, 8, 11, 14, 17, 20, 23],
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
  apiMarketPlayers: [],
  apiLoaded: false,
  loadingCount: 0,
  autoEventGenerationRunning: false,
  lastAutoEventCheckKey: ""
};
