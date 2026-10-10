import { Route } from "react-router-dom";
import { Career } from "./pages/Career";
import QuestionnairePage from "./pages/QuestionnairePage";
import RoadmapPage from "./pages/RoadmapPage";
import InterviewPage from "./pages/InterviewPage";
import CareerDashboard from "./pages/CareerDashboard";
import CareerSurveyForm from "./pages/CareerSurveyForm";
import CareerRecommendations from "./pages/CareerRecommendations";
import SkillGapAnalysis from "./pages/SkillGapAnalysis";
import Roadmap from "./pages/Roadmap";
import InterviewSimulator from "./pages/InterviewSimulator";

// Mounted under /app by App.jsx.
export default function careerRoutes() {
  return (
    <>
      {/* ACRDS MVP flow: survey -> recommendations -> gap analysis -> roadmap */}
      <Route path="career" element={<CareerDashboard />} />
      <Route path="career/survey" element={<CareerSurveyForm />} />
      <Route path="career/recommendations" element={<CareerRecommendations />} />
      <Route path="career/gap-analysis" element={<SkillGapAnalysis />} />
      <Route path="career/roadmap" element={<Roadmap />} />
      <Route path="career/interview" element={<InterviewSimulator />} />

      {/* Earlier prototype pages (saved-profile flow), kept reachable */}
      <Route path="career/legacy" element={<Career />} />
      <Route path="career/questionnaire" element={<QuestionnairePage />} />
      <Route path="career/roadmap/:career" element={<RoadmapPage />} />
      <Route path="career/interview/:career" element={<InterviewPage />} />
    </>
  );
}
