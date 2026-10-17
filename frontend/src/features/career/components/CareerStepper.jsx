import { useNavigate } from "react-router-dom";
import { CheckIcon } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { careerSession } from "../utils/careerSession";
import { t } from "../i18n";

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

  const index = Math.max(0, STEPS.findIndex((s) => s.key === current));
  return (
    <>
      {/* Phone: compact "Step 3 of 5" with a segmented bar (the full tracker does not fit) */}
      <nav aria-label={t("Career readiness steps")} className="sm:hidden space-y-1.5">
        <p className="flex items-center justify-between text-xs font-bold text-[#1F5F53]">
          <span>{t("Step {n} of {total}", { n: index + 1, total: STEPS.length })} · {t(STEPS[index].label)}</span>
          {index < STEPS.length - 1 && STEPS[index + 1].open(flow) && (
            <button type="button" className="underline" onClick={() => navigate(STEPS[index + 1].to)}>
              {t("Next:")} {t(STEPS[index + 1].label)}
            </button>
          )}
        </p>
        <ol className="grid grid-cols-5 gap-1">
          {STEPS.map((step, i) => (
            <li key={step.key}>
              <button type="button" disabled={!step.open(flow)} onClick={() => navigate(step.to)}
                aria-label={`${t("Step {n}", { n: i + 1 })}: ${t(step.label)}`} aria-current={i === index ? "step" : undefined}
                className={cn("block h-1.5 w-full rounded-full",
                  i === index ? "bg-[#1F5F53]" : step.done(flow) ? "bg-[#5DBFA9]" : "bg-[#9EB2DB]/40")} />
            </li>
          ))}
        </ol>
      </nav>

    <nav aria-label={t("Career readiness steps")} className="hidden sm:block overflow-x-auto -mx-1 px-1">
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
                {t(step.label)}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
    </>
  );
}
