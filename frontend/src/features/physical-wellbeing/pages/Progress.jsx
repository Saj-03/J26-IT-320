import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUpIcon, ArrowRightIcon, CalendarIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { BarChart, LineChart } from '../../../shared/components/charts/Charts';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle } from '../components/Shared';
import { getActivitySummary, getProfile, getHabits } from '../api';
import { cn } from '../../../shared/lib/cn';

export function PhysicalProgress() {
  const navigate = useNavigate();
  const [metricTab, setMetricTab] = useState('Steps');
  const [activitySummary, setActivitySummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getActivitySummary().catch(() => null),
      getProfile().catch(() => null),
      getHabits().catch(() => [])
    ]).then(([act, prof, habs]) => {
      setActivitySummary(act);
      setProfile(prof);
      setHabits(Array.isArray(habs) ? habs : []);
      setLoading(false);
    });
  }, []);

  const weeklySteps = activitySummary?.weekly_totals?.steps || 0;
  const weeklyMins = activitySummary?.weekly_totals?.exercise_minutes || 0;
  const history = activitySummary?.daily_history || [];
  const totalHabits = habits.length;
  const doneHabits = habits.filter((h) => h.done).length;

  const chartData = history.map((h) => ({
    label: h.day || h.label,
    value: metricTab === 'Steps' ? (h.steps || 0) : (h.exercise_minutes || 0)
  }));
  const hasHistory = chartData.some((d) => d.value > 0);

  // Goal completion calculations based on real parameters
  const goalName = profile?.goal?.replace('_', ' ') || 'General Fitness';
  const exerciseCompletionPct = Math.min(100, Math.round((weeklyMins / 150) * 100));
  const walkingCompletionPct = Math.min(100, Math.round((weeklySteps / (8000 * 7)) * 100));
  const habitsCompletionPct = totalHabits > 0 ? Math.round((doneHabits / totalHabits) * 100) : 0;

  const studentGoals = [
    {
      label: `Primary Goal: ${goalName.charAt(0).toUpperCase() + goalName.slice(1)}`,
      value: profile ? Math.round((exerciseCompletionPct + walkingCompletionPct) / 2) : 0
    },
    {
      label: 'Weekly Active Movement (WHO 150m)',
      value: exerciseCompletionPct
    },
    {
      label: 'Campus Walking Adherence',
      value: walkingCompletionPct
    },
    {
      label: 'Daily Habit Momentum',
      value: habitsCompletionPct
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Student Progress & Trends"
          subtitle="Real-world physical activity, weekly volume, and goal alignment without synthetic inflation."
        />
        <div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft self-start shrink-0">
          {['Steps', 'Exercise Minutes'].map((t) => (
            <button
              key={t}
              onClick={() => setMetricTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-bold transition-colors',
                metricTab === t ? 'bg-brand-500 text-white' : 'text-charcoal-light hover:text-charcoal'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <PhysicalNav />

      {/* Real Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card padding="sm" hover>
          <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
            👟
          </span>
          <p className="text-2xl font-extrabold text-charcoal mt-3 tracking-tight">
            {weeklySteps.toLocaleString()}
          </p>
          <p className="text-xs font-medium text-charcoal-muted mt-0.5 leading-tight">Total Steps This Week</p>
        </Card>

        <Card padding="sm" hover>
          <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
            ⏱️
          </span>
          <p className="text-2xl font-extrabold text-charcoal mt-3 tracking-tight">
            {weeklyMins} <span className="text-sm font-semibold text-charcoal-muted">mins</span>
          </p>
          <p className="text-xs font-medium text-charcoal-muted mt-0.5 leading-tight">Workout Time This Week</p>
        </Card>

        <Card padding="sm" hover>
          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
            ⭐
          </span>
          <p className="text-2xl font-extrabold text-charcoal mt-3 tracking-tight">
            {totalHabits}
          </p>
          <p className="text-xs font-medium text-charcoal-muted mt-0.5 leading-tight">Active Habits Tracked</p>
        </Card>

        <Card padding="sm" hover>
          <div className="flex items-center gap-3">
            <ProgressRing value={exerciseCompletionPct} size={54} stroke={6} color="#2E9C88">
              <span className="text-[11px] font-extrabold text-charcoal">{exerciseCompletionPct}%</span>
            </ProgressRing>
            <div>
              <p className="text-xs font-extrabold text-charcoal leading-tight">Weekly Target</p>
              <p className="text-[11px] text-charcoal-muted mt-0.5">150m WHO baseline</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle
            title={`7-Day ${metricTab} Trend`}
            subtitle={hasHistory ? 'Daily breakdown from verified log entries' : 'No entries recorded for this 7-day period'}
          />
          {hasHistory ? (
            <BarChart
              data={chartData}
              height={190}
              unit={metricTab === 'Steps' ? ' steps' : ' min'}
            />
          ) : (
            <div className="h-[190px] flex flex-col items-center justify-center rounded-2xl bg-cream/50 border border-dashed border-black/10 text-center p-6">
              <span className="text-3xl mb-2">📈</span>
              <p className="text-sm font-bold text-charcoal">No Data to Plot Yet</p>
              <p className="text-xs text-charcoal-muted mt-1 max-w-sm">
                Log today’s steps and workouts to begin graphing your real consistency curve.
              </p>
            </div>
          )}
        </Card>

        {/* Real Goal Completion */}
        <Card padding="lg">
          <SectionTitle
            title="Goal Progress"
            subtitle={profile ? 'Calibrated to your setup preferences' : 'Take assessment to initialize targets'}
          />
          <div className="space-y-4">
            {studentGoals.map((g) => (
              <div key={g.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-charcoal-light">{g.label}</span>
                  <span className="font-extrabold text-charcoal">{g.value}%</span>
                </div>
                <ProgressBar value={g.value} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* AI Insight */}
      <AIInsightCard title="AI Adaptive Progress Insight">
        {weeklyMins >= 150
          ? 'Exceptional dedication! You have hit the full 150-minute threshold. The engine will focus your upcoming plan on muscle recovery and balanced meal nutrition.'
          : weeklyMins > 0
          ? `You have logged ${weeklyMins} active minutes this week toward your 150-minute goal (${exerciseCompletionPct}%). Consistency on smaller daily increments is proven to prevent academic burnout.`
          : 'Welcome to your progress tracker. Complete short walking intervals between campus lectures or follow your daily 20-minute workout plan to start building your streak!'}
        <span className="block mt-4">
          <Button variant="soft" size="sm" className="bg-white" onClick={() => navigate('/app/physical/plan')}>
            View Personalized Plan <ArrowRightIcon size={14} />
          </Button>
        </span>
      </AIInsightCard>
    </div>
  );
}
