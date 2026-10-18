// SMART SCHEDULE - the next 7 days from the API:
//   * "Plan my week" pieces (CP-SAT scheduler, Module D) - heavy work in the M1 best hours
//   * tasks the student planned by hand (scheduled_start, no pieces)
//   * commitments (lectures, work, protected rest blocks)
// plus the wellbeing banner (Component 4 signal) and progress for these 7 days.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, ClockIcon, SkipForwardIcon, BrainIcon, SparklesIcon, PlayIcon, AlertTriangleIcon } from 'lucide-react';
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
import { finishTask, getAttentionProfile, getPlan, getStressStatus, listCommitments, listTasks, planMyWeek, updateTask, utcMs } from '../api';
import { LOAD_LABEL, hoursLabel, isOpen, stressStyles } from '../lib';
import { cn } from '../../../shared/lib/cn';

const DAY_COUNT = 7;
const FIRST_HOUR = 6, LAST_HOUR = 24, ROW_HOURS = 2, ROW_PX = 64;          // grid 06:00 - 24:00
const HOURS = Array.from({ length: (LAST_HOUR - FIRST_HOUR) / ROW_HOURS }, (_, i) => `${String(FIRST_HOUR + i * ROW_HOURS).padStart(2, '0')}:00`);

// What each kind of block looks like (colours from the shared category styles)
const KIND_STYLE = { task: 'academic', lecture: 'career', work: 'work', protected_block: 'recovery', personal: 'personal', extracurricular: 'social' };
const LEGEND = [['academic', 'Study task'], ['career', 'Lecture'], ['work', 'Work'], ['recovery', 'Rest / protected'], ['personal', 'Personal']];
const STRESS_WORD = { LOW: 'Low', MODERATE: 'Medium', HIGH: 'High' };
const ATTENTION_WORD = { m1_model: 'your M1 focus pattern', survey: 'the study hours you told us', none: 'the earliest free time' };

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();
const hm = (text) => { const [h, m] = text.split(':').map(Number); return h * 60 + m; };     // "09:30:00" -> 570
const time = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// All blocks of the 7 days: {day 0-6, start, end (Date), title, kind, task?, piece?}
function weekBlocks(tasks, plan, commitments, firstDay) {
    const lastDay = new Date(firstDay.getTime() + DAY_COUNT * 86400000);
    const dayOf = (d) => Math.floor((d - firstDay) / 86400000);
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const blocks = [];

    // 1. pieces from "Plan my week"
    const planned = new Set();
    for (const p of plan) {
        const s = new Date(utcMs(p.start)), e = new Date(utcMs(p.end));
        planned.add(p.task_id);
        if (s >= firstDay && s < lastDay && byId[p.task_id])
            blocks.push({ day: dayOf(s), start: s, end: e, title: p.title, kind: 'task', task: byId[p.task_id], piece: p });
    }
    // 2. tasks planned by hand (no pieces)
    for (const t of tasks) {
        if (!t.scheduled_start || planned.has(t.id)) continue;
        const s = new Date(utcMs(t.scheduled_start));
        if (s >= firstDay && s < lastDay)
            blocks.push({ day: dayOf(s), start: s, end: new Date(s.getTime() + t.estimated_minutes * 60000), title: t.title, kind: 'task', task: t });
    }
    // 3. commitments (weekly ones are Sri Lanka clock times on a weekday)
    for (const c of commitments) {
        if (c.is_recurring) {
            for (let i = 0; i < DAY_COUNT; i++) {
                const day = new Date(firstDay.getTime() + i * 86400000);
                if ((day.getDay() + 6) % 7 !== c.weekday) continue;
                const at = (min) => new Date(day.getTime() + min * 60000);
                blocks.push({ day: i, start: at(hm(c.start_time)), end: at(hm(c.end_time)), title: c.title, kind: c.kind });
            }
        } else if (c.start_at) {
            const s = new Date(utcMs(c.start_at)), e = new Date(utcMs(c.end_at));
            if (s >= firstDay && s < lastDay) blocks.push({ day: dayOf(s), start: s, end: e, title: c.title, kind: c.kind });
        }
    }
    return blocks;
}

