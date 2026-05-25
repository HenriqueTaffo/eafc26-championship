import { useEffect } from "react";
import App from "../../js/app.js";
import { useAppRuntime } from "./ViewSummaries.jsx";

function CommissionerRuntime() {
  useAppRuntime();

  useEffect(() => {
    App.governance.renderGrid();
  });

  return null;
}

export { CommissionerRuntime };
