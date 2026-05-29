import { BrowserRouter } from "react-router-dom";
import { LeagueProviders } from "../runtime/LeagueProviders.jsx";
import { AppRouter } from "./AppRouter";

export function RootApp() {
  return (
    <LeagueProviders>
      <div className="react-shell product-v2-app">
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </div>
    </LeagueProviders>
  );
}

export default RootApp;
