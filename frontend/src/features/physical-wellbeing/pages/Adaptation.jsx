import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityIcon, ArrowRightIcon, CheckCircle2Icon, Clock3Icon, RotateCwIcon, SlidersHorizontalIcon, SparklesIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PhysicalNav } from '../components/PhysicalNav';
import { PhysicalMasterCard } from '../components/PhysicalMasterCard';
import { AdaptiveLoop } from '../components/AdaptiveLoop';
import { SectionTitle } from '../components/Shared';
import { getActivitySummary, getHabits, getProfile, getRecommendations } from '../api';

function adaptationSummary(reason, checkIns, completionRate) {
  if (reason === 'shorter_sessions_after_difficult_feedback') {
    return 'Your recent workout ratings show that sessions have felt difficult. The recommender has shortened the target duration to make the next session more manageable.';
  }
  if (reason === 'shorter_sessions_after_recent_missed_workouts') {
    return 'Recent workout check-ins show that shorter sessions may be easier to keep up with. The recommender has adjusted the target duration.';
  }
  if (reason === 'maintaining_duration_after_consistent_workouts') {
    return 'Your recent workout check-ins show steady follow-through. The recommender is maintaining a manageable session duration.';
  }
  if (checkIns > 0 && completionRate !== null) {
    return 'Your recent check-ins are being used to tune session length as more activity history builds.';
  }
  return 'Log a workout check-in to give the recommender evidence for adapting your session length.';
}

