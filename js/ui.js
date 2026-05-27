import App from "./app.js";

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
  },

  skeletonRows(count = 3, className = "app-skeleton-stack") {
    const total = Math.max(1, Math.min(Number(count || 3), 8));
    return `
      <div class="${App.utils.escapeHtml(className)}" aria-hidden="true">
        ${Array.from(
          { length: total },
          (_, index) => `
            <span class="app-skeleton-row">
              <i></i>
              <b style="width:${Math.max(42, 78 - index * 8)}%"></b>
              <em style="width:${Math.max(28, 58 - index * 7)}%"></em>
            </span>
          `,
        ).join("")}
      </div>
    `;
  },

  getActionModal() {
    let modal = document.getElementById("appActionModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "appActionModal";
    modal.className = "app-action-modal";
    modal.setAttribute("aria-hidden", "true");
    document.body.appendChild(modal);
    return modal;
  },

  openActionModal(options = {}) {
    const modal = App.ui.getActionModal();
    const previousFocus = document.activeElement;
    const actions = options.actions || [
      { id: "cancel", label: "Cancelar", variant: "secondary" },
      { id: "confirm", label: "Confirmar", variant: "primary" },
    ];
    const fields = options.fields || [];
    const summary = options.summary || [];
    const steps = options.steps || [];
    const tone = options.tone || "market";
    const titleId = "appActionModalTitle";
    const descriptionId = "appActionModalDescription";

    const fieldHtml = fields
      .map(
        (field) => `
      <label class="app-action-modal-field">
        <span>${App.utils.escapeDisplay(field.label || field.name)}</span>
        ${field.prefix ? `<b>${App.utils.escapeDisplay(field.prefix)}</b>` : ""}
        <input
          name="${App.utils.escapeHtml(field.name)}"
          type="${App.utils.escapeHtml(field.type || "text")}"
          value="${App.utils.escapeHtml(field.value ?? "")}"
          placeholder="${App.utils.escapeHtml(field.placeholder || "")}"
          ${field.inputMode ? `inputmode="${App.utils.escapeHtml(field.inputMode)}"` : ""}
          ${field.required === false ? "" : "required"}
        />
      </label>
    `,
      )
      .join("");

    const actionHtml = actions
      .map((action) => {
        const variant =
          action.variant || (action.id === "cancel" ? "secondary" : "primary");
        return `
        <button
          type="${action.id === "cancel" ? "button" : "submit"}"
          class="app-action-modal-button app-action-modal-button-${App.utils.escapeHtml(variant)}"
          data-modal-action="${App.utils.escapeHtml(action.id)}"
          ${action.autofocus ? "autofocus" : ""}
        >
          <span>${App.utils.escapeDisplay(action.label)}</span>
          ${action.description ? `<small>${App.utils.escapeDisplay(action.description)}</small>` : ""}
        </button>
      `;
      })
      .join("");

    const summaryHtml = summary
      .map(
        (item) => {
          const itemClass = [
            "app-action-modal-summary-item",
            item.variant ? `is-${item.variant}` : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `
      <div class="${App.utils.escapeHtml(itemClass)}">
        <span>${App.utils.escapeDisplay(item.label || "")}</span>
        <strong>${App.utils.escapeDisplay(item.value || "")}</strong>
        ${item.detail ? `<small>${App.utils.escapeDisplay(item.detail)}</small>` : ""}
      </div>
    `;
        },
      )
      .join("");

    const stepsHtml = steps
      .map(
        (step, index) => {
          const stepClass = [
            "app-action-modal-step",
            step.tone ? `is-${step.tone}` : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `
      <div class="${App.utils.escapeHtml(stepClass)}">
        <b>${index + 1}</b>
        <div>
          <strong>${App.utils.escapeDisplay(step.title || "")}</strong>
          ${step.detail ? `<small>${App.utils.escapeDisplay(step.detail)}</small>` : ""}
        </div>
      </div>
    `;
        },
      )
      .join("");

    App.dom.setHtml(
      modal,
      `
      <div class="app-action-modal-backdrop" data-modal-action="cancel"></div>
      <form class="app-action-modal-card app-action-modal-${App.utils.escapeHtml(tone)}${summaryHtml ? " has-summary" : ""}${stepsHtml ? " has-steps" : ""}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" aria-describedby="${descriptionId}">
        <div class="app-action-modal-header">
          <span>${App.utils.escapeDisplay(options.kicker || "Confirmacao")}</span>
          <h2 id="${titleId}">${App.utils.escapeDisplay(options.title || "Confirmar acao")}</h2>
          <p id="${descriptionId}">${App.utils.escapeDisplay(options.message || "")}</p>
        </div>
        ${summaryHtml ? `<div class="app-action-modal-summary">${summaryHtml}</div>` : ""}
        ${stepsHtml ? `<div class="app-action-modal-steps">${stepsHtml}</div>` : ""}
        ${options.detail ? `<div class="app-action-modal-detail">${App.utils.escapeDisplay(options.detail)}</div>` : ""}
        ${fieldHtml ? `<div class="app-action-modal-fields">${fieldHtml}</div>` : ""}
        <p class="app-action-modal-error" role="alert" hidden></p>
        <div class="app-action-modal-actions">${actionHtml}</div>
      </form>
    `,
    );

    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-active");

    return new Promise((resolve) => {
      const form = modal.querySelector("form");
      const error = modal.querySelector(".app-action-modal-error");

      const finish = (result) => {
        modal.classList.remove("is-visible");
        modal.setAttribute("aria-hidden", "true");
        App.dom.clear(modal);
        document.removeEventListener("keydown", handleKeydown);
        document.body.classList.remove("modal-active");
        if (previousFocus?.focus) previousFocus.focus();
        resolve(result);
      };

      const showError = (message) => {
        if (!error) return;
        error.textContent = App.utils.polishUiText(message);
        error.hidden = false;
      };

      const getValues = () => {
        const values = {};
        new FormData(form).forEach((value, key) => {
          values[key] = value;
        });
        return values;
      };

      const handleKeydown = (event) => {
        if (event.key === "Escape")
          finish({ action: "cancel", values: getValues() });
      };

      modal
        .querySelectorAll('[data-modal-action="cancel"]')
        .forEach((element) => {
          element.addEventListener("click", () =>
            finish({ action: "cancel", values: getValues() }),
          );
        });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const action =
          event.submitter?.dataset.modalAction ||
          actions.find((item) => item.id !== "cancel")?.id ||
          "confirm";
        const values = getValues();
        const validationMessage = options.validate
          ? options.validate(values, action)
          : "";
        if (validationMessage) {
          showError(validationMessage);
          return;
        }
        finish({ action, values });
      });

      document.addEventListener("keydown", handleKeydown);
      setTimeout(() => {
        const card = modal.querySelector(".app-action-modal-card");
        const firstInput = modal.querySelector("input, select, textarea");
        const preferredButton =
          modal.querySelector("[autofocus]") ||
          modal.querySelector(
            '[data-modal-action]:not([data-modal-action="cancel"])',
          );
        const focusTarget = firstInput || preferredButton;
        if (focusTarget?.focus) {
          focusTarget.focus({ preventScroll: true });
        }
        if (card) card.scrollTop = 0;
      }, 0);
    });
  },

  async confirmAction(options = {}) {
    const result = await App.ui.openActionModal({
      ...options,
      actions: options.actions || [
        {
          id: "cancel",
          label: options.cancelLabel || "Cancelar",
          variant: "secondary",
        },
        {
          id: "confirm",
          label: options.confirmLabel || "Confirmar",
          variant: options.confirmVariant || "primary",
          autofocus: true,
        },
      ],
    });

    return result.action === "confirm";
  },
};
