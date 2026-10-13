import React from 'react';
import { PlayIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { categoryStyles, priorityStyles } from '../../../shared/lib/data';
// [ITEM 8] Today's plan comes from the scheduler data.js (same as the Scheduler and Focus pages)
import { todaySessions } from '../data';
import { formatMinutes } from './PlanPrimitives';
const todaySchedule = todaySessions.map((s) => ({ ...s, time: s.start, duration: formatMinutes(s.minutes) }));
import { cn } from '../../../shared/lib/cn';
export function ScheduleTimeline() {
    const navigate = useNavigate();
    return (<div className="space-y-1">
      {todaySchedule.map((block, i) => {
            const cat = categoryStyles[block.category];
            const isAcademic = block.category === 'academic';
            return (<div key={i} className="flex gap-4">
            {/* time + line */}
            <div className="flex flex-col items-center w-16 shrink-0">
              <span className="text-xs font-bold text-charcoal-muted pt-1">{block.time}</span>
              <div className="relative flex-1 flex justify-center pt-2">
                <span className={cn('w-3 h-3 rounded-full ring-4 ring-white', cat.dot)}/>
                {i < todaySchedule.length - 1 && <span className="absolute top-5 w-0.5 flex-1 h-full bg-black/[0.06]"/>}
              </div>
            </div>
            {/* card */}
            <div className={cn('flex-1 mb-3 rounded-2xl border p-4 flex items-center justify-between gap-3', cat.bg, cat.ring)}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-charcoal text-sm">{block.title}</h4>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', priorityStyles[block.priority].bg, priorityStyles[block.priority].text)}>
                    {priorityStyles[block.priority].label}
                  </span>
                </div>
                <p className="text-xs text-charcoal-muted mt-0.5">
                  {block.subtitle} · {block.duration}
                </p>
              </div>
              {isAcademic &&
                    <button onClick={() => navigate('/app/focus')} className="shrink-0 w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors shadow-glow" aria-label={`Start ${block.title}`}>
                  <PlayIcon size={14} fill="currentColor"/>
                </button>}
            </div>
          </div>);
        })}
    </div>);
}
