window.App = window.App || {};

App.utils = {
  normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },

  normalizeTeamName(value) {
    const normalized = App.utils.normalizeText(value);
    const aliases = {
      "southampton fc": "southampton",
      "blackburn": "blackburn rovers",
      "blackburn rovers fc": "blackburn rovers",
      "coventry": "coventry city",
      "coventry city fc": "coventry city",
      "birmingham": "birmingham city",
      "birmingham city fc": "birmingham city",
      "middlesbrough fc": "middlesbrough",
      "qpr": "queens park rangers",
      "queens park rangers fc": "queens park rangers",
      "west brom": "west bromwich albion",
      "west bromwich": "west bromwich albion",
      "sheffield utd": "sheffield united",
      "sheffield wed": "sheffield wednesday",
      "bristol city fc": "bristol city",
      "hull city fc": "hull city",
      "leicester city fc": "leicester city",
      "swansea city fc": "swansea city",
      "norwich city fc": "norwich city",
      "stoke city fc": "stoke city",
      "watford fc": "watford",
      "portsmouth fc": "portsmouth",
      "wrexham afc": "wrexham"
    };
    return aliases[normalized] || normalized;
  },

  sameTeamName(a, b) {
    return App.utils.normalizeTeamName(a) === App.utils.normalizeTeamName(b);
  },

  resolveTeamName(value) {
    const normalized = App.utils.normalizeTeamName(value);
    const found = App.data.teams.find(team => App.utils.normalizeTeamName(team.team) === normalized);
    return found ? found.team : String(value || "").trim();
  },

  getTeamByName(teamName) {
    return App.data.teams.find(team => App.utils.sameTeamName(team.team, teamName));
  },

  getHumanBuyers() {
    return [...new Set(App.data.teams.filter(team => team.status === "Nosso").map(team => team.owner))];
  },

  formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  },

  formatGoalDifference(value) {
    const number = Number(value || 0);
    return number > 0 ? `+${number}` : String(number);
  },

  addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  },

  getBaseStartDate() {
    return new Date(`${App.config.calendarConfig.startDate}T12:00:00`);
  },

  formatDate(value) {
    if (!value) return "A definir";
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  },

  getChampionshipDate(roundNumber) {
    const config = App.config.calendarConfig;
    const weekIndex = Math.ceil(roundNumber / config.championshipRoundsPerWeek) - 1;
    const slotIndex = (roundNumber - 1) % config.championshipRoundsPerWeek;
    return App.utils.addDays(App.utils.getBaseStartDate(), (weekIndex * 7) + config.championshipDayOffsets[slotIndex]);
  },

  getCupDate(week) {
    const config = App.config.calendarConfig;
    return App.utils.addDays(App.utils.getBaseStartDate(), ((week - 1) * 7) + config.cupDayOffset);
  },

  setMessage(element, text, type = "") {
    if (!element) return;
    element.textContent = text;
    element.className = `app-message ${type}`.trim();
  },

  escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
};
