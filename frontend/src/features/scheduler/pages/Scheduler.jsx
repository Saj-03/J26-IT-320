import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SparklesIcon, CheckCircle2Icon, ArrowRightIcon, CheckIcon, ClockIcon, SkipForwardIcon, BrainIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { LoadBadge, SectionTitle } from '../components/PlanPrimitives';
import PlannedTasks from '../components/PlannedTasks';
import { categoryStyles } from '../../../shared/lib/data';
import { focusStudent, stressStyles, weekDays, weekSchedule, calendarDays as days, calendarHours as hours, calendarBlocks as blocks, calendarLegend as legend } from '../data';
import { cn } from '../../../shared/lib/cn';
// [ITEM 8] Calendar data now comes from data.js (same source as every other page)
export function Scheduler() {
    const navigate = useNavigate();
    const [view, setView] = useState('Week');
    const [optimised, setOptimised] = useState(false);
    const [sessions, setSessions] = useState(weekSchedule);
    const [selected, setSelected] = useState(null);
    const stress = stressStyles[focusStudent.stress];
    const totalSessions = sessions.filter((b) => b.load !== 'Break').length;
    const doneSessions = sessions.filter((b) => b.status === 'done' && b.load !== 'Break').length;
    const update = (id, status) => {
        setSessions((bs) => bs.map((b) => b.id === id ? { ...b, status } : b));
        setSelected(null);
    };
    return (<div className="space-y-6">
      <PageHeader title="Smart Schedule" subtitle={`This week: ${totalSessions} study sessions · ${doneSessions} completed. Your schedule adapts to your focus and stress.`} action={<div className="flex items-center gap-2">
            <div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft">
              {['Day', 'Week', 'Month'].map((v) => <button key={v} onClick={() => setView(v)} className={cn('px-4 py-1.5 rounded-full text-sm font-semibold transition-colors', view === v ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
                  {v}
                </button>)}
            </div>
            <Button onClick={() => setOptimised(true)}>
              <SparklesIcon size={16}/> AI Optimize
            </Button>
          </div>}/>

      {/* [ITEM 2] Stress banner — uses suggestion wording (the user decides) */}
      <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate('/app/schedule/adjusted')} className={cn('w-full text-left rounded-3xl border p-5 flex items-center gap-4 transition-colors hover:brightness-[0.98]', stress.bg, stress.border)}>
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', stress.dot)}/>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', stress.text)}>Stress Level: {focusStudent.stress}</p>
          <p className="text-base font-semibold text-charcoal mt-0.5 leading-snug">{focusStudent.stressMessage}</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-charcoal shrink-0">
          See suggestions <ArrowRightIcon size={15}/>
        </span>
      </motion.button>

      {/* Week progress */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-charcoal">Week progress</p>
          <span className="text-sm font-extrabold text-brand-600">
            {doneSessions} / {totalSessions}
          </span>
        </div>
        <ProgressBar value={doneSessions / totalSessions * 100} height={10}/>
        {optimised &&
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-semibold text-emerald-600 mt-2.5">
            ✓ Rebalanced around your peak focus windows.
          </motion.p>}
      </Card>

      {/* Live plan from the scheduler API */}
      <PlannedTasks />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {legend.map((l) => <span key={l.cat} className="inline-flex items-center gap-2 text-xs font-semibold text-charcoal-muted">
            <span className={cn('w-3 h-3 rounded-md', categoryStyles[l.cat].dot)}/>
            {l.label}
          </span>)}
        {/* [ITEM 9] Explain what the dots mean in words */}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-muted">
          <span className="flex gap-0.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((k) => <span key={k} className={cn('w-1 h-1 rounded-full', k < 4 ? 'bg-charcoal-muted' : 'bg-black/10')}/>)}
          </span>
          Dots = priority (e.g. P4/5)
        </span>
      </div>

      <Card padding="sm">
        <div className="overflow-x-auto no-scrollbar">
          <div className="min-w-[720px]">
            {/* header row */}
            <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div />
              {days.map((d, i) => <div key={d} className="text-center pb-2">
                  <p className={cn('text-sm font-bold', i === 2 ? 'text-brand-600' : 'text-charcoal')}>{d}</p>
                  {i === 2 && <span className="text-[10px] font-semibold text-brand-500">Today</span>}
                </div>)}
            </div>

            {/* grid */}
            <div className="relative grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              {hours.map((h) => <React.Fragment key={h}>
                  <div className="text-[11px] font-medium text-charcoal-muted pr-2 text-right h-16 pt-1">{h}</div>
                  {days.map((_, di) => <div key={di} className="border-t border-l border-black/[0.05] h-16 relative first:border-l-0"/>)}
                </React.Fragment>)}

              {blocks.map((b, i) => {
            const cat = categoryStyles[b.category];
            const colW = `calc((100% - 56px) / 7)`;
            return (<motion.div key={i} title={`${b.title} · ${b.duration} · Priority ${b.focus}/5`} initial={optimised ? { scale: 0.9, opacity: 0.6 } : false} animate={{ scale: 1, opacity: 1 }} className={cn('absolute rounded-xl border p-1.5 overflow-hidden', cat.bg, cat.ring)} style={{
                    left: `calc(56px + ${b.day} * ${colW})`,
                    top: `${b.start * 64}px`,
                    width: `calc(${colW} - 6px)`,
                    height: `${b.span * 64 - 6}px`,
                    marginLeft: '3px'
                }}>
                    <p className={cn('text-[11px] font-bold leading-tight truncate', cat.text)}>{b.title}</p>
                    <p className="text-[9px] text-charcoal-muted font-medium">{b.duration}</p>
                    {/* [ITEM 9] Priority is not shown by colour only: tooltip (title) + visible text "P4/5" + screen-reader label */}
                    <div className="flex items-center gap-0.5 mt-1" title={`Priority ${b.focus}/5`} role="img" aria-label={`Priority ${b.focus} out of 5`}>
                      {Array.from({ length: 5 }).map((_, k) => <span key={k} aria-hidden className={cn('w-1 h-1 rounded-full', k < b.focus ? cat.dot : 'bg-black/10')}/>)}
                      <span aria-hidden className="ml-1 text-[9px] font-bold text-charcoal-muted leading-none">P{b.focus}/5</span>
                    </div>
                  </motion.div>);
        })}
            </div>
          </div>
        </div>
      </Card>

      {/* Adaptive study sessions — tap to complete, reschedule or skip */}
      <div>
        <SectionTitle title="Study sessions" subtitle="Tap any block to mark it complete, reschedule or skip." action={<Button variant="outline" size="sm" onClick={() => navigate('/app/schedule/attention')}>
              <BrainIcon size={15}/> Best study times
            </Button>}/>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {weekDays.map((day) => {
            const dayBlocks = sessions.filter((b) => b.day === day);
            if (dayBlocks.length === 0)
                return null;
            return (<Card key={day} padding="lg" className="h-full">
                <h3 className="font-bold text-charcoal mb-3">{day}</h3>
                <div className="space-y-2">
                  {dayBlocks.map((b) => <button key={b.id} onClick={() => setSelected(b)} className={cn('w-full text-left rounded-2xl bg-cream p-3 hover:bg-black/[0.04] transition-colors', b.status === 'done' && 'opacity-55')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-charcoal-muted tabular-nums">
                          {b.start} – {b.end}
                        </span>
                        <LoadBadge load={b.load}/>
                      </div>
                      <p className={cn('text-sm font-bold text-charcoal mt-1', b.status === 'done' && 'line-through')}>
                        {b.title}
                      </p>
                      {b.status === 'missed' &&
                        <span className="text-[11px] font-bold text-brand-600">Missed · tap to reschedule</span>}
                    </button>)}
                </div>
              </Card>);
        })}
        </div>
      </div>

      {/* Session action sheet */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected &&
            <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LoadBadge load={selected.load}/>
              <span className="text-sm font-semibold text-charcoal-muted">
                {selected.day} · {selected.start} – {selected.end}
              </span>
            </div>

            <div className="space-y-2">
              <Button fullWidth size="lg" onClick={() => update(selected.id, 'done')}>
                <CheckIcon size={17}/> Mark Complete
              </Button>
              <Button fullWidth size="lg" variant="outline" onClick={() => {
                    setSelected(null);
                    navigate('/app/schedule/missed');
                }}>
                <ClockIcon size={16}/> Reschedule
              </Button>
              <Button fullWidth size="lg" variant="ghost" onClick={() => update(selected.id, 'missed')}>
                <SkipForwardIcon size={16}/> Skip Session
              </Button>
            </div>

            <p className="text-xs text-charcoal-muted text-center">
              Skipping is fine. We’ll find another slot before your deadline.
            </p>
          </div>}
      </Modal>

      {/* Floating AI assistant card */}
      <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0 z-30 w-[calc(100%-2rem)] max-w-sm">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl shadow-lift border border-black/[0.05] p-4 flex items-center gap-3">
          <span className={cn('w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0', optimised ? 'bg-sage' : 'bg-brand-500')}>
            {optimised ? <CheckCircle2Icon size={20}/> : <SparklesIcon size={18}/>}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-charcoal">{optimised ? 'Your schedule is optimised.' : 'Ready to optimise your week?'}</p>
            <p className="text-xs text-charcoal-muted truncate">
              {optimised ? 'Balanced around focus & recovery.' : 'Rebalance around focus and wellbeing.'}
            </p>
          </div>
          {!optimised &&
            <Button size="sm" onClick={() => setOptimised(true)}>
              Optimise
            </Button>}
        </motion.div>
      </div>
    </div>);
}
