import React from 'react';
import { cn } from '../../../shared/lib/cn';
export function SectionTitle({ title, subtitle, action, className }) {
    return (<div className={cn('flex items-end justify-between gap-3 mb-3', className)}>
      <div>
        <h2 className="text-lg font-bold text-charcoal tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-charcoal-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>);
}
/** Small pill used to mark something the AI changed for the student. */
export function AdaptedChip({ children = 'Adapted by AI' }) {
    return (<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-500"/>
      {children}
    </span>);
}
/** Non-medical disclaimer, reused across assessment + profile + privacy. */
export function MedicalDisclaimer({ className }) {
    return (<p className={cn('text-xs text-charcoal-muted leading-relaxed bg-cream rounded-2xl p-3.5', className)}>
      This system provides wellbeing recommendations and does not provide medical diagnosis or replace professional
      healthcare advice.
    </p>);
}
export function SelectCard({ selected, onClick, emoji, label, desc, className }) {
    return (<button type="button" onClick={onClick} aria-pressed={selected} className={cn('text-left rounded-3xl p-4 border-2 transition-colors w-full', selected ? 'border-brand-500 bg-brand-50' : 'border-black/[0.06] bg-white hover:border-brand-200', className)}>
      <div className="flex items-start gap-3">
        {emoji && <span className="text-2xl leading-none shrink-0">{emoji}</span>}
        <div className="min-w-0">
          <p className="font-bold text-charcoal text-sm leading-snug">{label}</p>
          {desc && <p className="text-xs text-charcoal-muted mt-0.5 leading-snug">{desc}</p>}
        </div>
      </div>
    </button>);
}
export function ChoiceChip({ selected, onClick, children }) {
    return (<button type="button" onClick={onClick} aria-pressed={selected} className={cn('rounded-full px-4 py-2 text-sm font-semibold border transition-colors', selected ?
            'border-transparent bg-brand-500 text-white' :
            'border-black/[0.05] bg-white text-charcoal-light hover:border-brand-200')}>
      {children}
    </button>);
}
