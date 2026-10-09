import { Route } from "react-router-dom";
import { Career } from "./pages/Career";
import QuestionnairePage from "./pages/QuestionnairePage";
import RoadmapPage from "./pages/RoadmapPage";
import InterviewPage from "./pages/InterviewPage";

// Mounted under /app by App.jsx.
export default function careerRoutes() {
  return (
    <>
      <Route path="career" element={<Career />} />
      <Route path="career/questionnaire" element={<QuestionnairePage />} />
      <Route path="career/roadmap/:career" element={<RoadmapPage />} />
      <Route path="career/interview/:career" element={<InterviewPage />} />
    </>
  );
}
