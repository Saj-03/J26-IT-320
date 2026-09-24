import React from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { ToggleRow } from '../../../shared/components/ui/SettingsRow';
import { PhysicalNav } from '../components/PhysicalNav';
import { SectionTitle } from '../components/Shared';
import { wellbeingNotifications } from '../data';
import { cn } from '../../../shared/lib/cn';
const toneStyles = {
    activity: 'bg-brand-50',
    exercise: 'bg-sky-50',
    reward: 'bg-amber-light',
    adapt: 'bg-sage-light'
};
export function PhysicalNotifications() {
    return (<div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Only what’s useful — we keep these deliberately few."/>

      <PhysicalNav />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {wellbeingNotifications.map((n, i) => <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card padding="sm" className={cn('flex items-start gap-3', n.unread && 'ring-1 ring-brand-100')}>
                <span className={cn('w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0', toneStyles[n.tone])}>
                  {n.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-charcoal text-sm">{n.title}</p>
                    {n.unread && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0"/>}
                  </div>
                  <p className="text-sm text-charcoal-muted mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-xs text-charcoal-muted mt-1.5 font-medium">{n.time}</p>
                </div>
              </Card>
            </motion.div>)}
        </div>

        <Card padding="lg">
          <SectionTitle title="What you hear about" subtitle="Turn off anything that doesn’t help."/>
          <div className="divide-y divide-black/[0.05]">
            <ToggleRow label="Movement nudges" desc="A gentle reminder after long sitting" defaultOn/>
            <ToggleRow label="Daily workout ready" desc="When your session is prepared" defaultOn/>
            <ToggleRow label="Progress & achievements" desc="Streaks, badges and milestones" defaultOn/>
            <ToggleRow label="Plan adaptations" desc="When the AI updates your plan" defaultOn/>
          </div>
        </Card>
      </div>
    </div>);
}
