import React from 'react';
import { motion } from 'framer-motion';
import { RotateCwIcon, ChevronRightIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { adaptiveLoopSteps } from '../data';
import { cn } from '../../../shared/lib/cn';
/**
 * Visualises the research contribution:
 * Student Data → Behaviour Analysis → Personalised Recommendation → Student Action → Feedback → AI Adaptation → (repeat)
 */
export function AdaptiveLoop({ activeKey, className }) {
    return (<Card padding="lg" className={className}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-2xl bg-brand-500 text-white flex items-center justify-center">
          <RotateCwIcon size={16}/>
        </span>
        <h3 className="font-bold text-charcoal">How your plan keeps adapting</h3>
      </div>
      <p className="text-sm text-charcoal-muted mb-5 ml-10">
        This loop runs continuously — every action you take reshapes what comes next.
      </p>

      <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
        <div className="flex items-stretch gap-2 min-w-[680px]">
          {adaptiveLoopSteps.map((s, i) => {
            const active = s.key === activeKey;
            return (<React.Fragment key={s.key}>
                <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className={cn('flex-1 rounded-2xl p-3.5 border transition-colors text-center', active ? 'border-brand-200 bg-brand-50' : 'border-black/[0.05] bg-cream')}>
                  <div className="text-2xl">{s.emoji}</div>
                  <p className={cn('text-xs font-bold mt-1.5 leading-tight', active ? 'text-brand-700' : 'text-charcoal')}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-charcoal-muted mt-1 leading-tight">{s.desc}</p>
                  {active &&
                    <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-wide text-white bg-brand-500 rounded-full px-2 py-0.5">
                      You are here
                    </span>}
                </motion.div>
                {i < adaptiveLoopSteps.length - 1 &&
                    <div className="flex items-center shrink-0 text-charcoal-muted">
                    <ChevronRightIcon size={16}/>
                  </div>}
              </React.Fragment>);
        })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 bg-cream rounded-2xl px-4 py-3">
        <RotateCwIcon size={14} className="text-brand-500 shrink-0"/>
        <p className="text-xs font-semibold text-charcoal-light">
          The system understands your lifestyle and changes with you — no two weeks look the same.
        </p>
      </div>
    </Card>);
}
