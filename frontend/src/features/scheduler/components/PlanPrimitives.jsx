import React from 'react';
import { loadStyles } from '../data';
import { cn } from '../../../shared/lib/cn';
/** Heavy / Medium / Light / Break badge used across Schedule, Tasks and Focus. */
export function LoadBadge({ load, className }) {
    const s = loadStyles[load];
    return (<span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0', s.bg, s.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)}/>
      {load}
    </span>);
}
export function SectionTitle({ title, subtitle, action }) {
    return (<div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-lg font-bold text-charcoal">{title}</h3>
        {subtitle && <p className="text-sm text-charcoal-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>);
}
/** A single scheduled study block. */
export function SessionRow({ start, end, title, load, status, onClick }) {
    const s = loadStyles[load];
    return (<button onClick={onClick} className={cn('w-full text-left flex items-center gap-4 rounded-3xl bg-white border border-black/[0.04] shadow-soft p-4 transition-shadow hover:shadow-card', status === 'done' && 'opacity-60')}>
      <span className={cn('w-1.5 self-stretch rounded-full shrink-0', s.dot)}/>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-charcoal-muted tabular-nums">
          {start} – {end}
        </p>
        <p className={cn('text-base font-bold text-charcoal mt-0.5 leading-snug', status === 'done' && 'line-through')}>
          {title}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <LoadBadge load={load}/>
        {status === 'missed' && <span className="text-[11px] font-bold text-brand-600">Missed</span>}
        {status === 'done' && <span className="text-[11px] font-bold text-emerald-600">Done ✓</span>}
      </div>
    </button>);
}
