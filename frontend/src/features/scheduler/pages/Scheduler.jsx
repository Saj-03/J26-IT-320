// SMART SCHEDULE - this week from the API: planned tasks (scheduled_start) + commitments
// (lectures, work, protected rest blocks), the wellbeing banner (Component 4 signal) and week progress.
// Tasks without a time get "Find a time" (reschedule page: free slots ranked by M1).
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, ClockIcon, SkipForwardIcon, BrainIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { ErrorState, LoadingState } from '../../../shared/components/ui/States';
import { LoadBadge, SectionTitle, formatMinutes } from '../components/PlanPrimitives';
import PlannedTasks from '../components/PlannedTasks';
import { categoryStyles } from '../../../shared/lib/data';
import { apiErrorMessage } from '../../../shared/api/client';
import { finishTask, getStressStatus, listCommitments, listTasks, updateTask, utcMs } from '../api';
import { LOAD_LABEL, isOpen, stressStyles } from '../lib';
import { cn } from '../../../shared/lib/cn';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FIRST_HOUR = 6, LAST_HOUR = 24, ROW_HOURS = 2, ROW_PX = 64;          // grid 06:00 - 24:00
const HOURS = Array.from({ length: (LAST_HOUR - FIRST_HOUR) / ROW_HOURS }, (_, i) => `${String(FIRST_HOUR + i * ROW_HOURS).padStart(2, '0')}:00`);

// What each kind of block looks like (colours from the shared category styles)
const KIND_STYLE = { task: 'academic', lecture: 'career', work: 'work', protected_block: 'recovery', personal: 'personal', extracurricular: 'social' };
const LEGEND = [['academic', 'Study task'], ['career', 'Lecture'], ['work', 'Work'], ['recovery', 'Rest / protected'], ['personal', 'Personal']];
const STRESS_WORD = { LOW: 'Low', MODERATE: 'Medium', HIGH: 'High' };

const monday = (d = new Date()) => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();
const hm = (text) => { const [h, m] = text.split(':').map(Number); return h * 60 + m; };     // "09:30:00" -> 570

// All blocks of this week: {day 0-6, startMin, endMin, title, kind, task?}
function weekBlocks(tasks, commitments, weekStart) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
    const blocks = [];
    for (const t of tasks) {
        if (!t.scheduled_start) continue;
        const s = new Date(utcMs(t.scheduled_start));
        if (s < weekStart || s >= weekEnd) continue;
        blocks.push({ day: (s.getDay() + 6) % 7, startMin: minutesOfDay(s), endMin: minutesOfDay(s) + t.estimated_minutes,
                      title: t.title, kind: 'task', task: t });
    }
    for (const c of commitments) {
        if (c.is_recurring) {                                   // weekly, times are Sri Lanka clock times
            blocks.push({ day: c.weekday, startMin: hm(c.start_time), endMin: hm(c.end_time), title: c.title, kind: c.kind });
        } else if (c.start_at) {
            const s = new Date(utcMs(c.start_at)), e = new Date(utcMs(c.end_at));
            if (s >= weekStart && s < weekEnd)
                blocks.push({ day: (s.getDay() + 6) % 7, startMin: minutesOfDay(s), endMin: minutesOfDay(s) + (e - s) / 60000, title: c.title, kind: c.kind });
        }
    }
    return blocks;
}

