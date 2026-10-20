import React, { useEffect, useState } from 'react';
import { UsersIcon, ActivityIcon, CheckCircle2Icon, GaugeIcon, HeartPulseIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { LineChart, BarChart, DonutChart } from '../shared/components/charts/Charts';
import { LoadingState } from '../shared/components/ui/States';
import api, { apiErrorMessage } from '../shared/api/client';
import { cn } from '../shared/lib/cn';
import PilotModes from '../features/scheduler/components/PilotModes';
import { toDate } from '../features/scheduler/lib';

// Everything comes from GET /scheduler/research/overview: consenting participants only, research IDs only,
// no camera data (the proposal excludes camera signals). Researchers = SCHEDULER_RESEARCHER_EMAILS in backend/.env.
const OUTCOME_COLORS = { 'Finished': '#5FC0AB', 'Stopped early': '#F2B857', 'Auto-closed': '#9EB2DB', 'Missed': '#E58C8C' };
const trendIcon = { RISING: TrendingUpIcon, FALLING: TrendingDownIcon, STABLE: MinusIcon };
const trendColor = { RISING: 'text-brand-600', FALLING: 'text-emerald-600', STABLE: 'text-charcoal-muted' };
const show = (v, suffix = '') => (v == null ? '–' : `${v}${suffix}`);

export function AdminResearch() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        api.get('/scheduler/research/overview').then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e)));
    }, []);

    return (<div className="space-y-6">
      <PageHeader title="Research Dashboard" subtitle="Aggregated, anonymised study metrics across consenting participants."/>
      {error ? <Card padding="lg"><p className="text-sm text-charcoal-muted">{error}</p></Card>
        : !data ? <LoadingState label="Loading study metrics…"/> : <Overview data={data}/>}

      {/* Component 3: experiment mode per participant (researchers only) + metrics CSV */}
      <PilotModes />
    </div>);
}

