import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon, SparklesIcon, ArrowRightIcon } from 'lucide-react';
import { Logo } from '../../../shared/components/ui/Logo';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { cn } from '../../../shared/lib/cn';
const stages = [
    { label: 'Analysing your lifestyle', emoji: '🏫' },
    { label: 'Analysing physical activity', emoji: '🚶' },
    { label: 'Understanding your goals', emoji: '🎯' },
    { label: 'Preparing exercise recommendations', emoji: '🏃' },
    { label: 'Preparing nutrition recommendations', emoji: '🥗' },
    { label: 'Creating healthy habits', emoji: '✨' }
];
export function PhysicalGenerating() {
    const navigate = useNavigate();
    const [active, setActive] = useState(0);
    const done = active >= stages.length;
    useEffect(() => {
        if (done)
            return;
        const id = setTimeout(() => setActive((a) => a + 1), 900);
        return () => clearTimeout(id);
    }, [active, done]);
    const pct = Math.min(100, active / stages.length * 100);
    return (<div className="min-h-screen w-full bg-cream flex flex-col">
      <header className="p-5 max-w-2xl w-full mx-auto">
        <Logo size={34} textClass="text-lg"/>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {!done ?
            <motion.div key="loading" exit={{ opacity: 0, y: -12 }}>
                <div className="flex flex-col items-center text-center">
                  <ProgressRing value={pct} size={140} stroke={12}>
                    <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-3xl">
                      ✨
                    </motion.span>
                  </ProgressRing>
                  <h1 className="text-2xl font-extrabold text-charcoal tracking-tight mt-6">
                    Creating Your Personal Wellbeing Plan
                  </h1>
                  <p className="text-sm text-charcoal-muted mt-1.5">This only takes a moment.</p>
                </div>

                <ul className="mt-8 space-y-2.5">
                  {stages.map((s, i) => {
                    const complete = i < active;
                    const current = i === active;
                    return (<motion.li key={s.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: complete || current ? 1 : 0.4, x: 0 }} className={cn('flex items-center gap-3 rounded-2xl px-4 py-3 border transition-colors', complete && 'bg-brand-50 border-brand-100', current && 'bg-white border-brand-300 shadow-soft', !complete && !current && 'bg-white/50 border-black/[0.04]')}>
                        <span className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm', complete ? 'bg-brand-500 text-white' : 'bg-cream')}>
                          {complete ? <CheckIcon size={14} strokeWidth={3}/> : s.emoji}
                        </span>
                        <span className={cn('text-sm font-semibold', complete ? 'text-brand-700' : 'text-charcoal')}>
                          {s.label}
                        </span>
                        {current &&
                            <span className="ml-auto w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"/>}
                      </motion.li>);
                })}
                </ul>
              </motion.div> :
            <motion.div key="ready" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center">
                <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }} className="w-24 h-24 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-glow">
                  <SparklesIcon size={44}/>
                </motion.div>
                <h1 className="text-3xl font-extrabold text-charcoal tracking-tight mt-6">Your Plan Is Ready</h1>
                <p className="text-charcoal-light mt-2 max-w-xs">
                  Built around your goals, your available time, and your knee-friendly activity needs.
                </p>

                <div className="grid grid-cols-3 gap-2 w-full mt-7">
                  {[
                    { emoji: '🏃', l: 'Exercise' },
                    { emoji: '🥗', l: 'Nutrition' },
                    { emoji: '✨', l: 'Habits' }
                ].
                    map((c) => <div key={c.l} className="bg-white rounded-2xl p-3 border border-black/[0.04] shadow-soft">
                      <div className="text-xl">{c.emoji}</div>
                      <p className="text-xs font-bold text-charcoal mt-1">{c.l}</p>
                    </div>)}
                </div>

                <Button size="lg" fullWidth className="mt-8" onClick={() => navigate('/app/physical')}>
                  View My Plan <ArrowRightIcon size={18}/>
                </Button>
              </motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </div>);
}
