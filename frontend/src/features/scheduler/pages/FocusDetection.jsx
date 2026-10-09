import React, { useState } from 'react';
import { ShieldCheckIcon, EyeIcon, DatabaseIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { cn } from '../../../shared/lib/cn';
const states = [
    { key: 'FOCUSED', label: 'Focused', color: 'text-emerald-600', bg: 'bg-sage-light', active: true },
    { key: 'DISTRACTED', label: 'Distracted', color: 'text-amber-600', bg: 'bg-amber-light', active: false },
    { key: 'SLEEPING', label: 'Sleeping', color: 'text-violet-500', bg: 'bg-violet-50', active: false },
    { key: 'PHONE', label: 'Phone', color: 'text-sky-500', bg: 'bg-sky-50', active: false }
];
const signals = [
    { l: 'Focus Score', v: '82%' },
    { l: 'Focus State', v: 'Focused' },
    { l: 'Gaze Direction', v: 'Centre' },
    { l: 'Head Position', v: 'Neutral' },
    { l: 'Eye Openness', v: '0.91' },
    { l: 'Keyboard Activity', v: 'Active' },
    { l: 'Mouse Activity', v: 'Active' },
    { l: 'Phone Detection', v: 'None' }
];
function Toggle({ label, desc, on }) {
    const [enabled, setEnabled] = useState(on);
    return (<div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-semibold text-charcoal">{label}</p>
        <p className="text-xs text-charcoal-muted">{desc}</p>
      </div>
      <button onClick={() => setEnabled((e) => !e)} className={cn('w-12 h-7 rounded-full transition-colors relative shrink-0', enabled ? 'bg-brand-500' : 'bg-black/15')} aria-pressed={enabled}>
        <span className={cn('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', enabled ? 'left-6' : 'left-1')}/>
      </button>
    </div>);
}
export function FocusDetection() {
    return (<div className="space-y-6">
      <PageHeader title="Focus Detection" subtitle="Your webcam is processed locally to help you stay on track."/>

      {/* Privacy banner */}
      <div className="bg-sage-light border border-emerald-100 rounded-3xl p-5 flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <ShieldCheckIcon size={20}/>
        </span>
        <div>
          <p className="font-bold text-emerald-800">No images, videos, or screenshots are stored.</p>
          <p className="text-sm text-emerald-700/80 mt-0.5">
            Everything is processed on your device in real time. IHSD only keeps the numerical signals below.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gauge + states */}
        <Card padding="lg" className="lg:col-span-1 flex flex-col items-center text-center">
          <h3 className="font-bold text-charcoal mb-4 self-start">Live Focus Score</h3>
          <ProgressRing value={82} size={180} stroke={14} color="#7FB998">
            <span className="text-4xl font-extrabold text-charcoal">82</span>
            <span className="text-xs font-semibold text-charcoal-muted">Focus score</span>
          </ProgressRing>
          <div className="grid grid-cols-2 gap-2 w-full mt-6">
            {states.map((s) => <div key={s.key} className={cn('rounded-2xl p-3 border-2 transition-all', s.active ? `${s.bg} border-transparent` : 'bg-white border-black/[0.05]')}>
                <p className={cn('text-sm font-bold', s.active ? s.color : 'text-charcoal-muted')}>{s.label}</p>
                {s.active && <p className="text-[10px] font-semibold text-charcoal-muted mt-0.5">Current state</p>}
              </div>)}
          </div>
        </Card>

        {/* Signals */}
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <EyeIcon size={18} className="text-charcoal-muted"/>
            <h3 className="font-bold text-charcoal">Numerical signals only</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {signals.map((s) => <div key={s.l} className="bg-cream rounded-2xl p-4">
                <p className="text-xs font-medium text-charcoal-muted">{s.l}</p>
                <p className="text-lg font-extrabold text-charcoal mt-1">{s.v}</p>
              </div>)}
          </div>

          <div className="mt-6 pt-5 border-t border-black/[0.05]">
            <div className="flex items-center gap-2 mb-1">
              <DatabaseIcon size={16} className="text-charcoal-muted"/>
              <h4 className="font-bold text-charcoal">Privacy Controls</h4>
            </div>
            <div className="divide-y divide-black/[0.05]">
              <Toggle label="Enable Focus Detection" desc="Use local processing to track focus" on={true}/>
              <Toggle label="Disable Webcam" desc="Turn off camera-based signals entirely" on={false}/>
              <Toggle label="Data Collection Preferences" desc="Store anonymised focus scores for insights" on={true}/>
            </div>
          </div>
        </Card>
      </div>
    </div>);
}
