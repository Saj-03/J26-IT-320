import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PauseIcon, PlayIcon, SkipForwardIcon, FlagIcon, CheckIcon, CameraIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { featuredExercise } from '../data';
import { getRecommendations, saveWorkoutFeedback } from '../api';
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
    const location = useLocation();
    const selectedWorkout = location.state?.workout || location.state?.exercise || null;
    const [recommendedWorkout, setRecommendedWorkout] = useState(selectedWorkout);
    const [index, setIndex] = useState(0);
    const [left, setLeft] = useState(20 * 60);
    const [started, setStarted] = useState(false);
    const [running, setRunning] = useState(false);
    const [finished, setFinished] = useState(false);
    const [feeling, setFeeling] = useState(null);
    const [savingCompletion, setSavingCompletion] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [poseTracking, setPoseTracking] = useState(false);

    useEffect(() => {
        if (selectedWorkout) {
            setRecommendedWorkout(selectedWorkout);
            return;
        }
        getRecommendations()
            .then((result) => setRecommendedWorkout(result?.exercises?.[0] || null))
            .catch(() => setRecommendedWorkout(null));
    }, [selectedWorkout]);

    const workout = selectedWorkout || recommendedWorkout || {
        name: featuredExercise.title,
        minutes: 20,
        description: featuredExercise.benefit
    };
    const workoutTitle = workout.name || workout.title || featuredExercise.title;
    const workoutMins = Number(workout.minutes || workout.duration_mins || 20);
    const workoutDay = location.state?.dayName;
    const currentSteps = [{
        name: workoutTitle,
        seconds: Math.max(60, workoutMins * 60),
        cue: workout.description || 'Follow the recommended routine at a comfortable pace, and pause if you feel pain.'
    }];
    const step = currentSteps[0];

    useEffect(() => {
        setLeft(currentSteps[0].seconds);
        setIndex(0);
        setStarted(false);
        setRunning(false);
        setFinished(false);
    }, [workoutTitle, workoutMins, workout.description]);

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

    const finishAndSave = async (includeFeedback) => {
        setSavingCompletion(true);
        setSaveError('');
        const now = new Date();
        const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        try {
            await saveWorkoutFeedback({
                day,
                did_workout: true,
                workout_minutes: Math.max(1, workoutMins - 2),
                difficulty: includeFeedback && feeling !== null ? feelings[feeling].label : null,
            });
            navigate('/app/physical');
        } catch (err) {
            console.error('Could not save workout completion:', err);
            setSaveError(err?.response?.data?.detail || 'Could not save your workout. Check your connection and try again.');
        } finally {
            setSavingCompletion(false);
        }
    };

    if (finished) {
        return (
            <div className="max-w-md mx-auto">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-4">
                    <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }} className="text-6xl">
                        🎉
                    </motion.div>
                    {false && <motion.div
                        initial={{ x: -220, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 75, damping: 13, delay: 0.15 }}
                        className="mx-auto mt-2 flex w-fit items-center gap-3 rounded-full border border-sky-100 bg-sky-50 px-4 py-2"
                    >
                        <motion.svg viewBox="0 0 48 58" className="h-14 w-12" animate={{ y: [0, -2, 0] }} transition={{ duration: 0.45, repeat: Infinity }} role="img" aria-label="Small Messi-inspired cartoon footballer walking in to celebrate">
                            {/* Dark hair and a friendly bearded footballer face */}
                            <path d="M10 17 Q7 3 23 3 Q40 3 38 20 L34 22 L13 22 Z" fill="#382820" />
                            <ellipse cx="24" cy="16" rx="11" ry="12" fill="#d99a70" />
                            <path d="M13 13 Q16 4 25 5 Q34 5 36 14 Q29 10 23 11 Q18 10 13 13" fill="#382820" />
                            <circle cx="20" cy="16" r="1" fill="#2c211d" /><circle cx="28" cy="16" r="1" fill="#2c211d" />
                            <path d="M20 20 Q24 22 28 20 M14 22 Q24 31 34 22" fill="none" stroke="#54372c" strokeWidth="2.4" strokeLinecap="round" />
                            {/* Argentina-style sky-blue and white number 10 shirt */}
                            <path d="M16 29 L10 33 L13 40 L17 38 L17 49 Q24 52 31 49 L31 38 L35 40 L38 33 L32 29 L28 27 L24 31 L20 27 Z" fill="#fff" stroke="#d8e8f5" strokeWidth="1" />
                            <path d="M16 30 L18 49 L21 50 L21 30 Z M27 30 L27 50 L30 49 L32 30 Z" fill="#73b9e8" />
                            <text x="24" y="42" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#26547a">10</text>
                            {/* Legs and football boots */}
                            <path d="M20 50 L19 55 M28 50 L29 55" stroke="#d99a70" strokeWidth="3" strokeLinecap="round" />
                            <path d="M16 56 Q19 53 22 56 L22 58 L15 58 Z M27 56 Q30 53 33 56 L34 58 L27 58 Z" fill="#f0c64d" />
                        </motion.svg>
                        <span className="text-xs font-bold text-sky-900">Messi-style celebration! ⚽</span>
                    </motion.div>}
                    {false && <motion.div
                        initial={{ x: -180, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 75, damping: 14, delay: 0.15 }}
                        className="mx-auto mt-2 flex w-fit items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-2"
                    >
                        <motion.svg viewBox="0 0 16 20" shapeRendering="crispEdges" className="h-16 w-14" animate={{ y: [0, -2, 0] }} transition={{ duration: 0.42, repeat: Infinity }} role="img" aria-label="Cute pixel art AI friend celebrating your workout">
                            {/* Pixel antenna and friendly square face */}
                            <rect x="7" y="0" width="2" height="2" fill="#8b5cf6" />
                            <rect x="6" y="2" width="4" height="1" fill="#a78bfa" />
                            <rect x="3" y="4" width="10" height="7" rx="1" fill="#c4b5fd" />
                            <rect x="4" y="5" width="8" height="5" fill="#f5f3ff" />
                            <rect x="5" y="6" width="1" height="1" fill="#5b21b6" />
                            <rect x="10" y="6" width="1" height="1" fill="#5b21b6" />
                            <rect x="4" y="8" width="1" height="1" fill="#f9a8d4" />
                            <rect x="11" y="8" width="1" height="1" fill="#f9a8d4" />
                            <rect x="6" y="8" width="1" height="1" fill="#7c3aed" />
                            <rect x="7" y="9" width="2" height="1" fill="#7c3aed" />
                            <rect x="9" y="8" width="1" height="1" fill="#7c3aed" />
                            {/* Bright little robot body, arms, and feet */}
                            <rect x="5" y="12" width="6" height="5" fill="#8b5cf6" />
                            <rect x="6" y="13" width="4" height="2" fill="#ddd6fe" />
                            <rect x="7" y="14" width="2" height="1" fill="#22d3ee" />
                            <rect x="3" y="12" width="2" height="2" fill="#a78bfa" />
                            <rect x="11" y="12" width="2" height="2" fill="#a78bfa" />
                            <rect x="5" y="17" width="2" height="2" fill="#6d28d9" />
                            <rect x="9" y="17" width="2" height="2" fill="#6d28d9" />
                            <rect x="4" y="19" width="3" height="1" fill="#22d3ee" />
                            <rect x="9" y="19" width="3" height="1" fill="#22d3ee" />
                        </motion.svg>
                        <span className="text-xs font-bold text-violet-900">Your pixel friend is proud of you! ✨</span>
                    </motion.div>}
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

                    {saveError && <p role="alert" className="mt-4 text-sm font-semibold text-rose-700">{saveError}</p>}
                    <Button size="lg" fullWidth className="mt-5" disabled={feeling === null || savingCompletion} onClick={() => finishAndSave(true)}>
                        <CheckIcon size={18} /> {savingCompletion ? 'Saving…' : 'Save & Finish'}
                    </Button>
                    <button disabled={savingCompletion} onClick={() => finishAndSave(false)} className="mt-2 text-sm font-semibold text-charcoal-muted hover:text-charcoal py-2 disabled:opacity-50">
                        Skip feedback
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto">
            <div className="text-center">
                <p className="text-sm font-semibold text-brand-600">Focused workout</p>
                <h1 className="text-xl font-extrabold text-charcoal mt-1">{workoutTitle}</h1>
                <p className="text-sm text-charcoal-muted mt-0.5">
                    {workoutDay ? `${workoutDay}’s planned workout` : `${workoutMins}-minute personalized session`}
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

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] xl:grid-cols-[minmax(0,1.7fr)_minmax(380px,1fr)] gap-5 lg:gap-7 xl:gap-8 items-start">
                <section className="min-w-0 rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-charcoal">Webcam movement view <span className="font-medium text-charcoal-muted">(optional)</span></h2>
                            <p className="mt-1 text-xs text-charcoal-muted">See your live skeleton and estimated reps for supported moves. It does not judge your form; video stays in your browser and is never uploaded or saved.</p>
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
                                <p className="mt-1 text-xs text-charcoal-muted">Enable the optional movement view to see your live skeleton and estimated reps for supported exercises.</p>
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

                    {!started ? (
                        <Button
                            size="lg"
                            fullWidth
                            className="mt-5"
                            onClick={() => { setStarted(true); setRunning(true); }}
                        >
                            <PlayIcon size={17} fill="currentColor" /> Start Workout
                        </Button>
                    ) : (
                        <>
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
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
