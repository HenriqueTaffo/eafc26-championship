const App = window.App || {};
const listeners = new Set();
let snapshotVersion = 0;
let notifyQueued = false;

window.App = App;

App.react = App.react || {
  getSnapshot() {
    return snapshotVersion;
  },

  notify() {
    if (notifyQueued) return;
    notifyQueued = true;
    Promise.resolve().then(() => {
      notifyQueued = false;
      snapshotVersion += 1;
      listeners.forEach((listener) => listener());
    });
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

App.dom = App.dom || {
  sanitizerObserver: null,
  sanitizerInstalled: false,

  sanitizeTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const raw = node.nodeValue;
    if (!raw || !App.utils?.polishUiText) return;
    const normalized = App.utils.polishUiText(raw);
    if (normalized !== raw) node.nodeValue = normalized;
  },

  sanitizeElementAttributes(element, attributeNames = null) {
    if (
      !element ||
      element.nodeType !== Node.ELEMENT_NODE ||
      !App.utils?.polishUiText
    )
      return;

    const allowedNames = attributeNames || [
      "placeholder",
      "title",
      "aria-label",
      "alt",
      "value",
    ];

    allowedNames.forEach((name) => {
      if (!element.hasAttribute?.(name)) return;
      if (
        name === "value" &&
        !(
          window.HTMLInputElement &&
          element instanceof window.HTMLInputElement &&
          ["button", "submit", "reset"].includes(
            String(element.type || "").toLowerCase(),
          )
        )
      ) {
        return;
      }

      const raw = element.getAttribute(name);
      if (!raw) return;
      const normalized = App.utils.polishUiText(raw);
      if (normalized !== raw) element.setAttribute(name, normalized);
    });
  },

  sanitizeTree(root) {
    if (!root || !App.utils?.polishUiText) return root;

    if (root.nodeType === Node.TEXT_NODE) {
      App.dom.sanitizeTextNode(root);
      return root;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      App.dom.sanitizeElementAttributes(root);
    }

    const documentRef = window.document;
    const walker = documentRef.createTreeWalker(
      root,
      window.NodeFilter.SHOW_TEXT,
      null,
    );
    while (walker.nextNode()) {
      App.dom.sanitizeTextNode(walker.currentNode);
    }

    if (typeof root.querySelectorAll === "function") {
      root
        .querySelectorAll("*")
        .forEach((element) => App.dom.sanitizeElementAttributes(element));
    }

    return root;
  },

  installTextSanitizer() {
    if (
      App.dom.sanitizerInstalled ||
      typeof window === "undefined" ||
      !window.document?.body ||
      typeof window.MutationObserver !== "function"
    ) {
      return;
    }

    App.dom.sanitizerInstalled = true;
    App.dom.sanitizeTree(window.document.body);

    App.dom.sanitizerObserver = new window.MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          App.dom.sanitizeTextNode(mutation.target);
          return;
        }

        if (mutation.type === "attributes") {
          App.dom.sanitizeElementAttributes(mutation.target, [
            mutation.attributeName,
          ]);
          return;
        }

        mutation.addedNodes.forEach((node) => App.dom.sanitizeTree(node));
      });
    });

    App.dom.sanitizerObserver.observe(window.document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt", "value"],
    });
  },

  fragmentFromHtml(html = "") {
    const documentRef = window.document;
    const rawHtml = String(html);
    const parsed = new window.DOMParser().parseFromString(
      `<body>${rawHtml}</body>`,
      "text/html",
    );
    const fragment = documentRef.createDocumentFragment();
    fragment.append(...parsed.body.childNodes);
    return App.dom.sanitizeTree(fragment);
  },

  setHtml(target, html = "") {
    if (!target) return;
    target.replaceChildren(App.dom.fragmentFromHtml(html));
    window.requestAnimationFrame(() => {
      App.motion?.applyStagger?.(target);
      App.transfers?.syncPlayerPhotoLoadStates?.(target);
    });
  },

  clear(target) {
    if (!target) return;
    target.replaceChildren();
  },
};

App.motion = App.motion || {
  timers: new WeakMap(),
  bodyTimer: null,
  navTimer: null,
  staggerSelector: [
    ".summary-card",
    ".home-panel",
    ".home-cup-card",
    ".calendar-card",
    ".calendar-month-card",
    ".calendar-week-card",
    ".calendar-event-card",
    ".coach-panel-card",
    ".decision-card",
    ".email-thread-item",
    ".sponsor-email-message",
    ".sponsor-active-item",
    ".submit-card",
    ".commissioner-card",
    ".experience-card",
    ".transfer-deal-card",
    ".transfer-scout-card",
    ".transfer-shortlist-card",
    ".transfer-hub-card",
    ".transfer-ops-card",
    ".transfer-compare-card",
    ".transfer-negotiation-card",
    ".transfer-movement-card",
    ".transfer-insight-card",
    ".transfer-kanban-card",
    ".transfer-timeline-item",
    ".transfer-deal-alert",
    ".transfer-hub-card-body",
    ".squad-roster-row",
    ".squad-slot",
    ".market-player-option",
    ".qol-metric-card",
    ".qol-action-row",
  ].join(","),

  prefersReducedMotion() {
    return Boolean(
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  },

  applyStagger(root = document) {
    if (!root || App.motion.prefersReducedMotion()) return;
    const candidates = [];
    if (
      root.nodeType === Node.ELEMENT_NODE &&
      root.matches?.(App.motion.staggerSelector)
    ) {
      candidates.push(root);
    }
    if (typeof root.querySelectorAll === "function") {
      candidates.push(...root.querySelectorAll(App.motion.staggerSelector));
    }

    candidates.slice(0, 90).forEach((element, index) => {
      element.classList.add("motion-stagger-item");
      element.style.setProperty("--motion-index", String(Math.min(index, 14)));
    });
  },

  enterView(view) {
    if (!view || App.motion.prefersReducedMotion()) return;

    const previousTimer = App.motion.timers.get(view);
    if (previousTimer) window.clearTimeout(previousTimer);

    App.motion.applyStagger(view);
    view.classList.remove("motion-view-enter");
    void view.offsetWidth;
    view.classList.add("motion-view-enter");

    document.body?.classList.add("is-view-transitioning");
    App.motion.syncNavigation();

    const timer = window.setTimeout(() => {
      view.classList.remove("motion-view-enter");
      document.body?.classList.remove("is-view-transitioning");
      App.motion.timers.delete(view);
    }, 760);
    App.motion.timers.set(view, timer);
  },

  unlockShell() {
    if (App.motion.prefersReducedMotion()) return;
    window.clearTimeout(App.motion.bodyTimer);
    document.body?.classList.add("auth-unlock-entering");
    App.motion.applyStagger(document);
    App.motion.syncNavigation();
    App.motion.bodyTimer = window.setTimeout(() => {
      document.body?.classList.remove("auth-unlock-entering");
    }, 960);
  },

  syncNavigation() {
    if (App.motion.prefersReducedMotion()) return;
    const activeTab = document.querySelector(
      ".workspace-nav-tab.active, .workspace-nav-tab[aria-current='page']",
    );
    if (!activeTab) return;
    window.clearTimeout(App.motion.navTimer);
    activeTab.classList.remove("motion-nav-active");
    void activeTab.offsetWidth;
    activeTab.classList.add("motion-nav-active");
    App.motion.navTimer = window.setTimeout(() => {
      activeTab.classList.remove("motion-nav-active");
    }, 620);
  },
};

export default App;
