import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SearchIcon, PlusIcon, SparklesIcon, ArrowRightIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/components/ui/States';
import { TaskCard } from '../components/TaskCard';
import { LoadBadge } from '../components/PlanPrimitives';
import { listTasks } from '../api';
import { LOAD_LABEL, dayText, isOpen, priorityWord, sameDay, toDate, timeText } from '../lib';
import { cn } from '../../../shared/lib/cn';

const tabs = ['All', 'Today', 'Upcoming', 'Completed', 'Overdue'];
const sourceCategory = { career: 'career', physical: 'personal' };

// Backend Task -> the shape TaskCard renders
function toCard(t) {
    const deadline = toDate(t.deadline);
    const start = toDate(t.scheduled_start);
    const status = t.status === 'done' ? 'completed' : deadline < new Date() || t.status === 'missed' ? 'overdue' : 'scheduled';
    return {
        id: t.id,
        title: t.title,
        subject: `${LOAD_LABEL[t.cognitive_load]} effort${t.load_set_by_student ? '' : t.load_confidence ? ' · AI' : ''}`,
        category: sourceCategory[t.source] || 'academic',
        priority: priorityWord(t.priority),
        status,
        durationMins: t.estimated_minutes,
        deadline: `Due ${dayText(t.deadline)}`,
        scheduledTime: start ? timeText(t.scheduled_start) : null,
        scheduledDay: start?.toLocaleDateString([], { weekday: 'short' }),
        isToday: sameDay(start, new Date())
    };
}

function filterTasks(tasks, tab, q) {
    let list = tasks;
    if (tab === 'Today') list = tasks.filter((t) => t.isToday && t.status !== 'completed');
    else if (tab === 'Upcoming') list = tasks.filter((t) => t.status === 'scheduled');
    else if (tab === 'Completed') list = tasks.filter((t) => t.status === 'completed');
    else if (tab === 'Overdue') list = tasks.filter((t) => t.status === 'overdue');
    if (q) list = list.filter((t) => (t.title + t.subject).toLowerCase().includes(q.toLowerCase()));
    return list;
}

export function Tasks() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('All');
    const [q, setQ] = useState('');
    const [all, setAll] = useState(null);
    const [failed, setFailed] = useState(false);

    const load = () => {
        setFailed(false);
        listTasks().then(setAll).catch(() => setFailed(true));
    };
    useEffect(load, []);

    if (failed) return <ErrorState onRetry={load}/>;
    if (!all) return <LoadingState label="Loading your tasks…"/>;

    // Big tasks with steps (subtasks) -> the "in progress" card shows the nearest open one
    const stepsOf = (id) => all.filter((t) => t.parent_id === id);
    const featured = all.filter((t) => !t.parent_id && isOpen(t) && stepsOf(t.id).length)[0];
    const steps = featured ? stepsOf(featured.id) : [];
    const stepsDone = steps.filter((s) => s.status === 'done').length;

    const tasks = all.filter((t) => !t.parent_id).map(toCard);     // steps are shown inside their task
    const list = filterTasks(tasks, tab, q);

    return (<div className="space-y-6">
      <PageHeader title="Tasks" subtitle="Everything on your plate — grouped, prioritised and scheduled for you." action={<Button onClick={() => navigate('/app/add-task')}>
            <PlusIcon size={16}/> Add task
          </Button>}/>

      {/* A task already broken into steps */}
      {featured &&
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card padding="lg">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-700 bg-brand-50 rounded-full px-2.5 py-1">
                  <SparklesIcon size={11}/> Broken into {steps.length} steps
                </span>
                <span className="text-xs font-semibold text-charcoal-muted">Due {dayText(featured.deadline)}</span>
              </div>
              <h3 className="text-lg font-extrabold text-charcoal mt-2">{featured.title}</h3>
              {featured.description && <p className="text-sm text-charcoal-muted mt-0.5">{featured.description}</p>}

              <div className="mt-4 max-w-md">
                <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
                  <span>{stepsDone} of {steps.length} steps done</span>
                  <span>{Math.round(stepsDone / steps.length * 100)}%</span>
                </div>
                <ProgressBar value={stepsDone / steps.length * 100}/>
              </div>
            </div>

            <div className="lg:w-64 shrink-0 space-y-2">
              {steps.slice(0, 3).map((s) => <div key={s.id} className="flex items-center gap-2 rounded-2xl bg-cream px-3 py-2">
                  <span className="text-xs font-bold text-charcoal truncate flex-1">{s.title}</span>
                  <LoadBadge load={LOAD_LABEL[s.cognitive_load]}/>
                </div>)}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/app/tasks/breakdown?id=${featured.id}`)}>
                  Edit steps
                </Button>
                <Button size="sm" className="flex-1" onClick={() => navigate(`/app/tasks/detail?id=${featured.id}`)}>
                  Open <ArrowRightIcon size={13}/>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>}

      {/* Search */}
      <div className="flex items-center gap-2 bg-white rounded-full pl-4 pr-2 py-2.5 border border-black/[0.05] shadow-soft">
        <SearchIcon size={16} className="text-charcoal-muted"/>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="bg-transparent text-sm outline-none flex-1 placeholder:text-charcoal-muted text-charcoal"/>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {tabs.map((t) => {
            const count = filterTasks(tasks, t, '').length;
            return (<button key={t} onClick={() => setTab(t)} className={cn('shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2', tab === t ? 'bg-charcoal text-white' : 'bg-white text-charcoal-light border border-black/[0.05]')}>
              {t}
              <span className={cn('text-xs px-1.5 rounded-full', tab === t ? 'bg-white/20' : 'bg-black/[0.05]')}>{count}</span>
            </button>);
        })}
      </div>

      {/* List */}
      {list.length === 0 ?
            <EmptyState title="Nothing here yet" desc="You’re all caught up in this view. Add a task and ThriveU will find the best time for it." actionLabel="Add a task" onAction={() => navigate('/app/add-task')}/> :
            <div className="grid md:grid-cols-2 gap-4">
          {list.map((t) => <div key={t.id} onClick={() => navigate(`/app/tasks/detail?id=${t.id}`)} className="cursor-pointer">
              <TaskCard task={t} onStart={(task) => navigate('/app/focus/setup', { state: { taskId: task.id } })}/>
            </div>)}
        </div>}
    </div>);
}
