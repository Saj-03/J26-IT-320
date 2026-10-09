import React from 'react';
import { ClockIcon, CalendarIcon, PlayIcon, CheckIcon, FlameIcon } from 'lucide-react';
import { categoryStyles, priorityStyles } from '../../../shared/lib/data';
import { Badge } from '../../../shared/components/ui/Badge';
import { cn } from '../../../shared/lib/cn';
function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m)
        return `${h}h ${m}m`;
    if (h)
        return `${h}h`;
    return `${m}m`;
}
export function TaskCard({ task, onStart }) {
    const cat = categoryStyles[task.category];
    const pri = priorityStyles[task.priority];
    const done = task.status === 'completed';
    const overdue = task.status === 'overdue';
    return (<div className={cn('group bg-white rounded-3xl border border-black/[0.04] shadow-soft p-5 transition-shadow hover:shadow-card', done && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', cat.bg)}>
          <span className={cn('w-2.5 h-2.5 rounded-full', cat.dot)}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('font-bold text-charcoal leading-snug', done && 'line-through')}>{task.title}</h3>
            {done ?
            <span className="w-6 h-6 rounded-full bg-sage/20 text-sage flex items-center justify-center shrink-0">
                <CheckIcon size={14} strokeWidth={3}/>
              </span> :
            <Badge className={cn(pri.bg, pri.text)}>{pri.label}</Badge>}
          </div>
          <p className="text-sm text-charcoal-muted mt-0.5">{task.subject}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-charcoal-muted">
            <span className={cn('inline-flex items-center gap-1', overdue && 'text-brand-600 font-semibold')}>
              <CalendarIcon size={13}/>
              {task.deadline}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon size={13}/>
              {formatDuration(task.durationMins)}
            </span>
            {task.scheduledTime && task.status !== 'completed' &&
            <span className="inline-flex items-center gap-1 text-brand-600 font-medium">
                <FlameIcon size={13}/>
                Scheduled {task.scheduledDay} {task.scheduledTime}
              </span>}
          </div>
        </div>
      </div>

      {!done &&
            <div className="flex items-center gap-2 mt-4 pl-14">
          <button onClick={() => onStart?.(task)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-full px-4 py-2 transition-colors">
            <PlayIcon size={13} fill="currentColor"/>
            {overdue ? 'Get back on track' : 'Start'}
          </button>
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', cat.bg, cat.text)}>{cat.label}</span>
        </div>}
    </div>);
}
