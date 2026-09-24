import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon, LightbulbIcon, TrendingUpIcon, CheckIcon, RefreshCwIcon, XIcon } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/lib/cn';
/**
 * The signature AI card for this module, styled to match IHSD's AIInsightCard language.
 * Every AI recommendation shows: Recommendation, Why, Expected benefit, and User controls.
 */
export function AIRecoCard({ title, detail, why, benefit, tag, primaryLabel = 'Accept', onPrimary, onChange, onSkip }) {
    const [choice, setChoice] = useState(null);
    return (<div className="rounded-3xl bg-white border border-black/[0.04] shadow-soft overflow-hidden">
      {/* Header band */}
      <div className="bg-brand-50 px-5 py-3 flex items-center gap-2 border-b border-brand-100">
        <span className="w-7 h-7 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
          <SparklesIcon size={14}/>
        </span>
        <span className="text-sm font-bold text-brand-700">AI Recommendation for Today</span>
        {tag &&
            <span className="ml-auto text-[11px] font-bold text-brand-700 bg-white/70 rounded-full px-2.5 py-1 shrink-0">
            {tag}
          </span>}
      </div>

      <div className="p-5 sm:p-6">
        {/* Recommendation */}
        <h3 className="text-lg font-extrabold text-charcoal leading-snug">{title}</h3>
        {detail && <p className="text-sm text-charcoal-muted mt-1">{detail}</p>}

        {/* Why + Benefit */}
        <div className="mt-4 space-y-2.5">
          <div className="flex gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
              <LightbulbIcon size={14}/>
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted">Why this?</p>
              <p className="text-sm text-charcoal-light leading-relaxed mt-0.5">{why}</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-sage-light text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUpIcon size={14}/>
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted">Expected benefit</p>
              <p className="text-sm text-charcoal-light leading-relaxed mt-0.5">{benefit}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <AnimatePresence mode="wait">
          {choice ?
            <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('mt-5 rounded-2xl p-3.5 text-sm font-semibold flex items-center gap-2', choice === 'accepted' ? 'bg-sage-light text-emerald-700' : 'bg-cream text-charcoal-light')}>
              {choice === 'accepted' ?
                    <>
                  <CheckIcon size={16}/> Added to today’s plan. Nice one.
                </> :
                    <>
                  <RefreshCwIcon size={16}/> Skipped — we’ll factor this into tomorrow’s plan.
                </>}
            </motion.div> :
            <motion.div key="controls" className="mt-5 flex flex-wrap gap-2">
              <Button className="flex-1 min-w-[130px]" onClick={() => {
                    setChoice('accepted');
                    onPrimary?.();
                }}>
                <CheckIcon size={15}/> {primaryLabel}
              </Button>
              <Button variant="outline" onClick={onChange}>
                <RefreshCwIcon size={15}/> Change
              </Button>
              <Button variant="ghost" onClick={() => {
                    setChoice('skipped');
                    onSkip?.();
                }}>
                <XIcon size={15}/> Skip
              </Button>
            </motion.div>}
        </AnimatePresence>

        <p className="text-[11px] text-charcoal-muted mt-3">
          You’re always in control — changing or skipping simply teaches the system what fits you better.
        </p>
      </div>
    </div>);
}
