// YOUR BEST STUDY TIMES — the student's attention pattern learned by the M1 model
// (GET /scheduler/attention/profile). Fewer than 5 sessions -> "still learning" + progress.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { ProgressBar } from '../../../../shared/components/ui/ProgressBar';
import { BarChart } from '../../../../shared/components/charts/Charts';
import { LoadingState, ErrorState } from '../../../../shared/components/ui/States';
import { AIInsightCard } from '../../../../shared/components/domain/AIInsightCard';
import { LoadBadge, SectionTitle } from '../../components/PlanPrimitives';
import { getAttentionProfile } from '../../api';

const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const pct = (chance) => Math.round(chance * 100);

export function AttentionPatterns() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [failed, setFailed] = useState(false);

    const load = () => {
        setFailed(false);
        getAttentionProfile().then(setProfile).catch(() => setFailed(true));
    };
    useEffect(load, []);

    if (failed) return <ErrorState onRetry={load}/>;
    if (!profile) return <LoadingState label="Reading your focus history…"/>;

    // Not enough sessions yet (or no model on the server) -> explain and show progress
    if (profile.source !== 'm1_model') {
        return (<div className="space-y-6">
          <PageHeader title="Your Best Study Times" subtitle="Learned from how you actually focus, not how you plan to."/>
          <Card padding="lg" className="max-w-xl space-y-4">
            <AIInsightCard title="Still learning">{profile.reason}</AIInsightCard>
            {profile.source === 'not_enough_history' &&
              <div>
                <ProgressBar value={profile.sessions_used / profile.min_sessions * 100}/>
                <p className="text-xs text-charcoal-muted mt-1.5">
                  {profile.sessions_used} of {profile.min_sessions} focus sessions
                </p>
              </div>}
            <Button onClick={() => navigate('/app/focus/setup')}>
              <PlayIcon size={16} fill="currentColor"/> Start a focus session
            </Button>
          </Card>
        </div>);
    }

    const chance = Object.fromEntries(profile.hourly.map((r) => [r.hour, r.chance]));
    const bars = profile.hourly.map((r) => ({ label: String(r.hour), value: pct(r.chance) }));
    const middle = profile.hourly.map((r) => r.hour)
        .filter((h) => !profile.peak_hours.includes(h) && !profile.low_hours.includes(h))
        .sort((a, b) => chance[b] - chance[a]).slice(0, 3);

    const windows = [
        { title: 'Best hours', hours: profile.peak_hours, color: 'bg-brand-500', load: 'Heavy' },
        { title: 'Hardest hours', hours: profile.low_hours, color: 'bg-sage', load: 'Light' },
    ];
    const matching = [
        { load: 'Heavy', window: 'Your best hours', hours: profile.peak_hours },
        { load: 'Medium', window: 'Normal hours', hours: middle },
        { load: 'Light', window: 'Your hardest hours', hours: profile.low_hours },
    ];

    return (<div className="space-y-6">
      <PageHeader title="Your Best Study Times" subtitle="Learned from how you actually focus, not how you plan to."/>

      <AIInsightCard title="From your focus history">{profile.reason}</AIInsightCard>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle title="Chance of finishing a 25-min session" subtitle={`By hour of the day, from ${profile.sessions_used} sessions (Sri Lanka time)`}/>
          <BarChart data={bars} height={200} unit="%"/>
        </Card>

        <Card padding="lg">
          <SectionTitle title="Focus windows"/>
          <div className="space-y-5">
            {windows.map((w) => <div key={w.title}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-charcoal">{w.title}</span>
                  <LoadBadge load={w.load}/>
                </div>
                <div className="space-y-2">
                  {w.hours.map((h) => <div key={h} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-charcoal-muted tabular-nums w-11">{hh(h)}</span>
                      <ProgressBar value={pct(chance[h])} color={w.color} className="flex-1"/>
                      <span className="text-xs font-bold text-charcoal tabular-nums w-9 text-right">{pct(chance[h])}%</span>
                    </div>)}
                </div>
              </div>)}
            <div className="rounded-2xl bg-cream p-4">
              <p className="text-sm font-bold text-charcoal">Focus capacity: ~{profile.capacity_minutes} min</p>
              <p className="text-xs text-charcoal-muted mt-0.5">Suggested timer: {profile.recommended_focus} min</p>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle title="Try matching tasks to these times" subtitle="Hard work when you focus best, light work when it is harder."/>
        <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
          {matching.map((r) => <Card key={r.load} padding="lg" hover className="text-center">
              <div className="flex justify-center">
                <LoadBadge load={r.load}/>
              </div>
              <p className="text-2xl mt-3">↓</p>
              <p className="text-base font-extrabold text-charcoal mt-2">{r.window}</p>
              <p className="text-sm text-charcoal-muted mt-0.5">{r.hours.map(hh).join(', ') || '—'}</p>
            </Card>)}
        </div>
      </div>
    </div>);
}