export function Scheduler() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState(null);
    const [commitments, setCommitments] = useState([]);
    const [stress, setStress] = useState(null);
    const [failed, setFailed] = useState(false);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const load = () => {
        setFailed(false);
        Promise.all([listTasks(), listCommitments()])
            .then(([t, c]) => { setTasks(t); setCommitments(c); })
            .catch(() => setFailed(true));
        getStressStatus().then(setStress).catch(() => {});
    };
    useEffect(load, [reloadKey]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (failed) return <ErrorState onRetry={load}/>;
    if (!tasks) return <LoadingState label="Loading your week…"/>;

    const weekStart = monday();
    const todayIndex = (new Date().getDay() + 6) % 7;
    const blocks = weekBlocks(tasks, commitments, weekStart);
    const taskBlocks = blocks.filter((b) => b.kind === 'task');
    const doneCount = taskBlocks.filter((b) => b.task.status === 'done').length;
    const level = stress?.level ? STRESS_WORD[stress.level] : null;
    const style = stressStyles[level ?? 'Low'];

    const act = (request) => {
        setError('');
        request.then(() => { setSelected(null); setReloadKey((k) => k + 1); }).catch((e) => setError(apiErrorMessage(e)));
    };
    const isMissed = (t) => isOpen(t) && t.scheduled_start && utcMs(t.scheduled_start) + t.estimated_minutes * 60000 < Date.now();

    return (<div className="space-y-6">
      <PageHeader title="Smart Schedule" subtitle={`This week: ${taskBlocks.length} planned study sessions · ${doneCount} completed. Your schedule adapts to your focus and stress.`}/>

      {/* Wellbeing banner - Component 4's signal and what we do with it (the student decides) */}
      {stress &&
        <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate('/app/schedule/adjusted')} className={cn('w-full text-left rounded-3xl border p-5 flex items-center gap-4 transition-colors hover:brightness-[0.98]', style.bg, style.border)}>
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', style.dot)}/>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', style.text)}>{level ? `Wellbeing signal: ${level}` : 'No wellbeing signal'}</p>
          <p className="text-base font-semibold text-charcoal mt-0.5 leading-snug">{stress.reason}</p>
        </div>
        {stress.action === 'propose_changes' &&
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-charcoal shrink-0">
            See suggestions <ArrowRightIcon size={15}/>
          </span>}
      </motion.button>}

      {/* Week progress */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-charcoal">Week progress</p>
          <span className="text-sm font-extrabold text-brand-600">{doneCount} / {taskBlocks.length}</span>
        </div>
        <ProgressBar value={taskBlocks.length ? doneCount / taskBlocks.length * 100 : 0} height={10}/>
      </Card>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <PlannedTasks reloadKey={reloadKey}/>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {LEGEND.map(([cat, label]) => <span key={cat} className="inline-flex items-center gap-2 text-xs font-semibold text-charcoal-muted">
            <span className={cn('w-3 h-3 rounded-md', categoryStyles[cat].dot)}/>
            {label}
          </span>)}
      </div>

      {/* Week grid */}
      <Card padding="sm">
        <div className="overflow-x-auto no-scrollbar">
          <div className="min-w-[720px]">
            <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div />
              {DAYS.map((d, i) => <div key={d} className="text-center pb-2">
                  <p className={cn('text-sm font-bold', i === todayIndex ? 'text-brand-600' : 'text-charcoal')}>{d}</p>
                  {i === todayIndex && <span className="text-[10px] font-semibold text-brand-500">Today</span>}
                </div>)}
            </div>

            <div className="relative grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              {HOURS.map((h) => <React.Fragment key={h}>
                  <div className="text-[11px] font-medium text-charcoal-muted pr-2 text-right h-16 pt-1">{h}</div>
                  {DAYS.map((_, di) => <div key={di} className="border-t border-l border-black/[0.05] h-16 relative first:border-l-0"/>)}
                </React.Fragment>)}

              {blocks.map((b, i) => {
                const start = Math.max(b.startMin, FIRST_HOUR * 60), end = Math.min(b.endMin, LAST_HOUR * 60);
                if (end <= start) return null;                          // outside 06:00-24:00
                const cat = categoryStyles[KIND_STYLE[b.kind] ?? 'personal'];
                const colW = `calc((100% - 56px) / 7)`;
                const px = (min) => (min - FIRST_HOUR * 60) / (ROW_HOURS * 60) * ROW_PX;
                return (<div key={i} onClick={() => b.task && setSelected(b.task)} title={`${b.title} · ${formatMinutes(b.endMin - b.startMin)}`}
                    className={cn('absolute rounded-xl border p-1.5 overflow-hidden', cat.bg, cat.ring, b.task && 'cursor-pointer', b.task?.status === 'done' && 'opacity-50')}
                    style={{ left: `calc(56px + ${b.day} * ${colW})`, top: `${px(start)}px`, width: `calc(${colW} - 6px)`,
                             height: `${Math.max(px(end) - px(start) - 4, 18)}px`, marginLeft: '3px' }}>
                    <p className={cn('text-[11px] font-bold leading-tight truncate', cat.text, b.task?.status === 'done' && 'line-through')}>{b.title}</p>
                    <p className="text-[9px] text-charcoal-muted font-medium">{formatMinutes(Math.round(b.endMin - b.startMin))}</p>
                  </div>);
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Study sessions by day - tap to complete, reschedule or unplan */}
      <div>
        <SectionTitle title="Study sessions" subtitle="Tap a session to mark it complete, reschedule or take it off the plan." action={<Button variant="outline" size="sm" onClick={() => navigate('/app/schedule/attention')}>
              <BrainIcon size={15}/> Best study times
            </Button>}/>
        {taskBlocks.length === 0 ?
          <Card padding="lg"><p className="text-sm text-charcoal-muted">No study sessions planned this week yet. Use “Find a time” on a task to plan one.</p></Card> :
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((day, di) => {
              const dayBlocks = taskBlocks.filter((b) => b.day === di).sort((a, b) => a.startMin - b.startMin);
              if (!dayBlocks.length) return null;
              return (<Card key={day} padding="lg" className="h-full">
                <h3 className="font-bold text-charcoal mb-3">{day}{di === todayIndex && ' · Today'}</h3>
                <div className="space-y-2">
                  {dayBlocks.map(({ task: t }) => {
                      const s = new Date(utcMs(t.scheduled_start));
                      const e = new Date(s.getTime() + t.estimated_minutes * 60000);
                      const time = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                      return <button key={t.id} onClick={() => setSelected(t)} className={cn('w-full text-left rounded-2xl bg-cream p-3 hover:bg-black/[0.04] transition-colors', t.status === 'done' && 'opacity-55')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-charcoal-muted tabular-nums">{time(s)} – {time(e)}</span>
                        <LoadBadge load={LOAD_LABEL[t.cognitive_load]}/>
                      </div>
                      <p className={cn('text-sm font-bold text-charcoal mt-1', t.status === 'done' && 'line-through')}>{t.title}</p>
                      {isMissed(t) && <span className="text-[11px] font-bold text-brand-600">Missed · tap to reschedule</span>}
                    </button>;
                  })}
                </div>
              </Card>);
          })}
        </div>}
      </div>

      {/* Session action sheet */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected &&
            <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LoadBadge load={LOAD_LABEL[selected.cognitive_load]}/>
              <span className="text-sm font-semibold text-charcoal-muted">{formatMinutes(selected.estimated_minutes)}</span>
            </div>
            {isOpen(selected) ?
              <div className="space-y-2">
                <Button fullWidth size="lg" onClick={() => act(finishTask(selected.id))}>
                  <CheckIcon size={17}/> Mark Complete
                </Button>
                <Button fullWidth size="lg" variant="outline" onClick={() => navigate(`/app/schedule/missed?id=${selected.id}`)}>
                  <ClockIcon size={16}/> Reschedule
                </Button>
                <Button fullWidth size="lg" variant="ghost" onClick={() => act(updateTask(selected.id, { scheduled_start: null }))}>
                  <SkipForwardIcon size={16}/> Take off the plan
                </Button>
              </div> :
              <p className="text-sm text-charcoal-muted">This task is {selected.status}.</p>}
            <p className="text-xs text-charcoal-muted text-center">Skipping is fine. Plan it again any time before the deadline.</p>
          </div>}
      </Modal>
    </div>);
}
