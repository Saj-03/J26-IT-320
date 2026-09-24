import React from 'react';
import { cn } from '../../lib/cn';
export function Logo({ size = 36, showText = true, className, textClass }) {
    return (<div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex items-center justify-center rounded-2xl bg-brand-500 shadow-glow shrink-0" style={{ width: size, height: size }}>
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
          <path d="M4 15.5C7 10 10 18 12 12C14 6 17 14 20 8.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="20" cy="8.5" r="2" fill="white"/>
        </svg>
      </div>
      {showText &&
            <div className="leading-none">
          <span className={cn('font-extrabold tracking-tight text-charcoal', textClass)}>IHSD</span>
        </div>}
    </div>);
}
