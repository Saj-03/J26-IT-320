import { useNavigate } from "react-router-dom";
import { MapIcon, MicIcon, PartyPopperIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { EmptyState, LoadingState } from "../../../shared/components/ui/States";
import { useCareerFlow } from "../utils/careerSession";
import RoadmapItem from "../components/RoadmapItem";
import PrintButton from "../components/PrintButton";

export default function Roadmap() {
  const navigate = useNavigate();
  const { flow: { roadmap }, ready } = useCareerFlow();

  if (!ready && !roadmap) return <LoadingState label="Loading your saved roadmap…" />;
  if (!roadmap) {
    return (
      <Card>
        <EmptyState icon={MapIcon} title="No roadmap yet"
          desc="Generate a roadmap from your skill gap analysis."
          actionLabel="Go to skill gap analysis" onAction={() => navigate("/app/career/gap-analysis")} />
      </Card>
    );
  }

  return (
    <CareerPage className="space-y-5" step="roadmap">
      <PageHeader
        title={`Your Roadmap: ${roadmap.career_name}`}
        subtitle={`${roadmap.message} Current readiness: ${Math.round(roadmap.readiness_percentage)}%. High-priority items come first.`}
        action={
          <div className="acrds-no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/app/career")}>Dashboard</Button>
            <PrintButton />
            <Button onClick={() => navigate("/app/career/interview")}><MicIcon size={16} /> Practise interview</Button>
          </div>
        }
      />

      {roadmap.roadmap.length === 0 ? (
        <Card>
          <EmptyState icon={PartyPopperIcon} title="You're career-ready on core skills"
            desc="Keep building portfolio projects and prepare for interviews." />
        </Card>
      ) : (
        <ol className="space-y-5">
          {roadmap.roadmap.map((item, i) => (
            <RoadmapItem key={item.skill} item={item} step={i + 1} last={i === roadmap.roadmap.length - 1} />
          ))}
        </ol>
      )}
    </CareerPage>
  );
}
