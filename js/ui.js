window.App = window.App || {};

App.ui = {
  byId(id) {
    return document.getElementById(id);
  },

  ownerColor(owner, fallback = "#2563eb") {
    return App.data?.ownerColors?.[owner] || fallback;
  },

  ownerBadge(owner, fallback = "#2563eb") {
    const label = owner || "Livre / CPU";
    return `<span class="owner" style="background:${App.ui.ownerColor(label, fallback)}">${App.utils.escapeHtml(label)}</span>`;
  },

  summaryCard(label, value, detail = "", className = "") {
    const classes = ["summary-card", className].filter(Boolean).join(" ");
    return `
      <article class="${App.utils.escapeHtml(classes)}">
        <span>${App.utils.escapeDisplay(label)}</span>
        <strong>${value}</strong>
        ${detail ? `<small>${App.utils.escapeDisplay(detail)}</small>` : ""}
      </article>
    `;
  },

  emptyCard(title, text = "", className = "calendar-card") {
    return `
      <article class="${App.utils.escapeHtml(className)}">
        <h3>${App.utils.escapeDisplay(title)}</h3>
        ${text ? `<p class="calendar-muted">${App.utils.escapeDisplay(text)}</p>` : ""}
      </article>
    `;
  }
};
