import React from 'react';
import { cn } from '../../lib/cn';
const paddingMap = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8'
};
export function Card({ className, padding = 'md', hover = false, children, ...props }) {
    return (<div className={cn('bg-white rounded-3xl border border-black/[0.04] shadow-soft', paddingMap[padding], hover && 'transition-shadow duration-300 hover:shadow-card', className)} {...props}>
      {children}
    </div>);
}
