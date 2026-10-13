import React, { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ClockIcon } from 'lucide-react';
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

// [ITEM 4] Load levels the user can pick for a step
const pickableLoads = ['Heavy', 'Medium', 'Light'];
/**
 * [ITEM 4] Clickable Heavy / Medium / Light tag.
 * Click the tag -> a small dropdown opens -> pick a new level -> onChange(newLoad) is called.
 */
export function LoadPicker({ load, onChange, label = 'step' }) {
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);
    // Close the dropdown when the user clicks somewhere else
    useEffect(() => {
        if (!open)
            return;
        const close = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);
    return (<div ref={boxRef} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Change load for ${label} (now ${load})`} title="Click to change" className="inline-flex items-center gap-0.5 rounded-full hover:ring-2 hover:ring-brand-200 transition-shadow">
        <LoadBadge load={load}/>
        <ChevronDownIcon size={12} className="text-charcoal-muted -ml-0.5 mr-1"/>
      </button>
      {open &&
            <ul role="listbox" className="absolute z-20 left-0 mt-1.5 w-32 bg-white rounded-2xl shadow-lift border border-black/[0.06] p-1.5">
          {pickableLoads.map((l) => <li key={l}>
              <button type="button" role="option" aria-selected={l === load} onClick={() => { onChange(l); setOpen(false); }} className={cn('w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-left hover:bg-cream', l === load && 'bg-cream')}>
                <span className={cn('w-2 h-2 rounded-full', loadStyles[l].dot)}/>
                {l}
              </button>
            </li>)}
        </ul>}
    </div>);
}
/** [ITEM 4] Estimated time for a step, e.g. "45 min" or "1h 30 min" */
export function formatMinutes(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m)
        return `${h}h ${m} min`;
    if (h)
        return `${h}h`;
    return `${m} min`;
}
export function EstimatedTime({ minutes }) {
    return (<span className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal-muted" title="Estimated time">
      <ClockIcon size={12}/> {formatMinutes(minutes)}
    </span>);
}
