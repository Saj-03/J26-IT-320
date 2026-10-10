import React from 'react';
import { ClockIcon, BrainIcon, TargetIcon, TrendingUpIcon, MoonStarIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { AIInsightCard } from '../shared/components/domain/AIInsightCard';
import { BarChart, LineChart } from '../shared/components/charts/Charts';
import { productivityByHour, focusTimeData, stressData, weeklyTasksData } from '../shared/lib/data';
const insights = [
    { icon: ClockIcon, title: 'Your Peak Focus Time', value: '9:00 AM – 12:00 PM', desc: 'Your deepest work happens in the late morning.' },
    { icon: BrainIcon, title: 'Your Best Task Type', value: 'Deep academic work', desc: 'You perform strongest on focused, single-subject work.' },
    { icon: TargetIcon, title: 'Your Task Accuracy', value: 'Off by ~28%', desc: 'You usually underestimate task duration.' },
    { icon: MoonStarIcon, title: 'Your Productivity Pattern', value: 'Dips after 8 PM', desc: 'Focus decreases sharply in the evening.' }
];
export function Insights() {
    return (<div className="space-y-6">
      <PageHeader title="AI Insights" subtitle="What ThriveU has learned about how you work and feel best."/>

      <AIInsightCard title="Your Weekly Trend">
        You completed <b>18% more tasks</b> this week than last — and did it with less late-night work. Keep protecting
        those mornings.
      </AIInsightCard>

      {/* Insight cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {insights.map((ins) => <Card key={ins.title} hover>
            <span className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center">
              <ins.icon size={19}/>
            </span>
            <p className="text-xs font-semibold text-charcoal-muted mt-3">{ins.title}</p>
            <p className="text-lg font-extrabold text-charcoal mt-0.5 leading-tight">{ins.value}</p>
            <p className="text-xs text-charcoal-muted mt-1.5 leading-relaxed">{ins.desc}</p>
          </Card>)}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Productivity by hour</h3>
          <p className="text-xs text-charcoal-muted mb-4">Peaks mid-morning, fades in the evening</p>
          <BarChart data={productivityByHour.map((d) => ({ label: d.hour, value: d.value }))} unit="%"/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Focus by day (hrs)</h3>
          <p className="text-xs text-charcoal-muted mb-4">Strongest end-of-week focus</p>
          <BarChart data={focusTimeData.map((d) => ({ label: d.day, value: d.value }))} unit="h"/>
        </Card>
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUpIcon size={16} className="text-brand-500"/>
            <h3 className="font-bold text-charcoal">Task completion rate</h3>
          </div>
          <p className="text-xs text-charcoal-muted mb-4">Trending up over the week</p>
          <LineChart data={weeklyTasksData.map((d) => ({ label: d.day, value: d.value }))} color="#2E9C88"/>
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Stress trend</h3>
          <p className="text-xs text-charcoal-muted mb-4">Calming into the weekend</p>
          <LineChart data={stressData.map((d) => ({ label: d.day, value: d.value }))} color="#7F95CC"/>
        </Card>
      </div>

      {/* Estimated vs actual */}
      <Card padding="lg">
        <h3 className="font-bold text-charcoal mb-1">Estimated vs actual duration</h3>
        <p className="text-xs text-charcoal-muted mb-5">You tend to underestimate — ThriveU adds a buffer for you.</p>
        <div className="space-y-4">
          {[
            { task: 'Chemistry Lab Report', est: 120, act: 165 },
            { task: 'Math Problem Sheet', est: 90, act: 110 },
            { task: 'Software Assignment', est: 150, act: 180 }
        ].
            map((r) => {
            const max = 200;
            return (<div key={r.task}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-charcoal">{r.task}</span>
                  <span className="text-charcoal-muted text-xs font-semibold">
                    est {r.est}m · actual {r.act}m
                  </span>
                </div>
                <div className="relative h-6 rounded-full bg-black/[0.04] overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-brand-200" style={{ width: `${r.est / max * 100}%` }}/>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-brand-500" style={{ width: `${r.act / max * 100}%`, mixBlendMode: 'multiply' }}/>
                </div>
              </div>);
        })}
        </div>
        <div className="flex gap-4 mt-4 text-xs font-semibold text-charcoal-muted">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-200"/> Estimated</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-500"/> Actual</span>
        </div>
      </Card>
    </div>);
}
