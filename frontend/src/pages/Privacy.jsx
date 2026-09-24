import React from 'react';
import { ShieldCheckIcon, DownloadIcon, VideoOffIcon, Trash2Icon, DatabaseIcon, PenLineIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { Button } from '../shared/components/ui/Button';
import { ToggleRow } from '../shared/components/ui/SettingsRow';
export function Privacy() {
    return (<div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Your Data, Your Control" subtitle="Full transparency over what IHSD collects — and complete control to change it."/>

      {/* Key promise */}
      <div className="bg-sage-light border border-emerald-100 rounded-3xl p-5 flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <ShieldCheckIcon size={20}/>
        </span>
        <div>
          <p className="font-bold text-emerald-800">Webcam images and videos are never stored.</p>
          <p className="text-sm text-emerald-700/80 mt-0.5">
            Focus detection happens on your device. Only anonymised numerical signals are ever saved.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <DatabaseIcon size={17} className="text-charcoal-muted"/>
            <h3 className="font-bold text-charcoal">Data collected automatically</h3>
          </div>
          <ul className="space-y-2">
            {['Task timestamps', 'Completion times', 'Focus scores', 'App usage', 'Schedule changes'].map((d) => <li key={d} className="text-sm text-charcoal-light flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-300"/> {d}
              </li>)}
          </ul>
        </Card>

        <Card padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <PenLineIcon size={17} className="text-charcoal-muted"/>
            <h3 className="font-bold text-charcoal">Data you provide</h3>
          </div>
          <ul className="space-y-2">
            {['Mood check-ins', 'Weekly life balance', 'Task difficulty ratings'].map((d) => <li key={d} className="text-sm text-charcoal-light flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sage"/> {d}
              </li>)}
          </ul>
        </Card>
      </div>

      <Card padding="lg">
        <h3 className="font-bold text-charcoal mb-2">Data collection preferences</h3>
        <div className="divide-y divide-black/[0.05]">
          <ToggleRow label="Focus score collection" desc="Store anonymised focus signals for your insights" defaultOn/>
          <ToggleRow label="Wellbeing check-ins" desc="Use mood & balance data to adapt your schedule" defaultOn/>
          <ToggleRow label="Research contribution" desc="Share anonymised data with the study" defaultOn/>
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-3">
        <Button variant="outline" fullWidth>
          <DownloadIcon size={16}/> Export data
        </Button>
        <Button variant="outline" fullWidth>
          <VideoOffIcon size={16}/> Disable monitoring
        </Button>
        <Button variant="outline" fullWidth className="text-brand-600 border-brand-200 hover:bg-brand-50">
          <Trash2Icon size={16}/> Delete data
        </Button>
      </div>
    </div>);
}
