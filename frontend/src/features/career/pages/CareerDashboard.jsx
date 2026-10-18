import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardListIcon, SparklesIcon, BarChart3Icon, MapIcon, MicIcon, ArrowRightIcon, ShieldCheckIcon,
  TrophyIcon, GaugeIcon, TargetIcon, CheckCircle2Icon, LockIcon, RotateCcwIcon, CompassIcon,
} from "lucide-react";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { cn } from "../../../shared/lib/cn";
import { useCareerFlow } from "../utils/careerSession";
import { getInterviewHistory } from "../api/careerApi";
import { ETHICS_NOTES, GLOSSARY, skillLabel } from "../constants";
import InfoTip from "../components/InfoTip";
import { nextRoadmapStep, roadmapStats } from "../utils/roadmapProgress";
import { ui } from "../theme";
import { t, useLanguage } from "../i18n";
import Reveal from "../components/Reveal";
import { CountUp } from "../hooks/useCountUp";
import { toast } from "../utils/toast";

const LOCALE = { en: "en-GB", si: "si-LK", ta: "ta-LK" };

// Summary tile in the hero banner. `help` = optional plain-language explanation.
function Stat({ icon: Icon, label, value, sub, help }) {
  return (
    <div className="relative hover:z-30 focus-within:z-30 rounded-2xl bg-white/70 backdrop-blur px-4 py-3 border border-white/80 min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#34477A]">
        <Icon size={13} /> {label}
        {help && <InfoTip label={label} align="left">{help}</InfoTip>}
      </p>
      <p className="text-base sm:text-lg font-extrabold text-charcoal leading-tight break-words">{value}</p>
      {sub && <p className="text-xs text-charcoal-muted leading-tight mt-0.5 break-words">{sub}</p>}
    </div>
  );
}

