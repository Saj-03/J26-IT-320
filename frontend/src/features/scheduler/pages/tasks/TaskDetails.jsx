// ONE TASK and its steps (subtasks), from GET /scheduler/tasks/{id}. Opened as /app/tasks/detail?id=...
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarIcon, FlagIcon, ClockIcon, CheckIcon, CalendarDaysIcon, PlayIcon, ListChecksIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { ProgressBar } from '../../../../shared/components/ui/ProgressBar';
import { ErrorState, LoadingState } from '../../../../shared/components/ui/States';
import { LoadPicker, EstimatedTime, SectionTitle, formatMinutes } from '../../components/PlanPrimitives';
import DurationCard from '../../components/DurationCard';
import { apiErrorMessage } from '../../../../shared/api/client';
import { finishTask, getTask, listTasks, updateTask } from '../../api';
import { LOAD_LABEL, LOAD_VALUE, dayText, dueText, isOpen, priorityWord } from '../../lib';
import { cn } from '../../../../shared/lib/cn';

export function TaskDetails() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const id = params.get('id');
    const [task, setTask] = useState(null);
    const [failed, setFailed] = useState(false);
    const [error, setError] = useState('');
    const [others, setOthers] = useState([]);           // tasks this one can wait for (FR-04)

    const load = () => {
        setFailed(false);
        getTask(id).then(setTask).catch(() => setFailed(true));
        listTasks().then((t) => setOthers(t.filter((x) => x.id !== id && x.parent_id !== id && !x.parent_id
            && (isOpen(x) || x.status === 'done')))).catch(() => {});
    };
    useEffect(() => { if (id) load(); else navigate('/app/tasks', { replace: true }); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (failed) return <ErrorState onRetry={load}/>;
    if (!task) return <LoadingState label="Loading task…"/>;

    const steps = task.subtasks;
    const done = steps.filter((s) => s.status === 'done').length;
    const progress = steps.length ? done / steps.length * 100 : task.status === 'done' ? 100 : 0;
    // Work left uses the M3 time when there is one (what the plan uses), minus focus minutes already logged
    const left = (t) => Math.max((t.predicted_minutes || t.estimated_minutes) - (t.actual_minutes || 0), 0);
    const remaining = steps.length
        ? steps.filter((s) => s.status !== 'done').reduce((sum, s) => sum + left(s), 0)
        : (task.status === 'done' ? 0 : left(task));

    // Student changes a step's effort -> saved (and recorded as a correction of the AI)
    const changeLoad = (step, label) =>
        updateTask(step.id, { cognitive_load: LOAD_VALUE[label] }).then(load).catch((e) => setError(apiErrorMessage(e)));
    const markDone = () => finishTask(task.id).then(load).catch((e) => setError(apiErrorMessage(e)));
    // FR-04: "do this after that task" - the planner keeps the order (a loop is refused by the backend)
    const changeAfter = (value) => updateTask(task.id, { after_task_id: value || null }).then(load)
        .catch((e) => setError(apiErrorMessage(e)));
    const waitsFor = others.find((x) => x.id === task.after_task_id);

    return (<div className="space-y-6">
      <PageHeader title={task.title} subtitle={task.description || `${LOAD_LABEL[task.cognitive_load]} effort · ${dueText(task.deadline)}`} action={<div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/app/schedule')}>
              <CalendarDaysIcon size={16}/> View Schedule
            </Button>
            {isOpen(task) && <Button variant="outline" onClick={markDone}><CheckIcon size={16}/> Mark done</Button>}
            {isOpen(task) &&
            <Button onClick={() => navigate('/app/focus/setup', { state: { taskId: task.id } })}>
                <PlayIcon size={15} fill="currentColor"/> Start
              </Button>}
          </div>}/>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      {/* M3: how long it will really take (only for a task without steps that is still open) */}
      {!steps.length && isOpen(task) && <DurationCard taskId={task.id} onChanged={load}/>}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Overview */}
        <Card padding="lg" className="lg:col-span-1">
          <div className="space-y-3">
            {[
            { icon: CalendarIcon, l: 'Deadline', v: dayText(task.deadline) },
            { icon: FlagIcon, l: 'Priority', v: `${priorityWord(task.priority)} (${task.priority}/5)` },
            { icon: ClockIcon, l: 'Remaining', v: formatMinutes(remaining) },
            { icon: ListChecksIcon, l: 'Status', v: task.status.replace('_', ' ') },
        ].map((r) => <div key={r.l} className="flex items-center justify-between">
                <span className="text-sm font-medium text-charcoal-muted flex items-center gap-2">
                  <r.icon size={14}/>
                  {r.l}
                </span>
                <span className="text-sm font-bold text-charcoal capitalize">{r.v}</span>
              </div>)}
          </div>

          {isOpen(task) && !task.parent_id &&
            <label className="mt-4 block">
              <span className="text-sm font-medium text-charcoal-muted">Do after</span>
              <select value={task.after_task_id || ''} onChange={(e) => changeAfter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-charcoal min-h-[44px]">
                <option value="">Any time - no other task first</option>
                {others.map((x) => <option key={x.id} value={x.id}>After “{x.title}”{x.status === 'done' ? ' (done)' : ''}</option>)}
              </select>
              {waitsFor && waitsFor.status !== 'done' &&
                <span className="block text-xs text-charcoal-muted mt-1">Planned only after “{waitsFor.title}” is finished.</span>}
            </label>}

          <div className="mt-5 pt-5 border-t border-black/[0.05]">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-charcoal-muted">Progress</span>
              <span className="font-extrabold text-charcoal">{Math.round(progress)}%</span>
            </div>
            <ProgressBar value={progress} height={10}/>
          </div>
        </Card>

        {/* Steps */}
        <Card padding="lg" className="lg:col-span-2">
          <SectionTitle title="Steps" subtitle={steps.length ? `${done} done, ${steps.length - done} to go.` : 'No steps yet.'} action={<Button size="sm" variant="outline" onClick={() => navigate(`/app/tasks/breakdown?id=${task.id}`)}>
                Edit steps
              </Button>}/>
          {steps.length === 0 &&
            <p className="text-sm text-charcoal-muted">Big task? Break it into small steps you can finish in one focus session.</p>}
          <div className="space-y-2">
            {steps.map((s, i) => {
                const active = s.status === 'in_progress';
                const finished = s.status === 'done';
                return <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={cn('flex items-center gap-3 rounded-2xl p-3.5', active ? 'bg-brand-50 border border-brand-100' : 'bg-cream')}>
                <span className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', finished && 'bg-sage text-white', active && 'bg-brand-500 text-white', !finished && !active && 'bg-white border border-black/[0.08]')}>
                  {finished && <CheckIcon size={14} strokeWidth={3}/>}
                  {active && <span className="w-2 h-2 rounded-full bg-white"/>}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-bold leading-snug', finished ? 'text-charcoal-muted line-through' : 'text-charcoal')}>{s.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {active && <span className="text-xs font-semibold text-brand-600">In Progress</span>}
                    <EstimatedTime minutes={s.estimated_minutes}/>
                  </div>
                </div>
                <LoadPicker load={LOAD_LABEL[s.cognitive_load]} label={s.title} onChange={(l) => changeLoad(s, l)}/>
              </motion.div>;
            })}
          </div>

          <div className="mt-5 rounded-2xl bg-cream px-4 py-3.5 flex items-center justify-between">
            <span className="text-sm font-medium text-charcoal-muted">Estimated Remaining Time</span>
            <span className="text-base font-extrabold text-charcoal">{formatMinutes(remaining)}</span>
          </div>
        </Card>
      </div>
    </div>);
}
