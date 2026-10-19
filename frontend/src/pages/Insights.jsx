import React, { useEffect, useState } from 'react';
import { ClockIcon, BrainIcon, TargetIcon, TrendingUpIcon, MoonStarIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { AIInsightCard } from '../shared/components/domain/AIInsightCard';
import { BarChart, LineChart } from '../shared/components/charts/Charts';
import { ErrorState, LoadingState } from '../shared/components/ui/States';
import api from '../shared/api/client';
import { hoursList } from '../features/scheduler/lib';

// Everything here comes from GET /scheduler/insights (the student's own sessions, tasks, M1/M3 and the C4 signal).
const LOAD_WORD = { heavy: 'Heavy, deep work', medium: 'Medium-effort work', low: 'Light tasks' };
const hourLabel = (h) => `${String(h).padStart(2, '0')}`;
const hours = (m) => Math.round(m / 6) / 10;            // minutes -> hours with 1 decimal

function weeklyTrend(week) {
    const { tasks_done: now, tasks_done_before: before, focus_minutes: mins, focus_minutes_before: minsBefore } = week;
    if (!now && !before && !mins) return 'No finished tasks or focus sessions in the last two weeks yet - your trends appear here as you use ThriveU.';
    const tasks = before ? `${now >= before ? '' : ''}${Math.abs(Math.round((now - before) / before * 100))}% ${now >= before ? 'more' : 'fewer'} tasks than the week before`
        : `${now} task${now === 1 ? '' : 's'} (none the week before)`;
    const focus = minsBefore ? `${hours(mins)} h of focus (${hours(minsBefore)} h the week before)` : `${hours(mins)} h of focus`;
    return `This week you finished ${tasks}, with ${focus}.`;
}

export function Insights() {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    const load = () => { setFailed(false); api.get('/scheduler/insights').then((r) => setData(r.data)).catch(() => setFailed(true)); };
    useEffect(load, []);

    if (failed) return <ErrorState onRetry={load}/>;
    if (!data) return <LoadingState label="Looking at your week…"/>;

    const { days, week, by_hour: byHour, best_load: best, duration, stress } = data;
    const fromM1 = byHour.source === 'm1_model';
    const over = duration.usual_over_run;
    const cards = [
        { icon: ClockIcon, title: 'Your Peak Focus Time',
          value: fromM1 ? hoursList(byHour.peak_hours.slice(0, 2)) : 'Still learning',
          desc: fromM1 ? 'Learned by the M1 model from your focus sessions.' : 'After 5 focus sessions the AI learns your best hours.' },
        { icon: BrainIcon, title: 'Your Best Task Type',
          value: best ? LOAD_WORD[best.load] : 'Not enough data',
          desc: best ? `You finish ${best.finished_pct}% of these sessions.` : 'Needs a few sessions of each effort level.' },
        { icon: TargetIcon, title: 'Your Task Accuracy',
          value: over == null ? 'Not enough data' : Math.abs(over - 1) < 0.1 ? 'Spot on' : `${over > 1 ? 'Off by' : 'Faster by'} ~${Math.round(Math.abs(over - 1) * 100)}%`,
          desc: over == null ? 'Finish tasks with focus sessions to see this.' : over > 1 ? 'Tasks usually take longer than you plan - ThriveU adds that time.' : 'You usually plan enough time.' },
        { icon: MoonStarIcon, title: 'Your Hardest Hours',
          value: fromM1 ? hoursList(byHour.low_hours.slice(0, 2)) : 'Still learning',
          desc: fromM1 ? 'Light tasks fit best here.' : 'Shown once the AI knows your pattern.' },
    ];
    const stressPoints = stress.filter((s) => s.value != null);
    const maxDuration = Math.max(1, ...duration.recent.flatMap((r) => [r.estimated, r.actual]));

    return (<div className="space-y-6">
      <PageHeader title="AI Insights" subtitle="What ThriveU has learned about how you work and feel best."/>

      <AIInsightCard title="Your Weekly Trend">{weeklyTrend(week)}</AIInsightCard>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => <Card key={c.title} hover>
            <span className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center"><c.icon size={19}/></span>
            <p className="text-xs font-semibold text-charcoal-muted mt-3">{c.title}</p>
            <p className="text-lg font-extrabold text-charcoal mt-0.5 leading-tight">{c.value}</p>
            <p className="text-xs text-charcoal-muted mt-1.5 leading-relaxed">{c.desc}</p>
          </Card>)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Focus success by hour</h3>
          <p className="text-xs text-charcoal-muted mb-4">
            {fromM1 ? 'M1 chance of finishing a session at each hour' : byHour.hours.length ? '% of your sessions finished at each hour' : 'No focus sessions yet'}
          </p>
          {byHour.hours.length > 0 && <BarChart data={byHour.hours.map((h) => ({ label: hourLabel(h.hour), value: h.value }))} unit="%"/>}
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Focus by day (hrs)</h3>
          <p className="text-xs text-charcoal-muted mb-4">Logged focus time, last 7 days</p>
          <BarChart data={days.map((d) => ({ label: d.label, value: hours(d.focus_minutes) }))} unit="h"/>
        </Card>
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUpIcon size={16} className="text-brand-500"/>
            <h3 className="font-bold text-charcoal">Sessions finished (%)</h3>
          </div>
          <p className="text-xs text-charcoal-muted mb-4">Share of focus sessions you completed each day</p>
          <LineChart data={days.map((d) => ({ label: d.label, value: d.finished_pct ?? 0 }))} color="#2E9C88"/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Stress trend</h3>
          <p className="text-xs text-charcoal-muted mb-4">Risk score from your wellbeing check-ins (shared with the scheduler)</p>
          {stressPoints.length > 1 ?
            <LineChart data={stressPoints.map((s) => ({ label: s.label, value: s.value }))} color="#7F95CC"/> :
            <p className="text-sm text-charcoal-muted">{stressPoints.length ? `Latest: ${stressPoints[0].value}/100` : 'No wellbeing signal shared this week.'}</p>}
        </Card>
      </div>

      <Card padding="lg">
        <h3 className="font-bold text-charcoal mb-1">Estimated vs actual duration</h3>
        <p className="text-xs text-charcoal-muted mb-5">
          {duration.recent.length ? 'Your last finished tasks with logged focus time.' : 'Finish tasks with focus sessions and they show up here.'}
        </p>
        <div className="space-y-4">
          {duration.recent.map((r, i) => <div key={i}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-charcoal truncate pr-3">{r.title}</span>
                <span className="text-charcoal-muted text-xs font-semibold shrink-0">est {r.estimated}m · actual {r.actual}m</span>
              </div>
              <div className="relative h-6 rounded-full bg-black/[0.04] overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-brand-200" style={{ width: `${r.estimated / maxDuration * 100}%` }}/>
                <div className="absolute inset-y-0 left-0 rounded-full bg-brand-500" style={{ width: `${r.actual / maxDuration * 100}%`, mixBlendMode: 'multiply' }}/>
              </div>
            </div>)}
        </div>
        {duration.recent.length > 0 &&
          <div className="flex gap-4 mt-4 text-xs font-semibold text-charcoal-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-200"/> Estimated</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-500"/> Actual</span>
          </div>}
      </Card>
    </div>);
}
