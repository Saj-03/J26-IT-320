import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PauseIcon, PlayIcon, SkipForwardIcon, FlagIcon, CheckIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { workoutSteps, featuredExercise } from '../data';
import { cn } from '../../../shared/lib/cn';
const feelings = [
    { emoji: '😌', label: 'Easy', note: 'We can add a little more next time.' },
    { emoji: '🙂', label: 'Comfortable', note: 'This intensity looks right for you.' },
    { emoji: '😓', label: 'Difficult', note: 'We’ll ease the next session slightly.' },
    { emoji: '🥵', label: 'Very Difficult', note: 'We’ll shorten and lighten your next workout.' }
];
function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function PhysicalWorkout() {
    const navigate = useNavigate();
    const [index, setIndex] = useState(0);
    const [left, setLeft] = useState(workoutSteps[0].seconds);
    const [running, setRunning] = useState(true);
    const [finished, setFinished] = useState(false);
    const [feeling, setFeeling] = useState(null);
    const step = workoutSteps[index];
    useEffect(() => {
        if (!running || finished)
            return;
        if (left <= 0) {
            if (index < workoutSteps.length - 1) {
                setIndex((i) => i + 1);
                setLeft(workoutSteps[index + 1].seconds);
            }
            else
                setFinished(true);
            return;
        }
        const id = setTimeout(() => setLeft((l) => l - 1), 1000);
        return () => clearTimeout(id);
    }, [left, running, index, finished]);
    const skip = () => {
        if (index < workoutSteps.length - 1) {
            setIndex((i) => i + 1);
            setLeft(workoutSteps[index + 1].seconds);
        }
        else
            setFinished(true);
    };
    const pct = (step.seconds - left) / step.seconds * 100;
    if (finished) {
        return (<div className="max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-4">
          <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }} className="text-6xl">
            🎉
          </motion.div>
          <h1 className="text-2xl font-extrabold text-charcoal mt-3">Workout Completed!</h1>
          <p className="text-sm text-charcoal-muted mt-1">{featuredExercise.title}</p>

          <div className="grid grid-cols-3 gap-2.5 mt-6">
            {[
                { l: 'Duration', v: '20 min' },
                { l: 'Active minutes', v: '18' },
                { l: 'Exercises', v: `${index + 1}/${workoutSteps.length}` }
            ].
                map((s) => <Card key={s.l} padding="sm" className="text-center">
                <p className="text-xl font-extrabold text-charcoal">{s.v}</p>
                <p className="text-[11px] font-medium text-charcoal-muted mt-0.5">{s.l}</p>
              </Card>)}
          </div>

          <Card padding="lg" className="mt-5 text-left">
            <h2 className="font-bold text-charcoal">How did this workout feel?</h2>
            <p className="text-xs text-charcoal-muted mt-0.5 mb-4">Your answer tunes your next session.</p>
            <div className="grid grid-cols-2 gap-2.5">
              {feelings.map((f, i) => <button key={f.label} onClick={() => setFeeling(i)} className={cn('rounded-3xl py-4 border-2 transition-colors flex flex-col items-center gap-1.5', feeling === i ? 'border-brand-500 bg-brand-50' : 'border-black/[0.06] bg-white hover:border-brand-200')}>
                  <span className="text-3xl">{f.emoji}</span>
                  <span className="text-sm font-bold text-charcoal">{f.label}</span>
                </button>)}
            </div>

            <AnimatePresence>
              {feeling !== null &&
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                  <div className="mt-4 rounded-2xl bg-brand-50 border border-brand-100 p-3.5 flex gap-2.5">
                    <span className="text-base shrink-0">🧠</span>
                    <p className="text-sm text-charcoal-light leading-relaxed">{feelings[feeling].note}</p>
                  </div>
                </motion.div>}
            </AnimatePresence>
          </Card>

          <Button size="lg" fullWidth className="mt-5" disabled={feeling === null} onClick={() => navigate('/app/physical')}>
            <CheckIcon size={18}/> Save & Finish
          </Button>
          <button onClick={() => navigate('/app/physical')} className="mt-2 text-sm font-semibold text-charcoal-muted hover:text-charcoal py-2">
            Skip feedback
          </button>
        </motion.div>
      </div>);
    }
    return (<div className="max-w-md mx-auto">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-600">Focused workout</p>
        <h1 className="text-xl font-extrabold text-charcoal mt-1">{featuredExercise.title}</h1>
        <p className="text-sm text-charcoal-muted mt-0.5">
          Exercise {index + 1} of {workoutSteps.length}
        </p>
      </div>

      {/* Step dots */}
      <div className="flex gap-1.5 mt-4">
        {workoutSteps.map((_, i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < index ? 'bg-brand-500' : i === index ? 'bg-brand-300' : 'bg-black/[0.08]')}/>)}
      </div>

      {/* Timer */}
      <div className="flex justify-center my-8">
        <ProgressRing value={pct} size={240} stroke={15}>
          <span className="text-5xl">{step.emoji}</span>
          <span className="text-4xl font-extrabold text-charcoal tracking-tight tabular-nums mt-2">{fmt(left)}</span>
        </ProgressRing>
      </div>

      <Card padding="lg" className="text-center">
        <h2 className="text-lg font-extrabold text-charcoal">{step.name}</h2>
        <p className="text-sm text-charcoal-light mt-1.5 leading-relaxed">{step.cue}</p>
      </Card>

      <div className="flex gap-2 mt-5">
        <Button size="lg" className="flex-1" variant={running ? 'secondary' : 'primary'} onClick={() => setRunning((r) => !r)}>
          {running ? <PauseIcon size={17}/> : <PlayIcon size={17} fill="currentColor"/>}
          {running ? 'Pause' : 'Resume'}
        </Button>
        <Button size="lg" variant="outline" onClick={skip}>
          <SkipForwardIcon size={16}/> Skip
        </Button>
      </div>
      <button onClick={() => setFinished(true)} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-charcoal-muted hover:text-charcoal py-2.5">
        <FlagIcon size={14}/> Finish Workout
      </button>
    </div>);
}
