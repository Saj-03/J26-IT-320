import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ArrowRightIcon, LeafIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { LoadBadge, SectionTitle } from '../../components/PlanPrimitives';
import { stressAdjustment } from '../../data';
export function StressAdjust() {
    const navigate = useNavigate();
    const [accepted, setAccepted] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    return (<div className="space-y-6">
      <PageHeader title="Your Schedule Has Been Adjusted" subtitle="A lighter day, so you can still finish what matters."/>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-sage-light border border-emerald-100 p-5 sm:p-6 flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <LeafIcon size={20}/>
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-emerald-800">We made today lighter</h2>
          <p className="text-sm text-emerald-700/85 mt-1 leading-relaxed max-w-xl">
            We noticed your stress level is high, so we reduced today’s workload.
          </p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card padding="lg">
          <SectionTitle title="Previous Schedule"/>
          <div className="space-y-2">
            {stressAdjustment.before.map((b) => <div key={b.title} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-charcoal-muted tabular-nums">{b.time}</p>
                  <p className="text-sm font-bold text-charcoal mt-0.5">{b.title}</p>
                </div>
                <LoadBadge load={b.load}/>
              </div>)}
          </div>
        </Card>

        <Card padding="lg" className="border-2 border-brand-200">
          <SectionTitle title="Updated Schedule"/>
          <div className="space-y-2">
            {stressAdjustment.after.map((b) => <div key={b.title} className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-charcoal-muted tabular-nums">{b.time}</p>
                  <p className="text-sm font-bold text-charcoal mt-0.5">{b.title}</p>
                </div>
                <LoadBadge load={b.load}/>
              </div>)}
          </div>
          <div className="mt-3 rounded-2xl bg-cream px-4 py-3">
            <p className="text-sm font-semibold text-charcoal-light">{stressAdjustment.moved}</p>
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {showDetail &&
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card padding="lg">
              <SectionTitle title="What changed, exactly"/>
              <ul className="space-y-2.5">
                {[
                    'Programming shortened from 2 hours to 1 hour.',
                    'A 30-minute recovery break was added at 10:00.',
                    'Research reduced to a light 30-minute session.',
                    'Testing moved to tomorrow morning, still before your deadline.'
                ].
                    map((t) => <li key={t} className="flex items-start gap-2.5 text-sm text-charcoal-light">
                    <span className="w-5 h-5 rounded-full bg-sage-light text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon size={12} strokeWidth={3}/>
                    </span>
                    {t}
                  </li>)}
              </ul>
            </Card>
          </motion.div>}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {accepted ?
            <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="flex items-center gap-4">
              <span className="text-3xl">🌿</span>
              <div className="flex-1">
                <p className="font-bold text-charcoal">Your lighter schedule is active</p>
                <p className="text-sm text-charcoal-muted mt-0.5">Take it one block at a time today.</p>
              </div>
              <Button onClick={() => navigate('/app/schedule')}>
                Go to schedule <ArrowRightIcon size={16}/>
              </Button>
            </Card>
          </motion.div> :
            <motion.div key="choose" className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="flex-1" onClick={() => setAccepted(true)}>
              <CheckIcon size={18}/> Accept New Schedule
            </Button>
            <Button size="lg" variant="outline" className="flex-1" onClick={() => setShowDetail((v) => !v)}>
              {showDetail ? 'Hide Changes' : 'Review Changes'}
            </Button>
          </motion.div>}
      </AnimatePresence>
    </div>);
}
