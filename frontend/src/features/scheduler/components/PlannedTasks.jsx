// "Planned by ThriveU" card on the Scheduler page - the student's open tasks from the API,
// with their planned time, the M1 best hours and the suggested focus / break length.
// (The Adaptive / Static toggle is NOT here - students must not see the experiment mode.)
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CheckIcon, PlusIcon, TimerIcon, HeartHandshakeIcon } from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { EmptyState } from "../../../shared/components/ui/States";
import { cn } from "../../../shared/lib/cn";
import { finishTask, getAttentionProfile, getTimerRecommendation, listTasks } from "../api";
import { dayText, hoursLabel, isOpen, timeText } from "../lib";

const loadStyle = {
  heavy: "bg-brand-50 text-brand-700",
  medium: "bg-amber-light text-amber-700",
  low: "bg-sage-light text-emerald-700",
};

export default function PlannedTasks({ reloadKey = 0 }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [timer, setTimer] = useState(null);
  const [peaks, setPeaks] = useState(null);

  const load = () => {
    // open tasks that are worked on directly (a big task with steps is planned through its steps)
    listTasks().then((all) => {
      const parents = new Set(all.map((t) => t.parent_id).filter(Boolean));
      setTasks(all.filter((t) => isOpen(t) && !parents.has(t.id)));
    }).catch(() => setTasks([]));
  };
  useEffect(() => {
    load();
    getTimerRecommendation().then(setTimer).catch(() => {});
    getAttentionProfile().then((p) => setPeaks(p.source === "m1_model" ? p.peak_hours : null)).catch(() => {});
  }, [reloadKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const complete = (id) => finishTask(id).then(load);

  return (
    <Card padding="lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-charcoal">Planned by ThriveU</h3>
          <p className="text-sm text-charcoal-muted">
            {peaks ? `Best focus: ${hoursLabel(peaks.slice(0, 2))}` : "Best focus time: still learning"}
            {timer && ` · ${timer.focus_minutes} min focus / ${timer.break_minutes} min break`}
          </p>
        </div>
      </div>

      <div className="mb-5">
        <Button variant="soft" size="sm" onClick={() => navigate("/app/schedule/adjusted")}>
          <HeartHandshakeIcon size={15} /> Check if my plan should ease up
        </Button>
      </div>

      {!tasks.length ? (
          <EmptyState title="No tasks to plan yet" desc="Add a task and ThriveU will place it in your best focus hours."
            actionLabel="Add a task" onAction={() => navigate("/app/add-task")} />
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-cream p-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-charcoal truncate">{t.title}</p>
                    <span className={cn("text-[11px] font-bold rounded-full px-2 py-0.5 capitalize", loadStyle[t.cognitive_load] || loadStyle.medium)}>{t.cognitive_load}</span>
                  </div>
                  <p className="text-xs text-charcoal-muted mt-0.5">
                    {t.scheduled_start ? `${dayText(t.scheduled_start)} ${timeText(t.scheduled_start)}` : "Not planned yet"}
                    {" · due "}{dayText(t.deadline)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!t.scheduled_start && (
                    <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate(`/app/schedule/missed?id=${t.id}`)}>
                      Find a time
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate("/app/focus/setup", { state: { taskId: t.id } })}>
                    <TimerIcon size={14} /> Focus
                  </Button>
                  <Button size="sm" onClick={() => complete(t.id)}>
                    <CheckIcon size={14} /> Done
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

      <Button variant="ghost" size="sm" className="mt-3 -ml-3" onClick={() => navigate("/app/add-task")}>
        <PlusIcon size={15} /> Add task
      </Button>
    </Card>
  );
}
