import React, { useState } from 'react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { BarChart } from '../../../shared/components/charts/Charts';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle, ChoiceChip } from '../components/Shared';
import { activityToday, weeklyActivity } from '../data';
import { Field } from '../../../shared/components/ui/Field';
import { Button } from '../../../shared/components/ui/Button';
import { logActivity } from '../api';
const metrics = ['Steps', 'Exercise', 'Active Minutes'];
export function PhysicalActivity() {
    const [metric, setMetric] = useState('Steps');
    const [log, setLog] = useState({ steps: '', exercise_minutes: '' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logActivity({ day: new Date().toISOString().slice(0, 10), steps: +log.steps || 0, exercise_minutes: +log.exercise_minutes || 0 });
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    };
    const data = weeklyActivity[metric];
    const avg = Math.round(data.reduce((s, d) => s + d.value, 0) / data.length);
    return (<div className="space-y-6">
      <PageHeader title="Activity" subtitle="Where you are today, and how this week is trending."/>

      <PhysicalNav />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today */}
        <Card padding="lg" className="lg:col-span-1">
          <SectionTitle title="Today"/>
          <div className="space-y-4">
            {activityToday.map((a) => {
            const pct = Math.min(100, a.current / a.total * 100);
            return (<div key={a.id}>
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
                  <ProgressBar value={pct} color={a.color}/>
                </div>);
        })}
          </div>
        </Card>

        {/* Weekly chart */}
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle title="This week" subtitle={`Average ${avg.toLocaleString()} per day`}/>
          <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {metrics.map((m) => <ChoiceChip key={m} selected={metric === m} onClick={() => setMetric(m)}>
                {m}
              </ChoiceChip>)}
          </div>
          <BarChart data={data} height={190}/>
        </Card>
      </div>

      <Card padding="lg">
        <SectionTitle title="Log today’s activity" subtitle="Numbers only — this feeds your adaptive plan."/>
        <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <Field label="Steps" name="steps" type="number" min={0} value={log.steps} onChange={(e) => setLog({ ...log, steps: e.target.value })}/>
          <Field label="Exercise minutes" name="exercise_minutes" type="number" min={0} value={log.exercise_minutes} onChange={(e) => setLog({ ...log, exercise_minutes: e.target.value })}/>
          <Button type="submit" size="lg" disabled={saving}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}</Button>
        </form>
      </Card>

      <AIInsightCard>
        Thursday was your quietest day. Your evening plan for tomorrow was made slightly lighter so it stays easy to
        finish.
      </AIInsightCard>
    </div>);
}
