import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, BellIcon, ShieldCheckIcon, LogOutIcon } from 'lucide-react';
import { useAuth } from '../shared/context/AuthContext';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { Field } from '../shared/components/ui/Field';
import { Button } from '../shared/components/ui/Button';
import { ToggleRow } from '../shared/components/ui/SettingsRow';
import useStudent from '../shared/hooks/useStudent';
import SchedulerSettings from '../features/scheduler/components/SchedulerSettings';
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
      <PageHeader title="Settings" subtitle="Tune ThriveU to fit how you live and work."/>

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

      {/* Component 3 - scheduler settings: real values, saved to the API (was a mock with a webcam option the
          proposal removed) */}
      <SchedulerSettings/>

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
          <Button variant="outline" fullWidth onClick={() => navigate('/app/research')}>Withdraw from research</Button>
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
