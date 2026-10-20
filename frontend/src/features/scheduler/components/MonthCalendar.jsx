// MONTH CALENDAR - the whole month at a glance; tap a day to see that day's timeline.
// Built only from data the schedule page already loads (no extra API):
//   * study sessions from "Plan my week" (future pieces)      * tasks planned by hand (scheduled_start)
//   * deadlines of open tasks ("Due")                          * tasks finished that day (✓, crossed out)
//   * commitments: weekly ones repeat on their weekday, one-off ones on their date
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FlagIcon, PlusIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { categoryStyles } from '../../../shared/lib/data';
import { cn } from '../../../shared/lib/cn';
import { utcMs } from '../api';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const KIND = {      // what an item is -> colour + badge
    study: { cat: 'academic', label: 'Study' },
    due: { cat: 'academic', label: 'Due' },
    lecture: { cat: 'career', label: 'Lecture' },
    work: { cat: 'work', label: 'Work' },
    protected_block: { cat: 'recovery', label: 'Rest' },
    personal: { cat: 'personal', label: 'Personal' },
    extracurricular: { cat: 'social', label: 'Club / sport' },
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sameDay = (a, b) => dayKey(a) === dayKey(b);
const toDate = (iso) => new Date(utcMs(iso));
const clock = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const atMinutes = (day, text) => {                       // "08:30:00" on a day -> Date
    const [h, m] = text.split(':').map(Number);
    const d = new Date(day); d.setHours(h, m, 0, 0); return d;
};

// The 6 x 7 days shown for a month (Monday first)
function monthDays(month) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

// Everything that happens on the shown days: { key -> [items] }, each list sorted by time
function itemsByDay(days, tasks, plan, commitments) {
    const out = {};
    const add = (day, item) => (out[dayKey(day)] ??= []).push(item);
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const shown = new Set(days.map(dayKey));
    const inRange = (d) => shown.has(dayKey(d));

    const planned = new Set();
    const parents = new Set(tasks.map((t) => t.parent_id).filter(Boolean));
    for (const p of plan) {
        const s = toDate(p.start), task = byId[p.task_id];
        planned.add(p.task_id);
        if (task && inRange(s))
            add(s, { kind: 'study', start: s, end: toDate(p.end), title: p.title, task, part: p.of > 1 ? `Part ${p.piece} of ${p.of}` : null });
    }
    for (const t of tasks) {
        if (t.scheduled_start && !planned.has(t.id) && !parents.has(t.id)) {     // a big task shows through its steps
            const s = toDate(t.scheduled_start);
            if (inRange(s)) add(s, { kind: 'study', start: s, end: new Date(s.getTime() + t.estimated_minutes * 60000), title: t.title, task: t });
        }
        if (t.status === 'done' && t.completed_at && !planned.has(t.id)) {
            const s = toDate(t.completed_at);
            if (inRange(s)) add(s, { kind: 'study', start: s, title: t.title, task: t, finished: true });
        }
        if (!t.parent_id && t.status !== 'done' && t.status !== 'cancelled' && t.deadline) {
            const s = toDate(t.deadline);
            if (inRange(s)) add(s, { kind: 'due', start: s, title: t.title, task: t, allDay: true });
        }
    }
    for (const c of commitments) {
        if (c.is_recurring) {
            const from = c.valid_from ? toDate(c.valid_from) : null, until = c.valid_until ? toDate(c.valid_until) : null;
            for (const d of days) {
                if ((d.getDay() + 6) % 7 !== c.weekday || (from && d < from) || (until && d > until)) continue;
                add(d, { kind: c.kind, start: atMinutes(d, c.start_time), end: atMinutes(d, c.end_time), title: c.title });
            }
        } else if (c.start_at) {
            const s = toDate(c.start_at);
            if (inRange(s)) add(s, { kind: c.kind, start: s, end: toDate(c.end_at), title: c.title });
        }
    }
    for (const list of Object.values(out))
        list.sort((a, b) => (a.allDay - b.allDay) || (a.start - b.start));
    return out;
}

function Agenda({ day, items }) {
    const navigate = useNavigate();
    const isToday = sameDay(day, new Date());
    return (<div className="space-y-3">
      <div>
        <h3 className="text-xl font-extrabold text-charcoal">{isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'long' })}</h3>
        <p className="text-sm text-charcoal-muted">
          {day.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} · {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {items.length === 0 ?
        <Card padding="lg" className="text-center space-y-3">
          <p className="text-sm text-charcoal-muted">Nothing planned for this day. Enjoy the free time 🌿</p>
          <Button size="sm" variant="outline" onClick={() => navigate('/app/add-task')}><PlusIcon size={15}/> Add a task</Button>
        </Card> :
        <ol className="relative space-y-3">
          {items.map((it, i) => {
              const kind = KIND[it.kind] ?? KIND.personal;
              const cat = categoryStyles[kind.cat];
              const done = it.finished || it.task?.status === 'done';
              const open = () => it.task && navigate(`/app/tasks/detail?id=${it.task.parent_id ?? it.task.id}`);
              return (<li key={i} className="grid grid-cols-[72px_1fr] gap-3 items-stretch">
                <div className="relative text-right pt-4">
                  <span className="text-xs font-bold text-charcoal-muted tabular-nums">{it.allDay ? 'Due' : clock(it.start)}</span>
                  {i < items.length - 1 && <span className="absolute right-[-7px] top-10 bottom-[-14px] w-px bg-black/10" aria-hidden/>}
                </div>
                <button type="button" onClick={open} disabled={!it.task}
                  className={cn('text-left flex items-center gap-3 rounded-2xl bg-white border border-black/[0.06] shadow-soft p-4 min-h-[64px]',
                    it.task ? 'hover:border-brand-200 transition-colors' : 'cursor-default')}>
                  <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                      done ? 'bg-emerald-500 text-white' : it.kind === 'due' ? 'bg-amber-light text-amber-700' : cat.bg + ' ' + cat.text)}>
                    {done ? <CheckIcon size={18}/> : it.kind === 'due' ? <FlagIcon size={16}/> : <span className={cn('w-2.5 h-2.5 rounded-full', cat.dot)}/>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block font-bold text-charcoal truncate', done && 'line-through text-charcoal-muted')}>{it.title}</span>
                    <span className="block text-xs text-charcoal-muted mt-0.5">
                      {it.allDay ? `Deadline · ${clock(it.start)}` : it.finished ? `Finished · ${clock(it.start)}` :
                        `${clock(it.start)}${it.end ? ` – ${clock(it.end)}` : ''}${it.part ? ` · ${it.part}` : ''}`}
                    </span>
                  </span>
                  <span className={cn('text-[11px] font-bold rounded-full px-2.5 py-1 shrink-0', cat.bg, cat.text)}>{done ? 'Done' : kind.label}</span>
                </button>
              </li>);
          })}
        </ol>}
    </div>);
}

