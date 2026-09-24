import React, { useState } from "react";
import { CalendarIcon, TimerIcon, HeartIcon, TrophyIcon } from "lucide-react";
import { PageHeader } from "../shared/components/layout/PageHeader";
import { Card } from "../shared/components/ui/Card";
import { notifications } from "../shared/lib/data";
import { cn } from "../shared/lib/cn";
const cats = ['All', 'Schedule', 'Focus', 'Wellbeing', 'Achievements'];
const iconMap = {
    calendar: {
        icon: CalendarIcon,
        bg: 'bg-brand-50',
        color: 'text-brand-500'
    },
    timer: {
        icon: TimerIcon,
        bg: 'bg-sky-50',
        color: 'text-sky-500'
    },
    heart: {
        icon: HeartIcon,
        bg: 'bg-sage-light',
        color: 'text-emerald-600'
    },
    trophy: {
        icon: TrophyIcon,
        bg: 'bg-amber-light',
        color: 'text-amber-600'
    }
};
export function Notifications() {
    const [cat, setCat] = useState('All');
    const list = cat === 'All' ? notifications : notifications.filter((n) => n.category === cat);
    return <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Notifications" subtitle="Gentle updates from IHSD — nothing noisy."/>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={cn('shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors', cat === c ? 'bg-charcoal text-white' : 'bg-white text-charcoal-light border border-black/[0.05]')}>
            {c}
          </button>)}
      </div>

      <div className="space-y-3">
        {list.map((n) => {
            const meta = iconMap[n.icon] ?? iconMap.calendar;
            const Icon = meta.icon;
            return <Card key={n.id} padding="sm" className={cn('flex items-start gap-3', n.unread && 'ring-1 ring-brand-100')}>
              <span className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', meta.bg)}>
                <Icon size={18} className={meta.color}/>
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-charcoal text-sm">{n.title}</p>
                  {n.unread && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0"/>}
                </div>
                <p className="text-sm text-charcoal-muted mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-xs text-charcoal-muted mt-1.5 font-medium">{n.category} · {n.time}</p>
              </div>
            </Card>;
        })}
      </div>
    </div>;
}
