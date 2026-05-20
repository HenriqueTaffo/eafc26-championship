const API_URL = "https://script.google.com/macros/s/AKfycbxbm5pIAkY4VHcWECWBwMNrpSbnxJu85jY665CQJhF0WcmhDPChymHEU9KSBO_H5wlj/exec";
window.App = window.App || {};

App.config = {
  API_URL: "https://script.google.com/macros/s/AKfycbxbm5pIAkY4VHcWECWBwMNrpSbnxJu85jY665CQJhF0WcmhDPChymHEU9KSBO_H5wlj/exec",
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
  apiClubs: [],
  apiLoaded: false,
  loadingCount: 0,
  autoEventGenerationRunning: false,
  lastAutoEventCheckKey: ""
};
