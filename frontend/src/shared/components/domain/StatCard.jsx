import React from "react";
import { cn } from "../../lib/cn";
import { Card } from "../ui/Card";
export function StatCard({ icon: Icon, iconBg = 'bg-brand-50', iconColor = 'text-brand-500', label, value, sub, children }) {
    return <Card padding="sm" hover className="flex flex-col">
      <div className="flex items-center justify-between">
        <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon size={17} className={iconColor}/>
        </span>
        {children}
      </div>
      <p className="text-xs font-medium text-charcoal-muted mt-3">{label}</p>
      <p className="text-2xl font-extrabold text-charcoal mt-0.5 tracking-tight">{value}</p>
      {sub && <div className="mt-1.5">{sub}</div>}
    </Card>;
}
