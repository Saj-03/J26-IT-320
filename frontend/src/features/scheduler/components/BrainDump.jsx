// VOICE PLANNER "Speak your day"
// 1. The student says / types their whole day (classes, study tasks, personal jobs, "I'm tired", "plan my day")
// 2. POST /brain-dump -> M4 + slot rules make one card per item (NOTHING is saved yet)
// 3. The student fixes / unticks cards, then confirms -> POST /brain-dump/confirm saves them (and plans)
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangleIcon, CalendarIcon, CheckIcon, MicIcon, MicOffIcon, SparklesIcon, WandSparklesIcon, ZapIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { apiErrorMessage } from '../../../shared/api/client';
import { cn } from '../../../shared/lib/cn';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { confirmBrainDump, previewBrainDump } from '../api';

const CARD_TYPES = [
    ['commitment', 'Class / event'], ['task_academic', 'Study task'], ['task_personal', 'Personal task'],
    ['routine', 'Routine'], ['other', 'Skip this'],
];
const COMMITMENT_KINDS = [['lecture', 'Lecture / lab'], ['work', 'Work'], ['extracurricular', 'Club / sport'], ['personal', 'Personal']];
const TASK_KINDS = [['assignment', 'Assignment'], ['exam_prep', 'Exam preparation'], ['project', 'Project'],
    ['reading', 'Reading'], ['lecture_review', 'Lecture review'], ['other', 'Other']];
const DEFAULT_KIND = { commitment: 'personal', routine: 'personal', task_academic: 'assignment', task_personal: 'other' };
const DEADLINE_DAYS = { task_academic: 7, task_personal: 2 };     // same defaults as the backend
const EDITABLE = ['type', 'title', 'kind', 'date', 'start', 'end', 'duration_minutes', 'deadline', 'load', 'urgent'];
const EXAMPLE = 'I have a software engineering lecture tomorrow from 8 to 10, then work from 2 to 6. ' +
    'Finish the machine learning report by Friday, about 3 hours. Buy eggs and bread. I\'m really tired today. Plan my day.';

const isTask = (type) => type === 'task_academic' || type === 'task_personal';
const isEvent = (type) => type === 'commitment' || type === 'routine';

