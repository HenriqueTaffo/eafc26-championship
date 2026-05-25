import { useEffect } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

function CommissionerRuntime() {
  const runtimeVersion = useAppRuntime();
  const isActive =
    typeof document !== "undefined" &&
    document.getElementById("commissionerView")?.classList.contains("active");

  useEffect(() => {
    if (!isActive) return;
    App.governance.renderGrid();
  }, [isActive, runtimeVersion]);

  return null;
}

export { CommissionerRuntime };
