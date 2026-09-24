import React from 'react';
import { ShieldCheckIcon, EyeIcon, SlidersHorizontalIcon, DownloadIcon, Trash2Icon, HeartHandshakeIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ToggleRow } from '../../../shared/components/ui/SettingsRow';
import { PhysicalNav } from '../components/PhysicalNav';
import { SectionTitle } from '../components/Shared';
const collected = [
    { emoji: '🚶', label: 'Activity & steps', desc: 'To measure daily movement' },
    { emoji: '🏃', label: 'Workout completion', desc: 'To adjust difficulty and length' },
    { emoji: '🥗', label: 'Meal choices', desc: 'To improve meal suggestions' },
    { emoji: '✨', label: 'Habit completion', desc: 'To track streaks and consistency' },
    { emoji: '💬', label: 'Workout feedback', desc: 'To match intensity to how you feel' },
    { emoji: '🏫', label: 'Lifestyle answers', desc: 'To fit your plan around lectures and work' }
];
export function PhysicalPrivacy() {
    return (<div className="space-y-6">
      <PageHeader title="Your Data, Your Control" subtitle="Your lifestyle and activity information is used to personalise your recommendations — nothing else."/>

      <PhysicalNav />

      {/* Promise */}
      <div className="bg-sage-light border border-emerald-100 rounded-3xl p-5 flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <ShieldCheckIcon size={20}/>
        </span>
        <div>
          <p className="font-bold text-emerald-800">You stay in control at every step</p>
          <p className="text-sm text-emerald-700/85 mt-0.5 leading-relaxed">
            You can view, export, or permanently delete everything the system holds about you — at any time, without
            losing access to your account.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* What's collected */}
        <Card padding="lg">
          <SectionTitle title="What we collect" subtitle="And exactly why each item is needed."/>
          <div className="space-y-2.5">
            {collected.map((c) => <div key={c.label} className="flex items-start gap-2.5 bg-cream rounded-2xl p-3.5">
                <span className="text-lg shrink-0">{c.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal leading-snug">{c.label}</p>
                  <p className="text-xs text-charcoal-muted mt-0.5 leading-snug">{c.desc}</p>
                </div>
              </div>)}
          </div>
        </Card>

        {/* Consent */}
        <Card padding="lg">
          <SectionTitle title="Manage Consent" subtitle="Switch off anything you’d rather not share."/>
          <div className="divide-y divide-black/[0.05]">
            <ToggleRow label="Personalised recommendations" desc="Use my data to adapt my plan" defaultOn/>
            <ToggleRow label="Activity tracking" desc="Record steps and active minutes" defaultOn/>
            <ToggleRow label="Nutrition preferences" desc="Remember my food choices" defaultOn/>
            <ToggleRow label="Contribute to research" desc="Share anonymised data with the study" defaultOn/>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Button variant="outline" fullWidth size="lg">
          <EyeIcon size={16}/> View My Data
        </Button>
        <Button variant="outline" fullWidth size="lg">
          <SlidersHorizontalIcon size={16}/> Manage Consent
        </Button>
        <Button variant="outline" fullWidth size="lg">
          <DownloadIcon size={16}/> Download My Data
        </Button>
        <Button variant="outline" fullWidth size="lg" className="text-brand-600 border-brand-200 hover:bg-brand-50">
          <Trash2Icon size={16}/> Delete My Data
        </Button>
      </div>

      {/* Safety */}
      <Card padding="lg" className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-cream flex items-center justify-center shrink-0 text-charcoal-light">
          <HeartHandshakeIcon size={19}/>
        </span>
        <div>
          <p className="font-bold text-charcoal">A note on safety</p>
          <p className="text-sm text-charcoal-muted mt-1 leading-relaxed">
            This system provides wellbeing recommendations and does not provide medical diagnosis or replace
            professional healthcare advice. If something hurts or feels wrong, stop and speak with a qualified
            healthcare professional.
          </p>
        </div>
      </Card>
    </div>);
}
