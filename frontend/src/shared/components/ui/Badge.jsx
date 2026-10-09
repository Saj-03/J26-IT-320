import React from 'react';
import { cn } from '../../lib/cn';
export function Badge({ children, className, dot }) {
    return (<span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', 'bg-black/[0.04] text-charcoal-light', className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dot)}/>}
      {children}
    </span>);
}
