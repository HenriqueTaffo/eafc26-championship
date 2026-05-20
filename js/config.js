const API_URL = "https://script.google.com/macros/s/AKfycbwh_NeuSPy8X-MmibPyIQH8aiz7cmeVPWz9n-dqkR0tHEsDVAMotyDeTk25IH9W-3QT/exec";
window.App = window.App || {};

App.config = {
  API_URL: "https://script.google.com/macros/s/AKfycbwh_NeuSPy8X-MmibPyIQH8aiz7cmeVPWz9n-dqkR0tHEsDVAMotyDeTk25IH9W-3QT/exec",
  API_PIN: "eafc26",
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
  apiLoaded: false,
  loadingCount: 0,
  autoEventGenerationRunning: false,
  lastAutoEventCheckKey: ""
};
