import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrophyIcon, LockKeyholeIcon, SparklesIcon } from 'lucide-react';
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
  const palettes = [
    { card: 'border-amber-200 from-amber-50 via-white to-orange-100', icon: 'from-amber-300 to-orange-400', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-900' },
    { card: 'border-sky-200 from-sky-50 via-white to-cyan-100', icon: 'from-sky-300 to-cyan-500', bar: 'bg-sky-500', badge: 'bg-sky-100 text-sky-900' },
    { card: 'border-violet-200 from-violet-50 via-white to-fuchsia-100', icon: 'from-violet-300 to-fuchsia-500', bar: 'bg-violet-500', badge: 'bg-violet-100 text-violet-900' },
    { card: 'border-emerald-200 from-emerald-50 via-white to-teal-100', icon: 'from-emerald-300 to-teal-500', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-900' },
    { card: 'border-rose-200 from-rose-50 via-white to-pink-100', icon: 'from-rose-300 to-pink-500', bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-900' },
  ];

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
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-100 px-4 py-2.5 text-right shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Collection</p><p className="text-lg font-black text-indigo-950">{earnedCount}<span className="text-sm font-bold text-indigo-500"> / {milestones.length}</span></p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {milestones.map((milestone, index) => (
                <motion.div key={milestone.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card padding="md" className={`relative h-full overflow-hidden border bg-gradient-to-br transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${milestone.earned ? `${palettes[index].card} shadow-md` : 'border-slate-200 from-slate-50 via-white to-slate-100 opacity-90'}`}>
                    {milestone.earned && <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/45 blur-sm" aria-hidden="true" />}
                    <div className="relative flex items-start gap-3">
                      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] text-3xl shadow-md ${milestone.earned ? `bg-gradient-to-br ${palettes[index].icon} text-white ring-2 ring-white` : 'bg-gradient-to-br from-slate-200 to-slate-300 grayscale'}`}>{milestone.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><h3 className="font-extrabold text-charcoal">{milestone.title}</h3>{milestone.earned ? <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${palettes[index].badge}`}>Unlocked</span> : <LockKeyholeIcon size={15} className="shrink-0 text-slate-400" />}</div>
                        <p className="mt-1 min-h-10 text-xs leading-relaxed text-charcoal-muted">{milestone.detail}</p>
                      </div>
                    </div>
                    <div className="relative mt-5">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]"><span className="font-bold text-charcoal-muted">{milestone.current.toLocaleString()} / {milestone.target.toLocaleString()} {milestone.unit}</span><span className={`font-extrabold ${milestone.earned ? 'text-emerald-700' : 'text-charcoal'}`}>{milestone.earned ? 'Complete' : `${Math.round(milestone.progress / milestone.target * 100)}%`}</span></div>
                      <ProgressBar value={milestone.progress / milestone.target * 100} height={9} color={milestone.earned ? 'bg-emerald-500' : palettes[index].bar} />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-brand-50 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><TrophyIcon size={22} /></div>
            <div><p className="font-extrabold text-charcoal">{earnedCount} of {milestones.length} milestones unlocked</p><p className="text-xs text-charcoal-muted">Calculated from activity saved in the last seven days and your current habit streaks.</p></div>
            <SparklesIcon size={19} className="ml-auto shrink-0 text-violet-500" />
          </div>
        </>
      )}
    </div>
  );
}
