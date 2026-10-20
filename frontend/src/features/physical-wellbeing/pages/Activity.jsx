import React, { useState, useEffect } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { BarChart } from '../../../shared/components/charts/Charts';
import { PhysicalNav } from '../components/PhysicalNav';
import { PhysicalMasterCard } from '../components/PhysicalMasterCard';
import { SectionTitle } from '../components/Shared';
import { Field } from '../../../shared/components/ui/Field';
import { Button } from '../../../shared/components/ui/Button';
import { getActivitySummary, logActivity } from '../api';

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ActivityTrackingPanel({ embedded = false }) {
  const [log, setLog] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activitySummary, setActivitySummary] = useState(null);

  const fetchSummary = async () => {
    try {
      setActivitySummary(await getActivitySummary());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!log) return;
    setSaving(true);
    setSaved(false);
    try {
      await logActivity({
        day: localDateString(),
        steps: Number(log) || 0,
        exercise_minutes: 0
      });
      setSaved(true);
      setLog('');
      await fetchSummary();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const history = Array.isArray(activitySummary?.daily_history) ? activitySummary.daily_history : [];

  const chartData = history.map((h) => ({
    label: h.day || h.label,
    value: Number(h.steps) || 0
  }));

  const totalChartValue = chartData.reduce((s, d) => s + d.value, 0);
  const avg = Math.round(totalChartValue / 7);
  const hasLoggedAnyHistory = totalChartValue > 0;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded && <>
        <PhysicalMasterCard
          title="Movement"
          subtitle="Your workouts, daily steps, and movement progress in one place."
          eyebrow="Exercise & activity"
        />
        <PhysicalNav />
      </>}

      <div className="grid grid-cols-1 gap-4">
        <Card padding="md">
          <SectionTitle
            title="Step count · past 7 days"
            subtitle={
              hasLoggedAnyHistory
                ? `7-day daily average: ${avg.toLocaleString()} steps`
                : activitySummary
                  ? 'No step records saved for the past 7 days yet'
                  : 'Loading your step history…'
            }
          />

          {hasLoggedAnyHistory ? (
            <BarChart data={chartData} height={150} unit=" steps" />
          ) : (
            <div className="h-[150px] flex flex-col items-center justify-center rounded-2xl bg-cream/60 border border-dashed border-black/10 text-center p-4">
              <span className="text-3xl mb-2">📊</span>
              <p className="text-sm font-bold text-charcoal">No step data yet</p>
              <p className="text-xs text-charcoal-muted mt-1 max-w-sm">
                Save today's step count to start your real 7-day history.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card padding="md">
        <SectionTitle
          title="Log today's steps"
          subtitle="Enter the step count recorded by your phone or wearable."
        />
        <form onSubmit={submit} className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <Field
            label="Steps recorded today"
            name="steps"
            type="number"
            min={0}
            placeholder="e.g. 5,200"
            value={log}
            onChange={(e) => setLog(e.target.value)}
          />
          <Button type="submit" size="lg" disabled={saving}>
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Steps'}
          </Button>
        </form>
      </Card>

    </div>
  );
}
