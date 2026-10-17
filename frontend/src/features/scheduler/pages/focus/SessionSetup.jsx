import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayIcon, SlidersHorizontalIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { SelectField } from '../../../../shared/components/ui/Field';
import { LoadingState, ErrorState } from '../../../../shared/components/ui/States';
import { AIInsightCard } from '../../../../shared/components/domain/AIInsightCard';
import { apiErrorMessage } from '../../../../shared/api/client';
import { getActiveFocus, getTimerRecommendation, listTasks, startFocus } from '../../api';

// Where the suggested length came from (backend "source") -> card title
const SOURCE_TITLE = {
    student_fixed: 'Your fixed timer',
    static_default: 'Standard Pomodoro',
    m1_model: 'AI suggestion from your focus history',
    history_rules: 'Based on your recent focus history',
    survey: 'Based on your usual focus length',
    default: 'Still learning',
};

// Same rule as the backend (focus_service.break_for): up to 30 min -> 5 min break, longer -> 10 min
const breakFor = (minutes) => (minutes <= 30 ? 5 : 10);

function Stepper({ label, value, setValue, step, min, max, suffix }) {
    return (<div className="flex items-center justify-between rounded-2xl bg-cream p-4">
      <span className="text-sm font-semibold text-charcoal-light">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => setValue(Math.max(min, value - step))} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-charcoal-light hover:bg-black/[0.04] transition-colors" aria-label={`Decrease ${label}`}>
          <MinusIcon size={15}/>
        </button>
        <span className="text-lg font-extrabold text-charcoal tabular-nums w-16 text-center">
          {value} {suffix}
        </span>
        <button onClick={() => setValue(Math.min(max, value + step))} className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors" aria-label={`Increase ${label}`}>
          <PlusIcon size={15}/>
        </button>
      </div>
    </div>);
}

export function SessionSetup() {
    const navigate = useNavigate();
    const [rec, setRec] = useState(null);          // suggestion from the backend
    const [tasks, setTasks] = useState([]);        // tasks the student can focus on
    const [taskId, setTaskId] = useState('');      // '' = no task
    const [focus, setFocus] = useState(25);
    const [manual, setManual] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState('');

    const load = () => {
        setLoadFailed(false);
        // A session is already running (e.g. the page was refreshed) -> go straight back to the timer
        getActiveFocus()
            .then((active) => {
                if (active) return navigate('/app/focus', { replace: true });
                return Promise.all([getTimerRecommendation(), listTasks()]).then(([r, all]) => {
                    setRec(r);
                    setFocus(r.focus_minutes);
                    setTasks(all.filter((t) => t.status === 'pending' || t.status === 'in_progress'));
                });
            })
            .catch(() => setLoadFailed(true));
    };
    useEffect(load, []);   // eslint-disable-line react-hooks/exhaustive-deps

    // Start on the backend. If the student changed the length, the backend records it as an override.
    const start = () => {
        setStarting(true);
        setError('');
        startFocus({ task_id: taskId || null, planned_minutes: focus })
            .then(() => navigate('/app/focus'))
            .catch((e) => setError(apiErrorMessage(e)))
            .finally(() => setStarting(false));
    };

    if (loadFailed) return <ErrorState onRetry={load}/>;
    if (!rec) return <LoadingState label="Getting your suggested session length…"/>;

    const changed = focus !== rec.focus_minutes;
    return (<div className="space-y-6">
      <PageHeader title="Session Length" subtitle="We suggest a length that matches how you actually focus."/>

      <div className="max-w-xl space-y-5">
        <AIInsightCard title={SOURCE_TITLE[rec.source] ?? 'Suggested length'}>
          We suggest a <b>{rec.focus_minutes} min focus</b> / <b>{rec.break_minutes} min break</b>.
          <span className="block text-xs mt-1">{rec.reason}</span>
        </AIInsightCard>

        <Card padding="lg">
          {tasks.length > 0 &&
            <div className="mb-4">
              <SelectField label="What will you work on?" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">No specific task</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.cognitive_load})</option>)}
              </SelectField>
            </div>}

          <div className="grid grid-cols-2 gap-3">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-brand-50 p-6 text-center">
              <p className="text-4xl font-extrabold text-charcoal tabular-nums">{focus}</p>
              <p className="text-sm font-bold text-brand-700 mt-1">min Focus</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-3xl bg-sage-light p-6 text-center">
              <p className="text-4xl font-extrabold text-charcoal tabular-nums">{changed ? breakFor(focus) : rec.break_minutes}</p>
              <p className="text-sm font-bold text-emerald-700 mt-1">min Break</p>
            </motion.div>
          </div>

          {manual &&
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <div className="space-y-2.5 mt-4">
                <Stepper label="Focus length" value={focus} setValue={setFocus} step={5} min={5} max={180} suffix="min"/>
                {changed && <p className="text-xs text-charcoal-muted px-1">You changed our suggestion - that's fine, we learn from it.</p>}
              </div>
            </motion.div>}

          {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

          <div className="mt-5 space-y-3">
            <Button size="lg" fullWidth onClick={start} disabled={starting}>
              <PlayIcon size={18} fill="currentColor"/> {starting ? 'Starting…' : 'Start Session'}
            </Button>
            <Button size="lg" fullWidth variant="outline" onClick={() => { setManual((m) => !m); setFocus(rec.focus_minutes); }}>
              <SlidersHorizontalIcon size={16}/> {manual ? 'Use Recommendation' : 'Adjust Manually'}
            </Button>
          </div>
        </Card>
      </div>
    </div>);
}