export default function CareerDashboard() {
  const lang = useLanguage();
  const navigate = useNavigate();
  const { flow, reset } = useCareerFlow();
  const [history, setHistory] = useState([]);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  const startOver = async () => {
    if (!window.confirm(t("Start over? Your profile, recommendations, skill gaps and roadmap will be deleted. Your interview practice history is kept."))) return;
    setResetting(true);
    setResetError("");
    try {
      await reset();
      toast.info(t("Your career progress was reset."));
    } catch {
      setResetError(t("Could not reset your progress. Check your connection and try again."));
    } finally {
      setResetting(false);
    }
  };
  useEffect(() => {
    getInterviewHistory(5).then(setHistory).catch(() => {});
  }, []);

  const top = flow.recommendations?.[0];
  const lastInterview = history[0]?.overall_score ?? flow.interviewReport?.overall_score;

  // Each step unlocks once the previous step has produced a result.
  const steps = [
    { title: "Career Profile", icon: ClipboardListIcon, to: "/app/career/survey", ready: true, done: !!flow.profile,
      desc: "Tell us about your studies, skills, interests and activities.", accent: "bg-[#9ADBCC]" },
    { title: "Career Recommendations", icon: SparklesIcon, to: "/app/career/recommendations", ready: !!flow.recommendations,
      done: !!flow.recommendations, desc: "Your top 5 career paths for your faculty, with clear reasons.", accent: "bg-[#C7F2D1]" },
    { title: "Skill Gap Analysis", icon: BarChart3Icon, to: "/app/career/gap-analysis", ready: !!flow.gapAnalysis,
      done: !!flow.gapAnalysis, desc: "Compare your skill levels with what your chosen career needs.", accent: "bg-[#D0F2F7]" },
    { title: "Personalized Roadmap", icon: MapIcon, to: "/app/career/roadmap", ready: !!flow.roadmap,
      done: !!flow.roadmap, desc: "Courses, projects and weekly tasks to close your most important gaps.", accent: "bg-[#9EB2DB]" },
  ];
  const completed = steps.filter((s) => s.done).length;
  const roadmapDone = flow.roadmap ? roadmapStats(flow.roadmap, flow.roadmapProgress) : null;
  const focus = flow.roadmap ? nextRoadmapStep(flow.roadmap, flow.roadmapProgress) : null;

  // One clear "do this next" action, based on how far the student has got.
  const next = !flow.profile
    ? { title: t("Start with the 5-minute career survey"), desc: t("Answer questions about your studies, skills and interests to get your top 5 careers."), label: t("Start survey"), to: "/app/career/survey" }
    : !flow.gapAnalysis
      ? { title: t("Choose a career from your top 5"), desc: t("Compare your options, then pick one to see exactly which skills to build."), label: t("See my careers"), to: "/app/career/recommendations" }
      : !flow.roadmap
        ? { title: t("Turn your {career} skill gaps into a plan", { career: flow.gapAnalysis.career_name }), desc: t("Get courses, projects and weekly tasks for your weakest skills."), label: t("Build my roadmap"), to: "/app/career/gap-analysis" }
        : focus
          ? { title: t("This week: {skill}, {part}", { skill: skillLabel(focus.item.skill), part: t(focus.label) }), desc: focus.item[focus.key], label: t("Open my roadmap"), to: "/app/career/roadmap" }
          : !lastInterview
            ? { title: t("Practise an interview for {career}", { career: flow.roadmap.career_name }), desc: t("Answer 5 real questions by typing, voice or camera and get instant feedback."), label: t("Start interview practice"), to: "/app/career/interview" }
            : { title: t("Keep improving your score"), desc: t("Try a new question set, or update your survey after learning new skills."), label: t("Practise again"), to: "/app/career/interview" };

  const action = (s, i) => {
    if (i === 0) return flow.profile ? t("Edit profile") : t("Start");
    return s.ready ? t("View") : t("Complete previous step");
  };

  return (
    <CareerPage>
      {/* Hero */}
      <section className="rounded-4xl bg-gradient-to-br from-[#9ADBCC] via-[#D0F2F7] to-[#9EB2DB] p-6 sm:p-8 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-[#1F5F53]">{t("Career Readiness")} · ACRDS</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#12352E] tracking-tight mt-1">
              {t("Adaptive Career Readiness and Development System")}
            </h1>
            <p className="text-sm text-[#1F4A43] mt-2">
              {t("Move from career confusion to career readiness: profile → recommendations → skill gaps → roadmap → interview.")}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 w-40 rounded-full bg-white/60 overflow-hidden">
                <div className="h-full rounded-full bg-[#1F5F53] transition-all duration-700" style={{ width: `${(completed / 4) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-[#1F5F53]">{t("{n} of 4 steps done", { n: completed })}</span>
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-2">
            <Button size="lg" className="bg-[#FFFBF0] hover:bg-white text-[#1F5F53]"
              onClick={() => navigate("/app/career/survey")}>
              {flow.profile ? t("Update my profile") : t("Start career survey")} <ArrowRightIcon size={18} />
            </Button>
            {flow.profile && (
              <button type="button" onClick={startOver} disabled={resetting}
                className="flex items-center gap-1.5 text-xs font-bold text-[#1F5F53] hover:underline disabled:opacity-60">
                <RotateCcwIcon size={13} /> {resetting ? t("Resetting…") : t("Start over")}
              </button>
            )}
            {resetError && <p className="text-xs font-semibold text-red-700">{resetError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <Stat icon={TrophyIcon} label={t("Top match")} value={top ? top.career_name : "—"}
            sub={top ? t("{n}% match", { n: Math.round(top.match_percentage) }) : t("Complete the survey")} />
          <Stat icon={TargetIcon} label={t("Readiness")} help={GLOSSARY.readiness}
            value={flow.gapAnalysis ? <CountUp value={flow.gapAnalysis.readiness_percentage} suffix="%" /> : "—"}
            sub={flow.gapAnalysis ? flow.gapAnalysis.career_name : t("Select a career")} />
          <Stat icon={GaugeIcon} label={t("Skill stage")} help={GLOSSARY.persona} value={flow.persona?.name || "—"}
            sub={flow.persona ? t("avg {n}/5", { n: flow.persona.average_skill_level }) : t("From your survey")} />
          <Stat icon={MicIcon} label={t("Last interview")} help={GLOSSARY.interviewScore} value={lastInterview != null ? <CountUp value={lastInterview} suffix="/100" /> : "—"}
            sub={lastInterview != null ? t("practice score") : t("Not practised yet")} />
        </div>
      </section>

      {/* Next best action */}
      <Card padding="none" className="overflow-hidden border-2 border-[#9ADBCC] acrds-glow">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6 bg-[#FFFBF0]">
          <span className="w-12 h-12 rounded-2xl bg-[#9ADBCC] text-[#12352E] flex items-center justify-center shrink-0">
            <CompassIcon size={24} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-[#1F5F53]">{t("Your next step")}</p>
            <h2 className="text-lg font-extrabold text-charcoal">{next.title}</h2>
            <p className="text-sm text-charcoal-muted">{next.desc}</p>
            {roadmapDone && roadmapDone.total > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 w-36 rounded-full bg-[#E3FFD6] overflow-hidden">
                  <div className="h-full rounded-full bg-[#5DBFA9]" style={{ width: `${roadmapDone.pct}%` }} />
                </div>
                <span className="text-xs font-bold text-[#1F5F53]">{t("Roadmap {n}% done", { n: roadmapDone.pct })}</span>
              </div>
            )}
          </div>
          <Button onClick={() => navigate(next.to)} className="self-start sm:self-auto">
            {next.label} <ArrowRightIcon size={16} />
          </Button>
        </div>
      </Card>

      {/* Steps */}
      <div className="grid sm:grid-cols-2 gap-5">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.title} index={i} className="flex">
            <Card padding="none" hover className="flex flex-col overflow-hidden w-full">
              <div className={cn("h-1.5", s.accent)} />
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`w-11 h-11 rounded-2xl ${ui.iconTile} flex items-center justify-center`}>
                    <Icon size={20} />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-charcoal-muted">{t("Step {n}", { n: i + 1 })}</p>
                    <h3 className="font-bold text-charcoal">{t(s.title)}</h3>
                  </div>
                  {s.done ? (
                    <span className="flex items-center gap-1 rounded-full bg-[#C7F2D1] text-[#1F5E3D] px-2.5 py-1 text-xs font-bold">
                      <CheckCircle2Icon size={13} /> {t("Done")}
                    </span>
                  ) : !s.ready && (
                    <span className="flex items-center gap-1 rounded-full bg-black/[0.04] text-charcoal-muted px-2.5 py-1 text-xs font-bold">
                      <LockIcon size={12} /> {t("Locked")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-charcoal-muted flex-1">{t(s.desc)}</p>
                <Button className="mt-4 self-start" variant={s.ready ? "soft" : "outline"} size="sm"
                  disabled={!s.ready} onClick={() => navigate(s.to)}>
                  {action(s, i)}
                </Button>
              </div>
            </Card>
            </Reveal>
          );
        })}
      </div>

      {/* Step 5: AI Interview Simulator (available any time) */}
      <Card padding="none" className="overflow-hidden border-2 border-[#9EB2DB]">
        <div className="grid md:grid-cols-[1.4fr_1fr]">
          <div className="p-6 bg-[#D0F2F7]/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-11 h-11 rounded-2xl bg-[#FFFBF0] text-[#34477A] flex items-center justify-center">
                <MicIcon size={20} />
              </span>
              <div>
                <p className="text-xs font-bold text-charcoal-muted">{t("Step {n}", { n: 5 })}</p>
                <h3 className="font-bold text-charcoal">{t("AI Interview Simulator")}</h3>
              </div>
            </div>
            <p className="text-sm text-charcoal-muted mb-3">
              {t("Practise career-specific interview questions by typing, speaking or on camera, and get feedback on answer content, speaking pace and presentation.")}
            </p>
            <ul className="space-y-1">
              {ETHICS_NOTES.map((note) => (
                <li key={note} className="flex items-start gap-2 text-xs text-charcoal-light">
                  <ShieldCheckIcon size={14} className="mt-0.5 text-[#1F5F53] shrink-0" /> {t(note)}
                </li>
              ))}
            </ul>
            <Button className="mt-4" onClick={() => navigate("/app/career/interview")}>
              <MicIcon size={16} /> {t("Start interview practice")}
            </Button>
          </div>
          <div className="p-6 bg-[#FFFBF0]">
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-2">{t("Your recent practice")}</p>
            {history.length ? (
              <ul className="space-y-2.5">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-charcoal truncate">{h.career_name}</p>
                      <div className="h-1.5 rounded-full bg-[#E3FFD6] mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-[#5DBFA9]" style={{ width: `${h.overall_score}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-charcoal">{Math.round(h.overall_score)}</p>
                      <p className="text-[10px] text-charcoal-muted">{new Date(h.created_at).toLocaleDateString(LOCALE[lang])}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-charcoal-muted">{t("Your interview scores will appear here so you can track your progress.")}</p>
            )}
          </div>
        </div>
      </Card>
    </CareerPage>
  );
}
