// MY SCHEDULER SETTINGS - real values from GET /scheduler/settings, saved with PATCH (only what changed).
// The planner uses them at once: a new study window or daily cap makes the plan change by itself.
// The experiment mode (static / adaptive) is NOT shown: participants must not know it (it could bias them).
import React, { useEffect, useState } from 'react';
import { CalendarIcon, CheckIcon, HeartPulseIcon, TimerIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { SelectField } from '../../../shared/components/ui/Field';
import { apiErrorMessage } from '../../../shared/api/client';
import { cn } from '../../../shared/lib/cn';
import { getSchedulerSettings, updateSchedulerSettings } from '../api';

const FIELDS = ['day_start_hour', 'day_end_hour', 'max_study_minutes_per_day', 'preferred_hours', 'usual_focus_minutes',
                'fixed_timer_minutes', 'focus_tracking_enabled', 'stress_adaptation_enabled'];
const clock = (h) => `${String(h % 24).padStart(2, '0')}:00`;

function Toggle({ label, desc, on, onChange }) {
    return (<div className="flex items-center justify-between py-3.5">
      <div className="pr-4">
        <p className="text-sm font-semibold text-charcoal">{label}</p>
        <p className="text-xs text-charcoal-muted mt-0.5">{desc}</p>
      </div>
      <button type="button" onClick={() => onChange(!on)} aria-pressed={on} aria-label={label}
        className={cn('w-12 h-7 rounded-full transition-colors relative shrink-0', on ? 'bg-brand-500' : 'bg-black/15')}>
        <span className={cn('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-6' : 'left-1')}/>
      </button>
    </div>);
}

function Section({ icon: Icon, title, children }) {
    return (<Card padding="lg">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center"><Icon size={18}/></span>
        <h2 className="text-lg font-bold text-charcoal">{title}</h2>
      </div>
      {children}
    </Card>);
}

export default function SchedulerSettings() {
    const [saved, setSaved] = useState(null);      // what the server has
    const [form, setForm] = useState(null);        // what the student is editing
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        getSchedulerSettings().then((s) => { setSaved(s); setForm(s); }).catch((e) => setMessage(apiErrorMessage(e)));
    }, []);
    if (!form) return <Card padding="lg"><p className="text-sm text-charcoal-muted">{message || 'Loading your schedule settings…'}</p></Card>;

    const set = (field, value) => { setForm((f) => ({ ...f, [field]: value })); setMessage(''); };
    const changed = FIELDS.filter((f) => JSON.stringify(form[f]) !== JSON.stringify(saved[f]));
    const badWindow = form.day_end_hour <= form.day_start_hour;
    const togglePreferred = (h) => set('preferred_hours', form.preferred_hours.includes(h)
        ? form.preferred_hours.filter((x) => x !== h) : [...form.preferred_hours, h].sort((a, b) => a - b));

    const save = () => {
        setBusy(true);
        updateSchedulerSettings(Object.fromEntries(changed.map((f) => [f, form[f]])))
            .then((s) => { setSaved(s); setForm(s); setMessage('Saved. Your plan was updated with the new settings.'); })
            .catch((e) => setMessage(apiErrorMessage(e)))
            .finally(() => setBusy(false));
    };

    return (<div className="space-y-6">
      <Section icon={CalendarIcon} title="Study time">
        <div className="grid sm:grid-cols-3 gap-4">
          <SelectField label="Study from" value={form.day_start_hour} onChange={(e) => set('day_start_hour', Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{clock(h)}</option>)}
          </SelectField>
          <SelectField label="Study until" value={form.day_end_hour} onChange={(e) => set('day_end_hour', Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h === 24 ? '24:00' : clock(h)}</option>)}
          </SelectField>
          <SelectField label="Most study in a day" value={form.max_study_minutes_per_day} onChange={(e) => set('max_study_minutes_per_day', Number(e.target.value))}>
            {[60, 120, 180, 240, 300, 360, 420, 480, 600].map((m) => <option key={m} value={m}>{m / 60} hours</option>)}
          </SelectField>
        </div>
        {badWindow && <p className="text-xs font-semibold text-red-600 mt-2">"Study until" must be after "Study from".</p>}
        <p className="text-xs text-charcoal-muted mt-3">ThriveU plans study only inside this window, around your lectures and commitments.</p>

        <p className="text-sm font-semibold text-charcoal-light mt-5">Hours you like to study <span className="font-normal text-charcoal-muted">(used until ThriveU learns your best hours from your focus sessions)</span></p>
        <div className="flex flex-wrap gap-2 mt-2">
          {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => <button key={h} type="button" onClick={() => togglePreferred(h)}
              aria-pressed={form.preferred_hours.includes(h)}
              className={cn('px-3 py-2 rounded-xl text-xs font-bold min-h-[36px] border transition-colors',
                form.preferred_hours.includes(h) ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-charcoal-light border-black/10 hover:border-brand-300')}>
              {clock(h)}
            </button>)}
        </div>
      </Section>

      <Section icon={TimerIcon} title="Focus timer">
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField label="Timer length" value={form.fixed_timer_minutes ?? ''} onChange={(e) => set('fixed_timer_minutes', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Adaptive - ThriveU learns it (recommended)</option>
            {[15, 20, 25, 30, 40, 45, 50, 60, 90].map((m) => <option key={m} value={m}>Always {m} minutes</option>)}
          </SelectField>
          <SelectField label="How long you usually focus (a starting point)" value={form.usual_focus_minutes} onChange={(e) => set('usual_focus_minutes', Number(e.target.value))}>
            {[10, 15, 20, 25, 30, 40, 45, 50, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </SelectField>
        </div>
      </Section>

      <Section icon={HeartPulseIcon} title="Your choices">
        <div className="divide-y divide-black/[0.05]">
          <Toggle label="Track my focus sessions" desc="Needed to learn your best hours and timer length. Off = no focus data is kept."
            on={form.focus_tracking_enabled} onChange={(v) => set('focus_tracking_enabled', v)}/>
          <Toggle label="Suggest a lighter plan when my wellbeing signal is high" desc="Nothing changes until you accept a suggestion. Off = your plan is never changed for stress."
            on={form.stress_adaptation_enabled} onChange={(v) => set('stress_adaptation_enabled', v)}/>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy || !changed.length || badWindow}>
          <CheckIcon size={16}/> {busy ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'Saved'}
        </Button>
        {changed.length > 0 && <Button variant="ghost" onClick={() => { setForm(saved); setMessage(''); }}>Undo changes</Button>}
        {message && <p className="text-sm font-semibold text-charcoal-light" aria-live="polite">{message}</p>}
      </div>
    </div>);
}
