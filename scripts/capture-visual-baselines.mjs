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
    "calendar-desktop",
    "/league/calendar",
    "manager",
    { width: 1440, height: 1000 },
  ],
  ["cups-desktop", "/league/cups", "manager", { width: 1440, height: 1000 }],
  [
    "events-desktop",
    "/league/events",
    "manager",
    { width: 1440, height: 1000 },
  ],
  ["inbox-desktop", "/club/inbox", "manager", { width: 1440, height: 1000 }],
  [
    "commercial-desktop",
    "/club/commercial",
    "manager",
    { width: 1440, height: 1000 },
  ],
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
    "intelligence-desktop",
    "/ops/intelligence",
    "commissioner",
    { width: 1440, height: 1000 },
  ],
  [
    "results-desktop",
    "/ops/results",
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

const routeViewIds = new Map([
  ["/", "standingsView"],
  ["/league/standings", "standingsView"],
  ["/league/calendar", "calendarView"],
  ["/league/cups", "cupsView"],
  ["/league/events", "eventsView"],
  ["/club/inbox", "playersView"],
  ["/club/commercial", "playersView"],
  ["/club/transfers", "transfersView"],
  ["/club/squad", "squadView"],
  ["/ops/commissioner", "commissionerView"],
  ["/ops/intelligence", "experienceView"],
  ["/ops/results", "submitView"],
]);

const hoverChecks = [
  {
    name: "inbox-thread-hover",
    route: "/club/inbox",
    kind: "manager",
    viewport: { width: 1440, height: 1000 },
    waitSelector: ".email-office-layout",
    targetSelector: ".email-thread-item:not(.is-selected) .email-thread-button",
    assertSelector: ".email-thread-item:not(.is-selected)",
  },
  {
    name: "inbox-filter-hover",
    route: "/club/inbox",
    kind: "manager",
    viewport: { width: 1440, height: 1000 },
    waitSelector: ".email-office-layout",
    targetSelector: ".email-filter-button:not(.is-active)",
    assertSelector: ".email-filter-button:not(.is-active)",
  },
  {
    name: "nav-hover",
    route: "/club/transfers",
    kind: "manager",
    viewport: { width: 1440, height: 1000 },
    targetSelector: '.workspace-nav-tab[data-view="calendarView"]',
    assertSelector: '.workspace-nav-tab[data-view="calendarView"]',
  },
  {
    name: "standings-attention-hover",
    route: "/",
    kind: "manager",
    viewport: { width: 1440, height: 1000 },
    targetSelector: ".attention-item",
    assertSelector: ".attention-item",
  },
  {
    name: "transfer-action-hover",
    route: "/club/transfers",
    kind: "manager",
    viewport: { width: 1440, height: 1000 },
    waitSelector: "#transferForm",
    targetSelector: '#transferForm .primary-button[type="submit"]',
    assertSelector: '#transferForm .primary-button[type="submit"]',
  },
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

  async function preparePage(route, kind, viewport) {
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

    const view = routeViewIds.get(route) || null;

    if (view && kind) {
      await page.evaluate((viewId) => {
        window.App?.main?.switchToView?.(viewId);
        window.App?.main?.renderCurrentView?.();
      }, view);
      await page.waitForTimeout(1800);
    }

    return page;
  }

  for (const [name, route, kind, viewport] of routes) {
    const page = await preparePage(route, kind, viewport);

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
      const isVisible = (node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          getComputedStyle(node).visibility !== "hidden"
        );
      };
      const clickableNodes = [
        ...document.querySelectorAll(
          [
            "button:not(:disabled)",
            "a[href]",
            "summary",
            '[role="button"]',
            'input[type="checkbox"]:not(:disabled)',
            'input[type="radio"]:not(:disabled)',
            'input[type="range"]:not(:disabled)',
            "select:not(:disabled)",
          ].join(","),
        ),
      ].filter(isVisible);
      const nonPointerClickable = clickableNodes
        .filter((node) => getComputedStyle(node).cursor !== "pointer")
        .slice(0, 8)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: String(node.className || ""),
          text: String(node.textContent || "")
            .trim()
            .slice(0, 48),
          cursor: getComputedStyle(node).cursor,
        }));

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
        interactions: {
          clickableCount: clickableNodes.length,
          nonPointerClickable,
        },
      };
    });
    const problems = [];
    if (metrics.overflowX) {
      problems.push("document has horizontal overflow");
    }
    if (
      viewport.width >= 1180 &&
      metrics.interactions.nonPointerClickable.length > 0
    ) {
      problems.push(
        `visible clickable controls without pointer cursor: ${JSON.stringify(
          metrics.interactions.nonPointerClickable,
        )}`,
      );
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

  for (const check of hoverChecks) {
    const page = await preparePage(check.route, check.kind, check.viewport);

    if (check.waitSelector) {
      await page
        .waitForSelector(check.waitSelector, { timeout: 30000 })
        .catch(() => null);
    }

    const target = page.locator(check.targetSelector).first();
    const assertTarget = page.locator(check.assertSelector).first();
    await target.waitFor({ state: "visible", timeout: 30000 });
    await assertTarget.waitFor({ state: "visible", timeout: 30000 });
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const readHoverState = (selector) =>
      page
        .locator(selector)
        .first()
        .evaluate((node) => {
          const styles = getComputedStyle(node);
          return {
            backgroundColor: styles.backgroundColor,
            borderColor: styles.borderColor,
            boxShadow: styles.boxShadow,
            color: styles.color,
            cursor: styles.cursor,
            transform: styles.transform,
          };
        });

    const before = await readHoverState(check.assertSelector);
    await target.hover();
    await page.waitForTimeout(300);
    const after = await readHoverState(check.assertSelector);
    const targetCursor = await page
      .locator(check.targetSelector)
      .first()
      .evaluate((node) => getComputedStyle(node).cursor);
    const changed = [
      "backgroundColor",
      "borderColor",
      "boxShadow",
      "color",
      "transform",
    ].some((property) => before[property] !== after[property]);
    const file = path.join(OUT_DIR, `${check.name}.png`);
    await page.screenshot({ path: file, fullPage: false });

    if (targetCursor !== "pointer") {
      throw new Error(
        `${check.name} hover guard failed: target cursor is ${targetCursor}`,
      );
    }
    if (!changed) {
      throw new Error(
        `${check.name} hover guard failed: hover did not change visible styles`,
      );
    }

    summary.push({
      name: check.name,
      file,
      hover: {
        changed,
        targetCursor,
        before,
        after,
      },
    });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(summary, null, 2));
});
