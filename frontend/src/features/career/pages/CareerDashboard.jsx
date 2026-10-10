import { useNavigate } from "react-router-dom";
import { ClipboardListIcon, SparklesIcon, BarChart3Icon, MapIcon, MicIcon, ArrowRightIcon, ShieldCheckIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { careerSession } from "../utils/careerSession";
import { ETHICS_NOTES } from "../constants";
import { ui } from "../theme";

export default function CareerDashboard() {
  const navigate = useNavigate();
  const flow = careerSession.get();

  // Each step unlocks once the previous step has produced a result.
  const steps = [
    { title: "Career Profile", icon: ClipboardListIcon, to: "/app/career/survey", ready: true,
      desc: "Tell us about your studies, skills, interests and activities." },
    { title: "Career Recommendations", icon: SparklesIcon, to: "/app/career/recommendations", ready: !!flow.recommendations,
      desc: "Your top 5 career paths, ranked by skill-profile match with clear reasons." },
    { title: "Skill Gap Analysis", icon: BarChart3Icon, to: "/app/career/gap-analysis", ready: !!flow.gapAnalysis,
      desc: "Compare your current skill levels with what your chosen career needs." },
    { title: "Personalized Roadmap", icon: MapIcon, to: "/app/career/roadmap", ready: !!flow.roadmap,
      desc: "Courses, projects and weekly tasks to close your most important gaps." },
  ];

  const stepLabel = (i, ready) => {
    if (i === 0) return flow.profile ? "Edit profile" : "Start";
    return ready ? "View" : "Complete previous step";
  };

  return (
    <CareerPage>
      <PageHeader
        title="Adaptive Career Readiness and Development System"
        subtitle="Move from career confusion to career readiness: profile → recommendations → skill gaps → roadmap."
        action={
          <Button onClick={() => navigate("/app/career/survey")}>
            {flow.profile ? "Update my profile" : "Start career survey"} <ArrowRightIcon size={16} />
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 gap-5">
        {steps.map(({ title, icon: Icon, to, ready, desc }, i) => (
          <Card key={title} padding="lg" hover className="flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <span className={`w-10 h-10 rounded-2xl ${ui.iconTile} flex items-center justify-center`}>
                <Icon size={20} />
              </span>
              <div>
                <p className="text-xs font-bold text-charcoal-muted">Step {i + 1}</p>
                <h3 className="font-bold text-charcoal">{title}</h3>
              </div>
            </div>
            <p className="text-sm text-charcoal-muted flex-1">{desc}</p>
            <Button className="mt-4 self-start" variant={ready ? "soft" : "outline"} size="sm"
              disabled={!ready} onClick={() => navigate(to)}>
              {stepLabel(i, ready)}
            </Button>
          </Card>
        ))}
      </div>

      {/* Step 5: AI Interview Simulator (available any time) */}
      <Card padding="lg" className="border-2 border-[#9EB2DB] bg-[#D0F2F7]/40">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-2xl bg-[#FFFBF0] text-[#34477A] flex items-center justify-center">
            <MicIcon size={20} />
          </span>
          <div>
            <p className="text-xs font-bold text-charcoal-muted">Step 5</p>
            <h3 className="font-bold text-charcoal">AI Interview Simulator</h3>
          </div>
        </div>
        <p className="text-sm text-charcoal-muted mb-3">
          Practise career-specific interview questions by typing, speaking or on camera, and get feedback on answer
          content, speaking pace and presentation.
          {flow.interviewReport && ` Last score: ${Math.round(flow.interviewReport.overall_score)}/100 (${flow.interviewReport.readiness_band}).`}
        </p>
        <ul className="space-y-1">
          {ETHICS_NOTES.map((note) => (
            <li key={note} className="flex items-start gap-2 text-xs text-charcoal-light">
              <ShieldCheckIcon size={14} className="mt-0.5 text-[#1F5F53] shrink-0" /> {note}
            </li>
          ))}
        </ul>
        <Button className="mt-4" size="sm" onClick={() => navigate("/app/career/interview")}>
          <MicIcon size={16} /> Start interview practice
        </Button>
      </Card>
    </CareerPage>
  );
}
