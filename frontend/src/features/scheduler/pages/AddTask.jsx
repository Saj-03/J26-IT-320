import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon, WandSparklesIcon, ArrowRightIcon, CheckIcon, MicIcon, MicOffIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { apiErrorMessage } from '../../../shared/api/client';
import { cn } from '../../../shared/lib/cn';
import { fakeExtract } from '../utils/fakeExtract';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { LoadBadge } from '../components/PlanPrimitives';
import DurationCard from '../components/DurationCard';
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
    const [input, setInput] = useState('');
    const [preview, setPreview] = useState(null);      // fields understood from the sentence
    const [saved, setSaved] = useState(null);          // the task the backend saved
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);      // M1 attention profile (best hours)

    useEffect(() => { getAttentionProfile().then(setProfile).catch(() => {}); }, []);

    // VOICE INPUT  (en-US = English, si-LK = Sinhala)
    const [voiceLang, setVoiceLang] = useState('en-US');
    const textBeforeVoice = useRef('');
    const voice = useVoiceInput({
        lang: voiceLang,
        onText: (spoken) => setInput(textBeforeVoice.current ? `${textBeforeVoice.current} ${spoken}` : spoken)
    });
    const toggleMic = () => {
        if (!voice.listening) textBeforeVoice.current = input.trim();
        voice.toggle();
    };

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

    // Natural language -> fields the student checks before saving
    const generate = () => {
        if (voice.listening) voice.stop();
        const text = input.trim();
        if (text.length < 3) return setError('Type or say your task first.');
        setError('');
        setPreview(fakeExtract(text));
        setSaved(null);
    };
    const editPreview = (field, value) => setPreview((p) => ({ ...p, [field]: value }));
    const confirmPreview = () => save({
        title: preview.title.trim(), deadline: endOfDay(preview.deadline),
        estimated_minutes: preview.minutes, priority: PRIORITY_NUMBER[preview.priority],
    });

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
      <PageHeader title="What do you need to get done?" subtitle="Describe it in plain language — ThriveU turns it into a scheduled task."/>

      {/* Mode toggle */}
      <div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft w-fit">
        {['manual', 'ai'].map((m) => <button key={m} onClick={() => { setMode(m); setSaved(null); setError(''); }} className={cn('px-5 py-2 rounded-full text-sm font-semibold transition-colors', mode === m ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
            {m === 'ai' ? 'Natural language' : 'Manual entry'}
          </button>)}
      </div>

      {mode === 'ai' ?
            <>
          <Card padding="lg">
            <label htmlFor="task-text" className="text-sm font-semibold text-charcoal-light">Your task</label>
            <div className="mt-2 relative">
              <textarea id="task-text" value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Try typing: Submit chemistry report by Friday, about 3 hours" className="w-full rounded-2xl border border-black/10 bg-cream/50 pl-4 pr-16 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"/>

              {voice.supported ?
                <button type="button" onClick={toggleMic} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop voice input' : 'Start voice input'} title={voice.listening ? 'Click to stop' : 'Speak your task'} className={cn('absolute right-3 top-3 w-11 h-11 rounded-full flex items-center justify-center transition-colors', voice.listening ? 'bg-red-500 text-white' : 'bg-white text-brand-600 border border-black/10 hover:bg-brand-50')}>
                  {voice.listening && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60"/>}
                  <MicIcon size={18} className="relative"/>
                </button> :
                <span tabIndex={0} className="group absolute right-3 top-3 w-10 h-10 rounded-full bg-black/[0.04] text-charcoal-muted flex items-center justify-center cursor-help outline-none" aria-label="Voice input works in Chrome or Edge">
                  <MicOffIcon size={16}/>
                  <span role="tooltip" className="pointer-events-none absolute right-0 top-11 z-10 whitespace-nowrap rounded-xl bg-charcoal text-white text-xs font-semibold px-3 py-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                    Voice input works in Chrome or Edge
                  </span>
                </span>}
            </div>

            {voice.supported &&
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold min-h-[1rem]" aria-live="polite">
                  {voice.listening ?
                    <span className="inline-flex items-center gap-1.5 text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> Listening...
                    </span> :
                    voice.error && <span className="text-brand-700">{voice.error}</span>}
                </div>
                <div className="flex bg-cream rounded-full p-0.5" role="group" aria-label="Voice language">
                  {[{ v: 'en-US', l: 'English' }, { v: 'si-LK', l: 'සිංහල' }].map((o) => <button key={o.v} type="button" disabled={voice.listening} onClick={() => setVoiceLang(o.v)} aria-pressed={voiceLang === o.v} className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50', voiceLang === o.v ? 'bg-white text-charcoal shadow-soft' : 'text-charcoal-muted')}>
                      {o.l}
                    </button>)}
                </div>
              </div>}
            <Button className="mt-4" onClick={generate}>
              <WandSparklesIcon size={16}/> Create Task
            </Button>
          </Card>

          <AnimatePresence>
            {preview &&
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {!saved &&
                <Card padding="lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded-xl bg-brand-500 text-white flex items-center justify-center">
                      <SparklesIcon size={14}/>
                    </span>
                    <h3 className="font-bold text-charcoal">Check your task</h3>
                  </div>
                  <p className="text-sm text-charcoal-muted mb-4">This is what we understood. Fix anything that is wrong, then confirm.</p>
                  <div className="space-y-4">
                    <Field id="preview-title" label="Title" value={preview.title} onChange={(e) => editPreview('title', e.target.value)}/>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Field id="preview-deadline" label="Deadline" type="date" value={preview.deadline} onChange={(e) => editPreview('deadline', e.target.value)}/>
                      <Field id="preview-minutes" label="Duration (minutes)" type="number" min={5} step={5} value={preview.minutes} onChange={(e) => editPreview('minutes', Number(e.target.value))}/>
                      <SelectField id="preview-priority" label="Priority" value={preview.priority} onChange={(e) => editPreview('priority', e.target.value)}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </SelectField>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col sm:flex-row gap-3">
                    <Button className="flex-1" onClick={confirmPreview} disabled={saving || !preview.title.trim() || !preview.deadline}>
                      <CheckIcon size={16}/> {saving ? 'Saving…' : 'Confirm and save'}
                    </Button>
                    <Button variant="ghost" className="flex-1" onClick={() => setPreview(null)}>Cancel</Button>
                  </div>
                </Card>}
                {savedCard}
              </motion.div>}
          </AnimatePresence>
        </> :
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
