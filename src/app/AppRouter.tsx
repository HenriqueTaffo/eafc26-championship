import { Route, Routes } from "react-router-dom";
import { LegacyWorkspaceShell } from "./LegacyWorkspaceShell";
import { workspaceRoutes } from "../shared/navigation/workspace-routes";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LegacyWorkspaceShell />} />
      {workspaceRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<LegacyWorkspaceShell />}
        />
      ))}
      <Route path="*" element={<LegacyWorkspaceShell />} />
    </Routes>
  );
}

export default AppRouter;
