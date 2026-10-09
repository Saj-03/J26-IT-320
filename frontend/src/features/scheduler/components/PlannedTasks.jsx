// Live plan from /scheduler/plan. adaptive=false is the STATIC baseline used in the controlled pilot.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckIcon, PlusIcon, TimerIcon } from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../../../shared/components/ui/States";
import useFetch from "../../../shared/hooks/useFetch";
import { cn } from "../../../shared/lib/cn";
import AdaptationBanner from "./AdaptationBanner";
import { completeTask } from "../api";

const loadStyle = {
  heavy: "bg-brand-50 text-brand-700",
  medium: "bg-amber-light text-amber-700",
  low: "bg-sage-light text-emerald-700",
};

export default function PlannedTasks() {
  const navigate = useNavigate();
  const [adaptive, setAdaptive] = useState(true);
  const { data, error, loading, reload } = useFetch(`/scheduler/plan?adaptive=${adaptive}`);

  return (
    <Card padding="lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-charcoal">Planned by IHSD</h3>
          <p className="text-sm text-charcoal-muted">
            Peak hours: {data?.peak_hours?.length ? data.peak_hours.map((h) => `${h}:00`).join(", ") : "still learning"}
            {data?.pomodoro && ` · ${data.pomodoro.focus_minutes} min focus / ${data.pomodoro.break_minutes} min break`}
          </p>
        </div>
        <div className="flex bg-cream rounded-full p-1 w-fit">
          {[true, false].map((a) => (
            <button key={String(a)} onClick={() => setAdaptive(a)}
              className={cn("px-4 py-1.5 rounded-full text-sm font-semibold transition-colors", adaptive === a ? "bg-brand-500 text-white" : "text-charcoal-light")}>
              {a ? "Adaptive" : "Static baseline"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5"><AdaptationBanner onDone={reload} /></div>

      {loading && !data ? <LoadingState label="Building your plan…" /> :
        error ? <ErrorState onRetry={reload} /> :
        !data?.tasks?.length ? (
          <EmptyState title="No tasks to plan yet" desc="Add a task and IHSD will place it in your best focus hours."
            actionLabel="Add a task" onAction={() => navigate("/app/add-task")} />
        ) : (
          <ul className="space-y-2">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-cream p-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-charcoal truncate">{t.title}</p>
                    <span className={cn("text-[11px] font-bold rounded-full px-2 py-0.5 capitalize", loadStyle[t.load] || loadStyle.medium)}>{t.load}</span>
                  </div>
                  <p className="text-xs text-charcoal-muted mt-0.5">
                    {t.start ? new Date(t.start).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "No slot before the deadline"}
                    {" · due "}{new Date(t.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate("/app/focus")}>
                    <TimerIcon size={14} /> Focus
                  </Button>
                  <Button size="sm" onClick={() => completeTask(t.id).then(reload)}>
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
