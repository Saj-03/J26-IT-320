import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardListIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { EmptyState } from "../../../shared/components/ui/States";
import { apiErrorMessage } from "../../../shared/api/client";
import { getGapAnalysis } from "../api/careerApi";
import { careerSession } from "../utils/careerSession";
import RecommendationCard from "../components/RecommendationCard";

export default function CareerRecommendations() {
  const navigate = useNavigate();
  const { profile, recommendations } = careerSession.get();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  if (!profile || !recommendations?.length) {
    return (
      <Card>
        <EmptyState icon={ClipboardListIcon} title="No recommendations yet"
          desc="Complete the career profile survey to see your top 5 career paths."
          actionLabel="Start survey" onAction={() => navigate("/app/career/survey")} />
      </Card>
    );
  }

  const select = async (rec) => {
    setBusyId(rec.career_id);
    setError("");
    try {
      const gap = await getGapAnalysis({ career_id: rec.career_id, profile });
      careerSession.update({ selectedCareer: rec, gapAnalysis: gap, roadmap: null });
      navigate("/app/career/gap-analysis");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <CareerPage className="space-y-5">
      <PageHeader
        title="Your Top 5 Career Paths"
        subtitle="Ranked by how closely your skill profile matches each career, plus your interests and experience. Select one to see your skill gaps."
        action={<Button variant="outline" onClick={() => navigate("/app/career/survey")}>Edit profile</Button>}
      />
      {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}
      {recommendations.map((rec, i) => (
        <RecommendationCard key={rec.career_id} rec={rec} rank={i + 1}
          onSelect={select} busy={busyId === rec.career_id} />
      ))}
    </CareerPage>
  );
}
