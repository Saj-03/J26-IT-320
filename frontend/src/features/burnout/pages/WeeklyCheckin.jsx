import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
const items = [
    { key: 'academic', label: 'Academic workload', invert: true },
    { key: 'relationship', label: 'Relationship wellbeing', invert: false },
    { key: 'work', label: 'Work pressure', invert: true },
    { key: 'social', label: 'Social connection', invert: false },
    { key: 'sleep', label: 'Sleep quality', invert: false },
    { key: 'mental', label: 'Mental wellbeing', invert: false }
];
export function WeeklyCheckin() {
    const navigate = useNavigate();
    const [vals, setVals] = useState({
        academic: 4,
        relationship: 3,
        work: 4,
        social: 3,
        sleep: 2,
        mental: 3
    });
    const pressure = useMemo(() => {
        // Higher workload/work + lower sleep/mental => higher pressure
        let score = 0;
        items.forEach((it) => {
            const v = vals[it.key];
            score += it.invert ? v : 6 - v;
        });
        return Math.round(score / (items.length * 5) * 100);
    }, [vals]);
    const band = pressure >= 66 ? 'Moderate-High' : pressure >= 40 ? 'Moderate' : 'Comfortable';
    return (<div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Let’s check in with your week." subtitle="A quick Sunday reflection so next week can flow better."/>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <div className="space-y-6">
            {items.map((it) => <div key={it.key}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold text-charcoal-light">{it.label}</span>
                  <span className="text-sm font-bold text-brand-600">{vals[it.key]} / 5</span>
                </div>
                <input type="range" min={1} max={5} value={vals[it.key]} onChange={(e) => setVals((v) => ({ ...v, [it.key]: Number(e.target.value) }))} className="w-full accent-brand-500"/>
              </div>)}
          </div>
        </Card>

        <div className="space-y-6">
          <Card padding="lg" className="flex flex-col items-center text-center">
            <p className="text-xs font-semibold text-charcoal-muted mb-3">Life Pressure Score</p>
            <ProgressRing value={pressure} size={140} stroke={12} color={pressure >= 66 ? '#F2B857' : '#F5811E'}>
              <span className="text-3xl font-extrabold text-charcoal">{pressure}%</span>
              <span className="text-xs font-semibold text-charcoal-muted mt-0.5">{band}</span>
            </ProgressRing>
          </Card>

          <div className="bg-brand-50 border border-brand-100 rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-xl bg-brand-500 text-white flex items-center justify-center">
                <SparklesIcon size={14}/>
              </span>
              <span className="font-bold text-brand-700 text-sm">IHSD notes</span>
            </div>
            <p className="text-sm text-charcoal-light leading-relaxed">
              Your workload and sleep are currently creating the most pressure. Next week’s schedule will include more
              breathing room.
            </p>
          </div>
        </div>
      </div>

      <Button size="lg" fullWidth onClick={() => navigate('/app/wellbeing')}>
        Save Weekly Check-in
      </Button>
    </div>);
}
