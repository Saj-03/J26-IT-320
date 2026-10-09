import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ArrowRightIcon, CalendarClockIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { SectionTitle } from '../../components/PlanPrimitives';
import { missedSession } from '../../data';
import { cn } from '../../../../shared/lib/cn';
export function MissedSession() {
    const navigate = useNavigate();
    const [choosing, setChoosing] = useState(false);
    const [picked, setPicked] = useState(0);
    const [accepted, setAccepted] = useState(false);
    return (<div className="space-y-6">
      <PageHeader title="Session Missed" subtitle="No problem. We found another suitable time before your deadline."/>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-sage-light border border-emerald-100 p-5 sm:p-6 flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <CalendarClockIcon size={20}/>
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-emerald-800">Already sorted</h2>
          <p className="text-sm text-emerald-700/85 mt-1 leading-relaxed max-w-xl">
            No problem. We found another suitable time before your deadline.
          </p>
        </div>
      </motion.div>

      <Card padding="lg">
        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-charcoal-muted mb-2">Missed</p>
            <p className="font-bold text-charcoal line-through decoration-charcoal-muted/40">
              {missedSession.missed.day} {missedSession.missed.time}
            </p>
            <p className="text-sm text-charcoal-muted mt-0.5">{missedSession.missed.title}</p>
          </div>

          <div className="flex sm:flex-col items-center justify-center text-charcoal-muted">
            <ArrowRightIcon size={20} className="rotate-90 sm:rotate-0"/>
          </div>

          <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700 mb-2">New Time</p>
            <p className="font-extrabold text-charcoal">
              {missedSession.newTime.day} {missedSession.newTime.time}
            </p>
            <p className="text-sm text-charcoal-muted mt-0.5">Your peak focus window</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-cream px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-1">Also changed</p>
          <p className="text-sm font-semibold text-charcoal-light">{missedSession.secondary}</p>
        </div>
      </Card>

      <AnimatePresence>
        {choosing &&
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card padding="lg">
              <SectionTitle title="Choose another time" subtitle="All of these still land before Friday."/>
              <div className="space-y-2">
                {missedSession.alternatives.map((a, i) => <button key={`${a.day}-${a.time}`} onClick={() => setPicked(i)} className={cn('w-full text-left rounded-2xl p-4 border-2 transition-colors flex items-center gap-3', picked === i ? 'border-brand-500 bg-brand-50' : 'border-black/[0.06] bg-white hover:border-brand-200')}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-charcoal">
                        {a.day} {a.time}
                      </p>
                      <p className="text-xs text-charcoal-muted mt-0.5">{a.note}</p>
                    </div>
                    {a.best &&
                        <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-brand-500 rounded-full px-2 py-0.5 shrink-0">
                        Best
                      </span>}
                  </button>)}
              </div>
            </Card>
          </motion.div>}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {accepted ?
            <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="flex items-center gap-4">
              <span className="text-3xl">✅</span>
              <div className="flex-1">
                <p className="font-bold text-charcoal">
                  Moved to {missedSession.alternatives[picked].day} {missedSession.alternatives[picked].time}
                </p>
                <p className="text-sm text-charcoal-muted mt-0.5">Your week has been rebalanced around it.</p>
              </div>
              <Button onClick={() => navigate('/app/schedule')}>
                View schedule <ArrowRightIcon size={16}/>
              </Button>
            </Card>
          </motion.div> :
            <motion.div key="choose" className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="flex-1" onClick={() => setAccepted(true)}>
              <CheckIcon size={18}/> Accept Changes
            </Button>
            <Button size="lg" variant="outline" className="flex-1" onClick={() => setChoosing((v) => !v)}>
              Choose Another Time
            </Button>
          </motion.div>}
      </AnimatePresence>
    </div>);
}
