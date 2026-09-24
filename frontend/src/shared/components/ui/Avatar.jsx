import React from 'react';
import { cn } from '../../lib/cn';
export function Avatar({ src, name = 'A', size = 40, className, ring = false }) {
    const initials = name.
        split(' ').
        map((n) => n[0]).
        slice(0, 2).
        join('').
        toUpperCase();
    return (<div className={cn('relative rounded-full overflow-hidden bg-brand-100 flex items-center justify-center shrink-0', ring && 'ring-2 ring-white shadow-soft', className)} style={{ width: size, height: size }}>
      {src ?
            <img src={src} alt={name} className="w-full h-full object-cover"/> :
            <span className="font-semibold text-brand-700" style={{ fontSize: size * 0.38 }}>
          {initials}
        </span>}
    </div>);
}