// "2026-10-19" + 7 days -> "2026-10-26"
function addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00`);
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Preview items -> cards. Energy / plan request become switches, not cards.
function toCards(preview) {
    return preview.items.filter((it) => !['energy', 'plan_request'].includes(it.type)).map((it) => {
        const card = { ...it };
        if (isTask(card.type) && !card.deadline)
            card.deadline = addDays(preview.today, DEADLINE_DAYS[card.type]);
        return { ...card, original: { ...card } };
    });
}

// The backend's 422 for a card: [{card, title, problem}]
function saveError(err) {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail) && detail[0]?.card)
        return detail.map((d) => `Card ${d.card} (${d.title}): ${d.problem}`).join('. ');
    return apiErrorMessage(err);
}

function ItemCard({ card, number, onChange }) {
    const set = (field) => (e) => onChange({ [field]: e.target.type === 'number' ? Number(e.target.value) || null : e.target.value || null });
    const changeType = (e) => {
        const type = e.target.value;
        onChange({ type, include: type !== 'other', kind: DEFAULT_KIND[type] ?? null });
    };
    const id = (f) => `card-${number}-${f}`;
    const sure = Math.round(card.confidence * 100);
    const showM3 = card.type === 'task_academic' && card.predicted_minutes && card.predicted_minutes !== card.duration_minutes
        && card.duration_minutes === card.original.duration_minutes;

    return (<Card padding="lg" className={cn('space-y-4', !card.include && 'opacity-60', card.include && card.needs_check && 'ring-2 ring-amber-300')}>
      <div className="flex flex-wrap items-center gap-3">
        <input type="checkbox" checked={card.include} disabled={card.type === 'other'} onChange={(e) => onChange({ include: e.target.checked })} aria-label={`Save card ${number}`} className="w-5 h-5 accent-brand-500"/>
        <span className="text-sm font-bold text-charcoal">Card {number}</span>
        {card.include && card.needs_check ?
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-[11px] font-bold">
              <AlertTriangleIcon size={12}/> Please check
            </span> :
            <span className="rounded-full bg-sage-light text-emerald-700 px-2.5 py-1 text-[11px] font-bold">AI {sure}% sure</span>}
      </div>
      <p className="text-xs text-charcoal-muted">You said: “{card.text}”</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <SelectField id={id('type')} label="What is it?" value={card.type} onChange={changeType}>
          {CARD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectField>
        <Field id={id('title')} label="Title" value={card.title} onChange={set('title')}/>
      </div>

      {isEvent(card.type) &&
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SelectField id={id('kind')} label="Kind" value={card.kind ?? 'personal'} onChange={set('kind')}>
            {COMMITMENT_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelectField>
          <Field id={id('date')} label="Day" type="date" value={card.date ?? ''} onChange={set('date')}/>
          <Field id={id('start')} label="From" type="time" value={card.start ?? ''} onChange={set('start')}/>
          <Field id={id('end')} label="To" type="time" value={card.end ?? ''} onChange={set('end')}/>
        </div>}

      {isTask(card.type) &&
        <div className={cn('grid gap-4', card.type === 'task_academic' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}>
          {card.type === 'task_academic' &&
            <SelectField id={id('kind')} label="Task type" value={card.kind ?? 'assignment'} onChange={set('kind')}>
              {TASK_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectField>}
          <Field id={id('deadline')} label="Due" type="date" value={card.deadline ?? ''} onChange={set('deadline')}/>
          <Field id={id('duration')} label="Minutes" type="number" min={5} step={5} value={card.duration_minutes ?? ''} onChange={set('duration_minutes')}/>
          {card.type === 'task_academic' &&
            <SelectField id={id('load')} label="Effort (AI)" value={card.load ?? 'medium'} onChange={set('load')}>
              <option value="low">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </SelectField>}
        </div>}

      {isTask(card.type) &&
        <label className={cn('inline-flex items-center gap-2 text-sm font-semibold', card.urgent ? 'text-red-600' : 'text-charcoal-light')}>
          <input type="checkbox" checked={Boolean(card.urgent)} onChange={(e) => onChange({ urgent: e.target.checked })} className="w-4 h-4 accent-red-500"/>
          Urgent (planned first)
        </label>}
      {showM3 &&
        <p className="text-xs text-charcoal-light">From your past tasks, this may really take about <b>{card.predicted_minutes} min</b>. The planner uses that.</p>}
      {card.warning && card.include && card.start === card.original.start && card.end === card.original.end &&
        <p className="text-xs font-semibold text-amber-700">{card.warning}</p>}
      {isEvent(card.type) && !card.start && card.include &&
        <p className="text-xs font-semibold text-amber-700">Add a start time, or untick this card.</p>}
    </Card>);
}

export default function BrainDump() {
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [preview, setPreview] = useState(null);       // what the backend understood
    const [cards, setCards] = useState([]);
    const [lowEnergy, setLowEnergy] = useState(false);
    const [plan, setPlan] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(null);

    // VOICE INPUT (en-US = English, si-LK = Sinhala, beta)
    const [voiceLang, setVoiceLang] = useState('en-US');
    const textBeforeVoice = useRef('');
    const voice = useVoiceInput({
        lang: voiceLang,
        onText: (spoken) => setText(textBeforeVoice.current ? `${textBeforeVoice.current} ${spoken}` : spoken)
    });
    const toggleMic = () => {
        if (!voice.listening) textBeforeVoice.current = text.trim();
        voice.toggle();
    };

    const understand = () => {
        if (voice.listening) voice.stop();
        if (text.trim().length < 3) return setError('Type or say your day first.');
        setBusy(true);
        setError('');
        setSaved(null);
        previewBrainDump(text.trim())
            .then((p) => {
                setPreview(p);
                setCards(toCards(p));
                setLowEnergy(p.energy === 'low');
                setPlan(p.plan_requested);
            })
            .catch((e) => setError(apiErrorMessage(e)))
            .finally(() => setBusy(false));
    };

    const editCard = (i, changes) => setCards((all) => all.map((c, j) => (j === i ? { ...c, ...changes } : c)));

    const chosen = cards.filter((c) => c.include && c.type !== 'other');
    const save = () => {
        setBusy(true);
        setError('');
        const items = chosen.map((c) => ({
            type: c.type, title: c.title?.trim() || 'Untitled', kind: c.kind,
            ...(isTask(c.type)
                ? { deadline: c.deadline, duration_minutes: c.duration_minutes, load: c.type === 'task_academic' ? c.load : null,
                    urgent: Boolean(c.urgent) }
                : { date: c.date, start: c.start, end: c.end, duration_minutes: c.duration_minutes }),
            // learning loop: what the AI said + what the student changed (the backend never stores the spoken text)
            model_type: c.original.type, confidence: c.confidence,
            changed: EDITABLE.filter((f) => c[f] !== c.original[f]),
        }));
        confirmBrainDump({ items, energy: lowEnergy ? 'low' : (preview.energy === 'high' ? 'high' : null), plan, dropped: cards.length - chosen.length })
            .then(setSaved)
            .catch((e) => setError(saveError(e)))
            .finally(() => setBusy(false));
    };

    const startAgain = () => { setPreview(null); setCards([]); setSaved(null); setText(''); setError(''); };

    if (saved)
        return (<Card padding="lg" className="space-y-4">
        <p className="text-sm font-semibold text-emerald-700 bg-sage-light rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckIcon size={16}/> Saved {saved.tasks.length} task{saved.tasks.length === 1 ? '' : 's'} and {saved.commitments.length} event{saved.commitments.length === 1 ? '' : 's'}.
        </p>
        <ul className="text-sm text-charcoal space-y-1">
          {saved.commitments.map((c) => <li key={c.id}>📅 {c.title}</li>)}
          {saved.tasks.map((t) => <li key={t.id}>📝 {t.title}</li>)}
        </ul>
        {saved.planned &&
            <p className="text-sm text-charcoal-light">
            Planned {saved.sessions} study session{saved.sessions === 1 ? '' : 's'}
            {saved.unplaced ? `, ${saved.unplaced} task${saved.unplaced === 1 ? '' : 's'} did not fit` : ''}.
            {saved.today_cap_minutes != null && ` You said you are tired, so today has at most ${saved.today_cap_minutes} minutes of study.`}
          </p>}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={() => navigate('/app/schedule')}><CalendarIcon size={16}/> Go to my schedule</Button>
          <Button variant="outline" className="flex-1" onClick={startAgain}>Speak another day</Button>
        </div>
      </Card>);

    return (<div className="space-y-5">
      <Card padding="lg">
        <label htmlFor="day-text" className="text-sm font-semibold text-charcoal-light">Tell us your day</label>
        <div className="mt-2 relative">
          <textarea id="day-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={2000} placeholder={`Try: ${EXAMPLE}`} className="w-full rounded-2xl border border-black/10 bg-cream/50 pl-4 pr-16 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"/>
          {voice.supported ?
            <button type="button" onClick={toggleMic} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop voice input' : 'Start voice input'} title={voice.listening ? 'Click to stop' : 'Speak your day'} className={cn('absolute right-3 top-3 w-11 h-11 rounded-full flex items-center justify-center transition-colors', voice.listening ? 'bg-red-500 text-white' : 'bg-white text-brand-600 border border-black/10 hover:bg-brand-50')}>
              {voice.listening && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60"/>}
              <MicIcon size={18} className="relative"/>
            </button> :
            <span className="absolute right-3 top-3 w-10 h-10 rounded-full bg-black/[0.04] text-charcoal-muted flex items-center justify-center" title="Voice input works in Chrome or Edge" aria-label="Voice input works in Chrome or Edge">
              <MicOffIcon size={16}/>
            </span>}
        </div>

        {voice.supported &&
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold min-h-[1rem]" aria-live="polite">
              {voice.listening ?
                <span className="inline-flex items-center gap-1.5 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> Listening...</span> :
                voice.error && <span className="text-brand-700">{voice.error}</span>}
            </div>
            <div className="flex bg-cream rounded-full p-0.5" role="group" aria-label="Voice language">
              {[{ v: 'en-US', l: 'English' }, { v: 'si-LK', l: 'සිංහල (beta)' }].map((o) => <button key={o.v} type="button" disabled={voice.listening} onClick={() => setVoiceLang(o.v)} aria-pressed={voiceLang === o.v} className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50', voiceLang === o.v ? 'bg-white text-charcoal shadow-soft' : 'text-charcoal-muted')}>
                  {o.l}
                </button>)}
            </div>
          </div>}
        <p className="mt-2 text-[11px] text-charcoal-muted">
          Privacy: your browser turns speech into text (Google / Microsoft speech service). ThriveU saves only the cards you confirm, never what you said.
        </p>
        <Button className="mt-4" onClick={understand} disabled={busy}>
          <WandSparklesIcon size={16}/> {busy && !preview ? 'Reading your day…' : 'Understand my day'}
        </Button>
      </Card>

      <AnimatePresence>
        {preview &&
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-brand-500 text-white flex items-center justify-center"><SparklesIcon size={14}/></span>
              <h3 className="font-bold text-charcoal">Check what we understood</h3>
            </div>
            <p className="text-sm text-charcoal-muted">
              Fix anything wrong, untick what you do not want, then save. Nothing is saved until you press Save.
              {preview.model === 'keyword_rules' && ' (AI model not loaded, simple word rules were used.)'}
            </p>

            {preview.ignored?.length > 0 &&
                <p className="text-xs text-charcoal-muted">
                Skipped words: {preview.ignored.map((w) => `“${w}”`).join(' · ')}. If something important is here, type it again above.
              </p>}
            {cards.length === 0 &&<Card padding="lg"><p className="text-sm text-charcoal-muted">We could not find any tasks or events. Try saying what, when and how long.</p></Card>}
            {cards.map((c, i) => <ItemCard key={c.index} card={c} number={i + 1} onChange={(changes) => editCard(i, changes)}/>)}

            <Card padding="lg" className="space-y-3">
              <label className="flex items-center gap-3 text-sm text-charcoal">
                <input type="checkbox" checked={lowEnergy} onChange={(e) => setLowEnergy(e.target.checked)} className="w-5 h-5 accent-brand-500"/>
                <ZapIcon size={16} className="text-amber-500"/> I have low energy today (plan less study for today)
              </label>
              {preview.items.filter((it) => it.type === 'energy' && !it.kind).map((it) =>
                <p key={it.index} className="text-xs font-semibold text-amber-700 pl-8">
                  You said “{it.text}”. We were not sure how you feel, so tick this if you are tired.
                </p>)}
              <label className="flex items-center gap-3 text-sm text-charcoal">
                <input type="checkbox" checked={plan} onChange={(e) => setPlan(e.target.checked)} className="w-5 h-5 accent-brand-500"/>
                <CalendarIcon size={16} className="text-brand-600"/> Plan my week after saving
              </label>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1" onClick={save} disabled={busy || chosen.length === 0}>
                <CheckIcon size={16}/> {busy ? 'Saving…' : `Save ${chosen.length} item${chosen.length === 1 ? '' : 's'}`}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={startAgain}>Start again</Button>
            </div>
          </motion.div>}
      </AnimatePresence>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </div>);
}
