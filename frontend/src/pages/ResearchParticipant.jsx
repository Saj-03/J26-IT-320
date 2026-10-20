import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleIcon, FlaskConicalIcon, ShieldCheckIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { Button } from '../shared/components/ui/Button';
import api from '../shared/api/client';
import { useAuth } from '../shared/context/AuthContext';
import { cn } from '../shared/lib/cn';

// Real data only: the logged-in student's research ID and consent (from /auth/me) and how much
// study data they have contributed so far. The survey system is not built yet, so the surveys are
// listed as "opens when the pilot starts" instead of showing made-up progress.
// The experiment mode (static / adaptive) is deliberately NOT shown to participants (it could bias them).
const SURVEYS = ['Pre-study questionnaire', 'Week 1 survey', 'Week 2 survey', 'Week 3 survey', 'Week 4 survey',
                 'Post-study questionnaire (incl. System Usability Scale)'];

export function ResearchParticipant() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [sessions, setSessions] = useState(null);
    useEffect(() => {
        api.get('/scheduler/focus/history', { params: { limit: 1 } })
            .then((r) => setSessions(r.data.summary.sessions)).catch(() => setSessions(null));
    }, []);
    const consent = !!user?.research_consent;

    return (<div className="space-y-6">
      <PageHeader title="Research Participation" subtitle="Thank you for being part of the ThriveU study."/>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
              consent ? 'bg-sage-light text-emerald-700' : 'bg-black/[0.05] text-charcoal-muted')}>
            <span className={cn('w-2 h-2 rounded-full', consent ? 'bg-sage' : 'bg-charcoal-muted')}/>
            {consent ? 'Taking part in the study' : 'Not taking part'}
          </span>
          <h2 className="text-xl font-extrabold text-charcoal mt-2">
            {consent ? 'The pilot study has not started yet' : 'You have not given research consent'}
          </h2>
          <p className="text-sm text-charcoal-muted mt-1 max-w-lg leading-relaxed">
            {consent
              ? `You will get a message when the 4-week pilot begins. ${sessions != null ? `So far you have logged ${sessions} focus session${sessions === 1 ? '' : 's'}.` : ''}`
              : 'ThriveU works the same without it. Only students who consent are included in the research data, and only by research ID.'}
          </p>
        </Card>

        <Card padding="lg" className="flex flex-col items-center justify-center text-center">
          <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center"><FlaskConicalIcon size={22}/></span>
          <p className="font-bold text-charcoal mt-3">Study ID</p>
          <p className="text-sm text-charcoal-muted">{user?.research_id ?? '–'} (anonymised)</p>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Surveys</h3>
        <div className="space-y-3">
          {SURVEYS.map((name) => <Card key={name} padding="sm" className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-black/[0.04] text-charcoal-muted"><CircleIcon size={20}/></span>
              <div className="flex-1">
                <p className="font-bold text-charcoal text-sm">{name}</p>
                <p className="text-xs text-charcoal-muted">Opens when the pilot study starts</p>
              </div>
            </Card>)}
        </div>
      </div>

      <Card padding="sm" className="flex items-center justify-between gap-4">
        <p className="text-sm text-charcoal-muted flex items-center gap-2">
          <ShieldCheckIcon size={16} className="shrink-0"/> You can withdraw at any time without affecting your account.
        </p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/settings')}>Manage participation</Button>
      </Card>
    </div>);
}
