import React, { useState, useEffect } from 'react';
import { LockKeyholeIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { PhysicalMasterCard } from '../components/PhysicalMasterCard';
import { getActivitySummary, getHabits } from '../api';

export function PhysicalAchievements() {
  const [activity, setActivity] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getActivitySummary(), getHabits()])
      .then(([summary, savedHabits]) => {
        setActivity(summary);
        setHabits(Array.isArray(savedHabits) ? savedHabits : []);
      })
      .catch(() => setError('Could not load achievements. Refresh and try again.'))
      .finally(() => setLoading(false));
  }, []);

  const days = activity?.daily_history || [];
  const activeDays = Number(activity?.weekly_totals?.days_active || 0);
  const weeklyMinutes = Number(activity?.weekly_totals?.exercise_minutes || 0);
  const peakStepsInADay = days.reduce((peak, day) => Math.max(peak, Number(day.steps || 0)), 0);
  const longestHabitStreak = habits.reduce((best, habit) => Math.max(best, Number(habit.streak || 0)), 0);
  const milestones = [
    { id: 'first-move', icon: '👟', title: 'First Move', detail: 'Record steps or exercise in your activity log.', current: Number(activity?.weekly_totals?.steps || 0) + weeklyMinutes > 0 ? 1 : 0, target: 1, unit: 'logged activity' },
    { id: 'three-days', icon: '🗓️', title: 'Show Up Three Times', detail: 'Be active on three different days in the last seven days.', current: activeDays, target: 3, unit: 'active days' },
    { id: 'stride', icon: '⚡', title: 'Big Day on Your Feet', detail: 'Reach 10,000 steps in a single logged day.', current: peakStepsInADay, target: 10000, unit: 'steps in one day' },
    { id: 'move-hour', icon: '⏱️', title: 'An Hour of Movement', detail: 'Log 60 exercise minutes over the last seven days.', current: weeklyMinutes, target: 60, unit: 'exercise minutes' },
    { id: 'habit-three', icon: '🔥', title: 'Habit in Motion', detail: 'Keep any saved habit going for three consecutive days.', current: longestHabitStreak, target: 3, unit: 'day streak' },
  ].map((milestone) => ({ ...milestone, progress: Math.min(milestone.current, milestone.target), earned: milestone.current >= milestone.target }));
  const earnedCount = milestones.filter((milestone) => milestone.earned).length;
  return (
    <div className="space-y-6">
      <PhysicalMasterCard
        title="Achievements"
        subtitle="Small wins become big momentum. Unlock milestones from the activity and habit check-ins you save."
        eyebrow="Your milestones"
      />
      <PhysicalNav />

      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      {loading ? (
        <Card padding="lg" className="py-10 text-center"><div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /><p className="text-xs font-bold text-charcoal-muted">Loading your milestones…</p></Card>
      ) : activity && (
        <>
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-600">Keep collecting</p><h2 className="mt-1 text-2xl font-black tracking-tight text-charcoal">Milestone gallery</h2><p className="mt-1 text-sm text-charcoal-muted">Unlock awards through your saved movement and habit check-ins.</p></div>
              <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-2 text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Unlocked</p><p className="text-lg font-bold text-charcoal">{earnedCount}<span className="text-sm font-medium text-charcoal-muted"> / {milestones.length}</span></p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {milestones.map((milestone) => (
                  <Card key={milestone.id} padding="md" className={`h-full border bg-white transition-shadow hover:shadow-md ${milestone.earned ? 'border-emerald-200' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${milestone.earned ? 'bg-emerald-50' : 'bg-slate-100 grayscale'}`}>{milestone.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-charcoal">{milestone.title}</h3>{milestone.earned ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Unlocked</span> : <LockKeyholeIcon size={15} className="shrink-0 text-slate-400" />}</div>
                        <p className="mt-1 min-h-10 text-xs leading-relaxed text-charcoal-muted">{milestone.detail}</p>
                      </div>
                    </div>
                    <div className="relative mt-5">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]"><span className="font-bold text-charcoal-muted">{milestone.current.toLocaleString()} / {milestone.target.toLocaleString()} {milestone.unit}</span><span className={`font-extrabold ${milestone.earned ? 'text-emerald-700' : 'text-charcoal'}`}>{milestone.earned ? 'Complete' : `${Math.round(milestone.progress / milestone.target * 100)}%`}</span></div>
                      <ProgressBar value={milestone.progress / milestone.target * 100} height={7} color={milestone.earned ? 'bg-emerald-500' : 'bg-brand-500'} />
                    </div>
                  </Card>
              ))}
            </div>
          </section>

          <p className="text-xs text-charcoal-muted">Milestones update from activity saved in the last seven days and your current habit streaks.</p>
        </>
      )}
    </div>
  );
}
