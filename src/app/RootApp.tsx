import { BrowserRouter } from "react-router-dom";
import { LeagueProviders } from "../runtime/LeagueProviders.jsx";
import { AppRouter } from "./AppRouter";

const routerBaseName =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/$/, "");

export function RootApp() {
  return (
    <LeagueProviders>
      <div className="react-shell product-v2-app">
        <BrowserRouter basename={routerBaseName}>
          <AppRouter />
        </BrowserRouter>
      </div>
    </LeagueProviders>
  );
}

export default RootApp;
