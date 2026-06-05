import { useEffect } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

function TransfersRuntime({ activeSubview = "" } = {}) {
  const runtimeVersion = useAppRuntime();
  const isActive =
    typeof document !== "undefined" &&
    document.getElementById("transfersView")?.classList.contains("active");

  useEffect(() => {
    if (!isActive) return;

    App.transfers.renderBudgetBoard();
    App.transfers.renderInsights();
    App.transfers.bindWorkspaceEvents?.();

    const form = document.getElementById("transferForm");
    if (form) {
      App.forms?.setupTransferPreview?.();
      if (App.state.apiLoaded) App.transfers.populateExchangePlayers(form);
      if (App.transfers.pendingCandidateForProposal) {
        App.transfers.loadCandidateIntoForm?.(
          App.transfers.pendingCandidateForProposal,
        );
        App.transfers.pendingCandidateForProposal = null;
      }
      App.transfers.refreshWorkspace?.(form);
    }
    App.transfers.renderMarketPlayerResults();

    App.transfers.syncTransferWindowLock();
    App.transfers.renderWorkspace?.(form);
    App.transfers.renderHistory?.();

    const view = document.getElementById("transfersView");
    const syncPlayerPhotos = () =>
      App.transfers.syncPlayerPhotoLoadStates?.(view || document);
    syncPlayerPhotos();
    window.requestAnimationFrame(syncPlayerPhotos);
    const photoSyncTimer = window.setTimeout(syncPlayerPhotos, 800);

    return () => window.clearTimeout(photoSyncTimer);
  }, [activeSubview, isActive, runtimeVersion]);

  return null;
}

export { TransfersRuntime };
