import React from 'react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { ProgressBar } from '../../../../shared/components/ui/ProgressBar';
import { BarChart } from '../../../../shared/components/charts/Charts';
import { AIInsightCard } from '../../../../shared/components/domain/AIInsightCard';
import { LoadBadge, SectionTitle } from '../../components/PlanPrimitives';
import { attentionBands, attentionCurve, matchingRules } from '../../data';
const levelColor = {
    'High Attention': 'bg-brand-500',
    'Medium Attention': 'bg-amber-soft',
    'Low Attention': 'bg-sage'
};
export function AttentionPatterns() {
    return (<div className="space-y-6">
      <PageHeader title="Your Best Study Times" subtitle="Learned from how you actually focus, not how you plan to."/>

      <AIInsightCard>Difficult tasks will be placed during your strongest focus periods.</AIInsightCard>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle title="Your attention through the day" subtitle="Peaks mid-morning, fades after dinner."/>
          <BarChart data={attentionCurve} height={200} unit="%"/>
        </Card>

        <Card padding="lg">
          <SectionTitle title="Focus windows"/>
          <div className="space-y-4">
            {attentionBands.map((b) => <div key={b.range}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-charcoal">{b.range}</span>
                  <LoadBadge load={b.load}/>
                </div>
                <ProgressBar value={b.value} color={levelColor[b.level]}/>
                <p className="text-xs text-charcoal-muted mt-1">{b.level}</p>
              </div>)}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle title="How we match tasks to time" subtitle="One simple rule per load type."/>
        <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
          {matchingRules.map((r) => <Card key={r.load} padding="lg" hover className="text-center">
              <div className="flex justify-center">
                <LoadBadge load={r.load}/>
              </div>
              <p className="text-2xl mt-3">↓</p>
              <p className="text-base font-extrabold text-charcoal mt-2">{r.window}</p>
              <p className="text-sm text-charcoal-muted mt-0.5">{r.example}</p>
            </Card>)}
        </div>
      </div>
    </div>);
}
