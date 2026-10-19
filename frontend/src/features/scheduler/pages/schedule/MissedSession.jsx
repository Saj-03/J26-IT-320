// RESCHEDULE A MISSED / UNPLANNED TASK.
// New times = free slots before the deadline (GET /availability), ranked by the M1 chance of
// finishing a session at that hour (GET /attention/profile). Picking one moves the task (PATCH).
// Opened as /app/schedule/missed?id=<task id>; without an id the student first picks a task.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ArrowRightIcon, CalendarClockIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../../../shared/components/ui/States';
import { SectionTitle } from '../../components/PlanPrimitives';
import { apiErrorMessage } from '../../../../shared/api/client';
import { getAttentionProfile, getAvailability, listTasks, updateTask, utcMs } from '../../api';
import { dayText, isOpen, timeText } from '../../lib';
import { cn } from '../../../../shared/lib/cn';

const MAX_OPTIONS = 4;
const MAX_SESSION = 60;      // plan at most one hour at a time

// Every full-hour start inside the free slots where the session fits before the deadline
function candidateTimes(days, minutes, deadlineMs) {
    const out = [];
    for (const day of days) {
        for (const slot of day.slots) {
            const end = utcMs(slot.end);
            let t = Math.ceil(utcMs(slot.start) / 3600000) * 3600000;      // next full hour
            while (t + minutes * 60000 <= Math.min(end, deadlineMs)) {
                out.push(t);
                t += 3600000;
            }
        }
    }
    return out;
}

export function MissedSession() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const id = params.get('id');
    const [tasks, setTasks] = useState(null);
    const [days, setDays] = useState(null);
    const [chanceByHour, setChanceByHour] = useState(null);   // M1, null = not learned yet
    const [failed, setFailed] = useState(false);
    const [picked, setPicked] = useState(0);
    const [moved, setMoved] = useState(null);
    const [error, setError] = useState('');

    const load = () => {
        setFailed(false);
        Promise.all([listTasks(), getAvailability(14), getAttentionProfile()])
            .then(([t, a, p]) => {
                setTasks(t);
                setDays(a.days);
                setChanceByHour(p.source === 'm1_model' ? Object.fromEntries(p.hourly.map((r) => [r.hour, r.chance])) : null);
            })
            .catch(() => setFailed(true));
    };
    useEffect(load, []);

    if (failed) return <ErrorState onRetry={load}/>;
    if (!tasks || !days) return <LoadingState label="Looking for free time…"/>;

    const now = Date.now();
    const task = tasks.find((t) => t.id === id);

    // No task chosen -> list open tasks whose planned time has passed (or that have no time)
    if (!task) {
        const missed = tasks.filter((t) => isOpen(t) && !t.parent_id && (!t.scheduled_start || utcMs(t.scheduled_start) < now));
        return (<div className="space-y-6">
          <PageHeader title="Reschedule a task" subtitle="Pick a task and we will find a good time before its deadline."/>
          {missed.length === 0 ?
            <EmptyState title="Nothing missed" desc="All your open tasks have a time in the future." actionLabel="Back to schedule" onAction={() => navigate('/app/schedule')}/> :
            <div className="space-y-2">
              {missed.map((t) => <button key={t.id} onClick={() => setParams({ id: t.id })} className="w-full text-left rounded-2xl bg-white border border-black/[0.05] p-4 hover:border-brand-200">
                  <p className="font-bold text-charcoal">{t.title}</p>
                  <p className="text-xs text-charcoal-muted mt-0.5">
                    {t.scheduled_start ? `Was planned ${dayText(t.scheduled_start)} ${timeText(t.scheduled_start)}` : 'No time planned'} · due {dayText(t.deadline)}
                  </p>
                </button>)}
            </div>}
        </div>);
    }

    const minutes = Math.min(task.estimated_minutes, MAX_SESSION);
    const score = (ms) => chanceByHour?.[new Date(ms).getHours()] ?? 0;
    const options = candidateTimes(days, minutes, utcMs(task.deadline))
        .sort((a, b) => score(b) - score(a) || a - b)          // best focus hour first, then earliest
        .slice(0, MAX_OPTIONS);

    const accept = () => {
        setError('');
        updateTask(task.id, { scheduled_start: new Date(options[picked]).toISOString() })
            .then(setMoved)
            .catch((e) => setError(apiErrorMessage(e)));
    };

    const label = (ms) => `${new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    return (<div className="space-y-6">
      <PageHeader title="Reschedule" subtitle="No problem. Here are free times before your deadline."/>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-sage-light border border-emerald-100 p-5 sm:p-6 flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <CalendarClockIcon size={20}/>
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-emerald-800">{task.title}</h2>
          <p className="text-sm text-emerald-700/85 mt-1 leading-relaxed max-w-xl">
            {task.scheduled_start ? `Was planned for ${dayText(task.scheduled_start)} ${timeText(task.scheduled_start)}. ` : ''}
            Due {dayText(task.deadline)} · {minutes} min session.
            {chanceByHour ? ' Times are ranked by when you usually focus best.' : ' After 5 focus sessions we also rank times by your best focus hours.'}
          </p>
        </div>
      </motion.div>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      {options.length === 0 ?
        <EmptyState title="No free time before the deadline" desc="Your free time is full until the deadline. Try moving a commitment or the deadline." actionLabel="Back to schedule" onAction={() => navigate('/app/schedule')}/> :
        <Card padding="lg">
          <SectionTitle title="Choose a new time" subtitle={`All of these are free and before ${dayText(task.deadline)}.`}/>
          <div className="space-y-2">
            {options.map((ms, i) => <button key={ms} onClick={() => setPicked(i)} disabled={!!moved} className={cn('w-full text-left rounded-2xl p-4 border-2 transition-colors flex items-center gap-3', picked === i ? 'border-brand-500 bg-brand-50' : 'border-black/[0.06] bg-white hover:border-brand-200')}>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-charcoal">{label(ms)}</p>
                  <p className="text-xs text-charcoal-muted mt-0.5">
                    {chanceByHour ? `${Math.round(score(ms) * 100)}% chance you finish a session at this hour` : 'Free time'}
                  </p>
                </div>
                {i === 0 && chanceByHour &&
                    <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-brand-500 rounded-full px-2 py-0.5 shrink-0">Best</span>}
              </button>)}
          </div>
        </Card>}

      <AnimatePresence mode="wait">
        {moved ?
            <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="flex items-center gap-4">
              <span className="text-3xl">✅</span>
              <div className="flex-1">
                <p className="font-bold text-charcoal">Moved to {dayText(moved.scheduled_start)} {timeText(moved.scheduled_start)}</p>
                <p className="text-sm text-charcoal-muted mt-0.5">You will see it in your schedule.</p>
              </div>
              <Button onClick={() => navigate('/app/schedule')}>
                View schedule <ArrowRightIcon size={16}/>
              </Button>
            </Card>
          </motion.div> :
            options.length > 0 &&
            <motion.div key="choose">
            <Button size="lg" fullWidth onClick={accept}>
              <CheckIcon size={18}/> Move to {label(options[picked])}
            </Button>
          </motion.div>}
      </AnimatePresence>
    </div>);
}
