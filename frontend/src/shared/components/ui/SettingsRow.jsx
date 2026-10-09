import React, { useState } from 'react';
import { cn } from '../../lib/cn';
export function ToggleRow({ label, desc, defaultOn = false }) {
    const [on, setOn] = useState(defaultOn);
    return (<div className="flex items-center justify-between py-3.5">
      <div className="pr-4">
        <p className="text-sm font-semibold text-charcoal">{label}</p>
        {desc && <p className="text-xs text-charcoal-muted mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => setOn((o) => !o)} className={cn('w-12 h-7 rounded-full transition-colors relative shrink-0', on ? 'bg-brand-500' : 'bg-black/15')} aria-pressed={on} aria-label={label}>
        <span className={cn('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-6' : 'left-1')}/>
      </button>
    </div>);
}