export function PhysicalAdaptation() {
  const navigate = useNavigate();
  const [data, setData] = useState({ profile: null, activity: null, habits: [], recommendations: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      getProfile().catch(() => null),
      getActivitySummary().catch(() => null),
      getHabits().catch(() => []),
      getRecommendations().catch(() => null),
    ]).then(([profile, activity, habits, recommendations]) => {
      if (!active) return;
      setData({ profile, activity, habits: Array.isArray(habits) ? habits : [], recommendations });
      if (!profile) setError('Complete your wellbeing assessment to get personalized adaptations.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const adaptation = data.recommendations?.behavior_adaptation || {};
  const checkIns = Number(adaptation.check_ins) || 0;
  const completed = Number(adaptation.completed) || 0;
  const difficultyResponses = Number(adaptation.difficulty_responses) || 0;
  const completionRate = typeof adaptation.completion_rate === 'number' ? adaptation.completion_rate : null;
  const weeklyMinutes = Number(data.activity?.weekly_totals?.exercise_minutes) || 0;
  const weeklySteps = Number(data.activity?.weekly_totals?.steps) || 0;
  const doneHabits = data.habits.filter((habit) => habit.done).length;
  const recommendedExercise = data.recommendations?.exercises?.[0] || null;
  const effectiveMinutes = Number(data.recommendations?.effective_available_minutes || adaptation.target_minutes || data.profile?.available_minutes) || 20;
  const isRecovery = Boolean(data.recommendations?.recovery_mode || data.profile?.recovery_mode);

  const signals = useMemo(() => [
    {
      icon: ActivityIcon,
      label: 'Workout check-ins',
      value: checkIns ? `${completed} of ${checkIns} completed` : 'No check-ins yet',
      detail: checkIns ? `${Math.round((completionRate || 0) * 100)}% completion across the last 14 days.` : 'Check in after a recommended workout so the system can adapt session length.',
    },
    {
      icon: CheckCircle2Icon,
      label: 'Weekly movement',
      value: `${weeklyMinutes} min · ${weeklySteps.toLocaleString()} steps`,
      detail: 'Totals from activity you logged in the last 7 days.',
    },
    {
      icon: SparklesIcon,
      label: 'Habit check-ins today',
      value: data.habits.length ? `${doneHabits} of ${data.habits.length} completed` : 'No habits tracked',
      detail: data.habits.length ? 'Habit progress is shown as context; workout adaptation uses explicit workout check-ins.' : 'Add habits to track daily routines alongside your activity.',
    },
    {
      icon: Clock3Icon,
      label: 'Workout difficulty',
      value: adaptation.latest_difficulty || 'No rating yet',
      detail: difficultyResponses ? `${adaptation.difficult_sessions || 0} of ${difficultyResponses} rated sessions were difficult or very difficult.` : 'Rate completed workouts to help tune future session length.',
    },
  ], [checkIns, completed, completionRate, difficultyResponses, adaptation.latest_difficulty, adaptation.difficult_sessions, weeklyMinutes, weeklySteps, doneHabits, data.habits]);

  return (
    <div className="space-y-6">
      <PhysicalMasterCard title="Plan Adaptation" subtitle="See how your saved preferences and recent check-ins shape your current recommendations." eyebrow="How your plan adapts" />
      <PhysicalNav />

      {loading ? (
        <Card padding="lg" className="text-center py-10">
          <div className="w-7 h-7 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm text-charcoal-muted">Loading your adaptation signals…</p>
        </Card>
      ) : error ? (
        <Card padding="lg" className="text-center py-8">
          <p className="text-sm text-charcoal-muted mb-4">{error}</p>
          <Button onClick={() => navigate('/physical-setup/assessment')}>Set up my profile</Button>
        </Card>
      ) : (
        <>
          <Card padding="lg" className="relative overflow-hidden border border-brand-100 bg-brand-50">
            <div className="flex items-start gap-4">
              <span className="w-11 h-11 rounded-2xl bg-brand-500 text-white flex items-center justify-center shrink-0">
                <RotateCwIcon size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{isRecovery ? 'Recovery guidance active' : checkIns ? 'Using your recent check-ins' : 'Building your activity history'}</p>
                <h2 className="text-xl font-extrabold text-charcoal mt-1">Your current plan recommendation</h2>
                <p className="text-sm text-charcoal-light mt-1 leading-relaxed">
                  {adaptationSummary(adaptation.reason, checkIns, completionRate)}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            <Card padding="lg" className="lg:col-span-2">
              <SectionTitle title="Current recommendation" subtitle="Generated from your saved wellbeing profile and recent behavior." />
              {recommendedExercise ? (
                <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-white text-brand-600 flex items-center justify-center shrink-0"><ActivityIcon size={19} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Recommended session</p>
                      <h3 className="font-extrabold text-charcoal mt-1">{recommendedExercise.name}</h3>
                      {recommendedExercise.description && <p className="text-sm text-charcoal-muted mt-1">{recommendedExercise.description}</p>}
                      <div className="flex items-center gap-2 text-xs font-semibold text-charcoal-light mt-3"><Clock3Icon size={14} /> {recommendedExercise.minutes || effectiveMinutes} minutes</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-cream p-4 text-sm text-charcoal-muted">Recommendations are unavailable right now. Your activity signals are still shown here.</p>
              )}
              <p className="text-xs text-charcoal-muted mt-4">Adjusted session target: <strong className="text-charcoal">{effectiveMinutes} minutes</strong>{data.recommendations?.model_version ? ` · ${data.recommendations.model_version}` : ''}</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <Button onClick={() => navigate('/app/physical/plan')}>View my plan <ArrowRightIcon size={16} /></Button>
                <Button variant="outline" onClick={() => navigate('/app/physical/profile')}><SlidersHorizontalIcon size={16} /> Edit preferences</Button>
              </div>
            </Card>

            <Card padding="lg">
              <SectionTitle title="Signals used" subtitle="Recent data available to the adaptation logic." />
              <div className="space-y-4">
                {signals.map(({ icon: Icon, label, value, detail }) => (
                  <div key={label} className="flex items-start gap-3 rounded-2xl bg-cream p-3.5">
                    <span className="w-9 h-9 rounded-xl bg-white text-brand-600 flex items-center justify-center shrink-0"><Icon size={16} /></span>
                    <div className="min-w-0">
                      <p className="text-xs text-charcoal-muted">{label}</p>
                      <p className="text-sm font-extrabold text-charcoal mt-0.5">{value}</p>
                      <p className="text-[11px] text-charcoal-muted mt-1 leading-relaxed">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <AdaptiveLoop activeKey="adapt" />
    </div>
  );
}
