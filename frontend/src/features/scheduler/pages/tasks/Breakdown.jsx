// BREAK A TASK INTO STEPS. Steps are real subtasks: add / edit / delete go to the backend.
// Opened as /app/tasks/breakdown?id=<task id>. Steps longer than the student's focus capacity (M1) are flagged.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PlusIcon, PencilIcon, Trash2Icon, CheckIcon, AlertTriangleIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { Field, SelectField } from '../../../../shared/components/ui/Field';
import { ErrorState, LoadingState } from '../../../../shared/components/ui/States';
import { LoadPicker, EstimatedTime, SectionTitle, formatMinutes } from '../../components/PlanPrimitives';
import { apiErrorMessage } from '../../../../shared/api/client';
import { createTask, deleteTask, getAttentionProfile, getTask, updateTask } from '../../api';
import { LOAD_LABEL, LOAD_VALUE, dayText } from '../../lib';

const EMPTY_DRAFT = { title: '', load: 'Medium', minutes: 30 };

export function TaskBreakdown() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const id = params.get('id');
    const [task, setTask] = useState(null);
    const [capacity, setCapacity] = useState(null);     // M1: minutes the student can usually focus
    const [failed, setFailed] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState(EMPTY_DRAFT);

    const load = () => {
        setFailed(false);
        getTask(id).then(setTask).catch(() => setFailed(true));
    };
    useEffect(() => {
        if (!id) return navigate('/app/tasks', { replace: true });
        load();
        getAttentionProfile().then((p) => p.source === 'm1_model' && setCapacity(p.capacity_minutes)).catch(() => {});
    }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps

    // Run a backend change, then reload the task
    const run = (request, after) => {
        setError('');
        request.then(() => { after?.(); load(); }).catch((e) => setError(apiErrorMessage(e)));
    };

    if (failed) return <ErrorState onRetry={load}/>;
    if (!task) return <LoadingState label="Loading task…"/>;

    const steps = task.subtasks;
    const totalMins = steps.reduce((s, x) => s + x.estimated_minutes, 0);
    const tooLong = capacity ? steps.filter((s) => s.estimated_minutes > capacity && s.status !== 'done') : [];

    // A step is a subtask: same deadline and priority as its task
    const addStep = () => run(createTask({
        title: draft.title.trim(), parent_id: task.id, deadline: task.deadline + (task.deadline.endsWith('Z') ? '' : 'Z'),
        estimated_minutes: draft.minutes, priority: task.priority, cognitive_load: LOAD_VALUE[draft.load],
    }), () => { setDraft(EMPTY_DRAFT); setAdding(false); });
    const saveEdit = () => run(updateTask(editing.id, {
        title: editing.title, estimated_minutes: editing.estimated_minutes, cognitive_load: editing.cognitive_load,
    }), () => setEditing(null));
    const changeLoad = (step, label) => run(updateTask(step.id, { cognitive_load: LOAD_VALUE[label] }));
    const remove = (step) => run(deleteTask(step.id));

    return (<div className="space-y-6">
      <PageHeader title="Break it into steps" subtitle={`${steps.length} step${steps.length === 1 ? '' : 's'} · about ${formatMinutes(totalMins)} in total.`} action={<Button onClick={() => navigate(`/app/tasks/detail?id=${task.id}`)}>
            <CheckIcon size={16}/> Done
          </Button>}/>

      {/* Main task */}
      <Card padding="lg" className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-600">Main Task</p>
          <h2 className="text-xl font-extrabold text-charcoal mt-0.5">{task.title}</h2>
          <p className="text-sm text-charcoal-muted mt-1">
            {LOAD_LABEL[task.cognitive_load]} effort · Due {dayText(task.deadline)} · estimated {formatMinutes(task.estimated_minutes)}
          </p>
        </div>
        <Button variant="outline" onClick={() => setAdding(true)}>
          <PlusIcon size={16}/> Add step
        </Button>
      </Card>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Steps */}
        <div className="lg:col-span-2">
          <SectionTitle title="Steps" subtitle="Edit or remove anything that doesn’t fit."/>
          {steps.length === 0 &&
            <Card padding="lg"><p className="text-sm text-charcoal-muted">No steps yet. Add the first small step you can finish in one focus session.</p></Card>}
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {steps.map((s, i) => <motion.div key={s.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card padding="sm" className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-cream flex items-center justify-center text-sm font-extrabold text-charcoal-light shrink-0">
                      {s.status === 'done' ? <CheckIcon size={14}/> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-charcoal text-sm leading-snug">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <LoadPicker load={LOAD_LABEL[s.cognitive_load]} label={s.title} onChange={(l) => changeLoad(s, l)}/>
                        <EstimatedTime minutes={s.estimated_minutes}/>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditing({ ...s })} className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-black/[0.04] transition-colors" aria-label={`Edit ${s.title}`}>
                        <PencilIcon size={14}/>
                      </button>
                      <button onClick={() => remove(s)} className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-brand-50 hover:text-brand-600 transition-colors" aria-label={`Delete ${s.title}`}>
                        <Trash2Icon size={14}/>
                      </button>
                    </div>
                  </Card>
                </motion.div>)}
            </AnimatePresence>
          </div>
        </div>

        {/* Step size vs the student's focus capacity (M1) */}
        <Card padding="lg" className="h-fit">
          <SectionTitle title="Step size" subtitle="Small steps are easier to start."/>
          {capacity ?
            <>
              <p className="text-sm text-charcoal-light">You can usually focus for about <b>{capacity} min</b>. Steps longer than that are harder to finish in one go.</p>
              {tooLong.length ?
                <div className="mt-3 space-y-2">
                  {tooLong.map((s) => <p key={s.id} className="flex items-center gap-2 text-sm font-semibold text-brand-700 bg-brand-50 rounded-2xl px-3 py-2">
                      <AlertTriangleIcon size={14}/> {s.title} ({s.estimated_minutes} min)
                    </p>)}
                </div> :
                steps.length > 0 && <p className="mt-3 text-sm font-semibold text-emerald-700">✓ Every step fits your focus capacity.</p>}
            </> :
            <p className="text-sm text-charcoal-muted">After 5 focus sessions we learn how long you can usually focus and check your step sizes.</p>}
        </Card>
      </div>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit step">
        {editing &&
            <div className="space-y-4">
            <Field label="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}/>
            <SelectField label="Effort" value={LOAD_LABEL[editing.cognitive_load]} onChange={(e) => setEditing({ ...editing, cognitive_load: LOAD_VALUE[e.target.value] })}>
              <option>Light</option>
              <option>Medium</option>
              <option>Heavy</option>
            </SelectField>
            <Field label="Minutes" type="number" min={5} value={editing.estimated_minutes} onChange={(e) => setEditing({ ...editing, estimated_minutes: Number(e.target.value) })}/>
            <Button fullWidth size="lg" onClick={saveEdit} disabled={!editing.title.trim() || editing.estimated_minutes < 5}>
              Save changes
            </Button>
          </div>}
      </Modal>

      {/* Add modal */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a step">
        <div className="space-y-4">
          <Field label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Draft conclusion"/>
          <SelectField label="Effort" value={draft.load} onChange={(e) => setDraft({ ...draft, load: e.target.value })}>
            <option>Light</option>
            <option>Medium</option>
            <option>Heavy</option>
          </SelectField>
          <Field label="Minutes" type="number" min={5} value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}/>
          <Button fullWidth size="lg" onClick={addStep} disabled={!draft.title.trim() || draft.minutes < 5}>
            Add step
          </Button>
        </div>
      </Modal>
    </div>);
}
