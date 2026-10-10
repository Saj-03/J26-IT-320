import { Route } from "react-router-dom";
import { PhysicalHome } from "./pages/Home";
import { PhysicalPlan } from "./pages/Plan";
import { PhysicalExercise } from "./pages/Exercise";
import { PhysicalWorkout } from "./pages/Workout";
import { PhysicalNutrition } from "./pages/Nutrition";
import { PhysicalActivity } from "./pages/Activity";
import { PhysicalHabits } from "./pages/Habits";
import { PhysicalAchievements } from "./pages/Achievements";
import { PhysicalAdaptation } from "./pages/Adaptation";
import { PhysicalProgress } from "./pages/Progress";
import { PhysicalProfile } from "./pages/WellbeingProfile";
import { PhysicalNotifications } from "./pages/Notifications";
import { PhysicalPrivacy } from "./pages/Privacy";
import { PhysicalWelcome } from "./pages/Welcome";
import { PhysicalAssessment } from "./pages/Assessment";
import { PhysicalGenerating } from "./pages/Generating";
import { PhysicalModelTester } from "./pages/PhysicalModelTester";

// Mounted under /app by App.jsx (inside the standard IHSD shell).
export default function physicalRoutes() {
  return (
    <>
      <Route path="physical" element={<PhysicalHome />} />
      <Route path="physical/tester" element={<PhysicalModelTester />} />
      <Route path="physical/plan" element={<PhysicalPlan />} />
      <Route path="physical/exercise" element={<PhysicalExercise />} />
      <Route path="physical/workout" element={<PhysicalWorkout />} />
      <Route path="physical/nutrition" element={<PhysicalNutrition />} />
      <Route path="physical/activity" element={<PhysicalActivity />} />
      <Route path="physical/habits" element={<PhysicalHabits />} />
      <Route path="physical/achievements" element={<PhysicalAchievements />} />
      <Route path="physical/adaptation" element={<PhysicalAdaptation />} />
      <Route path="physical/progress" element={<PhysicalProgress />} />
      <Route path="physical/profile" element={<PhysicalProfile />} />
      <Route path="physical/notifications" element={<PhysicalNotifications />} />
      <Route path="physical/privacy" element={<PhysicalPrivacy />} />
    </>
  );
}

// Full-screen setup flow (like onboarding). Mounted at the top level by App.jsx.
export function physicalSetupRoutes() {
  return (
    <>
      <Route path="/physical-setup" element={<PhysicalWelcome />} />
      <Route path="/physical-setup/assessment" element={<PhysicalAssessment />} />
      <Route path="/physical-setup/generating" element={<PhysicalGenerating />} />
    </>
  );
}
