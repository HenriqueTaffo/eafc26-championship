import { useEffect } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

function TransfersRuntime() {
  const runtimeVersion = useAppRuntime();
  const isActive =
    typeof document !== "undefined" &&
    document.getElementById("transfersView")?.classList.contains("active");

  useEffect(() => {
    if (!isActive) return;

    App.transfers.renderBudgetBoard();
    App.transfers.renderInsights();
    App.transfers.renderMarketPlayerResults();
    App.transfers.bindWorkspaceEvents?.();

    const form = document.getElementById("transferForm");
    if (form) {
      if (App.state.apiLoaded) App.transfers.populateExchangePlayers(form);
      App.transfers.refreshWorkspace?.(form);
    }

    App.transfers.syncTransferWindowLock();
    App.transfers.renderWorkspace?.(form);
    App.transfers.renderHistory?.();
  }, [isActive, runtimeVersion]);

  return null;
}

export { TransfersRuntime };