export function Scheduler() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState(null);
    const [plan, setPlan] = useState([]);
    const [commitments, setCommitments] = useState([]);
    const [stress, setStress] = useState(null);
    const [peaks, setPeaks] = useState([]);                 // M1 best hours, e.g. [21, 20, 16]
    const [failed, setFailed] = useState(false);
    const [selected, setSelected] = useState(null);         // a block of a task
    const [error, setError] = useState('');
    const [planning, setPlanning] = useState(false);
    const [result, setResult] = useState(null);             // answer of the last "Plan my week"
    const [reloadKey, setReloadKey] = useState(0);

    const load = () => {
        setFailed(false);
        Promise.all([listTasks(), listCommitments(), getPlan()])
            .then(([t, c, p]) => { setTasks(t); setCommitments(c); setPlan(p.sessions); })
            .catch(() => setFailed(true));
        getStressStatus().then(setStress).catch(() => {});
        getAttentionProfile().then((p) => setPeaks(p.source === 'm1_model' ? p.peak_hours : [])).catch(() => {});
    };
    useEffect(load, [reloadKey]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (failed) return <ErrorState onRetry={load}/>;
    if (!tasks) return <LoadingState label="Loading your week…"/>;

    const firstDay = startOfToday();
    const days = Array.from({ length: DAY_COUNT }, (_, i) => new Date(firstDay.getTime() + i * 86400000));
    const blocks = weekBlocks(tasks, plan, commitments, firstDay);
    const taskBlocks = blocks.filter((b) => b.kind === 'task');
    const doneCount = taskBlocks.filter((b) => b.task.status === 'done').length;
    const level = stress?.level ? STRESS_WORD[stress.level] : null;
    const style = stressStyles[level ?? 'Low'];

    const act = (request) => {
        setError('');
        request.then(() => { setSelected(null); setReloadKey((k) => k + 1); }).catch((e) => setError(apiErrorMessage(e)));
    };
    const runPlanner = () => {
        setError(''); setPlanning(true);
        planMyWeek()
            .then((r) => { setResult(r); setReloadKey((k) => k + 1); })
            .catch((e) => setError(apiErrorMessage(e)))
            .finally(() => setPlanning(false));
    };
    const isMissed = (b) => isOpen(b.task) && b.end.getTime() < Date.now();
    const inPeak = (b) => !!b.piece && peaks.includes(b.start.getHours());     // placed in an M1 best hour

    return (<div className="space-y-6">
      <PageHeader title="Smart Schedule"
          subtitle={`Next 7 days: ${taskBlocks.length} planned study sessions · ${doneCount} completed. Your schedule adapts to your focus and stress.`}
          action={<Button onClick={runPlanner} disabled={planning}>
              <SparklesIcon size={16}/> {planning ? 'Planning…' : 'Plan my week'}
            </Button>}/>

      {/* What the planner just did - and anything it could not fit */}
      {result && <PlanResult result={result} onClose={() => setResult(null)}/>}

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

      {/* Progress over the 7 days */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-charcoal">Progress (next 7 days)</p>
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
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal-muted">🔥 In your best focus hours</span>
      </div>

      {/* Grid of the next 7 days */}
      <Card padding="sm">
        <div className="overflow-x-auto no-scrollbar">
          <div className="min-w-[720px]">
            <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div />
              {days.map((d, i) => <div key={i} className="text-center pb-2">
                  <p className={cn('text-sm font-bold', i === 0 ? 'text-brand-600' : 'text-charcoal')}>{d.toLocaleDateString([], { weekday: 'short' })}</p>
                  <span className={cn('text-[10px] font-semibold', i === 0 ? 'text-brand-500' : 'text-charcoal-muted')}>
                    {i === 0 ? 'Today' : d.toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </span>
                </div>)}
            </div>

            <div className="relative grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              {HOURS.map((h) => <React.Fragment key={h}>
                  <div className="text-[11px] font-medium text-charcoal-muted pr-2 text-right h-16 pt-1">{h}</div>
                  {days.map((_, di) => <div key={di} className="border-t border-l border-black/[0.05] h-16 relative first:border-l-0"/>)}
                </React.Fragment>)}

              {blocks.map((b, i) => {
                const start = Math.max(minutesOfDay(b.start), FIRST_HOUR * 60);
                const end = Math.min(minutesOfDay(b.start) + (b.end - b.start) / 60000, LAST_HOUR * 60);
                if (end <= start) return null;                          // outside 06:00-24:00
                const cat = categoryStyles[KIND_STYLE[b.kind] ?? 'personal'];
                const colW = `calc((100% - 56px) / 7)`;
                const px = (min) => (min - FIRST_HOUR * 60) / (ROW_HOURS * 60) * ROW_PX;
                const done = b.task?.status === 'done';
                const peak = inPeak(b);
                return (<div key={i} onClick={() => b.task && setSelected(b)} title={blockTitle(b)}
                    className={cn('absolute rounded-xl border p-1.5 overflow-hidden', cat.bg, cat.ring, b.task && 'cursor-pointer', done && 'opacity-50')}
                    style={{ left: `calc(56px + ${b.day} * ${colW})`, top: `${px(start)}px`, width: `calc(${colW} - 6px)`,
                             height: `${Math.max(px(end) - px(start) - 4, 18)}px`, marginLeft: '3px' }}>
                    <p className={cn('text-[11px] font-bold leading-tight truncate', cat.text, done && 'line-through')}>
                      {peak && '🔥 '}{b.title}
                    </p>
                    <p className="text-[9px] text-charcoal-muted font-medium">
                      {formatMinutes(Math.round((b.end - b.start) / 60000))}{b.piece && b.piece.of > 1 && ` · part ${b.piece.piece}/${b.piece.of}`}
                    </p>
                  </div>);
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Study sessions by day - tap to start, complete, reschedule or unplan */}
      <div>
        <SectionTitle title="Study sessions" subtitle="Tap a session to start it, mark it complete, reschedule or take it off the plan." action={<Button variant="outline" size="sm" onClick={() => navigate('/app/schedule/attention')}>
              <BrainIcon size={15}/> Best study times
            </Button>}/>
        {taskBlocks.length === 0 ?
          <Card padding="lg"><p className="text-sm text-charcoal-muted">No study sessions planned yet. Press “Plan my week” and ThriveU places your tasks in your free time, before each deadline.</p></Card> :
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {days.map((d, di) => {
              const dayBlocks = taskBlocks.filter((b) => b.day === di).sort((a, b) => a.start - b.start);
              if (!dayBlocks.length) return null;
              return (<Card key={di} padding="lg" className="h-full">
                <h3 className="font-bold text-charcoal mb-3">{d.toLocaleDateString([], { weekday: 'short' })}{di === 0 && ' · Today'}</h3>
                <div className="space-y-2">
                  {dayBlocks.map((b, i) => <button key={i} onClick={() => setSelected(b)} className={cn('w-full text-left rounded-2xl bg-cream p-3 hover:bg-black/[0.04] transition-colors', b.task.status === 'done' && 'opacity-55')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-charcoal-muted tabular-nums">{time(b.start)} – {time(b.end)}</span>
                        <LoadBadge load={LOAD_LABEL[b.task.cognitive_load]}/>
                      </div>
                      <p className={cn('text-sm font-bold text-charcoal mt-1', b.task.status === 'done' && 'line-through')}>{b.title}</p>
                      {b.piece && <p className="text-[11px] font-semibold text-charcoal-muted mt-0.5">
                          {b.piece.of > 1 && `Part ${b.piece.piece} of ${b.piece.of}`}
                          {b.piece.chance != null && `${b.piece.of > 1 ? ' · ' : ''}${Math.round(b.piece.chance * 100)}% focus chance${inPeak(b) ? ' 🔥 best hours' : ''}`}
                        </p>}
                      {isMissed(b) && <span className="text-[11px] font-bold text-brand-600">Missed · tap to reschedule</span>}
                    </button>)}
                </div>
              </Card>);
          })}
        </div>}
      </div>

      {/* Session action sheet */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected &&
            <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <LoadBadge load={LOAD_LABEL[selected.task.cognitive_load]}/>
              <span className="text-sm font-semibold text-charcoal-muted">
                {time(selected.start)} – {time(selected.end)}{selected.piece?.of > 1 && ` · part ${selected.piece.piece} of ${selected.piece.of}`}
              </span>
            </div>
            {selected.piece?.chance != null && <p className="text-sm text-charcoal-muted">
                The AI placed this here because you have about a <b>{Math.round(selected.piece.chance * 100)}%</b> chance of finishing a session at this time.
              </p>}
            {isOpen(selected.task) ?
              <div className="space-y-2">
                <Button fullWidth size="lg" onClick={() => navigate('/app/focus/setup', { state: { taskId: selected.task.id } })}>
                  <PlayIcon size={16}/> Start focus session
                </Button>
                <Button fullWidth size="lg" variant="outline" onClick={() => act(finishTask(selected.task.id))}>
                  <CheckIcon size={17}/> Mark task complete
                </Button>
                <Button fullWidth size="lg" variant="outline" onClick={() => navigate(`/app/schedule/missed?id=${selected.task.id}`)}>
                  <ClockIcon size={16}/> Reschedule
                </Button>
                <Button fullWidth size="lg" variant="ghost" onClick={() => act(updateTask(selected.task.id, { scheduled_start: null }))}>
                  <SkipForwardIcon size={16}/> Take off the plan
                </Button>
              </div> :
              <p className="text-sm text-charcoal-muted">This task is {selected.task.status}.</p>}
            <p className="text-xs text-charcoal-muted text-center">Moving a task by hand replaces its AI-planned parts. Plan again any time.</p>
          </div>}
      </Modal>
    </div>);
}

function blockTitle(b) {
    const length = formatMinutes(Math.round((b.end - b.start) / 60000));
    const chance = b.piece?.chance != null ? ` · ${Math.round(b.piece.chance * 100)}% focus chance` : '';
    return `${b.title} · ${length}${chance}`;
}

// Summary of the last "Plan my week": what was placed, how, and what did not fit
function PlanResult({ result, onClose }) {
    const heavy = result.sessions.filter((s) => s.load === 'heavy');
    const heavyGood = heavy.filter((s) => result.peak_hours.includes(new Date(utcMs(s.start)).getHours())).length;
    return (<Card padding="lg" className="border border-brand-100 bg-brand-50/60">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shrink-0"><SparklesIcon size={18}/></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-charcoal">Planned {result.sessions.length} study sessions for the next 7 days</p>
          <p className="text-sm text-charcoal-muted mt-0.5">
            {result.focus_minutes}-minute parts with {result.break_minutes}-minute breaks, placed using {ATTENTION_WORD[result.attention_source] ?? 'your free time'}
            {result.mode === 'static' && ' (standard plan)'} · around lectures and before every deadline · {(result.latency_ms / 1000).toFixed(1)} s
          </p>
          {heavy.length > 0 && result.peak_hours.length > 0 &&
            <p className="text-sm font-semibold text-brand-700 mt-2">
              🔥 {heavyGood} of {heavy.length} heavy parts are in your best focus hours ({hoursLabel(result.peak_hours)}).
            </p>}
          {result.unplaced.length > 0 &&
            <div className="mt-3 rounded-2xl bg-white p-3 space-y-1">
              {result.unplaced.map((u) => <p key={u.task_id} className="text-sm text-charcoal flex items-start gap-2">
                  <AlertTriangleIcon size={15} className="text-amber-500 mt-0.5 shrink-0"/>
                  <span><b>{u.title}</b>: {formatMinutes(u.minutes)} did not fit. {u.reason}. Move the deadline, free some time or split the task.</span>
                </p>)}
            </div>}
        </div>
        <button onClick={onClose} className="text-xs font-bold text-charcoal-muted hover:text-charcoal">Close</button>
      </div>
    </Card>);
}
