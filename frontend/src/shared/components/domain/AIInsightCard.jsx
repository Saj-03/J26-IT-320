import React from 'react';
import { SparklesIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
export function AIInsightCard({ title = 'AI Insight', children, tone = 'brand', className }) {
    return (<div className={cn('rounded-3xl p-5 border', tone === 'brand' ? 'bg-brand-50 border-brand-100' : 'bg-sage-light border-emerald-100', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('w-7 h-7 rounded-xl flex items-center justify-center', tone === 'brand' ? 'bg-brand-500 text-white' : 'bg-sage text-white')}>
          <SparklesIcon size={15}/>
        </span>
        <span className={cn('text-sm font-bold', tone === 'brand' ? 'text-brand-700' : 'text-emerald-700')}>{title}</span>
      </div>
      <p className="text-sm leading-relaxed text-charcoal-light">{children}</p>
    </div>);
}
