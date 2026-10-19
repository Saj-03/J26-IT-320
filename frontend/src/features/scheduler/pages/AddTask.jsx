import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WandSparklesIcon, ArrowRightIcon, CheckIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { apiErrorMessage } from '../../../shared/api/client';
import { cn } from '../../../shared/lib/cn';
import { LoadBadge } from '../components/PlanPrimitives';
import DurationCard from '../components/DurationCard';
import BrainDump from '../components/BrainDump';
import { createTask, getAttentionProfile } from '../api';
import { LOAD_LABEL, PRIORITY_NUMBER, dayText, hoursLabel } from '../lib';

// Backend task types (TASK_TYPES in models.py)
const TASK_TYPES = [
    ['assignment', 'Assignment'], ['exam_prep', 'Exam preparation'], ['project', 'Project'],
    ['reading', 'Reading'], ['lecture_review', 'Lecture review'], ['other', 'Other'],
];

// "2026-10-24" from a date input -> end of that day in the student's time, as an ISO string
const endOfDay = (date) => new Date(`${date}T23:59`).toISOString();

export function AddTask() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('manual');
    const [saved, setSaved] = useState(null);          // the task the backend saved
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);      // M1 attention profile (best hours)

    useEffect(() => { getAttentionProfile().then(setProfile).catch(() => {}); }, []);

    // Send one task to the backend. No load chosen -> the M2 model decides.
    const save = (task) => {
        setSaving(true);
        setError('');
        createTask(task)
            .then(setSaved)
            .catch((e) => setError(apiErrorMessage(e)))
            .finally(() => setSaving(false));
    };

    const saveManual = (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
            title: f.get('title'),
            task_type: f.get('type'),
            description: f.get('subject') || null,
            deadline: endOfDay(f.get('deadline')),
            estimated_minutes: Math.round(Number(f.get('hours')) * 60),
            priority: PRIORITY_NUMBER[f.get('priority')],
            cognitive_load: f.get('load') || null,
        });
    };

    const bestTime = profile?.source === 'm1_model' ? hoursLabel(profile.peak_hours.slice(0, 2)) : null;

    // After saving: what the backend (and M2) decided
    const savedCard = saved &&
        <Card padding="lg" className="space-y-4">
          <p className="text-sm font-semibold text-emerald-700 bg-sage-light rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckIcon size={16}/> Task saved: {saved.title} · due {dayText(saved.deadline)}
          </p>
          <div className="flex items-center gap-2 text-sm text-charcoal-light">
            <LoadBadge load={LOAD_LABEL[saved.cognitive_load]}/>
            {saved.load_set_by_student ? 'You chose this effort level.'
                : saved.load_confidence ? `AI read your task as ${saved.cognitive_load} effort (${Math.round(saved.load_confidence * 100)}% sure). You can change it on the task.`
                : 'Effort set to medium - change it on the task if needed.'}
          </div>
          <DurationCard taskId={saved.id}/>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1" onClick={() => navigate('/app/schedule')}>
              <CheckIcon size={16}/> Go to my schedule
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate(`/app/tasks/breakdown?id=${saved.id}`)}>
              <WandSparklesIcon size={16}/> Break it into steps
            </Button>
          </div>
        </Card>;

    return (<div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="What do you need to get done?" subtitle="Add one task, or say your whole day — ThriveU turns it into tasks, events and a plan."/>

      {/* Mode toggle */}
      <div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft w-fit">
        {['manual', 'ai'].map((m) => <button key={m} onClick={() => { setMode(m); setSaved(null); setError(''); }} className={cn('px-5 py-2 rounded-full text-sm font-semibold transition-colors', mode === m ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
            {m === 'ai' ? '🎤 Speak your day' : 'Manual entry'}
          </button>)}
      </div>

      {mode === 'ai' ? <BrainDump/> :
            (saved ? savedCard :
            <Card padding="lg">
          <form className="space-y-4" onSubmit={saveManual}>
            <Field label="Task name" name="title" placeholder="Chemistry Lab Report" required/>
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField label="Task type" name="type" defaultValue="assignment">
                {TASK_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectField>
              <Field label="Subject / notes" name="subject" placeholder="Chemistry"/>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Deadline" name="deadline" type="date" required/>
              <Field label="Duration (hours)" name="hours" type="number" defaultValue={3} min={0.25} step={0.25}/>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField label="Effort" name="load" defaultValue="">
                <option value="">Let AI decide</option>
                <option value="heavy">Heavy</option>
                <option value="medium">Medium</option>
                <option value="low">Light</option>
              </SelectField>
              <SelectField label="Priority" name="priority" defaultValue="medium">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </SelectField>
            </div>
            <Button type="submit" size="lg" fullWidth disabled={saving}>
              {saving ? 'Saving…' : 'Create Task'} <ArrowRightIcon size={18}/>
            </Button>
          </form>
        </Card>)}

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <AIInsightCard title="Best time to work on it">
        {bestTime ?
            <><span className="block font-bold text-charcoal mb-1">{bestTime}</span>From your focus history, this is when you finish sessions most often.</> :
            <>We learn your best focus time after {profile?.min_sessions ?? 5} focus sessions.</>}
      </AIInsightCard>
    </div>);
}
