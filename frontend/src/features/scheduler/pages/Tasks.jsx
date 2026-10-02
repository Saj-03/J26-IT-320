import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SearchIcon, SlidersHorizontalIcon, ArrowUpDownIcon, PlusIcon, SparklesIcon, ArrowRightIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { TaskCard } from '../components/TaskCard';
import { LoadBadge } from '../components/PlanPrimitives';
import { EmptyState } from '../../../shared/components/ui/States';
// [ITEM 8] Tasks come from data.js (same list as the Scheduler page), no backend yet
import { mainTask, subtasks, schedulerTasks } from '../data';
import { cn } from '../../../shared/lib/cn';
const tabs = ['All', 'Today', 'Upcoming', 'Completed', 'Overdue'];
const sourceCategory = { career: 'career', physical: 'personal' };
// Backend Task -> the shape TaskCard renders
function toCard(t) {
    const deadline = new Date(t.deadline);
    const start = t.scheduled_start ? new Date(t.scheduled_start) : null;
    const status = t.status === 'done' ? 'completed' : deadline < new Date() || t.status === 'missed' ? 'overdue' : 'scheduled';
    return {
        id: t.id,
        title: t.title,
        subject: `${t.cognitive_load} effort`,
        category: sourceCategory[t.source] || 'academic',
        priority: t.priority >= 4 ? 'high' : t.priority === 3 ? 'medium' : 'low',
        status,
        durationMins: t.estimated_minutes,
        deadline: `Due ${deadline.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`,
        scheduledTime: start?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        scheduledDay: start?.toLocaleDateString(undefined, { weekday: 'short' }),
        isToday: start?.toDateString() === new Date().toDateString()
    };
}
function filterTasks(tasks, tab, q) {
    let list = tasks;
    if (tab === 'Today')
        list = tasks.filter((t) => t.isToday && t.status !== 'completed');
    else if (tab === 'Upcoming')
        list = tasks.filter((t) => t.status === 'scheduled');
    else if (tab === 'Completed')
        list = tasks.filter((t) => t.status === 'completed');
    else if (tab === 'Overdue')
        list = tasks.filter((t) => t.status === 'overdue');
    if (q)
        list = list.filter((t) => (t.title + t.subject).toLowerCase().includes(q.toLowerCase()));
    return list;
}
export function Tasks() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('All');
    const [q, setQ] = useState('');
    const tasks = schedulerTasks.map(toCard);
    const list = filterTasks(tasks, tab, q);
    return (<div className="space-y-6">
      <PageHeader title="Tasks" subtitle="Everything on your plate — grouped, prioritised and scheduled for you." action={<Button onClick={() => navigate('/app/add-task')}>
            <PlusIcon size={16}/> Add task
          </Button>}/>

      {/* In-progress task, already broken into steps */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card padding="lg">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-700 bg-brand-50 rounded-full px-2.5 py-1">
                  <SparklesIcon size={11}/> Broken into {subtasks.length} steps
                </span>
                <span className="text-xs font-semibold text-charcoal-muted">Due {mainTask.deadline}</span>
              </div>
              <h3 className="text-lg font-extrabold text-charcoal mt-2">{mainTask.title}</h3>
              <p className="text-sm text-charcoal-muted mt-0.5">{mainTask.description}</p>

              <div className="mt-4 max-w-md">
                <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
                  <span>
                    {subtasks.filter((s) => s.status === 'done').length} of {subtasks.length} steps done
                  </span>
                  <span>{mainTask.progress}%</span>
                </div>
                <ProgressBar value={mainTask.progress}/>
              </div>
            </div>

            <div className="lg:w-64 shrink-0 space-y-2">
              {subtasks.slice(0, 3).map((s) => <div key={s.id} className="flex items-center gap-2 rounded-2xl bg-cream px-3 py-2">
                  <span className="text-xs font-bold text-charcoal truncate flex-1">{s.title}</span>
                  <LoadBadge load={s.load}/>
                </div>)}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate('/app/tasks/breakdown')}>
                  Edit steps
                </Button>
                <Button size="sm" className="flex-1" onClick={() => navigate('/app/tasks/detail')}>
                  Open <ArrowRightIcon size={13}/>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white rounded-full pl-4 pr-2 py-2.5 border border-black/[0.05] shadow-soft flex-1">
          <SearchIcon size={16} className="text-charcoal-muted"/>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="bg-transparent text-sm outline-none flex-1 placeholder:text-charcoal-muted text-charcoal"/>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md">
            <SlidersHorizontalIcon size={15}/> Filter
          </Button>
          <Button variant="outline" size="md">
            <ArrowUpDownIcon size={15}/> Sort
          </Button>
        </div>
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
            <EmptyState title="Nothing here yet" desc="You’re all caught up in this view. Add a task and IHSD will find the best time for it." actionLabel="Add a task" onAction={() => navigate('/app/add-task')}/> :
            <div className="grid md:grid-cols-2 gap-4">
          {list.map((t) => <TaskCard key={t.id} task={t} onStart={() => navigate('/app/focus/setup')}/>)}
        </div>}
    </div>);
}
