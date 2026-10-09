import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PlusIcon, PencilIcon, Trash2Icon, ChevronUpIcon, ChevronDownIcon, ArrowDownIcon, CheckIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { Field, SelectField } from '../../../../shared/components/ui/Field';
import { LoadBadge, SectionTitle } from '../../components/PlanPrimitives';
import { subtasks as seed, dependencyChain, mainTask } from '../../data';
export function TaskBreakdown() {
    const navigate = useNavigate();
    const [items, setItems] = useState(seed.map((s) => ({ ...s, status: 'todo' })));
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({ title: '', load: 'Medium', minutes: 30 });
    const move = (index, dir) => {
        const target = index + dir;
        if (target < 0 || target >= items.length)
            return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        setItems(next.map((s, i) => ({ ...s, order: i + 1 })));
    };
    const remove = (id) => setItems((xs) => xs.filter((x) => x.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
    const saveEdit = () => {
        if (!editing)
            return;
        setItems((xs) => xs.map((x) => x.id === editing.id ? editing : x));
        setEditing(null);
    };
    const addSubtask = () => {
        if (!draft.title.trim())
            return;
        setItems((xs) => [
            ...xs,
            { id: `st${Date.now()}`, order: xs.length + 1, title: draft.title.trim(), load: draft.load, minutes: draft.minutes, status: 'todo' }
        ]);
        setDraft({ title: '', load: 'Medium', minutes: 30 });
        setAdding(false);
    };
    const totalMins = items.reduce((s, x) => s + x.minutes, 0);
    return (<div className="space-y-6">
      <PageHeader title="Your Task Has Been Broken Down" subtitle={`${items.length} small steps · about ${Math.floor(totalMins / 60)}h ${totalMins % 60}m in total.`} action={<Button onClick={() => navigate('/app/schedule')}>
            <CheckIcon size={16}/> Create My Schedule
          </Button>}/>

      {/* Main task */}
      <Card padding="lg" className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-600">Main Task</p>
          <h2 className="text-xl font-extrabold text-charcoal mt-0.5">{mainTask.title}</h2>
          <p className="text-sm text-charcoal-muted mt-1">
            {mainTask.subject} · Due {mainTask.deadline}
          </p>
        </div>
        <Button variant="outline" onClick={() => setAdding(true)}>
          <PlusIcon size={16}/> Add subtask
        </Button>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Subtasks */}
        <div className="lg:col-span-2">
          <SectionTitle title="Steps" subtitle="Reorder, edit or remove anything that doesn’t fit."/>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((s, i) => <motion.div key={s.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card padding="sm" className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-cream flex items-center justify-center text-sm font-extrabold text-charcoal-light shrink-0">
                      {i + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-charcoal text-sm leading-snug">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <LoadBadge load={s.load}/>
                        <span className="text-xs font-semibold text-charcoal-muted">{s.minutes} minutes</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-black/[0.04] disabled:opacity-30 transition-colors" aria-label="Move up">
                        <ChevronUpIcon size={16}/>
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-black/[0.04] disabled:opacity-30 transition-colors" aria-label="Move down">
                        <ChevronDownIcon size={16}/>
                      </button>
                      <button onClick={() => setEditing(s)} className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-black/[0.04] transition-colors" aria-label={`Edit ${s.title}`}>
                        <PencilIcon size={14}/>
                      </button>
                      <button onClick={() => remove(s.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-brand-50 hover:text-brand-600 transition-colors" aria-label={`Delete ${s.title}`}>
                        <Trash2Icon size={14}/>
                      </button>
                    </div>
                  </Card>
                </motion.div>)}
            </AnimatePresence>
          </div>
        </div>

        {/* Dependencies */}
        <Card padding="lg" className="h-fit">
          <SectionTitle title="Order that matters" subtitle="Some steps need the one before them."/>
          <div className="space-y-1">
            {dependencyChain.map((d, i) => <React.Fragment key={d}>
                <div className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-charcoal">{d}</div>
                {i < dependencyChain.length - 1 &&
                <div className="flex justify-center py-0.5">
                    <ArrowDownIcon size={15} className="text-charcoal-muted"/>
                  </div>}
              </React.Fragment>)}
          </div>
        </Card>
      </div>

      <Button size="lg" fullWidth onClick={() => navigate('/app/schedule')}>
        Create My Schedule
      </Button>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit step">
        {editing &&
            <div className="space-y-4">
            <Field label="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}/>
            <SelectField label="Load" value={editing.load} onChange={(e) => setEditing({ ...editing, load: e.target.value })}>
              <option>Light</option>
              <option>Medium</option>
              <option>Heavy</option>
            </SelectField>
            <Field label="Minutes" type="number" value={editing.minutes} onChange={(e) => setEditing({ ...editing, minutes: Number(e.target.value) })}/>
            <Button fullWidth size="lg" onClick={saveEdit}>
              Save changes
            </Button>
          </div>}
      </Modal>

      {/* Add modal */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a step">
        <div className="space-y-4">
          <Field label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Draft conclusion"/>
          <SelectField label="Load" value={draft.load} onChange={(e) => setDraft({ ...draft, load: e.target.value })}>
            <option>Light</option>
            <option>Medium</option>
            <option>Heavy</option>
          </SelectField>
          <Field label="Minutes" type="number" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}/>
          <Button fullWidth size="lg" onClick={addSubtask}>
            Add step
          </Button>
        </div>
      </Modal>
    </div>);
}
