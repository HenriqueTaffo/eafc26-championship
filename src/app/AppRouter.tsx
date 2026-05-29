import { Navigate, Route, Routes } from "react-router-dom";
import { LegacyWorkspaceShell } from "./LegacyWorkspaceShell";
import { DEFAULT_WORKSPACE_ROUTE, workspaceRoutes } from "../shared/navigation/workspace-routes";

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate replace to={DEFAULT_WORKSPACE_ROUTE.path} />}
      />
      {workspaceRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<LegacyWorkspaceShell />}
        />
      ))}
      <Route
        path="*"
        element={<Navigate replace to={DEFAULT_WORKSPACE_ROUTE.path} />}
      />
    </Routes>
  );
}

export default AppRouter;
