// Today's numbers for the Overview page, all from the scheduler API:
//   tasks planned today, M1 best hours, focus minutes + completion rate today, streak.
import { useEffect, useState } from "react";
import api from "../../../shared/api/client";
import { getAttentionProfile, getProgress, listTasks } from "../api";
import { hoursLabel, isOpen, sameDay, toDate } from "../lib";

const EMPTY = { tasks: [], doneToday: 0, peakLabel: null, focusMinutes: 0, completionRate: null, streak: 0, loaded: false };

export default function useToday() {
  const [today, setToday] = useState(EMPTY);

  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const optional = (p) => p.catch(() => null);           // one failing call must not blank the page
    Promise.all([
      listTasks(),
      optional(getAttentionProfile()),
      optional(getProgress()),
      optional(api.get("/scheduler/focus/history", { params: { from: midnight.toISOString(), limit: 1 } }).then((r) => r.data)),
    ])
      .then(([all, profile, progress, history]) => {
        const plannedToday = all.filter((t) => sameDay(toDate(t.scheduled_start), new Date()));
        setToday({
          tasks: plannedToday.filter(isOpen).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)),
          doneToday: plannedToday.filter((t) => t.status === "done").length,
          peakLabel: profile?.source === "m1_model" ? hoursLabel(profile.peak_hours.slice(0, 2)) : null,
          focusMinutes: history?.summary.total_focus_minutes ?? 0,
          completionRate: history?.summary.completion_rate ?? null,
          streak: progress?.streak.current ?? 0,
          loaded: true,
        });
      })
      .catch(() => setToday({ ...EMPTY, loaded: true }));
  }, []);

  return today;
}
