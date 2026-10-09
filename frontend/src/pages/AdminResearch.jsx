import React from 'react';
import { UsersIcon, ActivityIcon, CheckCircle2Icon, GaugeIcon, HeartPulseIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { LineChart, BarChart, DonutChart } from '../shared/components/charts/Charts';
import { participants, stressData, weeklyTasksData } from '../shared/lib/data';
import { cn } from '../shared/lib/cn';
const kpis = [
    { icon: UsersIcon, label: 'Total participants', value: '142', bg: 'bg-brand-50', color: 'text-brand-500' },
    { icon: ActivityIcon, label: 'Active participants', value: '118', bg: 'bg-sage-light', color: 'text-emerald-600' },
    { icon: CheckCircle2Icon, label: 'Avg task completion', value: '78%', bg: 'bg-sky-50', color: 'text-sky-500' },
    { icon: GaugeIcon, label: 'Avg focus score', value: '81%', bg: 'bg-violet-50', color: 'text-violet-500' },
    { icon: HeartPulseIcon, label: 'Avg stress score', value: '46%', bg: 'bg-amber-light', color: 'text-amber-600' }
];
const focusDist = [
    { label: 'Focused', value: 62, color: '#7FB998' },
    { label: 'Distracted', value: 22, color: '#F2B857' },
    { label: 'Phone', value: 11, color: '#7CB8E8' },
    { label: 'Sleeping', value: 5, color: '#B69CE0' }
];
const trendIcon = { rising: TrendingUpIcon, falling: TrendingDownIcon, stable: MinusIcon };
const trendColor = { rising: 'text-emerald-600', falling: 'text-brand-600', stable: 'text-charcoal-muted' };
export function AdminResearch() {
    return (<div className="space-y-6">
      <PageHeader title="Research Dashboard" subtitle="Aggregated, anonymised study metrics across all participants."/>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpis.map((k) => <Card key={k.label} padding="sm">
            <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', k.bg)}>
              <k.icon size={17} className={k.color}/>
            </span>
            <p className="text-2xl font-extrabold text-charcoal mt-3">{k.value}</p>
            <p className="text-xs font-medium text-charcoal-muted mt-0.5">{k.label}</p>
          </Card>)}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <h3 className="font-bold text-charcoal mb-1">Average stress over time</h3>
          <p className="text-xs text-charcoal-muted mb-4">Cohort mean, past 7 days</p>
          <LineChart data={stressData.map((d) => ({ label: d.day, value: d.value }))} color="#F2B857"/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-4">Focus state distribution</h3>
          <div className="flex items-center gap-4">
            <div className="relative">
              <DonutChart segments={focusDist} size={140} stroke={20}/>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-charcoal">62%</span>
                <span className="text-[10px] text-charcoal-muted font-semibold">Focused</span>
              </div>
            </div>
            <div className="space-y-1.5 flex-1">
              {focusDist.map((f) => <div key={f.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-charcoal-light font-medium">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }}/> {f.label}
                  </span>
                  <span className="font-bold text-charcoal">{f.value}%</span>
                </div>)}
            </div>
          </div>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-4">Task completion over time</h3>
          <BarChart data={weeklyTasksData}/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-4">Schedule adjustment frequency</h3>
          <BarChart data={[
            { label: 'W1', value: 24 },
            { label: 'W2', value: 31 },
            { label: 'W3', value: 28 },
            { label: 'W4', value: 19 }
        ]} unit="/wk"/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Intervention effectiveness</h3>
          <p className="text-xs text-charcoal-muted mb-4">Stress reduction after adaptation</p>
          <div className="flex flex-col items-center justify-center py-2">
            <span className="text-4xl font-extrabold text-emerald-600">-23%</span>
            <p className="text-sm text-charcoal-muted mt-1 text-center">avg stress after schedule lightening</p>
          </div>
        </Card>
      </div>

      {/* Participant table */}
      <Card padding="none">
        <div className="p-5 border-b border-black/[0.05]">
          <h3 className="font-bold text-charcoal">Participants</h3>
          <p className="text-xs text-charcoal-muted">Anonymised IDs only</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-charcoal-muted">
                <th className="px-5 py-3">Participant ID</th>
                <th className="px-5 py-3">Tasks Completed</th>
                <th className="px-5 py-3">Average Focus</th>
                <th className="px-5 py-3">Stress Trend</th>
                <th className="px-5 py-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {participants.map((p) => {
            const TIcon = trendIcon[p.trend];
            return (<tr key={p.id} className="hover:bg-cream/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-charcoal">{p.id}</td>
                    <td className="px-5 py-3.5 text-charcoal-light">{p.tasks}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-14 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                          <span className="block h-full bg-brand-500 rounded-full" style={{ width: `${p.focus}%` }}/>
                        </span>
                        <span className="font-semibold text-charcoal">{p.focus}%</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('inline-flex items-center gap-1 font-semibold capitalize', trendColor[p.trend])}>
                        <TIcon size={14}/> {p.trend}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-charcoal-muted">{p.active}</td>
                  </tr>);
        })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>);
}
