import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../js/app.js";
import { LegacyLoginPanel } from "./StaticShell.jsx";

type TestLegacyApp = typeof App & {
  auth?: Record<string, unknown>;
};

const legacyApp = App as TestLegacyApp;

describe("LegacyLoginPanel", () => {
  const originalAuth = legacyApp.auth;

  afterEach(() => {
    cleanup();
    legacyApp.auth = originalAuth;
    vi.restoreAllMocks();
  });

  it("rehydrates the legacy login DOM after a React rerender", () => {
    let authenticated = false;
    const renderLoginPanel = vi.fn(() => {
      const panel = document.getElementById("managerLoginPanel");
      if (!panel) return;

      panel.innerHTML = authenticated
        ? '<div data-testid="session-card">Tecnico conectado</div>'
        : '<form data-testid="login-form"><button type="submit">Enviar</button></form>';
    });

    legacyApp.auth = {
      ...originalAuth,
      renderLoginPanel,
    };

    const { getByTestId, queryByTestId, rerender } = render(
      <LegacyLoginPanel />,
    );

    expect(getByTestId("login-form")).toBeInTheDocument();

    authenticated = true;
    rerender(<LegacyLoginPanel />);

    expect(queryByTestId("login-form")).not.toBeInTheDocument();
    expect(getByTestId("session-card")).toBeInTheDocument();
    expect(renderLoginPanel).toHaveBeenCalledTimes(2);
  });
});
