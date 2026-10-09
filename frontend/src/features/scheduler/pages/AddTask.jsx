import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon, WandSparklesIcon, CalendarIcon, ClockIcon, GaugeIcon, FlagIcon, ArrowRightIcon, CheckIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { cn } from '../../../shared/lib/cn';
import { addTask } from '../api';
export function AddTask() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('ai');
    const [input, setInput] = useState('');
    const [preview, setPreview] = useState(false);
    const [analysing, setAnalysing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    // Manual entry -> POST /scheduler/tasks. Difficulty maps to the scheduler's cognitive load.
    const saveManual = async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const difficulty = +f.get('difficulty');
        setSaving(true);
        setError('');
        try {
            await addTask({
                title: f.get('title'),
                deadline: `${f.get('deadline')}T23:59:00`,
                estimated_minutes: Math.round(+f.get('hours') * 60),
                cognitive_load: difficulty >= 4 ? 'heavy' : difficulty === 3 ? 'medium' : 'low',
                priority: { high: 5, medium: 3, low: 1 }[f.get('priority')]
            });
            navigate('/app/schedule');
        }
        catch {
            setError('Could not save the task. Please try again.');
        }
        finally {
            setSaving(false);
        }
    };
    const generate = () => {
        if (input.trim().length < 3)
            setInput('Submit chemistry report by Friday, about 3 hours');
        setPreview(true);
    };
    const breakItDown = () => {
        setAnalysing(true);
        setTimeout(() => navigate('/app/tasks/breakdown'), 1600);
    };
    return (<div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="What do you need to get done?" subtitle="Describe it in plain language — IHSD turns it into a scheduled task."/>

      {/* Mode toggle */}
      <div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft w-fit">
        {['ai', 'manual'].map((m) => <button key={m} onClick={() => setMode(m)} className={cn('px-5 py-2 rounded-full text-sm font-semibold transition-colors', mode === m ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
            {m === 'ai' ? 'Natural language' : 'Manual entry'}
          </button>)}
      </div>

      {mode === 'ai' ?
            <>
          <Card padding="lg">
            <label className="text-sm font-semibold text-charcoal-light">Your task</label>
            <div className="mt-2 relative">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Try typing: Submit chemistry report by Friday, about 3 hours" className="w-full rounded-2xl border border-black/10 bg-cream/50 px-4 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"/>
            </div>
            <Button className="mt-4" onClick={generate}>
              <WandSparklesIcon size={16}/> Create Task
            </Button>
          </Card>

          <AnimatePresence>
            {preview &&
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <Card padding="lg">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-7 h-7 rounded-xl bg-brand-500 text-white flex items-center justify-center">
                      <SparklesIcon size={14}/>
                    </span>
                    <h3 className="font-bold text-charcoal">AI-generated task preview</h3>
                  </div>
                  <h2 className="text-xl font-extrabold text-charcoal">Chemistry Lab Report</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                    {[
                            { icon: FlagIcon, l: 'Type', v: 'Lab Report' },
                            { icon: SparklesIcon, l: 'Subject', v: 'Chemistry' },
                            { icon: CalendarIcon, l: 'Deadline', v: 'Fri, Jul 24' },
                            { icon: ClockIcon, l: 'Duration', v: '3 hours' },
                            { icon: GaugeIcon, l: 'Difficulty', v: '4 / 5' },
                            { icon: FlagIcon, l: 'Priority', v: 'HIGH' }
                        ].
                            map((f) => <div key={f.l} className="bg-cream rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 text-charcoal-muted mb-1">
                          <f.icon size={13}/>
                          <span className="text-xs font-semibold">{f.l}</span>
                        </div>
                        <p className={cn('font-bold text-charcoal', f.l === 'Priority' && 'text-brand-600')}>{f.v}</p>
                      </div>)}
                  </div>
                </Card>

                <AIInsightCard title="AI Scheduling Recommendation">
                  <span className="block font-bold text-charcoal mb-1">Best time: Thursday 9:00 AM – 12:00 PM</span>
                  Your focus performance is strongest during this time.
                </AIInsightCard>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" className="flex-1" onClick={() => navigate('/app/schedule')}>
                    <CheckIcon size={18}/> Add to Smart Schedule
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1" onClick={breakItDown}>
                    <WandSparklesIcon size={16}/> Generate Study Plan
                  </Button>
                </div>
                <p className="text-xs text-charcoal-muted text-center -mt-2">
                  A study plan splits this into small, ordered steps you can actually start.
                </p>
              </motion.div>}
          </AnimatePresence>
        </> :
            <Card padding="lg">
          <form className="space-y-4" onSubmit={saveManual}>
            <Field label="Task name" name="title" placeholder="Chemistry Lab Report" required/>
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField label="Task type" defaultValue="lab">
                <option value="lab">Lab Report</option>
                <option value="essay">Essay</option>
                <option value="problem">Problem Sheet</option>
                <option value="presentation">Presentation</option>
                <option value="assignment">Assignment</option>
              </SelectField>
              <Field label="Subject" placeholder="Chemistry"/>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Deadline" name="deadline" type="date" required/>
              <Field label="Duration (hours)" name="hours" type="number" defaultValue={3} min={0.5} step={0.5}/>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField label="Difficulty" name="difficulty" defaultValue="4">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
              </SelectField>
              <SelectField label="Priority" name="priority" defaultValue="high">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </SelectField>
            </div>
            {error && <p className="text-sm font-semibold text-brand-700 bg-brand-50 rounded-2xl px-4 py-2.5">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" size="lg" className="flex-1" disabled={saving}>
                {saving ? 'Saving…' : 'Create Task'} <ArrowRightIcon size={18}/>
              </Button>
              <Button type="button" size="lg" variant="outline" className="flex-1" onClick={breakItDown}>
                <WandSparklesIcon size={16}/> Generate Study Plan
              </Button>
            </div>
          </form>
        </Card>}

      {/* Analysing overlay */}
      <AnimatePresence>
        {analysing &&
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-cream/90 backdrop-blur-sm">
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto">
                <div className="absolute inset-0 rounded-full border-[3px] border-brand-100"/>
                <div className="absolute inset-0 rounded-full border-[3px] border-brand-500 border-t-transparent animate-spin"/>
              </div>
              <p className="text-lg font-bold text-charcoal mt-5">Analyzing your task…</p>
              <p className="text-sm text-charcoal-muted mt-1">Finding the smallest useful steps.</p>
            </div>
          </motion.div>}
      </AnimatePresence>
    </div>);
}
