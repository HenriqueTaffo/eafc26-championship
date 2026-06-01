import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const PORT = Number(process.env.VISUAL_PORT || 5178);
const HOST = "127.0.0.1";
const BASE_URL =
  process.env.VISUAL_BASE_URL || `http://${HOST}:${PORT}/eafc26-championship/`;
const OUT_DIR = path.resolve(
  process.env.VISUAL_OUT_DIR || "reports/visual-baselines",
);

const routes = [
  ["login-desktop", "/", null, { width: 1440, height: 1000 }],
  ["standings-desktop", "/", "manager", { width: 1440, height: 1000 }],
  [
    "transfers-desktop",
    "/club/transfers",
    "manager",
    { width: 1440, height: 1000 },
  ],
  ["squad-desktop", "/club/squad", "manager", { width: 1440, height: 1000 }],
  [
    "commissioner-desktop",
    "/ops/commissioner",
    "commissioner",
    { width: 1440, height: 1000 },
  ],
  [
    "transfers-mobile",
    "/club/transfers",
    "manager",
    { width: 390, height: 844 },
  ],
];

function createSession(kind) {
  if (!kind) return null;

  const isCommissioner = kind === "commissioner";
  return {
    managerId: isCommissioner ? "comissario" : "visual-baseline-manager",
    managerName: isCommissioner ? "Comissario da Liga" : "Henrique",
    clubName: isCommissioner ? "" : "Henrique",
    isCommissioner,
    accessCode: "visual-baseline",
    sessionToken: "",
    sessionExpiresAt: "",
    scope: {
      organizationId: "4linhas",
      organizationName: "4 Linhas",
      leagueId: "championship",
      leagueName: "Championship Managers Hub",
      seasonId: "2026-championship",
      seasonName: "Temporada 2026",
      membershipRole: isCommissioner ? "commissioner" : "manager",
    },
  };
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Retry until Vite is ready.
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(poll, 500);
    };

    poll();
  });
}

async function withDevServer(callback) {
  if (process.env.VISUAL_BASE_URL) {
    await callback();
    return;
  }

  const server = await createServer({
    server: {
      host: HOST,
      port: PORT,
      strictPort: true,
    },
  });

  try {
    await server.listen();
    await waitForServer(`http://${HOST}:${PORT}/`);
    await callback();
  } finally {
    await server.close();
  }
}

await mkdir(OUT_DIR, { recursive: true });

await withDevServer(async () => {
  const browser = await chromium.launch({ headless: true });
  const summary = [];

  for (const [name, route, kind, viewport] of routes) {
    const page = await browser.newPage({ viewport });
    const session = createSession(kind);

    await page.addInitScript((payload) => {
      sessionStorage.removeItem("mistura_manager_session_v2");
      if (payload) {
        sessionStorage.setItem(
          "mistura_manager_session_v2",
          JSON.stringify(payload),
        );
      }
    }, session);

    const targetUrl = new URL(route.replace(/^\//, ""), BASE_URL).toString();
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3500);

    const view = route.includes("transfers")
      ? "transfersView"
      : route.includes("squad")
        ? "squadView"
        : route.includes("commissioner")
          ? "commissionerView"
          : null;

    if (view && kind) {
      await page.evaluate((viewId) => {
        window.App?.main?.switchToView?.(viewId);
        window.App?.main?.renderCurrentView?.();
      }, view);
      await page.waitForTimeout(1800);
    }

    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const metrics = await page.evaluate(() => {
      const readRect = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
        };
      };
      const readStyles = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const styles = getComputedStyle(node);
        return {
          display: styles.display,
          gridTemplateColumns: styles.gridTemplateColumns,
          maxHeight: styles.maxHeight,
          overflow: styles.overflow,
        };
      };

      return {
        activeView: document.querySelector(".view.active")?.id || "",
        overflowX: document.documentElement.scrollWidth > innerWidth + 2,
        width: document.documentElement.scrollWidth,
        innerWidth,
        chrome: {
          app: readStyles(".app"),
          shell: readRect(".shell-top-cluster"),
          shellStyles: readStyles(".shell-top-cluster"),
          nav: readRect(".workspace-nav"),
          navStyles: readStyles(".workspace-nav"),
          navScrollWidth:
            document.querySelector(".workspace-nav")?.scrollWidth || 0,
          navClientWidth:
            document.querySelector(".workspace-nav")?.clientWidth || 0,
          status: readRect(".app-status-bar"),
        },
      };
    });
    const problems = [];
    if (metrics.overflowX) {
      problems.push("document has horizontal overflow");
    }
    if (kind && viewport.width >= 1180) {
      const minimumChromeWidth = Math.round(viewport.width * 0.65);
      if ((metrics.chrome.shell?.width || 0) < minimumChromeWidth) {
        problems.push(
          `shell chrome collapsed to ${metrics.chrome.shell?.width || 0}px`,
        );
      }
      if ((metrics.chrome.nav?.width || 0) < minimumChromeWidth) {
        problems.push(
          `workspace nav collapsed to ${metrics.chrome.nav?.width || 0}px`,
        );
      }
      if ((metrics.chrome.status?.width || 0) < minimumChromeWidth) {
        problems.push(
          `status bar collapsed to ${metrics.chrome.status?.width || 0}px`,
        );
      }
      if ((metrics.chrome.nav?.height || 0) > 320) {
        problems.push(
          `workspace nav is too tall (${metrics.chrome.nav?.height || 0}px)`,
        );
      }
      if (metrics.chrome.navScrollWidth > metrics.chrome.navClientWidth + 2) {
        problems.push("workspace nav has horizontal internal overflow");
      }
      if (
        String(metrics.chrome.app?.gridTemplateColumns || "").includes("292px")
      ) {
        problems.push("app grid still contains the rejected 292px sidebar");
      }
    }
    if (problems.length > 0) {
      throw new Error(`${name} layout guard failed: ${problems.join("; ")}`);
    }
    summary.push({ name, file, ...metrics });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(summary, null, 2));
});
