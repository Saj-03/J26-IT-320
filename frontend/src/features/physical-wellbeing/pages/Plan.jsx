import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, PlayIcon, ClockIcon, XIcon, PlusIcon, MinusIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { AdaptedChip } from '../components/Shared';
import { todayPlan } from '../data';
import { cn } from '../../../shared/lib/cn';
const periodMeta = {
    Morning: { emoji: '🌅', tint: 'bg-brand-50 text-brand-700' },
    Afternoon: { emoji: '☀️', tint: 'bg-amber-light text-amber-700' },
    Evening: { emoji: '🌆', tint: 'bg-sky-50 text-sky-600' },
    Night: { emoji: '🌙', tint: 'bg-violet-50 text-violet-600' }
};
export function PhysicalPlan() {
    const navigate = useNavigate();
    const [statuses, setStatuses] = useState(Object.fromEntries(todayPlan.map((t) => [t.id, t.status])));
    const [water, setWater] = useState(5);
    const setStatus = (id, s) => setStatuses((prev) => ({ ...prev, [id]: s }));
    const completed = Object.values(statuses).filter((s) => s === 'done').length;
    return (<div className="space-y-6">
      <PageHeader title="Today’s Plan" subtitle="Four gentle blocks built around your lectures and your evening energy."/>

      <PhysicalNav />

      {/* Day progress */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-charcoal">Day progress</p>
          <span className="text-sm font-extrabold text-brand-600">
            {completed} / {todayPlan.length}
          </span>
        </div>
        <ProgressBar value={completed / todayPlan.length * 100}/>
        <p className="text-xs text-charcoal-muted mt-2.5">
          Every action you mark here teaches the AI what realistically fits your day.
        </p>
      </Card>

      {/* Timeline */}
      <div className="grid lg:grid-cols-2 gap-x-6">
        <div className="lg:col-span-2 space-y-1">
          {todayPlan.map((task, i) => {
            const status = statuses[task.id];
            const meta = periodMeta[task.period];
            const isWater = task.id === 'p2';
            return (<motion.div key={task.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-4">
                {/* Rail */}
                <div className="flex flex-col items-center w-10 shrink-0 pt-1">
                  <span className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0 ring-4 ring-cream', status === 'done' ? 'bg-brand-500 text-white' : 'bg-white border border-black/[0.06]')}>
                    {status === 'done' ? <CheckIcon size={17} strokeWidth={3}/> : meta.emoji}
                  </span>
                  {i < todayPlan.length - 1 && <span className="w-0.5 flex-1 bg-black/[0.06] my-1"/>}
                </div>

                {/* Card */}
                <Card padding="sm" className="flex-1 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={cn('inline-block text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5', meta.tint)}>
                        {task.period}
                      </span>
                      <h3 className="font-bold text-charcoal mt-1.5 leading-snug">
                        {task.emoji} {task.title}
                      </h3>
                      <p className="text-xs text-charcoal-muted mt-0.5">{task.target}</p>
                    </div>
                    {status === 'done' &&
                    <span className="text-xs font-semibold text-emerald-700 bg-sage-light rounded-full px-2.5 py-1 shrink-0">
                        Completed ✓
                      </span>}
                    {status === 'skipped' &&
                    <span className="text-xs font-semibold text-charcoal-muted bg-cream rounded-full px-2.5 py-1 shrink-0">
                        Skipped
                      </span>}
                    {status === 'rescheduled' && <AdaptedChip>Rescheduled</AdaptedChip>}
                  </div>

                  {/* Water counter */}
                  {isWater &&
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-charcoal-muted">{water} / 8 glasses</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setWater((w) => Math.max(0, w - 1))} className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-charcoal-light hover:bg-black/[0.06] transition-colors" aria-label="Remove a glass">
                            <MinusIcon size={13}/>
                          </button>
                          <button onClick={() => setWater((w) => Math.min(8, w + 1))} className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors" aria-label="Add a glass">
                            <PlusIcon size={13}/>
                          </button>
                        </div>
                      </div>
                      <ProgressBar value={water / 8 * 100} color="bg-violet-400"/>
                    </div>}

                  {/* Start CTA */}
                  {task.id === 'p3' && status !== 'done' && status !== 'skipped' &&
                    <button onClick={() => navigate('/app/physical/workout')} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-500 text-white text-sm font-semibold py-2.5 hover:bg-brand-600 transition-colors shadow-glow">
                      <PlayIcon size={14} fill="currentColor"/> Start
                    </button>}

                  {/* Controls */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-black/[0.05]">
                    {[
                    { s: 'done', label: 'Done', icon: CheckIcon },
                    { s: 'skipped', label: 'Skip', icon: XIcon },
                    { s: 'rescheduled', label: 'Reschedule', icon: ClockIcon }
                ].
                    map((c) => <button key={c.s} onClick={() => setStatus(task.id, c.s)} className={cn('flex-1 inline-flex items-center justify-center gap-1 rounded-full py-2 text-xs font-semibold transition-colors', status === c.s ? 'bg-charcoal text-white' : 'text-charcoal-light hover:bg-black/[0.04]')}>
                        <c.icon size={13}/> {c.label}
                      </button>)}
                  </div>
                </Card>
              </motion.div>);
        })}
        </div>
      </div>

      <div className="rounded-3xl bg-brand-50 border border-brand-100 p-5 flex gap-3">
        <span className="text-lg shrink-0">🧠</span>
        <p className="text-sm text-charcoal-light leading-relaxed">
          The AI learns from what you complete, skip, and reschedule — tomorrow’s plan will reflect today’s choices.
        </p>
      </div>
    </div>);
}
