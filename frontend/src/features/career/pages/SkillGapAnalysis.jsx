import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3Icon, MapIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { ProgressRing } from "../../../shared/components/ui/ProgressRing";
import { EmptyState } from "../../../shared/components/ui/States";
import { apiErrorMessage } from "../../../shared/api/client";
import { generateRoadmap } from "../api/careerApi";
import { careerSession } from "../utils/careerSession";
import GapTable from "../components/GapTable";
import { INK, PALETTE } from "../theme";

export default function SkillGapAnalysis() {
  const navigate = useNavigate();
  const { profile, gapAnalysis } = careerSession.get();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!profile || !gapAnalysis) {
    return (
      <Card>
        <EmptyState icon={BarChart3Icon} title="No career selected yet"
          desc="Pick a career from your recommendations to see your skill gaps."
          actionLabel="View recommendations" onAction={() => navigate("/app/career/recommendations")} />
      </Card>
    );
  }

  const count = (status) => gapAnalysis.skill_gaps.filter((g) => g.status === status).length;

  const buildRoadmap = async () => {
    setBusy(true);
    setError("");
    try {
      const roadmap = await generateRoadmap({ career_id: gapAnalysis.career_id, profile });
      careerSession.update({ roadmap });
      navigate("/app/career/roadmap");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareerPage>
      <PageHeader
        title={`Skill Gap Analysis: ${gapAnalysis.career_name}`}
        subtitle="Gap = required level − your current level. Strong (≤ 0), Needs Improvement (1), Critical Gap (≥ 2)."
        action={<Button variant="outline" onClick={() => navigate("/app/career/recommendations")}>Choose another career</Button>}
      />

      <Card padding="lg">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing value={gapAnalysis.readiness_percentage} size={120} stroke={11} color={INK.ring} track={PALETTE.lime}>
            <span className="text-2xl font-extrabold text-charcoal">{Math.round(gapAnalysis.readiness_percentage)}%</span>
            <span className="text-xs font-semibold text-charcoal-muted">ready</span>
          </ProgressRing>
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="font-bold text-charcoal">Career readiness for {gapAnalysis.career_name}</h3>
            <p className="text-sm text-charcoal-muted">
              {count("Strong")} strong · {count("Needs Improvement")} need improvement · {count("Critical Gap")} critical gap(s)
            </p>
            <Button onClick={buildRoadmap} disabled={busy}>
              <MapIcon size={16} /> {busy ? "Generating…" : "Generate Roadmap"}
            </Button>
          </div>
        </div>
      </Card>

      {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}

      <Card padding="lg">
        <GapTable gaps={gapAnalysis.skill_gaps} />
      </Card>
    </CareerPage>
  );
}
