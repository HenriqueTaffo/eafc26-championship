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
    if (!element || element.nodeType !== Node.ELEMENT_NODE || !App.utils?.polishUiText)
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
      root.querySelectorAll("*").forEach((element) =>
        App.dom.sanitizeElementAttributes(element),
      );
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
    const normalizedHtml = App.utils?.polishUiText
      ? App.utils.polishUiText(rawHtml)
      : rawHtml;
    const parsed = new window.DOMParser().parseFromString(
      `<body>${normalizedHtml}</body>`,
      "text/html",
    );
    const fragment = documentRef.createDocumentFragment();
    fragment.append(...parsed.body.childNodes);
    App.dom.sanitizeTree(fragment);
    return fragment;
  },

  setHtml(target, html = "") {
    if (!target) return;
    target.replaceChildren(App.dom.fragmentFromHtml(html));
    App.dom.sanitizeTree(target);
  },

  clear(target) {
    if (!target) return;
    target.replaceChildren();
  },
};

export default App;
