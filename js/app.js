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
  fragmentFromHtml(html = "") {
    const documentRef = window.document;
    const parsed = new window.DOMParser().parseFromString(
      `<body>${String(html)}</body>`,
      "text/html",
    );
    const fragment = documentRef.createDocumentFragment();
    fragment.append(...parsed.body.childNodes);
    return fragment;
  },

  setHtml(target, html = "") {
    if (!target) return;
    target.replaceChildren(App.dom.fragmentFromHtml(html));
  },

  clear(target) {
    if (!target) return;
    target.replaceChildren();
  },
};

export default App;
