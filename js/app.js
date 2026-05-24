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

export default App;
