import React, { useState, useEffect } from 'react';
import { ArrowRightIcon, CheckCircle2Icon, FlameIcon, FootprintsIcon, SparklesIcon, TimerIcon, TrophyIcon } from 'lucide-react';
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
  const completion = Math.round((earnedCount / milestones.length) * 100);
  const nextMilestone = milestones
    .filter((milestone) => !milestone.earned)
    .sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0];
  const closestPct = nextMilestone ? Math.round((nextMilestone.progress / nextMilestone.target) * 100) : 100;
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
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#183e36] via-[#17634f] to-[#279373] p-6 text-white shadow-[0_20px_55px_-30px_rgba(20,83,65,.75)] sm:p-8">
            <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[30px] border-white/[0.06]" />
            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl">
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-emerald-100"><SparklesIcon size={15} /> Your achievement journey</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Every small win counts.</h2>
                <p className="mt-2 text-sm leading-6 text-emerald-50/90">Your milestones are earned from activity and habit progress saved in your account. Keep building at your own pace.</p>
              </div>
              <div className="relative flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300 text-emerald-950 shadow-lg"><TrophyIcon size={27} /></span>
                <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100">Collection complete</p><p className="mt-0.5 text-3xl font-black">{earnedCount}<span className="text-base font-bold text-emerald-100"> / {milestones.length}</span></p></div>
              </div>
            </div>
            <div className="relative mt-7 rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-bold text-emerald-50">Overall collection progress</span><span className="font-black">{completion}%</span></div>
              <ProgressBar value={completion} height={9} color="bg-amber-300" track="bg-white/20" />
              <div className="mt-2 flex justify-between text-[10px] font-semibold text-emerald-100/80"><span>First steps</span><span>Building consistency</span><span>Milestone collector</span></div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AchievementStat icon={FootprintsIcon} label="Active days" value={`${activeDays} / 7`} note="This week" tone="emerald" />
            <AchievementStat icon={TimerIcon} label="Movement" value={`${weeklyMinutes} min`} note="This week" tone="amber" />
            <AchievementStat icon={SparklesIcon} label="Peak steps" value={peakStepsInADay.toLocaleString()} note="Best logged day" tone="sky" />
            <AchievementStat icon={FlameIcon} label="Habit streak" value={`${longestHabitStreak} days`} note="Longest current streak" tone="rose" />
          </section>

          {nextMilestone && <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">{nextMilestone.icon}</div>
              <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-amber-800">Your closest milestone</p><h3 className="mt-1 text-lg font-black text-charcoal">{nextMilestone.title}</h3><p className="mt-1 text-xs text-charcoal-muted">{nextMilestone.detail}</p></div>
              <div className="w-full sm:w-48"><div className="mb-1.5 flex justify-between text-[10px] font-bold text-charcoal-muted"><span>{nextMilestone.current.toLocaleString()} / {nextMilestone.target.toLocaleString()} {nextMilestone.unit}</span><span>{closestPct}%</span></div><ProgressBar value={closestPct} height={8} color="bg-amber-500" /></div>
            </div>
          </section>}

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-600">Earned through your real progress</p><h2 className="mt-1 text-2xl font-black tracking-tight text-charcoal">Milestone collection</h2><p className="mt-1 text-sm text-charcoal-muted">Movement and habit milestones update from the activity you save.</p></div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800">{earnedCount} unlocked</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {milestones.map((milestone, index) => (
                <Card key={milestone.id} padding="none" className={`group relative overflow-hidden border transition duration-200 hover:-translate-y-1 hover:shadow-lg ${milestone.earned ? 'border-emerald-200' : 'border-slate-200'}`}>
                  <div className={`h-1.5 ${milestone.earned ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-lime-300' : 'bg-gradient-to-r from-slate-200 to-slate-100'}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-sm transition group-hover:rotate-3 ${milestone.earned ? 'bg-gradient-to-br from-amber-100 to-emerald-100' : 'bg-slate-100 grayscale'}`}>{milestone.icon}</div>
                      {milestone.earned ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700"><CheckCircle2Icon size={13} /> Earned</span> : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">In progress</span>}
                    </div>
                    <h3 className="mt-4 text-base font-black text-charcoal">{milestone.title}</h3>
                    <p className="mt-1 min-h-10 text-xs leading-relaxed text-charcoal-muted">{milestone.detail}</p>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]"><span className="font-bold text-charcoal-muted">{milestone.current.toLocaleString()} / {milestone.target.toLocaleString()} {milestone.unit}</span><span className={`font-extrabold ${milestone.earned ? 'text-emerald-700' : 'text-charcoal'}`}>{milestone.earned ? 'Complete' : `${Math.round(milestone.progress / milestone.target * 100)}%`}</span></div>
                      <ProgressBar value={milestone.progress / milestone.target * 100} height={8} color={milestone.earned ? 'bg-emerald-500' : index % 2 ? 'bg-brand-500' : 'bg-amber-500'} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <p className="rounded-2xl bg-cream px-4 py-3 text-xs leading-relaxed text-charcoal-muted">Milestones reflect your saved activity from the last seven days and your current habit streaks. Your progress updates as new activity is recorded.</p>
        </>
      )}
    </div>
  );
}

function AchievementStat({ icon: Icon, label, value, note, tone }) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return <Card padding="md" className="border border-black/[0.05] bg-white shadow-sm">
    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[tone]}`}><Icon size={18} /></span>
    <p className="mt-3 text-2xl font-black tracking-tight text-charcoal">{value}</p>
    <p className="mt-0.5 text-xs font-bold text-charcoal">{label}</p>
    <p className="mt-1 text-[10px] text-charcoal-muted">{note}</p>
  </Card>;
}
