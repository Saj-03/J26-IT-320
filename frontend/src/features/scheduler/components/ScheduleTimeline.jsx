// Today's planned study sessions (Overview page), from the API via useToday.
import React from 'react';
import { PlayIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { categoryStyles, priorityStyles } from '../../../shared/lib/data';
import { formatMinutes } from './PlanPrimitives';
import { LOAD_LABEL, priorityWord, timeText } from '../lib';
import { cn } from '../../../shared/lib/cn';

export function ScheduleTimeline({ tasks }) {
    const navigate = useNavigate();
    if (!tasks.length)
        return <p className="text-sm text-charcoal-muted py-4">Nothing planned for today. Plan a task from your schedule.</p>;

    const cat = categoryStyles.academic;
    return (<div className="space-y-1">
      {tasks.map((t, i) => {
            const pri = priorityStyles[priorityWord(t.priority)];
            return (<div key={t.id} className="flex gap-4">
            <div className="flex flex-col items-center w-16 shrink-0">
              <span className="text-xs font-bold text-charcoal-muted pt-1">{timeText(t.scheduled_start)}</span>
              <div className="relative flex-1 flex justify-center pt-2">
                <span className={cn('w-3 h-3 rounded-full ring-4 ring-white', cat.dot)}/>
                {i < tasks.length - 1 && <span className="absolute top-5 w-0.5 flex-1 h-full bg-black/[0.06]"/>}
              </div>
            </div>
            <div className={cn('flex-1 mb-3 rounded-2xl border p-4 flex items-center justify-between gap-3', cat.bg, cat.ring)}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-charcoal text-sm">{t.title}</h4>
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', pri.bg, pri.text)}>{pri.label}</span>
                </div>
                <p className="text-xs text-charcoal-muted mt-0.5">
                  {LOAD_LABEL[t.cognitive_load]} effort · {formatMinutes(t.estimated_minutes)}
                </p>
              </div>
              <button onClick={() => navigate('/app/focus/setup', { state: { taskId: t.id } })} className="shrink-0 w-11 h-11 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors shadow-glow" aria-label={`Start ${t.title}`}>
                <PlayIcon size={14} fill="currentColor"/>
              </button>
            </div>
          </div>);
        })}
    </div>);
}