export default function MonthCalendar({ tasks, plan, commitments }) {
    const today = new Date();
    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [picked, setPicked] = useState(today);
    const days = useMemo(() => monthDays(month), [month]);
    const byDay = useMemo(() => itemsByDay(days, tasks, plan, commitments), [days, tasks, plan, commitments]);
    const move = (n) => {              // new month: show today if it is in it, else the 1st
        const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
        setMonth(next);
        setPicked(next.getMonth() === today.getMonth() && next.getFullYear() === today.getFullYear() ? today : next);
    };
    const backToToday = () => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setPicked(today); };
    const showingToday = month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();

    return (<div className="grid lg:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
      <Card padding="lg">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="w-11 h-11 rounded-full hover:bg-black/[0.04] flex items-center justify-center"><ChevronLeftIcon size={20}/></button>
          <div className="text-center">
            <p className="text-lg font-extrabold text-charcoal">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</p>
            {!(showingToday && sameDay(picked, today)) &&
              <button type="button" onClick={backToToday} className="text-xs font-bold text-amber-600 hover:underline">Back to today</button>}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next month" className="w-11 h-11 rounded-full hover:bg-black/[0.04] flex items-center justify-center"><ChevronRightIcon size={20}/></button>
        </div>

        <div className="grid grid-cols-7 mt-4 text-center">
          {WEEKDAYS.map((w, i) => <span key={i} className="text-xs font-bold text-charcoal-muted pb-2">{w}</span>)}
          {days.map((d) => {
              const items = byDay[dayKey(d)] ?? [];
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameDay(d, today), isPicked = sameDay(d, picked);
              const dots = [...new Set(items.map((it) => categoryStyles[(KIND[it.kind] ?? KIND.personal).cat].dot))].slice(0, 3);
              return (<button key={dayKey(d)} type="button" onClick={() => { setPicked(d); if (!inMonth) setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}
                  aria-label={`${d.toDateString()}, ${items.length} items`} aria-pressed={isPicked}
                  className="flex flex-col items-center gap-1 py-1.5 min-h-[56px]">
                <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums transition-colors',
                    isPicked ? 'bg-brand-500 text-white' : isToday ? 'bg-amber-light text-amber-700' : inMonth ? 'text-charcoal hover:bg-black/[0.04]' : 'text-charcoal-muted/50')}>
                  {d.getDate()}
                </span>
                <span className="flex gap-1 h-1.5">{dots.map((dot) => <span key={dot} className={cn('w-1.5 h-1.5 rounded-full', dot)}/>)}</span>
              </button>);
          })}
        </div>
      </Card>

      <Agenda day={picked} items={byDay[dayKey(picked)] ?? []}/>
    </div>);
}
