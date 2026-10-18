import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { BarChart } from '../../../shared/components/charts/Charts';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle, ChoiceChip } from '../components/Shared';
import { Field } from '../../../shared/components/ui/Field';
import { Button } from '../../../shared/components/ui/Button';
import { getActivitySummary, logActivity, getProfile } from '../api';

const metrics = ['Steps', 'Exercise Minutes'];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function PhysicalActivity() {
  const [metric, setMetric] = useState('Steps');
  const [log, setLog] = useState({ steps: '', exercise_minutes: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activitySummary, setActivitySummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      const [act, prof] = await Promise.all([
        getActivitySummary().catch(() => null),
        getProfile().catch(() => null)
      ]);
      setActivitySummary(act);
      setProfile(prof);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!log.steps && !log.exercise_minutes) return;
    setSaving(true);
    setSaved(false);
    try {
      await logActivity({
        day: localDateString(),
        steps: +log.steps || 0,
        exercise_minutes: +log.exercise_minutes || 0
      });
      setSaved(true);
      setLog({ steps: '', exercise_minutes: '' });
      await fetchSummary();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const todaySteps = activitySummary?.today?.steps || 0;
  const todayMins = activitySummary?.today?.exercise_minutes || 0;
  const targetMins = profile?.available_minutes || 20;

  const history = activitySummary?.daily_history || [
    { day: 'Mon', steps: 0, exercise_minutes: 0 },
    { day: 'Tue', steps: 0, exercise_minutes: 0 },
    { day: 'Wed', steps: 0, exercise_minutes: 0 },
    { day: 'Thu', steps: 0, exercise_minutes: 0 },
    { day: 'Fri', steps: 0, exercise_minutes: 0 },
    { day: 'Sat', steps: 0, exercise_minutes: 0 },
    { day: 'Sun', steps: 0, exercise_minutes: 0 }
  ];

  const chartData = history.map((h) => ({
    label: h.day || h.label,
    value: metric === 'Steps' ? (h.steps || 0) : (h.exercise_minutes || 0)
  }));

  const totalChartValue = chartData.reduce((s, d) => s + d.value, 0);
  const avg = Math.round(totalChartValue / (chartData.length || 1));
  const hasLoggedAnyHistory = totalChartValue > 0;

  const todayItems = [
    {
      id: 'steps',
      emoji: '👟',
      label: 'Daily Steps',
      current: todaySteps,
      total: 8000,
      unit: 'steps',
      color: '#16a34a'
    },
    {
      id: 'workout',
      emoji: '⏱️',
      label: 'Workout Time',
      current: todayMins,
      total: targetMins,
      unit: 'min',
      color: '#f59e0b'
    },
    {
      id: 'active_cal',
      emoji: '🔥',
      label: 'Active Energy',
      current: Math.round(todaySteps * 0.04 + todayMins * 5),
      total: 300,
      unit: 'kcal',
      color: '#ec4899'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Physical Activity"
        subtitle="Real-time daily tracking and 7-day trends connected to your adaptive plan."
      />

      <PhysicalNav />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today */}
        <Card padding="lg" className="lg:col-span-1">
          <SectionTitle
            title="Today's Activity"
            subtitle={
              todaySteps === 0 && todayMins === 0
                ? 'No activity logged yet today'
                : 'Live stats from today’s logs'
            }
          />

          <div className="space-y-4">
            {todayItems.map((a) => {
              const pct = Math.min(100, Math.round((a.current / a.total) * 100));
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-charcoal-light flex items-center gap-2">
                      <span>{a.emoji}</span>
                      {a.label}
                    </span>
                    <span className="text-sm font-bold text-charcoal">
                      {a.current.toLocaleString()}
                      <span className="text-charcoal-muted font-medium">
                        {' '}
                        / {a.total.toLocaleString()} {a.unit}
                      </span>
                    </span>
                  </div>
                  <ProgressBar value={pct} color={a.color} />
                </div>
              );
            })}
          </div>

          {todaySteps === 0 && todayMins === 0 && (
            <div className="mt-5 p-3 rounded-2xl bg-cream border border-black/[0.04] text-xs text-charcoal-muted text-center">
              💡 Log your morning steps or workout in the form below to update your daily progress rings!
            </div>
          )}
        </Card>

        {/* Weekly chart */}
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle
            title="Past 7 Days History"
            subtitle={
              hasLoggedAnyHistory
                ? `Daily Average: ${avg.toLocaleString()} ${metric === 'Steps' ? 'steps' : 'minutes'}`
                : 'No historical entries yet for this period'
            }
          />

          <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {metrics.map((m) => (
              <ChoiceChip key={m} selected={metric === m} onClick={() => setMetric(m)}>
                {m}
              </ChoiceChip>
            ))}
          </div>

          {hasLoggedAnyHistory ? (
            <BarChart data={chartData} height={190} unit={metric === 'Steps' ? ' steps' : ' min'} />
          ) : (
            <div className="h-[190px] flex flex-col items-center justify-center rounded-2xl bg-cream/60 border border-dashed border-black/10 text-center p-6">
              <span className="text-3xl mb-2">📊</span>
              <p className="text-sm font-bold text-charcoal">No Activity Logged in the Last 7 Days</p>
              <p className="text-xs text-charcoal-muted mt-1 max-w-sm">
                Each time you log steps or workout minutes, your 7-day consistency graph will build up here automatically.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card padding="lg">
        <SectionTitle
          title="Log Today's Activity"
          subtitle="Log real measurements to update today's totals and your 7-day movement history. Workout check-ins help tune future session length."
        />
        <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <Field
            label="Steps Walked Today"
            name="steps"
            type="number"
            min={0}
            placeholder="e.g. 5200"
            value={log.steps}
            onChange={(e) => setLog({ ...log, steps: e.target.value })}
          />
          <Field
            label="Exercise Minutes"
            name="exercise_minutes"
            type="number"
            min={0}
            placeholder="e.g. 25"
            value={log.exercise_minutes}
            onChange={(e) => setLog({ ...log, exercise_minutes: e.target.value })}
          />
          <Button type="submit" size="lg" disabled={saving}>
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Activity'}
          </Button>
        </form>
      </Card>

      <AIInsightCard>
        {todayMins > 0 || todaySteps > 0
          ? `You have logged ${todaySteps.toLocaleString()} steps and ${todayMins} active minutes today! The adaptive engine preserves recovery slots while maintaining consistency.`
          : 'No movement logged yet today. Even a brisk 15-minute campus power walk elevates mood, burns calories, and sharpens attention.'}
      </AIInsightCard>
    </div>
  );
}
