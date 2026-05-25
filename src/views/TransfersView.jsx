import { useEffect } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

function TransfersRuntime() {
  useAppRuntime();

  useEffect(() => {
    App.transfers.renderBudgetBoard();
    App.transfers.renderInsights();
    App.transfers.renderMarketPlayerResults();

    const form = document.getElementById("transferForm");
    if (form) {
      if (App.state.apiLoaded) App.transfers.populateExchangePlayers(form);
      App.transfers.renderTransferPreview(form);
    }

    App.transfers.renderHistory?.();
  });

  return null;
}

export { TransfersRuntime };
