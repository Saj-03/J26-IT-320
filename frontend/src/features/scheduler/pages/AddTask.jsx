import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon, WandSparklesIcon, ArrowRightIcon, CheckIcon, MicIcon, MicOffIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { cn } from '../../../shared/lib/cn';
import { fakeExtract } from '../utils/fakeExtract';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { peakHours } from '../data';
export function AddTask() {
    const navigate = useNavigate();
    // [ITEM 5] "Manual entry" is now the default tab
    const [mode, setMode] = useState('manual');
    const [input, setInput] = useState('');
    // [ITEM 5] Extracted fields shown in the preview card (null = no preview yet)
    const [preview, setPreview] = useState(null);
    const [confirmed, setConfirmed] = useState(false);
    // [ITEM 6] VOICE INPUT
    // voiceLang: 'en-US' = English (default), 'si-LK' = Sinhala
    const [voiceLang, setVoiceLang] = useState('en-US');
    // Text that was already in the box before the mic started (we add the spoken words after it)
    const textBeforeVoice = useRef('');
    const voice = useVoiceInput({
        lang: voiceLang,
        // Live text (interim results) goes straight into the text box so the user can see / edit it
        onText: (spoken) => setInput(textBeforeVoice.current ? `${textBeforeVoice.current} ${spoken}` : spoken)
    });
    const toggleMic = () => {
        if (!voice.listening)
            textBeforeVoice.current = input.trim();
        voice.toggle();
    };
    const [analysing, setAnalysing] = useState(false);
    // Manual entry — no backend yet, so the task is not sent anywhere. We go to the schedule.
    const saveManual = (e) => {
        e.preventDefault();
        navigate('/app/schedule');
    };
    // [ITEM 5] "Create Task" -> run the fake extraction and show the preview card
    const generate = () => {
        if (voice.listening)
            voice.stop(); // [ITEM 6] stop the mic when the user creates the task
        let text = input.trim();
        if (text.length < 3) {
            text = 'Submit chemistry report by Friday, about 3 hours';
            setInput(text);
        }
        setPreview(fakeExtract(text));
        setConfirmed(false);
    };
    // [ITEM 5] Change one field in the preview card
    const editPreview = (field, value) => setPreview((p) => ({ ...p, [field]: value }));
    // [ITEM 5] User checked the fields and confirms. No backend yet, so we only show a saved message.
    const confirmPreview = () => {
        if (!preview.title.trim() || !preview.deadline)
            return;
        setConfirmed(true);
    };
    const breakItDown = () => {
        setAnalysing(true);
        setTimeout(() => navigate('/app/tasks/breakdown'), 1600);
    };
    return (<div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="What do you need to get done?" subtitle="Describe it in plain language — ThriveU turns it into a scheduled task."/>

      {/* Mode toggle */}
      <div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft w-fit">
        {/* [ITEM 5] Manual entry is first and selected by default */}
        {['manual', 'ai'].map((m) => <button key={m} onClick={() => setMode(m)} className={cn('px-5 py-2 rounded-full text-sm font-semibold transition-colors', mode === m ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
            {m === 'ai' ? 'Natural language' : 'Manual entry'}
          </button>)}
      </div>

      {mode === 'ai' ?
            <>
          <Card padding="lg">
            <label htmlFor="task-text" className="text-sm font-semibold text-charcoal-light">Your task</label>
            <div className="mt-2 relative">
              {/* Typing always works. Voice is optional. */}
              <textarea id="task-text" value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Try typing: Submit chemistry report by Friday, about 3 hours" className="w-full rounded-2xl border border-black/10 bg-cream/50 pl-4 pr-16 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"/>

              {/* [ITEM 6] MIC BUTTON inside the text box */}
              {voice.supported ?
                <button type="button" onClick={toggleMic} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop voice input' : 'Start voice input'} title={voice.listening ? 'Click to stop' : 'Speak your task'} className={cn('absolute right-3 top-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors', voice.listening ? 'bg-red-500 text-white' : 'bg-white text-brand-600 border border-black/10 hover:bg-brand-50')}>
                  {/* Red pulsing ring while listening */}
                  {voice.listening && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60"/>}
                  <MicIcon size={18} className="relative"/>
                </button> :
                // [ITEM 6] Browser has no speech support (e.g. Firefox): no mic button, only a hint with a tooltip
                <span tabIndex={0} className="group absolute right-3 top-3 w-10 h-10 rounded-full bg-black/[0.04] text-charcoal-muted flex items-center justify-center cursor-help outline-none" aria-label="Voice input works in Chrome or Edge">
                  <MicOffIcon size={16}/>
                  <span role="tooltip" className="pointer-events-none absolute right-0 top-11 z-10 whitespace-nowrap rounded-xl bg-charcoal text-white text-xs font-semibold px-3 py-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                    Voice input works in Chrome or Edge
                  </span>
                </span>}
            </div>

            {/* [ITEM 6] Listening status, errors and language toggle */}
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
                {/* [ITEM 5] PREVIEW CARD — extracted fields the user can edit before saving */}
                <Card padding="lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded-xl bg-brand-500 text-white flex items-center justify-center">
                      <SparklesIcon size={14}/>
                    </span>
                    <h3 className="font-bold text-charcoal">Check your task</h3>
                  </div>
                  <p className="text-sm text-charcoal-muted mb-4">This is what we understood. Fix anything that is wrong, then confirm.</p>
                  <div className="space-y-4">
                    <Field id="preview-title" label="Title" value={preview.title} onChange={(e) => editPreview('title', e.target.value)} disabled={confirmed}/>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Field id="preview-deadline" label="Deadline" type="date" value={preview.deadline} onChange={(e) => editPreview('deadline', e.target.value)} disabled={confirmed}/>
                      <Field id="preview-minutes" label="Duration (minutes)" type="number" min={5} step={5} value={preview.minutes} onChange={(e) => editPreview('minutes', Number(e.target.value))} disabled={confirmed}/>
                      <SelectField id="preview-priority" label="Priority" value={preview.priority} onChange={(e) => editPreview('priority', e.target.value)} disabled={confirmed}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </SelectField>
                    </div>
                  </div>
                  {confirmed ?
                    <p className="mt-5 text-sm font-semibold text-emerald-700 bg-sage-light rounded-2xl px-4 py-3 flex items-center gap-2">
                      <CheckIcon size={16}/> Task saved: {preview.title}
                    </p> :
                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      <Button className="flex-1" onClick={confirmPreview} disabled={!preview.title.trim() || !preview.deadline}>
                        <CheckIcon size={16}/> Confirm and save
                      </Button>
                      <Button variant="ghost" className="flex-1" onClick={() => setPreview(null)}>
                        Cancel
                      </Button>
                    </div>}
                </Card>

                <AIInsightCard title="AI Scheduling Recommendation">
                  {/* [ITEM 8] Peak hours from data.js */}
                  <span className="block font-bold text-charcoal mb-1">Best time: {peakHours.label}</span>
                  Your focus performance is strongest during this time.
                </AIInsightCard>

                {/* [ITEM 5] Next steps appear only after the user confirmed the task */}
                {confirmed && <>
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
                </>}
              </motion.div>}
          </AnimatePresence>
        </> :
            <Card padding="lg">
          <form className="space-y-4" onSubmit={saveManual}>
            <Field label="Task name" name="title" placeholder="Chemistry Lab Report" required/>
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField label="Task type" name="type" defaultValue="lab">
                <option value="lab">Lab Report</option>
                <option value="essay">Essay</option>
                <option value="problem">Problem Sheet</option>
                <option value="presentation">Presentation</option>
                <option value="assignment">Assignment</option>
              </SelectField>
              <Field label="Subject" name="subject" placeholder="Chemistry"/>
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
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" size="lg" className="flex-1">
                Create Task <ArrowRightIcon size={18}/>
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
