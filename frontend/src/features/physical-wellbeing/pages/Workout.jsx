import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PauseIcon, PlayIcon, SkipForwardIcon, FlagIcon, CheckIcon, CameraIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import {
    kneeSafeWorkoutSteps,
    backSafeWorkoutSteps,
    gentleWorkoutSteps,
    standardWorkoutSteps,
    featuredExercise
} from '../data';
import { getRecommendations, getProfile } from '../api';
import { cn } from '../../../shared/lib/cn';
import { PoseTracker } from '../components/PoseTracker';

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
    const [recom, setRecom] = useState(null);
    const [steps, setSteps] = useState(standardWorkoutSteps);
    const [safetyBadge, setSafetyBadge] = useState(null);
    const [index, setIndex] = useState(0);
    const [left, setLeft] = useState(standardWorkoutSteps[0].seconds);
    const [running, setRunning] = useState(true);
    const [finished, setFinished] = useState(false);
    const [feeling, setFeeling] = useState(null);
    const [poseTracking, setPoseTracking] = useState(false);

    useEffect(() => {
        Promise.all([
            getRecommendations().catch(() => null),
            getProfile().catch(() => null)
        ]).then(([recomRes, profRes]) => {
            if (recomRes?.exercises?.[0]) {
                setRecom(recomRes.exercises[0]);
            }
            
            const limits = (profRes?.physical_limitations || recomRes?.user_preferences?.physical_limitations || '').toLowerCase();
            const safety = recomRes?.safety_analysis || null;
            
            let selectedSteps = standardWorkoutSteps;
            let badge = null;

            if (limits.includes('knee') || limits.includes('lower') || limits.includes('joint') || safety?.flagged_categories?.includes('lower_body_knee')) {
                selectedSteps = kneeSafeWorkoutSteps;
                badge = {
                    emoji: '🦵',
                    text: 'Knee-Safe Mode Active (Zero Squats / Zero Knee Shear)',
                    color: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                };
            } else if (limits.includes('back') || limits.includes('spine') || limits.includes('lumbar') || safety?.flagged_categories?.includes('upper_body_back')) {
                selectedSteps = backSafeWorkoutSteps;
                badge = {
                    emoji: '🧍',
                    text: 'Back & Spine Safe Mode Active (Zero Compressive Load)',
                    color: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                };
            } else if (limits.includes('prefer_not_to_say') || limits.includes('asthma') || limits.includes('cardio') || limits.includes('surgery') || safety?.doctor_consultation_advised) {
                selectedSteps = gentleWorkoutSteps;
                badge = {
                    emoji: '🔒',
                    text: 'Gentle Precautionary Protocol Active',
                    color: 'bg-blue-50 text-blue-800 border-blue-200'
                };
            }

            setSteps(selectedSteps);
            setSafetyBadge(badge);
            setLeft(selectedSteps[0].seconds);
        }).catch(() => null);
    }, []);

    const workoutTitle = recom?.name || featuredExercise.title;
    const workoutMins = recom?.minutes || 20;
    const currentSteps = steps && steps.length > 0 ? steps : standardWorkoutSteps;
    const step = currentSteps[index] || currentSteps[0];

    useEffect(() => {
        if (!running || finished) return;
        if (left <= 0) {
            if (index < currentSteps.length - 1) {
                setIndex((i) => i + 1);
                setLeft(currentSteps[index + 1].seconds);
            } else {
                setFinished(true);
            }
            return;
        }
        const id = setTimeout(() => setLeft((l) => l - 1), 1000);
        return () => clearTimeout(id);
    }, [left, running, index, finished, currentSteps]);

    const skip = () => {
        if (index < currentSteps.length - 1) {
            setIndex((i) => i + 1);
            setLeft(currentSteps[index + 1].seconds);
        } else {
            setFinished(true);
        }
    };

    const pct = step ? ((step.seconds - left) / step.seconds) * 100 : 0;

    if (finished) {
        return (
            <div className="max-w-md mx-auto">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-4">
                    <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }} className="text-6xl">
                        🎉
                    </motion.div>
                    <h1 className="text-2xl font-extrabold text-charcoal mt-3">Workout Completed!</h1>
                    <p className="text-sm text-charcoal-muted mt-1">{workoutTitle}</p>

                    <div className="grid grid-cols-3 gap-2.5 mt-6">
                        {[
                            { l: 'Duration', v: `${workoutMins} min` },
                            { l: 'Active minutes', v: `${Math.max(1, workoutMins - 2)}` },
                            { l: 'Exercises', v: `${index + 1}/${currentSteps.length}` }
                        ].map((s) => (
                            <Card key={s.l} padding="sm" className="text-center">
                                <p className="text-xl font-extrabold text-charcoal">{s.v}</p>
                                <p className="text-[11px] font-medium text-charcoal-muted mt-0.5">{s.l}</p>
                            </Card>
                        ))}
                    </div>

                    <Card padding="lg" className="mt-5 text-left">
                        <h2 className="font-bold text-charcoal">How did this workout feel?</h2>
                        <p className="text-xs text-charcoal-muted mt-0.5 mb-4">Your answer tunes your next session.</p>
                        <div className="grid grid-cols-2 gap-2.5">
                            {feelings.map((f, i) => (
                                <button
                                    key={f.label}
                                    onClick={() => setFeeling(i)}
                                    className={cn(
                                        'rounded-3xl py-4 border-2 transition-colors flex flex-col items-center gap-1.5',
                                        feeling === i ? 'border-brand-500 bg-brand-50' : 'border-black/[0.06] bg-white hover:border-brand-200'
                                    )}
                                >
                                    <span className="text-3xl">{f.emoji}</span>
                                    <span className="text-sm font-bold text-charcoal">{f.label}</span>
                                </button>
                            ))}
                        </div>

                        <AnimatePresence>
                            {feeling !== null && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                                    <div className="mt-4 rounded-2xl bg-brand-50 border border-brand-100 p-3.5 flex gap-2.5">
                                        <span className="text-base shrink-0">🧠</span>
                                        <p className="text-sm text-charcoal-light leading-relaxed">{feelings[feeling].note}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>

                    <Button size="lg" fullWidth className="mt-5" disabled={feeling === null} onClick={() => navigate('/app/physical')}>
                        <CheckIcon size={18} /> Save & Finish
                    </Button>
                    <button onClick={() => navigate('/app/physical')} className="mt-2 text-sm font-semibold text-charcoal-muted hover:text-charcoal py-2">
                        Skip feedback
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto">
            <div className="text-center">
                {safetyBadge && (
                    <div className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold mb-2 shadow-sm', safetyBadge.color)}>
                        <span>{safetyBadge.emoji}</span>
                        <span>{safetyBadge.text}</span>
                    </div>
                )}
                <p className="text-sm font-semibold text-brand-600">Focused workout</p>
                <h1 className="text-xl font-extrabold text-charcoal mt-1">{workoutTitle}</h1>
                <p className="text-sm text-charcoal-muted mt-0.5">
                    Exercise {index + 1} of {currentSteps.length}
                </p>
            </div>

            {/* Step dots */}
            <div className="flex gap-1.5 mt-4">
                {currentSteps.map((_, i) => (
                    <span
                        key={i}
                        className={cn(
                            'h-1.5 flex-1 rounded-full transition-colors',
                            i < index ? 'bg-brand-500' : i === index ? 'bg-brand-300' : 'bg-black/[0.08]'
                        )}
                    />
                ))}
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 items-start">
                <section className="min-w-0 rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-charcoal">Webcam form check <span className="font-medium text-charcoal-muted">(optional)</span></h2>
                            <p className="mt-1 text-xs text-charcoal-muted">Live pose tracking stays in your browser. Video is never uploaded or saved.</p>
                        </div>
                        <button
                            type="button"
                            aria-pressed={poseTracking}
                            onClick={() => setPoseTracking((enabled) => !enabled)}
                            className={cn('shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition-colors', poseTracking ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100')}
                        >
                            <CameraIcon size={15} /> {poseTracking ? 'Turn off' : 'Enable'}
                        </button>
                    </div>
                    {poseTracking ? (
                        <div className="mt-4"><PoseTracker exerciseName={step?.name || workoutTitle} /></div>
                    ) : (
                        <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl bg-brand-50/70 px-6 text-center">
                            <div>
                                <CameraIcon size={28} className="mx-auto text-brand-400" />
                                <p className="mt-3 text-sm font-semibold text-charcoal">Camera is off</p>
                                <p className="mt-1 text-xs text-charcoal-muted">Enable the optional form check to see your live skeleton and rep count.</p>
                            </div>
                        </div>
                    )}
                </section>

                <section className="min-w-0">
                    <div className="flex justify-center py-2 sm:py-4">
                        <ProgressRing value={pct} size={poseTracking ? 210 : 240} stroke={15}>
                            <span className="text-5xl">{step?.emoji || '🏋️'}</span>
                            <span className="text-4xl font-extrabold text-charcoal tracking-tight tabular-nums mt-2">{fmt(left)}</span>
                        </ProgressRing>
                    </div>

                    <Card padding="lg" className="text-center">
                        <h2 className="text-lg font-extrabold text-charcoal">{step?.name}</h2>
                        <p className="text-sm text-charcoal-light mt-1.5 leading-relaxed">{step?.cue}</p>
                    </Card>

                    <div className="flex gap-2 mt-5">
                        <Button size="lg" className="flex-1" variant={running ? 'secondary' : 'primary'} onClick={() => setRunning((r) => !r)}>
                            {running ? <PauseIcon size={17} /> : <PlayIcon size={17} fill="currentColor" />}
                            {running ? 'Pause' : 'Resume'}
                        </Button>
                        <Button size="lg" variant="outline" onClick={skip}>
                            <SkipForwardIcon size={16} /> Skip
                        </Button>
                    </div>
                    <button
                        onClick={() => setFinished(true)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-charcoal-muted hover:text-charcoal py-2.5"
                    >
                        <FlagIcon size={14} /> Finish Workout
                    </button>
                </section>
            </div>
        </div>
    );
}
