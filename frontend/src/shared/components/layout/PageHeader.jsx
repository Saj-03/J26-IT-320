import React from 'react';
export function PageHeader({ title, subtitle, action }) {
    return (<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-charcoal-muted mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>);
}
