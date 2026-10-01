import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayIcon, SlidersHorizontalIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { AIInsightCard } from '../../../../shared/components/domain/AIInsightCard';
import { getSessionPlan, MIN_SESSIONS_FOR_PATTERN } from '../../data';
function Stepper({ label, value, setValue, step, suffix }) {
    return (<div className="flex items-center justify-between rounded-2xl bg-cream p-4">
      <span className="text-sm font-semibold text-charcoal-light">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => setValue(Math.max(step, value - step))} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-charcoal-light hover:bg-black/[0.04] transition-colors" aria-label={`Decrease ${label}`}>
          <MinusIcon size={15}/>
        </button>
        <span className="text-lg font-extrabold text-charcoal tabular-nums w-16 text-center">
          {value} {suffix}
        </span>
        <button onClick={() => setValue(value + step)} className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors" aria-label={`Increase ${label}`}>
          <PlusIcon size={15}/>
        </button>
      </div>
    </div>);
}
// [ITEM 7] Recommended lengths (or the 25 / 5 fallback when there are fewer than 5 sessions)
const plan = getSessionPlan();
export function SessionSetup() {
    const navigate = useNavigate();
    const [focus, setFocus] = useState(plan.focus);
    const [brk, setBrk] = useState(plan.breakMins);
    const [manual, setManual] = useState(false);
    return (<div className="space-y-6">
      <PageHeader title="Session Length" subtitle="We suggest a length that matches how you actually focus."/>

      <div className="max-w-xl space-y-5">
        {/* [ITEM 7] FALLBACK STATE — fewer than 5 sessions, so we use the standard 25 / 5 */}
        {plan.learning ?
            <AIInsightCard title="Still learning">
            We’re still learning your focus pattern - using <b>{plan.focus} min focus</b> / <b>{plan.breakMins} min break</b>.
            <span className="block text-xs mt-1">
              {plan.sessionCount} of {MIN_SESSIONS_FOR_PATTERN} sessions done. After {MIN_SESSIONS_FOR_PATTERN} sessions we suggest a length that fits you.
            </span>
          </AIInsightCard> :
            <AIInsightCard title="Based on your recent focus history">
            We recommend a <b>{plan.focus} minute</b> focus block followed by a{' '}
            <b>{plan.breakMins} minute</b> break.
          </AIInsightCard>}

        <Card padding="lg">
          <div className="grid grid-cols-2 gap-3">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-brand-50 p-6 text-center">
              <p className="text-4xl font-extrabold text-charcoal tabular-nums">{focus}</p>
              <p className="text-sm font-bold text-brand-700 mt-1">min Focus</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-3xl bg-sage-light p-6 text-center">
              <p className="text-4xl font-extrabold text-charcoal tabular-nums">{brk}</p>
              <p className="text-sm font-bold text-emerald-700 mt-1">min Break</p>
            </motion.div>
          </div>

          {manual &&
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <div className="space-y-2.5 mt-4">
                <Stepper label="Focus length" value={focus} setValue={setFocus} step={5} suffix="min"/>
                <Stepper label="Break length" value={brk} setValue={setBrk} step={1} suffix="min"/>
              </div>
            </motion.div>}

          <div className="mt-5 space-y-3">
            <Button size="lg" fullWidth onClick={() => navigate('/app/focus')}>
              <PlayIcon size={18} fill="currentColor"/> Start Session
            </Button>
            <Button size="lg" fullWidth variant="outline" onClick={() => setManual((m) => !m)}>
              <SlidersHorizontalIcon size={16}/> {manual ? 'Use Recommendation' : 'Adjust Manually'}
            </Button>
          </div>
        </Card>

        {/* [ITEM 7] Average is only shown when we have enough sessions */}
        {!plan.learning &&
            <Card padding="sm" className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <p className="text-sm text-charcoal-light">
            Average focused session: <b className="text-charcoal">{plan.averageSession} minutes</b> ({plan.sessionCount} sessions)
          </p>
        </Card>}
      </div>
    </div>);
}
