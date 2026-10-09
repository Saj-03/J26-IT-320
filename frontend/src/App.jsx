/*
 * VIVA: "App.jsx is only the route map. Each research component lives in
 * src/features/<component>/ so every member's UI is separate."
 */
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppLayout } from "./shared/components/layout/AppLayout";
import ProtectedRoute from "./shared/components/ProtectedRoute";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { Progress } from "./pages/Progress";
import { Insights } from "./pages/Insights";
import { Notifications } from "./pages/Notifications";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { Privacy } from "./pages/Privacy";
import { ResearchParticipant } from "./pages/ResearchParticipant";
import { AdminResearch } from "./pages/AdminResearch";

import schedulerRoutes from "./features/scheduler/routes";
import burnoutRoutes from "./features/burnout/routes";
import careerRoutes from "./features/career/routes";
import physicalRoutes, { physicalSetupRoutes } from "./features/physical-wellbeing/routes";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
        <Route path="/onboarding" element={<Onboarding />} />
        {physicalSetupRoutes()}

        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          {schedulerRoutes()}
          {burnoutRoutes()}
          {physicalRoutes()}
          {careerRoutes()}
          <Route path="progress" element={<Progress />} />
          <Route path="insights" element={<Insights />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="research" element={<ResearchParticipant />} />
          <Route path="admin" element={<AdminResearch />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
