import { useNavigate } from "react-router-dom";
import { CheckIcon } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { careerSession } from "../utils/careerSession";

// The five ACRDS steps. `done` = the step has a saved result; `open` = the student can go there.
const STEPS = [
  { key: "profile", label: "Profile", to: "/app/career/survey", done: (f) => !!f.profile, open: () => true },
  { key: "careers", label: "Careers", to: "/app/career/recommendations", done: (f) => !!f.recommendations, open: (f) => !!f.recommendations },
  { key: "gap", label: "Skill gap", to: "/app/career/gap-analysis", done: (f) => !!f.gapAnalysis, open: (f) => !!f.gapAnalysis },
  { key: "roadmap", label: "Roadmap", to: "/app/career/roadmap", done: (f) => !!f.roadmap, open: (f) => !!f.roadmap },
  { key: "interview", label: "Interview", to: "/app/career/interview", done: (f) => !!f.interviewReport, open: () => true },
];

// Progress tracker shown at the top of every career page.
export default function CareerStepper({ current }) {
  const navigate = useNavigate();
  const flow = careerSession.get(); // re-read on every render, so it follows saved progress

  return (
    <nav aria-label="Career readiness steps" className="overflow-x-auto -mx-1 px-1">
      <ol className="flex items-center min-w-max gap-1">
        {STEPS.map((step, i) => {
          const done = step.done(flow);
          const active = step.key === current;
          const open = step.open(flow);
          return (
            <li key={step.key} className="flex items-center">
              {i > 0 && <span className={cn("w-6 sm:w-10 h-0.5 rounded-full mx-1", done || active ? "bg-[#5DBFA9]" : "bg-[#9EB2DB]/40")} />}
              <button type="button" disabled={!open} onClick={() => navigate(step.to)}
                aria-current={active ? "step" : undefined}
                className={cn("flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs font-bold transition-colors",
                  active ? "bg-[#9ADBCC] text-[#12352E] shadow-sm"
                    : open ? "text-[#1F5F53] hover:bg-[#E3FFD6]" : "text-charcoal-muted cursor-not-allowed")}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px]",
                  active ? "bg-[#FFFBF0] text-[#1F5F53]"
                    : done ? "bg-[#C7F2D1] text-[#1F5F53]" : "bg-white/70 border border-[#9EB2DB]/60 text-[#34477A]")}>
                  {done && !active ? <CheckIcon size={13} strokeWidth={3} /> : i + 1}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
