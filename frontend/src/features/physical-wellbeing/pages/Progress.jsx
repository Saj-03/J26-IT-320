import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUpIcon, ArrowRightIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { BarChart, LineChart } from '../../../shared/components/charts/Charts';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle } from '../components/Shared';
import { progressStats, progressSeries, aiWeeklyInsight } from '../data';
import { cn } from '../../../shared/lib/cn';
const tabs = ['Week', 'Month', 'Semester'];
export function PhysicalProgress() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('Week');
    const data = progressSeries[tab];
    return (<div className="space-y-6">
      <PageHeader title="My Progress" subtitle="How far you’ve come — across activity, consistency and habits." action={<div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft">
            {tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-1.5 rounded-full text-sm font-semibold transition-colors', tab === t ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
                {t}
              </button>)}
          </div>}/>

      <PhysicalNav />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {progressStats.map((s) => <Card key={s.label} padding="sm" hover>
            {s.absolute ?
                <div className="flex items-center gap-3">
                <ProgressRing value={s.value} size={54} stroke={6}>
                  <span className="text-[11px] font-extrabold text-charcoal">{s.value}%</span>
                </ProgressRing>
                <p className="text-xs font-medium text-charcoal-muted leading-tight">{s.label}</p>
              </div> :
                <>
                <span className="w-9 h-9 rounded-xl bg-sage-light text-emerald-600 flex items-center justify-center">
                  <TrendingUpIcon size={16}/>
                </span>
                <p className="text-2xl font-extrabold text-charcoal mt-3 tracking-tight">
                  ↑ {s.value}
                  {s.suffix}
                </p>
                <p className="text-xs font-medium text-charcoal-muted mt-0.5 leading-tight">{s.label}</p>
              </>}
          </Card>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle title={`${tab === 'Week' ? 'Weekly' : tab === 'Month' ? 'Monthly' : 'Semester'} wellbeing score`} subtitle="Higher is better — consistency matters more than peaks."/>
          {tab === 'Week' ? <BarChart data={data} height={190} unit="%"/> : <LineChart data={data} height={190}/>}
        </Card>

        {/* Goal completion */}
        <Card padding="lg">
          <SectionTitle title="Goal completion" subtitle="Against the goals you picked at setup."/>
          <div className="space-y-4">
            {[
            { l: 'Improve Physical Fitness', v: 82 },
            { l: 'Become More Active', v: 71 },
            { l: 'Build Better Eating Habits', v: 78 }
        ].
            map((g) => <div key={g.l}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-charcoal-light">{g.l}</span>
                  <span className="font-bold text-charcoal">{g.v}%</span>
                </div>
                <ProgressBar value={g.v}/>
              </div>)}
          </div>
        </Card>
      </div>

      {/* AI weekly insight */}
      <AIInsightCard title="AI Wellbeing Insight">
        {aiWeeklyInsight}
        <span className="block mt-4">
          <Button variant="soft" size="sm" className="bg-white" onClick={() => navigate('/app/physical/exercise')}>
            View Recommendations <ArrowRightIcon size={14}/>
          </Button>
        </span>
      </AIInsightCard>
    </div>);
}
