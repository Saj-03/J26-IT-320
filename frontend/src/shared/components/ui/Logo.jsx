import React from 'react';
import { cn } from '../../lib/cn';
export function Logo({ size = 36, showText = true, className, textClass }) {
    return (<div className={cn('flex items-center gap-2.5', className)}>
      <img src="/img/logo/logo-mark.png" alt="" className="shrink-0 object-contain" style={{ width: size, height: size }}/>
      {showText &&
            <div className="leading-none">
          <span className={cn('font-extrabold tracking-tight text-charcoal', textClass)}><span className="text-charcoal">Thrive</span><span className="bg-gradient-to-br from-brand-500 to-[#4CC764] bg-clip-text text-transparent">U</span></span>
        </div>}
    </div>);
}
