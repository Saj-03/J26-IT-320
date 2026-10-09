import React from 'react';
import { cn } from '../../lib/cn';
export function ProgressBar({ value, color = 'bg-brand-500', track = 'bg-black/[0.06]', className, height = 8 }) {
    const clamped = Math.max(0, Math.min(100, value));
    return (<div className={cn('w-full rounded-full overflow-hidden', track, className)} style={{ height }}>
      <div className={cn('h-full rounded-full', color)} style={{ width: `${clamped}%`, transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)' }}/>
    </div>);
}
