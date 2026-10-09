import React from "react";
import { InboxIcon } from "lucide-react";
import { Button } from "./Button";
export function LoadingState({ label = 'Loading…' }) {
    return <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-[3px] border-brand-100"/>
        <div className="absolute inset-0 rounded-full border-[3px] border-brand-500 border-t-transparent animate-spin"/>
      </div>
      <p className="text-sm text-charcoal-muted font-medium">{label}</p>
    </div>;
}
export function EmptyState({ icon: Icon = InboxIcon, title, desc, actionLabel, onAction }) {
    return <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center mb-4">
        <Icon className="text-brand-400" size={26}/>
      </div>
      <h3 className="font-bold text-charcoal">{title}</h3>
      {desc && <p className="text-sm text-charcoal-muted mt-1 max-w-xs">{desc}</p>}
      {actionLabel && <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>}
    </div>;
}
export function ErrorState({ onRetry }) {
    return <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-amber-light flex items-center justify-center mb-4 text-2xl">😕</div>
      <h3 className="font-bold text-charcoal">Something didn’t load</h3>
      <p className="text-sm text-charcoal-muted mt-1 max-w-xs">We couldn’t reach your data just now. Let’s try that again.</p>
      {onRetry && <Button className="mt-5" variant="soft" onClick={onRetry}>
          Try again
        </Button>}
    </div>;
}
