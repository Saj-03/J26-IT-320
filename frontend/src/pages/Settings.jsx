import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, CalendarIcon, EyeIcon, BellIcon, ShieldCheckIcon, LogOutIcon } from 'lucide-react';
import { useAuth } from '../shared/context/AuthContext';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { Field } from '../shared/components/ui/Field';
import { Button } from '../shared/components/ui/Button';
import { ToggleRow } from '../shared/components/ui/SettingsRow';
import useStudent from '../shared/hooks/useStudent';
function SectionCard({ icon: Icon, title, children }) {
    return (<Card padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center">
          <Icon size={17}/>
        </span>
        <h3 className="font-bold text-charcoal">{title}</h3>
      </div>
      {children}
    </Card>);
}
export function Settings() {
    const student = useStudent();
    const { logout } = useAuth();
    const navigate = useNavigate();
    return (<div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="Tune IHSD to fit how you live and work."/>

      <SectionCard icon={UserIcon} title="Account">
        <div className="space-y-4">
          <Field label="Full name" defaultValue={student.fullName}/>
          <Field label="Email" type="email" defaultValue={student.email}/>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-charcoal">Password</p>
              <p className="text-xs text-charcoal-muted">Last changed 3 months ago</p>
            </div>
            <Button variant="outline" size="sm">Change</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={CalendarIcon} title="Schedule Preferences">
        <div className="divide-y divide-black/[0.05]">
          <div className="grid grid-cols-2 gap-4 pb-4">
            <Field label="Working hours from" type="time" defaultValue="09:00"/>
            <Field label="Working hours to" type="time" defaultValue="18:00"/>
          </div>
          <ToggleRow label="Schedule study during focus hours" desc="Prioritise 9–12 for deep work" defaultOn/>
          <ToggleRow label="Automatic break preferences" desc="Insert recovery blocks between long sessions" defaultOn/>
        </div>
      </SectionCard>

      <SectionCard icon={EyeIcon} title="Focus Detection">
        <div className="divide-y divide-black/[0.05]">
          <ToggleRow label="Enable webcam focus detection" desc="Processed locally — no images stored" defaultOn/>
          <ToggleRow label="Privacy controls" desc="Only numerical focus signals are kept" defaultOn/>
        </div>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate('/app/focus-detection')}>
          Open focus detection settings
        </Button>
      </SectionCard>

      <SectionCard icon={BellIcon} title="Notifications">
        <div className="divide-y divide-black/[0.05]">
          <ToggleRow label="Schedule reminders" defaultOn/>
          <ToggleRow label="Focus reminders" defaultOn/>
          <ToggleRow label="Achievement notifications" defaultOn/>
        </div>
      </SectionCard>

      <SectionCard icon={ShieldCheckIcon} title="Data & Privacy">
        <div className="space-y-2">
          <Button variant="outline" fullWidth onClick={() => navigate('/app/privacy')}>View collected data</Button>
          <Button variant="outline" fullWidth>Export my data</Button>
          <Button variant="outline" fullWidth>Withdraw from research</Button>
          <button className="w-full text-sm font-semibold text-brand-600 hover:text-brand-700 py-2.5 rounded-full hover:bg-brand-50 transition-colors">
            Delete my data
          </button>
        </div>
      </SectionCard>

      <Button variant="secondary" size="lg" fullWidth onClick={() => { logout(); navigate('/login'); }}>
        <LogOutIcon size={18}/> Sign out
      </Button>
    </div>);
}
