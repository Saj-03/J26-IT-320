import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2Icon, CircleIcon, ClockIcon, FlaskConicalIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { Button } from '../shared/components/ui/Button';
import { ProgressRing } from '../shared/components/ui/ProgressRing';
import { cn } from '../shared/lib/cn';
const surveys = [
    { name: 'Pre-study questionnaire', status: 'done' },
    { name: 'Week 1 survey', status: 'done' },
    { name: 'Week 2 survey', status: 'done' },
    { name: 'Week 3 survey', status: 'active' },
    { name: 'Week 4 survey', status: 'upcoming' },
    { name: 'Post-study questionnaire', status: 'upcoming' }
];
export function ResearchParticipant() {
    const navigate = useNavigate();
    const completed = surveys.filter((s) => s.status === 'done').length;
    return (<div className="space-y-6">
      <PageHeader title="Research Participation" subtitle="Thank you for being part of the IHSD study."/>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-center gap-5">
            <ProgressRing value={completed / surveys.length * 100} size={110} stroke={11}>
              <span className="text-2xl font-extrabold text-charcoal">{completed}/{surveys.length}</span>
              <span className="text-[10px] font-semibold text-charcoal-muted">Surveys</span>
            </ProgressRing>
            <div>
              <span className="inline-flex items-center gap-1.5 bg-sage-light text-emerald-700 rounded-full px-3 py-1 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-sage"/> Active participant
              </span>
              <h2 className="text-xl font-extrabold text-charcoal mt-2">Week 3 of 4</h2>
              <p className="text-sm text-charcoal-muted mt-1 max-w-sm leading-relaxed">
                Your participation helps us understand how intelligent scheduling can support students.
              </p>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col items-center justify-center text-center">
          <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center">
            <FlaskConicalIcon size={22}/>
          </span>
          <p className="font-bold text-charcoal mt-3">Study ID</p>
          <p className="text-sm text-charcoal-muted">P-0142 (anonymised)</p>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Surveys</h3>
        <div className="space-y-3">
          {surveys.map((s) => <Card key={s.name} padding="sm" className="flex items-center gap-3">
              <span className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', s.status === 'done' && 'bg-sage-light text-emerald-600', s.status === 'active' && 'bg-brand-50 text-brand-500', s.status === 'upcoming' && 'bg-black/[0.04] text-charcoal-muted')}>
                {s.status === 'done' ? <CheckCircle2Icon size={20}/> : s.status === 'active' ? <ClockIcon size={20}/> : <CircleIcon size={20}/>}
              </span>
              <div className="flex-1">
                <p className="font-bold text-charcoal text-sm">{s.name}</p>
                <p className="text-xs text-charcoal-muted capitalize">
                  {s.status === 'done' ? 'Completed' : s.status === 'active' ? 'Available now' : 'Not yet available'}
                </p>
              </div>
              {s.status === 'active' && <Button size="sm">Start survey</Button>}
              {s.status === 'done' && <span className="text-xs font-semibold text-emerald-600">Done</span>}
            </Card>)}
        </div>
      </div>

      <Card padding="sm" className="flex items-center justify-between gap-4">
        <p className="text-sm text-charcoal-muted">You can withdraw at any time without affecting your account.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/settings')}>Manage participation</Button>
      </Card>
    </div>);
}
