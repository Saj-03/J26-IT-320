import { Route, Navigate } from "react-router-dom";
import { Scheduler } from "./pages/Scheduler";
import { Tasks } from "./pages/Tasks";
import { AddTask } from "./pages/AddTask";
import { Focus } from "./pages/Focus";
import { TaskBreakdown } from "./pages/tasks/Breakdown";
import { TaskDetails } from "./pages/tasks/TaskDetails";
import { AttentionPatterns } from "./pages/schedule/Attention";
import { StressAdjust } from "./pages/schedule/StressAdjust";
import { MissedSession } from "./pages/schedule/MissedSession";
import { SessionSetup } from "./pages/focus/SessionSetup";

// Mounted under /app by App.jsx. Called as a function so React Router sees plain <Route> elements.
export default function schedulerRoutes() {
  return (
    <>
      <Route path="schedule" element={<Scheduler />} />
      <Route path="schedule/attention" element={<AttentionPatterns />} />
      <Route path="schedule/adjusted" element={<StressAdjust />} />
      <Route path="schedule/missed" element={<MissedSession />} />
      <Route path="tasks" element={<Tasks />} />
      <Route path="tasks/breakdown" element={<TaskBreakdown />} />
      <Route path="tasks/detail" element={<TaskDetails />} />
      <Route path="add-task" element={<AddTask />} />
      <Route path="focus" element={<Focus />} />
      <Route path="focus/setup" element={<SessionSetup />} />
      {/* [ITEM 1] Camera focus detection removed (not in my proposal). Old links go to the Focus page. */}
      <Route path="focus-detection" element={<Navigate to="/app/focus" replace />} />
    </>
  );
}
