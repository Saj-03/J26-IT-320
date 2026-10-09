import React from 'react';
import { cn } from '../../lib/cn';
export function Field({ label, hint, className, id, ...props }) {
    const fieldId = id || props.name;
    return (<div className="space-y-1.5">
      {label &&
            <label htmlFor={fieldId} className="text-sm font-semibold text-charcoal-light">
          {label}
        </label>}
      <input id={fieldId} className={cn('w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-charcoal-muted outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20', className)} {...props}/>
      {hint && <p className="text-xs text-charcoal-muted">{hint}</p>}
    </div>);
}
export function SelectField({ label, children, className, id, ...props }) {
    const fieldId = id || props.name;
    return (<div className="space-y-1.5">
      {label &&
            <label htmlFor={fieldId} className="text-sm font-semibold text-charcoal-light">
          {label}
        </label>}
      <select id={fieldId} className={cn('w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-charcoal outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20', className)} {...props}>
        {children}
      </select>
    </div>);
}
