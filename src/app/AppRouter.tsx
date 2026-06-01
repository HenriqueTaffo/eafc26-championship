import { Route, Routes } from "react-router-dom";
import { LegacyWorkspaceShell } from "./LegacyWorkspaceShell";

export function AppRouter() {
  return (
    <Routes>
      <Route path="*" element={<LegacyWorkspaceShell />} />
    </Routes>
  );
}

export default AppRouter;
