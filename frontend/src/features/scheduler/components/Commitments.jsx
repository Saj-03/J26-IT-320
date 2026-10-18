// MY LECTURES & COMMITMENTS (FR-02) - busy time the planner must never use.
//   weekly  -> e.g. "SE lecture, every Monday 08:30-10:30" (Sri Lanka clock time)
//   one-off -> e.g. "Club event, 22 Oct 16:00-18:00"
// Clashes and deadlines that no longer fit come from GET /scheduler/conflicts.
import React, { useEffect, useState } from 'react';
import { AlertTriangleIcon, CalendarPlusIcon, RepeatIcon, Trash2Icon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { categoryStyles } from '../../../shared/lib/data';
import { apiErrorMessage } from '../../../shared/api/client';
import { createCommitment, deleteCommitment, getConflicts } from '../api';
import { SectionTitle } from './PlanPrimitives';
import { toDate } from '../lib';
import { cn } from '../../../shared/lib/cn';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const KINDS = [
    { value: 'lecture', label: 'Lecture', style: 'career' },
    { value: 'work', label: 'Work', style: 'work' },
    { value: 'extracurricular', label: 'Club / sport', style: 'social' },
    { value: 'personal', label: 'Personal', style: 'personal' },
];
const KIND_OF = Object.fromEntries([...KINDS, { value: 'protected_block', label: 'Rest', style: 'recovery' }].map((k) => [k.value, k]));
const EMPTY = { title: '', kind: 'lecture', weekly: true, weekday: 0, date: '', start: '08:30', end: '10:30' };
const field = 'w-full rounded-2xl border border-black/10 bg-cream/50 px-4 py-3 text-sm text-charcoal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20';

const clock = (hhmm) => new Date(`2000-01-01T${hhmm}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function whenText(c) {
    if (c.is_recurring) return `Every ${WEEKDAYS[c.weekday]} · ${clock(c.start_time)} – ${clock(c.end_time)}`;
    const s = toDate(c.start_at), e = toDate(c.end_at);
    const time = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${time(s)} – ${time(e)}`;
}

export default function Commitments({ items, onChanged }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [conflicts, setConflicts] = useState([]);

    useEffect(() => { getConflicts().then(setConflicts).catch(() => setConflicts([])); }, [items]);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

    const save = (e) => {
        e.preventDefault();
        setError('');
        if (form.end <= form.start) return setError('The end time must be after the start time.');
        if (!form.weekly && !form.date) return setError('Pick a date.');
        const body = form.weekly
            ? { title: form.title.trim(), kind: form.kind, is_recurring: true, weekday: Number(form.weekday), start_time: form.start, end_time: form.end }
            : { title: form.title.trim(), kind: form.kind, is_recurring: false,
                start_at: new Date(`${form.date}T${form.start}`).toISOString(), end_at: new Date(`${form.date}T${form.end}`).toISOString() };
        setSaving(true);
        createCommitment(body)
            .then(() => { setOpen(false); setForm(EMPTY); onChanged(); })
            .catch((err) => setError(apiErrorMessage(err)))
            .finally(() => setSaving(false));
    };

    const remove = (id) => deleteCommitment(id).then(onChanged).catch((err) => setError(apiErrorMessage(err)));

    const weekly = items.filter((c) => c.is_recurring);
    const oneOff = items.filter((c) => !c.is_recurring && toDate(c.end_at) > new Date());

    return (<div>
      <SectionTitle title="My lectures & commitments" subtitle="Busy time ThriveU never plans study into. Add your timetable once."
          action={<Button size="sm" onClick={() => { setError(''); setOpen(true); }}><CalendarPlusIcon size={15}/> Add</Button>}/>

      {conflicts.length > 0 &&
        <Card padding="sm" className="mb-3 border border-amber-200/60 bg-amber-light/60">
          {conflicts.map((c, i) => <p key={i} className="text-sm text-charcoal flex items-start gap-2 p-1">
              <AlertTriangleIcon size={15} className="text-amber-500 mt-0.5 shrink-0"/>{c.message}
            </p>)}
        </Card>}

      {weekly.length + oneOff.length === 0 ?
        <Card padding="lg"><p className="text-sm text-charcoal-muted">No lectures or commitments yet. Add your weekly timetable so “Plan my week” keeps those hours free.</p></Card> :
        <Card padding="sm">
          <ul className="divide-y divide-black/[0.05]">
            {[...weekly, ...oneOff].map((c) => {
                const kind = KIND_OF[c.kind] ?? KIND_OF.personal;
                const style = categoryStyles[kind.style];
                return <li key={c.id} className="flex items-center gap-3 p-3">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', style.dot)}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-charcoal truncate">{c.title}</p>
                    <p className="text-xs text-charcoal-muted flex items-center gap-1">
                      {c.is_recurring && <RepeatIcon size={11}/>}{whenText(c)} · {kind.label}
                    </p>
                  </div>
                  {c.kind !== 'protected_block' &&
                    <button onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`} className="w-9 h-9 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-black/[0.05] hover:text-red-600 transition-colors">
                      <Trash2Icon size={15}/>
                    </button>}
                </li>;
            })}
          </ul>
        </Card>}

      <Modal open={open} onClose={() => setOpen(false)} title="Add a lecture or commitment">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label htmlFor="c-title" className="text-sm font-semibold text-charcoal-light">What is it?</label>
            <input id="c-title" required maxLength={200} value={form.title} onChange={set('title')} placeholder="e.g. SE lecture" className={cn(field, 'mt-1.5')}/>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Type">
            {KINDS.map((k) => <button key={k.value} type="button" onClick={() => setForm({ ...form, kind: k.value })} aria-pressed={form.kind === k.value}
                className={cn('rounded-2xl px-3 py-2 text-xs font-semibold border transition-colors', form.kind === k.value ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-black/10 text-charcoal-muted hover:bg-black/[0.03]')}>
                {k.label}
              </button>)}
          </div>

          <div className="flex bg-cream rounded-full p-0.5 w-fit" role="group" aria-label="How often">
            {[[true, 'Every week'], [false, 'Just once']].map(([v, l]) => <button key={l} type="button" onClick={() => setForm({ ...form, weekly: v })} aria-pressed={form.weekly === v}
                className={cn('px-4 py-1.5 rounded-full text-xs font-semibold transition-colors', form.weekly === v ? 'bg-white text-charcoal shadow-soft' : 'text-charcoal-muted')}>
                {l}
              </button>)}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {form.weekly ?
              <div>
                <label htmlFor="c-day" className="text-xs font-semibold text-charcoal-light">Day</label>
                <select id="c-day" value={form.weekday} onChange={set('weekday')} className={cn(field, 'mt-1')}>
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div> :
              <div>
                <label htmlFor="c-date" className="text-xs font-semibold text-charcoal-light">Date</label>
                <input id="c-date" type="date" value={form.date} onChange={set('date')} className={cn(field, 'mt-1')}/>
              </div>}
            <div>
              <label htmlFor="c-start" className="text-xs font-semibold text-charcoal-light">From</label>
              <input id="c-start" type="time" required value={form.start} onChange={set('start')} className={cn(field, 'mt-1')}/>
            </div>
            <div>
              <label htmlFor="c-end" className="text-xs font-semibold text-charcoal-light">To</label>
              <input id="c-end" type="time" required value={form.end} onChange={set('end')} className={cn(field, 'mt-1')}/>
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <Button type="submit" fullWidth size="lg" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <p className="text-xs text-charcoal-muted text-center">Press “Plan my week” again afterwards so your study plan moves around it.</p>
        </form>
      </Modal>
    </div>);
}
