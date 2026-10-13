import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarIcon, FlagIcon, ClockIcon, CheckIcon, CalendarDaysIcon, PlayIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { ProgressBar } from '../../../../shared/components/ui/ProgressBar';
import { LoadPicker, EstimatedTime, SectionTitle } from '../../components/PlanPrimitives';
import { mainTask, subtasks } from '../../data';
import { cn } from '../../../../shared/lib/cn';
export function TaskDetails() {
    const navigate = useNavigate();
    // [ITEM 4] Steps are kept in state so the user can change each step's load level
    const [steps, setSteps] = useState(subtasks);
    const changeLoad = (id, load) => setSteps((xs) => xs.map((x) => x.id === id ? { ...x, load } : x));
    return (<div className="space-y-6">
      <PageHeader title={mainTask.title} subtitle={mainTask.description} action={<div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/app/schedule')}>
              <CalendarDaysIcon size={16}/> View Schedule
            </Button>
            <Button onClick={() => navigate('/app/focus/setup')}>
              <PlayIcon size={15} fill="currentColor"/> Start
            </Button>
          </div>}/>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Overview */}
        <Card padding="lg" className="lg:col-span-1">
          <div className="space-y-3">
            {[
            { icon: CalendarIcon, l: 'Deadline', v: 'Friday' },
            { icon: FlagIcon, l: 'Priority', v: mainTask.priority },
            { icon: ClockIcon, l: 'Remaining', v: mainTask.remaining }
        ].
            map((r) => <div key={r.l} className="flex items-center justify-between">
                <span className="text-sm font-medium text-charcoal-muted flex items-center gap-2">
                  <r.icon size={14}/>
                  {r.l}
                </span>
                <span className="text-sm font-bold text-charcoal">{r.v}</span>
              </div>)}
          </div>

          <div className="mt-5 pt-5 border-t border-black/[0.05]">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-charcoal-muted">Progress</span>
              <span className="font-extrabold text-charcoal">{mainTask.progress}%</span>
            </div>
            <ProgressBar value={mainTask.progress} height={10}/>
          </div>
        </Card>

        {/* Subtasks */}
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle title="Steps" subtitle="Three done, four to go. You’re past halfway."/>
          <div className="space-y-2">
            {steps.map((s, i) => <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={cn('flex items-center gap-3 rounded-2xl p-3.5', s.status === 'active' ? 'bg-brand-50 border border-brand-100' : 'bg-cream')}>
                <span className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', s.status === 'done' && 'bg-sage text-white', s.status === 'active' && 'bg-brand-500 text-white', s.status === 'todo' && 'bg-white border border-black/[0.08]')}>
                  {s.status === 'done' && <CheckIcon size={14} strokeWidth={3}/>}
                  {s.status === 'active' && <span className="w-2 h-2 rounded-full bg-white"/>}
                </span>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-bold leading-snug', s.status === 'done' ? 'text-charcoal-muted line-through' : 'text-charcoal')}>
                    {s.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.status === 'active' && <span className="text-xs font-semibold text-brand-600">In Progress</span>}
                    {/* [ITEM 4] Estimated time for this step */}
                    <EstimatedTime minutes={s.minutes}/>
                  </div>
                </div>

                {/* [ITEM 4] Clickable load tag (small dropdown) */}
                <LoadPicker load={s.load} label={s.title} onChange={(l) => changeLoad(s.id, l)}/>
              </motion.div>)}
          </div>

          <div className="mt-5 rounded-2xl bg-cream px-4 py-3.5 flex items-center justify-between">
            <span className="text-sm font-medium text-charcoal-muted">Estimated Remaining Time</span>
            <span className="text-base font-extrabold text-charcoal">{mainTask.remaining}</span>
          </div>
        </Card>
      </div>
    </div>);
}
