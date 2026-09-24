import React from 'react';
import { cn } from '../../lib/cn';
const variantMap = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-glow active:scale-[0.98]',
    secondary: 'bg-charcoal text-white hover:bg-charcoal-light active:scale-[0.98]',
    ghost: 'text-charcoal-light hover:bg-black/[0.04]',
    outline: 'border border-black/10 text-charcoal hover:bg-black/[0.03]',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100'
};
const sizeMap = {
    sm: 'text-sm px-4 py-2 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-7 py-3.5 gap-2'
};
export function Button({ variant = 'primary', size = 'md', pill = true, fullWidth = false, className, children, ...props }) {
    return (<button className={cn('inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream', pill ? 'rounded-full' : 'rounded-2xl', variantMap[variant], sizeMap[size], fullWidth && 'w-full', className)} {...props}>
      {children}
    </button>);
}
