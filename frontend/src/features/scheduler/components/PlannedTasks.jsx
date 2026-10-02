// "Planned by IHSD" card on the Scheduler page.
// [ITEM 8] Uses mock data from data.js (no backend yet): same tasks, peak hours and focus/break as other pages.
// [ITEM 3] The Adaptive / Static baseline toggle was REMOVED from here. Students must not see it.
// It is now a per-participant setting on the AdminResearch page.
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CheckIcon, PlusIcon, TimerIcon, HeartHandshakeIcon } from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { EmptyState } from "../../../shared/components/ui/States";
import { cn } from "../../../shared/lib/cn";
import { schedulerTasks, peakHours, getSessionPlan } from "../data";

// [ITEM 8] Turn the shared task list into the plan shape this card shows (only tasks not done yet)
const startingPlan = schedulerTasks
  .filter((t) => t.status !== "done")
  .map((t) => ({ id: t.id, title: t.title, load: t.cognitive_load, start: t.scheduled_start, deadline: t.deadline }));
const session = getSessionPlan();

const loadStyle = {
  heavy: "bg-brand-50 text-brand-700",
  medium: "bg-amber-light text-amber-700",
  low: "bg-sage-light text-emerald-700",
};

export default function PlannedTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(startingPlan);
  // Mark a task done = remove it from the plan (local only)
  const complete = (id) => setTasks((ts) => ts.filter((t) => t.id !== id));

  return (
    <Card padding="lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-charcoal">Planned by IHSD</h3>
          <p className="text-sm text-charcoal-muted">
            Peak hours: {peakHours.label} · {session.focus} min focus / {session.breakMins} min break
          </p>
        </div>
      </div>

      {/* Opens the stress suggestions page (the user decides there) */}
      <div className="mb-5">
        <Button variant="soft" size="sm" onClick={() => navigate("/app/schedule/adjusted")}>
          <HeartHandshakeIcon size={15} /> Check if my plan should ease up
        </Button>
      </div>

      {!tasks.length ? (
          <EmptyState title="No tasks to plan yet" desc="Add a task and IHSD will place it in your best focus hours."
            actionLabel="Add a task" onAction={() => navigate("/app/add-task")} />
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
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
