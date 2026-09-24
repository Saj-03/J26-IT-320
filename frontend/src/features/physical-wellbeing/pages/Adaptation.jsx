import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCwIcon, ArrowRightIcon, TrendingDownIcon, MinusIcon, CheckIcon, SlidersHorizontalIcon, UndoIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PhysicalNav } from '../components/PhysicalNav';
import { AdaptiveLoop } from '../components/AdaptiveLoop';
import { SectionTitle } from '../components/Shared';
import { adaptationEvent } from '../data';
import { cn } from '../../../shared/lib/cn';
export function PhysicalAdaptation() {
    const navigate = useNavigate();
    const [decision, setDecision] = useState(null);
    return (<div className="space-y-6">
      <PageHeader title="Plan Adaptation" subtitle="How and why your plan changed — and what you’d like to do about it."/>

      <PhysicalNav />

      {/* Notification banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-brand-50 border border-brand-100 p-5 sm:p-6 flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-brand-500 text-white flex items-center justify-center shrink-0">
          <RotateCwIcon size={20}/>
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-charcoal">{adaptationEvent.headline}</h2>
          <p className="text-sm text-charcoal-light mt-1 leading-relaxed">{adaptationEvent.message}</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Before / After */}
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle title="What changed" subtitle="Your plan was rebalanced, not reduced."/>
          <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <div className="rounded-2xl border border-black/[0.06] bg-cream p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-charcoal-muted mb-2">Previous plan</p>
              <p className="font-bold text-charcoal line-through decoration-charcoal-muted/40">{adaptationEvent.previous}</p>
            </div>

            <div className="flex sm:flex-col items-center justify-center text-charcoal-muted">
              <ArrowRightIcon size={20} className="rotate-90 sm:rotate-0"/>
            </div>

            <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700 mb-2">New plan</p>
              <p className="font-extrabold text-charcoal">{adaptationEvent.next}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-cream p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-1">Why this changed</p>
            <p className="text-sm text-charcoal-light leading-relaxed">{adaptationEvent.reason}</p>
          </div>
        </Card>

        {/* Controls */}
        <Card padding="lg">
          <AnimatePresence mode="wait">
            {decision ?
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={cn('rounded-2xl p-4 flex items-start gap-3', decision === 'accepted' ? 'bg-sage-light' : 'bg-cream')}>
                  <span className="text-2xl shrink-0">{decision === 'accepted' ? '✅' : '↩️'}</span>
                  <div>
                    <p className="font-bold text-charcoal">
                      {decision === 'accepted' ? 'Updated plan applied' : 'Keeping your previous plan'}
                    </p>
                    <p className="text-sm text-charcoal-muted mt-0.5 leading-relaxed">
                      {decision === 'accepted' ?
                    'Your week now starts with the lighter session.' :
                    'No problem — we’ll keep watching and check in again next week.'}
                    </p>
                  </div>
                </div>
                <Button fullWidth size="lg" className="mt-4" onClick={() => navigate('/app/physical/plan')}>
                  View today’s plan <ArrowRightIcon size={17}/>
                </Button>
              </motion.div> :
            <motion.div key="choose" className="space-y-2.5">
                <p className="text-sm font-bold text-charcoal mb-3">This is your call — nothing changes without you.</p>
                <Button fullWidth size="lg" onClick={() => setDecision('accepted')}>
                  <CheckIcon size={17}/> Accept Updated Plan
                </Button>
                <Button fullWidth size="lg" variant="outline" onClick={() => navigate('/app/physical/profile')}>
                  <SlidersHorizontalIcon size={16}/> Adjust Preferences
                </Button>
                <Button fullWidth size="lg" variant="ghost" onClick={() => setDecision('kept')}>
                  <UndoIcon size={16}/> Keep Previous Plan
                </Button>
              </motion.div>}
          </AnimatePresence>
        </Card>
      </div>

      {/* Signals */}
      <Card padding="lg">
        <SectionTitle title="Signals the AI learned from" subtitle="Straight from your last seven days."/>
        <div className="grid sm:grid-cols-3 gap-3">
          {adaptationEvent.signals.map((s) => {
            const flat = s.change === 0;
            return (<div key={s.label} className="flex items-start gap-3 rounded-2xl bg-cream p-4">
                <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white', flat ? 'text-charcoal-muted' : 'text-brand-600')}>
                  {flat ? <MinusIcon size={16}/> : <TrendingDownIcon size={16}/>}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-charcoal">{s.label}</p>
                    {!flat &&
                    <span className="text-sm font-extrabold text-brand-600">
                        {s.change > 0 ? '+' : ''}
                        {s.change}%
                      </span>}
                  </div>
                  <p className="text-xs text-charcoal-muted mt-0.5">{s.note}</p>
                </div>
              </div>);
        })}
        </div>
      </Card>

      <AdaptiveLoop activeKey="adapt"/>
    </div>);
}
