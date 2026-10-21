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

export function ActivityTrackingPanel({ embedded = false, view = 'all' }) {
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

      {view !== 'form' && <Card padding="md" className="overflow-hidden border-brand-100 bg-gradient-to-br from-white via-white to-brand-50/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Last 7 days</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-charcoal">Step count</h2>
            <p className="mt-1.5 text-sm text-charcoal-muted">
              <span className="font-medium tabular-nums text-brand-700">{hasLoggedAnyHistory ? avg.toLocaleString() : '—'}</span>
              <span> steps/day average</span>
            </p>
          </div>
        </div>

        {hasLoggedAnyHistory ? (
          <div className="mt-4 rounded-2xl border border-brand-100/70 bg-white/75 px-3 py-3 sm:px-5">
            <BarChart data={chartData} height={160} unit=" steps" showValues thinBars />
          </div>
        ) : (
          <div className="mt-4 flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-white/70 px-4 text-center">
            <p className="text-sm font-bold text-charcoal">No steps logged this week yet</p>
            <p className="mt-1 text-xs text-charcoal-muted">Your chart and average will appear after step counts are saved.</p>
          </div>
        )}
      </Card>}

      {view !== 'history' && <Card padding="md" className="border-brand-100">
        <SectionTitle
          title="Log today's steps"
          subtitle="Enter the total shown in your phone's health app or wearable."
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
      </Card>}

    </div>
  );
}
