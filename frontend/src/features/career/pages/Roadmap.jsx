import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, CalendarCheckIcon, FileUserIcon, InfoIcon, ListPlusIcon, MapIcon, MicIcon, PartyPopperIcon, XIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { EmptyState } from "../../../shared/components/ui/States";
import { careerSession, useCareerFlow } from "../utils/careerSession";
import RoadmapItem from "../components/RoadmapItem";
import { nextRoadmapStep, roadmapStats } from "../utils/roadmapProgress";
import PrintButton from "../components/PrintButton";
import CareerMilestones from "../components/CareerMilestones";
import TaskManagerDialog from "../components/TaskManagerDialog";
import { addRoadmapToTaskManager } from "../utils/taskManagerBridge";
import CareerSkeleton from "../components/CareerSkeleton";
import Reveal from "../components/Reveal";
import { CountUp } from "../hooks/useCountUp";
import { celebrate, originOf } from "../utils/celebrate";
import { toast } from "../utils/toast";
import { ROADMAP_PART_KEYS } from "../utils/roadmapProgress";
import { skillLabel } from "../constants";
import { t, useLanguage } from "../i18n";

export default function Roadmap() {
  useLanguage(); // re-render when the language changes
  const navigate = useNavigate();
  const { flow: { roadmap, roadmapProgress }, ready } = useCareerFlow();
  const [progress, setProgress] = useState(roadmapProgress || {});
  useEffect(() => setProgress(roadmapProgress || {}), [roadmapProgress]);
  // Task Manager prompt (optional; it never blocks the next step)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskNotice, setTaskNotice] = useState("");
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  if (!ready && !roadmap) return <CareerSkeleton variant="roadmap" label={t("Loading your saved roadmap…")} />;
  if (!roadmap) {
    return (
      <Card>
        <EmptyState icon={MapIcon} title={t("No roadmap yet")}
          desc={t("Generate a roadmap from your skill gap analysis.")}
          actionLabel={t("Go to skill gap analysis")} onAction={() => navigate("/app/career/gap-analysis")} />
      </Card>
    );
  }

  const items = roadmap.roadmap;
  const { done, total, pct } = roadmapStats(roadmap, progress);
  const focus = nextRoadmapStep(roadmap, progress);

  const saveProgress = (next) => {
    setProgress(next);
    careerSession.update({ roadmapProgress: next }); // saved to the database with the rest of the flow
  };
  // Ticking something off: a toast, a confetti burst from the pressed button, a bigger one when everything is done.
  const toggle = (skill, part) => {
    const next = { ...progress, [skill]: { ...progress[skill], [part]: !progress[skill]?.[part] } };
    const origin = originOf(document.activeElement);
    saveProgress(next);
    if (!next[skill][part]) return toast.info(t("Marked as not done"));
    if (roadmapStats(roadmap, next).pct === 100) {
      celebrate("big");
      return toast.success(t("Roadmap complete. Well done!"), { emoji: "🎉" });
    }
    if (ROADMAP_PART_KEYS.every((k) => next[skill][k])) {
      celebrate("small", origin);
      return toast.success(t("All {skill} activities done!", { skill: skillLabel(skill) }), { emoji: "🌟" });
    }
    toast.success(t("Nice! Marked as done."));
  };
  const toggleMilestone = (id) => {
    const done = !progress.milestones?.[id];
    const origin = originOf(document.activeElement);
    saveProgress({ ...progress, milestones: { ...progress.milestones, [id]: done } });
    if (!done) return toast.info(t("Marked as not done"));
    celebrate("small", origin);
    toast.success(t("Milestone reached!"), { emoji: "🏁" });
  };

  // The selected career goes with the navigation, so the simulator loads its questions straight away.
  const goToInterview = () => navigate("/app/career/interview", { state: { careerId: roadmap.career_id } });
  const goToCV = () => navigate("/app/career/cv", { state: { careerId: roadmap.career_id } }); // optional step

  // "Yes": hand the roadmap to the Task Manager bridge. Integration is not available yet, so the
  // student is told that honestly; the roadmap stays on screen and nothing is changed.
  const confirmTaskManager = async () => {
    setTaskBusy(true);
    try {
      const result = await addRoadmapToTaskManager(roadmap);
      setTaskNotice(result.status === "added"
        ? t("Your roadmap was added to your Task Manager.")
        : t("Task Manager integration is coming soon. Your roadmap is still available here."));
    } catch {
      setTaskNotice(t("Could not reach the Task Manager. Your roadmap is still available here."));
    } finally {
      setTaskBusy(false);
      setDialogOpen(false);
    }
  };

  return (
    <CareerPage className="space-y-5" step="roadmap">
      <PageHeader
        title={t("Your Roadmap: {career}", { career: roadmap.career_name })}
        subtitle={`${roadmap.message} ${t("Current readiness: {pct}%. High-priority items come first.", { pct: Math.round(roadmap.readiness_percentage) })}`}
        action={
          <div className="acrds-no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/app/career")}>{t("Dashboard")}</Button>
            <PrintButton />
            <Button onClick={goToInterview}><MicIcon size={16} /> {t("Practise interview")}</Button>
          </div>
        }
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={PartyPopperIcon} title={t("You're career-ready on core skills")}
            desc={t("Keep building portfolio projects and prepare for interviews.")} />
        </Card>
      ) : (
        <>
          {/* Progress + this week's focus */}
          <Card padding="lg" className="grid md:grid-cols-[1fr_1.2fr] gap-5 items-center">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted">{t("Your progress")}</p>
              <p className="text-3xl font-extrabold text-charcoal"><CountUp value={pct} suffix="%" /></p>
              <div className="h-2.5 rounded-full bg-[#E3FFD6] overflow-hidden" role="progressbar"
                aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("Roadmap progress")}>
                <div className="h-full rounded-full bg-gradient-to-r from-[#9ADBCC] to-[#5DBFA9] transition-all duration-500"
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-charcoal-muted">{t("{done} of {total} activities done · tick them off as you go", { done, total })}</p>
            </div>
            {focus ? (
              <div className="rounded-2xl bg-[#D0F2F7]/60 border border-[#9EB2DB]/50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#34477A]">
                  <CalendarCheckIcon size={14} /> {t("This week's focus")}
                </p>
                <p className="mt-1 font-bold text-charcoal">{skillLabel(focus.item.skill)}: {t(focus.label)}</p>
                <p className="text-sm text-charcoal-light">{focus.item[focus.key]}</p>
                <Button size="sm" className="mt-3 acrds-no-print" onClick={() => toggle(focus.item.skill, focus.key)}>
                  {t("Mark as done")}
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#C7F2D1]/70 border border-[#5DBFA9]/50 p-4 text-center">
                <PartyPopperIcon size={28} className="mx-auto text-[#1F5F53]" />
                <p className="mt-1 font-bold text-charcoal">{t("Roadmap complete. Well done!")}</p>
                <p className="text-sm text-charcoal-light">{t("Update your survey with your new skill levels to see your new readiness.")}</p>
                <Button size="sm" className="mt-3 acrds-no-print" onClick={() => navigate("/app/career/survey")}>{t("Update my skills")}</Button>
              </div>
            )}
          </Card>

          <section aria-labelledby="skill-steps-title" className="space-y-3">
            <h2 id="skill-steps-title" className="text-lg font-extrabold text-charcoal">{t("Close your skill gaps")}</h2>
            <ol className="space-y-5">
              {items.map((item, i) => (
                <Reveal as="li" key={item.skill} index={i} className="list-none">
                  <RoadmapItem as="div" item={item} step={i + 1} last={i === items.length - 1}
                    done={progress[item.skill]} onToggle={(part) => toggle(item.skill, part)} />
                </Reveal>
              ))}
            </ol>
          </section>
        </>
      )}

      <CareerMilestones career={roadmap.career_name} milestones={roadmap.milestones}
        done={progress.milestones} onToggle={toggleMilestone} onPractise={goToInterview} />

      {/* Next steps: two independent choices. The Task Manager is optional and never blocks the interview. */}
      <Card padding="lg" className="acrds-no-print space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-charcoal">{t("Your Personalized Career Roadmap")}</h2>
          <p className="text-sm text-charcoal-muted">
            {t("Keep this roadmap here, optionally add it to your Task Manager or create your CV, and practise your interview when you are ready.")}
          </p>
        </div>
        {taskNotice && (
          <div role="status" className="flex items-start gap-2 rounded-2xl bg-[#D0F2F7]/70 border border-[#9EB2DB]/50 px-4 py-3 text-sm text-[#24566A]">
            <InfoIcon size={18} className="shrink-0 mt-0.5" />
            <span className="flex-1">{taskNotice}</span>
            <button type="button" onClick={() => setTaskNotice("")} aria-label={t("Close")}
              className="shrink-0 rounded-full p-0.5 hover:bg-black/[0.05]"><XIcon size={16} /></button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => setDialogOpen(true)} className="sm:flex-1">
            <ListPlusIcon size={16} /> {t("Add to Task Manager")}
          </Button>
          <Button variant="soft" onClick={goToCV} className="sm:flex-1">
            <FileUserIcon size={16} /> {t("Create My CV")}
          </Button>
          <Button onClick={goToInterview} className="sm:flex-1">
            {t("Continue to AI Interview Simulator")} <ArrowRightIcon size={16} />
          </Button>
        </div>
      </Card>

      {/* Phone: the next step is always one thumb-tap away (sits above the app's bottom navigation) */}
      {createPortal(
        <div className="acrds-no-print sm:hidden fixed inset-x-3 bottom-20 z-40 flex gap-2 rounded-full bg-[#FFFBF0]/95 backdrop-blur border border-[#9ADBCC]/60 shadow-lift p-1.5">
          <Button variant="outline" size="sm" aria-label={t("Add to Task Manager")} onClick={() => setDialogOpen(true)} className="px-3">
            <ListPlusIcon size={18} />
          </Button>
          <Button variant="outline" size="sm" aria-label={t("Create My CV")} onClick={goToCV} className="px-3">
            <FileUserIcon size={18} />
          </Button>
          <Button size="sm" onClick={goToInterview} className="flex-1">
            <MicIcon size={16} /> {t("Continue to AI Interview Simulator")}
          </Button>
        </div>,
        document.body,
      )}
      <div className="h-16 sm:hidden" aria-hidden />

      <TaskManagerDialog open={dialogOpen} busy={taskBusy} onConfirm={confirmTaskManager} onClose={closeDialog} />
    </CareerPage>
  );
}