function Overview({ data }) {
    const { kpis, stress_by_day: stress, tasks_done_by_day: tasks, session_outcomes: outcomes,
            adjustments_by_week: weeks, intervention_effect: effect, participants } = data;
    const cards = [
        { icon: UsersIcon, label: 'Consenting participants', value: show(kpis.participants), bg: 'bg-brand-50', color: 'text-brand-500' },
        { icon: ActivityIcon, label: 'Active (last 7 days)', value: show(kpis.active_7d), bg: 'bg-sage-light', color: 'text-emerald-600' },
        { icon: CheckCircle2Icon, label: 'Planned tasks done', value: show(kpis.task_completion_pct, '%'), bg: 'bg-sky-50', color: 'text-sky-500' },
        { icon: GaugeIcon, label: 'Focus sessions finished', value: show(kpis.focus_completion_pct, '%'), bg: 'bg-violet-50', color: 'text-violet-500' },
        { icon: HeartPulseIcon, label: 'Avg latest risk score', value: show(kpis.avg_stress_pct, '%'), bg: 'bg-amber-light', color: 'text-amber-600' },
    ];
    const outcomeTotal = Object.values(outcomes).reduce((a, b) => a + b, 0);
    const segments = Object.entries(outcomes).filter(([, v]) => v > 0)
        .map(([label, v]) => ({ label, value: Math.round(v / outcomeTotal * 100), color: OUTCOME_COLORS[label] }));
    const stressPoints = stress.filter((s) => s.value != null);

    return (<>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {cards.map((k) => <Card key={k.label} padding="sm">
            <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', k.bg)}><k.icon size={17} className={k.color}/></span>
            <p className="text-2xl font-extrabold text-charcoal mt-3">{k.value}</p>
            <p className="text-xs font-medium text-charcoal-muted mt-0.5">{k.label}</p>
          </Card>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <h3 className="font-bold text-charcoal mb-1">Average risk score over time</h3>
          <p className="text-xs text-charcoal-muted mb-4">Cohort mean of Component 4 signals shared with the scheduler, past 7 days</p>
          {stressPoints.length > 1 ? <LineChart data={stressPoints} color="#7F95CC"/>
            : <p className="text-sm text-charcoal-muted">Not enough shared wellbeing signals yet.</p>}
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Focus session outcomes</h3>
          <p className="text-xs text-charcoal-muted mb-4">Last 30 days, from session logs (no camera)</p>
          {outcomeTotal ?
            <div className="flex items-center gap-4">
              <div className="relative">
                <DonutChart segments={segments} size={140} stroke={20}/>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold text-charcoal">{Math.round(outcomes.Finished / outcomeTotal * 100)}%</span>
                  <span className="text-[11px] text-charcoal-muted font-semibold">Finished</span>
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                {segments.map((f) => <div key={f.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-charcoal-light font-medium">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }}/> {f.label}
                    </span>
                    <span className="font-bold text-charcoal">{f.value}%</span>
                  </div>)}
              </div>
            </div> : <p className="text-sm text-charcoal-muted">No focus sessions yet.</p>}
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-4">Tasks completed per day</h3>
          <BarChart data={tasks}/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Lighter-plan suggestions</h3>
          <p className="text-xs text-charcoal-muted mb-4">Proposed per week (accepted in brackets)</p>
          <BarChart data={weeks.map((w) => ({ label: `${w.label} (${w.accepted})`, value: w.proposed }))} unit="/wk"/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Intervention effect</h3>
          <p className="text-xs text-charcoal-muted mb-4">Next risk score within 7 days after an accepted lighter plan</p>
          <div className="flex flex-col items-center justify-center py-2">
            <span className={cn('text-4xl font-extrabold', effect.avg_change_pct == null ? 'text-charcoal-muted' : effect.avg_change_pct <= 0 ? 'text-emerald-600' : 'text-brand-600')}>
              {effect.avg_change_pct == null ? '–' : `${effect.avg_change_pct > 0 ? '+' : ''}${effect.avg_change_pct}%`}
            </span>
            <p className="text-sm text-charcoal-muted mt-1 text-center">
              {effect.cases ? `average change, ${effect.cases} case${effect.cases === 1 ? '' : 's'} (descriptive, not causal)` : 'no accepted lighter plans with a follow-up signal yet'}
            </p>
          </div>
        </Card>
      </div>

      <Card padding="none">
        <div className="p-5 border-b border-black/[0.05]">
          <h3 className="font-bold text-charcoal">Participants</h3>
          <p className="text-xs text-charcoal-muted">Research IDs only · consenting students only</p>
        </div>
        {participants.length === 0 ? <p className="p-5 text-sm text-charcoal-muted">No consenting participants yet.</p> :
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-charcoal-muted">
                  <th className="px-5 py-3">Research ID</th>
                  <th className="px-5 py-3">Tasks done</th>
                  <th className="px-5 py-3">Sessions finished</th>
                  <th className="px-5 py-3">Risk trend</th>
                  <th className="px-5 py-3">Last session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {participants.map((p) => {
                    const TIcon = trendIcon[p.stress_trend];
                    return <tr key={p.research_id} className="hover:bg-cream/60 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-charcoal">{p.research_id}</td>
                      <td className="px-5 py-3.5 text-charcoal-light">{p.tasks_done}</td>
                      <td className="px-5 py-3.5">
                        {p.focus_completion_pct == null ? <span className="text-charcoal-muted">–</span> :
                          <span className="inline-flex items-center gap-2">
                            <span className="w-14 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                              <span className="block h-full bg-brand-500 rounded-full" style={{ width: `${p.focus_completion_pct}%` }}/>
                            </span>
                            <span className="font-semibold text-charcoal">{p.focus_completion_pct}%</span>
                          </span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {TIcon ? <span className={cn('inline-flex items-center gap-1 font-semibold capitalize', trendColor[p.stress_trend])}>
                            <TIcon size={14}/> {p.stress_trend.toLowerCase()}
                          </span> : <span className="text-charcoal-muted">no signal</span>}
                      </td>
                      <td className="px-5 py-3.5 text-charcoal-muted">
                        {p.last_active ? toDate(p.last_active).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '–'}
                      </td>
                    </tr>;
                })}
              </tbody>
            </table>
          </div>}
      </Card>
    </>);
}
