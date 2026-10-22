import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, ArrowUpRightIcon, TrophyIcon, ChevronRightIcon, RotateCwIcon, SparklesIcon, ShieldCheckIcon, DumbbellIcon, UtensilsIcon, ScaleIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { AdaptiveLoop } from '../components/AdaptiveLoop';
import { SectionTitle, AdaptedChip } from '../components/Shared';
import { WellbeingHeroBanner } from '../components/WellbeingHeroBanner';
import { RecommendationImage, mealImageFallbacks, exerciseImageFallback } from '../components/RecommendationImage';
import useStudent from '../../../shared/hooks/useStudent';
import { getRecommendations, getProfile, getActivitySummary, getHabits, saveWorkoutFeedback, saveMealFeedback } from '../api';

const MOTIVATIONAL_QUOTES = [
  'Small, steady steps create lasting change.',
  'Progress is built one choice at a time.',
  'Take care of your body; it carries you through every busy day.',
  'You do not need a perfect day to make a healthy choice.',
  'Show up for yourself in whatever way you can today.'
];

export function PhysicalHome() {
  const navigate = useNavigate();
  const student = useStudent();
  const [profile, setProfile] = useState(null);
  const buddyGender = profile?.assessment_data?.gender
    || localStorage.getItem(`wellbeing-buddy-gender:${student?.email || 'guest'}`)
    || 'Male';
  const buddyImage = String(buddyGender).trim().toLowerCase() === 'female'
    ? '/img/wellbeing-buddy-female.png'
    : '/img/wellbeing-buddy-male.png';
  const checkInDay = new Date().toLocaleDateString('en-CA');
  const snoozeKey = `wellbeing-buddy-snooze:${student?.email || 'guest'}:${checkInDay}`;

  const [recomData, setRecomData] = useState(null);
  const [activitySummary, setActivitySummary] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCheckIn, setSavingCheckIn] = useState(null);
  const [checkInError, setCheckInError] = useState('');
  const [workoutAnswer, setWorkoutAnswer] = useState(null);
  const [mealAnswer, setMealAnswer] = useState(null);
  const [showBuddyPrompt, setShowBuddyPrompt] = useState(false);
  const [buddyScheduled, setBuddyScheduled] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const checkInDoneForToday = workoutAnswer !== null && mealAnswer !== null;

  useEffect(() => {
    Promise.all([
      getRecommendations(false, false).catch(() => null),
      getProfile().catch(() => null),
      getActivitySummary(checkInDay).catch(() => null),
      getHabits().catch(() => [])
    ]).then(([rec, prof, act, habs]) => {
      setRecomData(rec);
      setProfile(prof);
      setActivitySummary(act);
      setWorkoutAnswer(typeof act?.today?.workout_feedback === 'boolean' ? act.today.workout_feedback : null);
      setMealAnswer(typeof act?.today?.meals_supported_wellbeing === 'boolean' ? act.today.meals_supported_wellbeing : null);
      setHabits(Array.isArray(habs) ? habs : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setQuoteIndex((index) => (index + 1) % MOTIVATIONAL_QUOTES.length), 7000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Wait for today's saved check-in before scheduling the prompt. If the user
    // has already answered today, don't replay the buddy's reaction on refresh.
    if (loading || checkInDoneForToday || buddyScheduled) return;
    const snoozeUntil = Number(localStorage.getItem(snoozeKey) || 0);
    const delay = Math.max(1800, snoozeUntil - Date.now());
    const timer = window.setTimeout(() => {
      setShowBuddyPrompt(true);
      setBuddyScheduled(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [loading, checkInDoneForToday, buddyScheduled, snoozeKey]);

  // Real stats
  const todaySteps = activitySummary?.today?.steps || 0;
  const todayMins = activitySummary?.today?.exercise_minutes || 0;
  const totalHabits = habits.length;
  const doneHabits = habits.filter((h) => h.done).length;
  const habitStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak || 0), 0) : 0;

  const weeklyMins = activitySummary?.weekly_totals?.exercise_minutes || 0;
  const weeklyTarget = 150;
  const challengePct = Math.min(100, Math.round((weeklyMins / weeklyTarget) * 100));

  const targetMins = profile?.available_minutes || 20;

  // Dynamic score calculation
  const baseScore = profile ? 40 : 0;
  const stepsScore = Math.min(25, Math.round((todaySteps / 8000) * 25));
  const exerciseScore = Math.min(20, Math.round((todayMins / targetMins) * 20));
  const habitsScore = totalHabits > 0 ? Math.min(15, Math.round((doneHabits / totalHabits) * 15)) : (profile ? 10 : 0);
  const dynamicScore = Math.min(100, baseScore + stepsScore + exerciseScore + habitsScore);

  // Top live recommendation from model
  const topWorkout = recomData?.exercises?.[0];
  const quickMeals = (recomData?.meals?.length ? recomData.meals : Object.values(recomData?.today_slots || {}).flat()).slice(0, 3);
  const assessedHeight = Number(profile?.assessment_data?.height);
  const assessedWeight = Number(profile?.assessment_data?.weight);
  const bmiValue = assessedHeight > 0 && assessedWeight > 0
    ? Math.round((assessedWeight / ((assessedHeight / 100) ** 2)) * 10) / 10
    : Number(profile?.bmi) || null;
  const bmiStatus = bmiValue === null ? null : bmiValue < 18.5
    ? { label: 'Below reference range', tone: 'text-sky-700 bg-sky-50' }
    : bmiValue < 25 ? { label: 'Reference range', tone: 'text-emerald-700 bg-emerald-50' }
      : bmiValue < 30 ? { label: 'Above reference range', tone: 'text-amber-700 bg-amber-50' }
        : { label: 'Higher range', tone: 'text-rose-700 bg-rose-50' };
  const bmiMarker = bmiValue === null ? 0 : Math.max(0, Math.min(100, ((bmiValue - 15) / 25) * 100));
  const studentName = student?.name || profile?.goal || 'Student';
  const isActiveToday = todaySteps > 0 || todayMins > 0;

  const answerWorkout = async (didWorkout) => {
    setSavingCheckIn('workout');
    setCheckInError('');
    try {
      await saveWorkoutFeedback({
        day: checkInDay,
        did_workout: didWorkout,
        workout_minutes: didWorkout ? Number(topWorkout?.minutes || topWorkout?.duration_mins || 20) : 0
      });
      setWorkoutAnswer(didWorkout);
      const refreshed = await getActivitySummary(checkInDay).catch(() => null);
      if (refreshed) setActivitySummary(refreshed);
    } catch {
      setCheckInError('Could not save your workout check-in. Please try again.');
    } finally {
      setSavingCheckIn(null);
    }
  };

  const answerMeals = async (ateWell) => {
    setSavingCheckIn('meals');
    setCheckInError('');
    try {
      await saveMealFeedback({ day: checkInDay, ate_well: ateWell });
      setMealAnswer(ateWell);
      const refreshed = await getActivitySummary(checkInDay).catch(() => null);
      if (refreshed) setActivitySummary(refreshed);
    } catch {
      setCheckInError('Could not save your meal check-in. Please try again.');
    } finally {
      setSavingCheckIn(null);
    }
  };

  const remindBuddyLater = () => {
    localStorage.setItem(snoozeKey, String(Date.now() + 30 * 60 * 1000));
    setShowBuddyPrompt(false);
    window.setTimeout(() => setShowBuddyPrompt(true), 30 * 60 * 1000);
  };

  return (<div className="space-y-6">
    {/* ── Animated Wellbeing Hero Banner ── */}
    <WellbeingHeroBanner
      studentName={studentName}
      isActive={isActiveToday}
    />

    <AnimatePresence initial={false}>
      {showBuddyPrompt && (
        <motion.div
          key="daily-wellbeing-checkin"
          initial={{ y: 24, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          className="fixed inset-x-3 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(38rem,calc(100vw-3rem))]"
        >
          <Card padding="md" className="border border-brand-100 bg-white shadow-xl">
            <div className="flex items-start gap-3">
              <motion.img src={buddyImage} alt="Your wellbeing buddy" className="h-24 w-16 shrink-0 object-contain" animate={{ y: [0, -3, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-brand-700">A quick daily check-in</p><h2 className="mt-0.5 text-base font-extrabold text-charcoal">How did today go?</h2></div>
                  <button type="button" onClick={() => setShowBuddyPrompt(false)} className="rounded-full px-2 py-1 text-xs font-semibold text-charcoal-muted hover:bg-cream">Close</button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-black/[0.06] bg-cream/50 p-3">
                    <p className="text-sm font-bold text-charcoal">Did you complete a workout today?</p>
                    {workoutAnswer !== null && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Saved: {workoutAnswer ? 'Yes' : 'Not today'}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant={workoutAnswer === false ? 'secondary' : 'outline'} disabled={savingCheckIn !== null} onClick={() => answerWorkout(false)} className="flex-1">Not today</Button>
                      <Button size="sm" variant={workoutAnswer === true ? 'secondary' : 'primary'} disabled={savingCheckIn !== null} onClick={() => answerWorkout(true)} className="flex-1">Yes, I did</Button>
                    </div>
                    {savingCheckIn === 'workout' && <p className="mt-1 text-[11px] text-brand-700">Saving workout check-in…</p>}
                  </div>
                  <div className="rounded-xl border border-black/[0.06] bg-cream/50 p-3">
                    <p className="text-sm font-bold text-charcoal">Did you have meals that supported your wellbeing?</p>
                    {mealAnswer !== null && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Saved: {mealAnswer ? 'Yes' : 'Not quite'}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant={mealAnswer === false ? 'secondary' : 'outline'} disabled={savingCheckIn !== null} onClick={() => answerMeals(false)} className="flex-1">Not quite</Button>
                      <Button size="sm" variant={mealAnswer === true ? 'secondary' : 'primary'} disabled={savingCheckIn !== null} onClick={() => answerMeals(true)} className="flex-1">Yes, I did</Button>
                    </div>
                    {savingCheckIn === 'meals' && <p className="mt-1 text-[11px] text-brand-700">Saving meal check-in…</p>}
                  </div>
                </div>
                {checkInError && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{checkInError}</p>}
                {checkInDoneForToday && <p className="mt-2 text-xs font-semibold text-emerald-700" aria-live="polite">Both answers are saved to your wellbeing record. You can update either answer today.</p>}
                {!checkInDoneForToday && <button type="button" onClick={remindBuddyLater} className="mt-2 rounded-full px-2 py-1 text-xs font-semibold text-charcoal-muted hover:bg-cream">Remind me later</button>}
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>

    {!showBuddyPrompt && (
      <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} className="fixed bottom-4 right-4 z-40 w-[min(18rem,calc(100vw-2rem))] sm:bottom-6 sm:right-6" aria-label="Wellbeing check-in reminder">
        <Card padding="sm" className="border border-brand-100 bg-white/95 shadow-lg">
          <div className="flex items-center gap-2.5">
            <motion.img src={buddyImage} alt="" className="h-16 w-12 shrink-0 object-contain" animate={{ y: [0, -2, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-brand-700">Your wellbeing buddy</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal">{checkInDoneForToday ? 'Thanks for checking in today!' : 'A quick workout and meal check-in is ready.'}</p>
            </div>
            <Button size="sm" onClick={() => setShowBuddyPrompt(true)}>{checkInDoneForToday ? 'Review' : 'Check in'}</Button>
          </div>
        </Card>
      </motion.div>
    )}

    <PhysicalNav />
    {/* Wellbeing score card */}
    <Card padding="lg" className="relative overflow-hidden">
      <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-brand-50" aria-hidden />
      <div className="relative flex flex-col sm:flex-row items-center gap-6">
        <ProgressRing value={dynamicScore} size={132} stroke={13}>
          <span className="text-3xl font-extrabold text-charcoal">{dynamicScore}</span>
          <span className="text-xs font-semibold text-charcoal-muted">/ 100</span>
        </ProgressRing>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-sm font-semibold text-brand-600">Wellness Score 📊</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-charcoal mt-1 leading-snug max-w-lg">
            {todaySteps === 0 && todayMins === 0
              ? "Ready to build healthy momentum today?"
              : "Great progress on your daily wellness goals!"}
          </h2>
          <p className="text-sm text-charcoal-muted mt-1.5 leading-relaxed max-w-lg">
            {profile ? (
              <>Calibrated for <strong>{profile.available_minutes} mins</strong> daily workout window and <strong>{profile.meal_style?.replace('_', ' ')}</strong> meals.</>
            ) : (
              'Complete your wellbeing assessment to generate your personalized AI routine.'
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
            <AdaptedChip>{recomData?.model_version || 'Adaptive AI Model'}</AdaptedChip>
            {profile?.diet_pref && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-cream border border-black/[0.06] text-charcoal-light">Diet: {profile.diet_pref}</span>}
            {profile?.physical_limitations && profile.physical_limitations !== 'none' && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800">Safety: {profile.physical_limitations}</span>}
          </div>
        </div>
      </div>
    </Card>

    {/* Today's overview */}
    <div>
      <h3 className="text-lg font-bold text-charcoal mb-3">Today’s Overview</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { id: 'steps', label: 'Steps', emoji: '👟', current: todaySteps, total: 8000, unit: 'steps', color: '#16a34a' },
          { id: 'workout', label: 'Active Workout', emoji: '⏱️', current: todayMins, total: targetMins, unit: 'mins', color: '#f59e0b' },
          { id: 'habits', label: 'Habits Done', emoji: '⭐', current: doneHabits, total: Math.max(totalHabits, 1), unit: totalHabits === 0 ? 'no habits' : 'habits', color: '#3b82f6' },
          { id: 'energy', label: 'Active Energy', emoji: '🔥', current: Math.round(todaySteps * 0.04 + todayMins * 5), total: 300, unit: 'kcal burn', color: '#ec4899' }
        ].map((r) => {
          const pct = Math.min(100, Math.round((r.current / r.total) * 100));
          return <Card key={r.id} padding="sm" hover className="flex items-center gap-3">
            <ProgressRing value={pct} size={54} stroke={6} color={r.color}><span className="text-sm">{r.emoji}</span></ProgressRing>
            <div className="min-w-0"><p className="text-xs font-medium text-charcoal-muted">{r.label}</p><p className="text-lg font-extrabold text-charcoal leading-tight tracking-tight">{r.current.toLocaleString()}<span className="text-charcoal-muted text-sm font-semibold"> / {r.total.toLocaleString()}</span></p><p className="text-[10px] text-charcoal-muted">{r.unit}</p></div>
          </Card>;
        })}
      </div>
    </div>

    {/* Quick glimpse of the student's saved measurements and current suggestions */}
    <Card padding="md" className="overflow-hidden border border-brand-100 bg-gradient-to-br from-white via-white to-emerald-50/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-brand-700"><SparklesIcon size={15} /> Your quick glimpse</p>
          <h2 className="mt-1 text-xl font-black text-charcoal">Your wellbeing, at a glance</h2>
          <p className="mt-1 text-sm text-charcoal-muted">A shortcut to your profile, today’s workout and meal ideas.</p>
        </div>
        <Button variant="soft" size="sm" onClick={() => navigate('/app/physical/plan')}>Open full plan <ArrowUpRightIcon size={15} /></Button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[.82fr_1.18fr]">
        <button type="button" onClick={() => navigate('/app/physical/profile')} className="group rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-charcoal-muted"><ScaleIcon size={15} className="text-emerald-700" /> BMI snapshot</span>
            <ArrowUpRightIcon size={15} className="text-charcoal-muted transition group-hover:text-brand-700" />
          </div>
          {bmiValue !== null ? <>
            <div className="mt-3 flex items-end gap-2"><span className="text-4xl font-black leading-none text-charcoal">{bmiValue.toFixed(1)}</span><span className="pb-0.5 text-xs font-bold text-charcoal-muted">BMI</span><span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-extrabold ${bmiStatus.tone}`}>{bmiStatus.label}</span></div>
            <div className="relative mt-4 pt-1">
              <div className="flex h-2.5 overflow-hidden rounded-full"><span className="w-[14%] bg-sky-400"/><span className="w-[26%] bg-emerald-400"/><span className="w-[20%] bg-amber-400"/><span className="flex-1 bg-rose-400"/></div>
              <span className="absolute top-0 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-white bg-charcoal shadow" style={{ left: `${bmiMarker}%` }} />
              <div className="mt-1 flex justify-between text-[9px] font-bold text-charcoal-muted"><span>18.5</span><span>25</span><span>30</span></div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-charcoal-muted">A general screening measure, not a diagnosis.</p>
          </> : <p className="mt-3 rounded-xl bg-cream p-3 text-xs font-semibold text-charcoal-muted">Complete your assessment to see your BMI.</p>}
        </button>

        <button type="button" onClick={() => navigate('/app/physical/workout', topWorkout ? { state: { workout: topWorkout } } : undefined)} className="group rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-charcoal-muted"><DumbbellIcon size={15} className="text-amber-700" /> Suggested workout</span>
            <ArrowUpRightIcon size={15} className="text-charcoal-muted transition group-hover:text-brand-700" />
          </div>
          <div className="relative mt-3 h-28 overflow-hidden rounded-xl bg-gradient-to-br from-amber-200 via-orange-100 to-emerald-100">
            <RecommendationImage src={topWorkout?.image} alt={topWorkout?.name || 'Suggested workout'} fallbackSrc={exerciseImageFallback} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-charcoal/45 via-transparent to-transparent" />
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/35 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur-sm"><DumbbellIcon size={12} /> Today’s pick</span>
          </div>
          <h3 className="mt-3 text-base font-black leading-snug text-charcoal">{topWorkout?.name || 'Your personalized workout is being prepared'}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-charcoal-muted">{topWorkout?.description || 'Your workout suggestion will appear here after your wellbeing assessment.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-charcoal shadow-sm">{topWorkout?.minutes || topWorkout?.duration_mins || profile?.available_minutes || 20} min</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold capitalize text-charcoal shadow-sm">{profile?.goal?.replaceAll('_', ' ') || 'Personalized'}</span>
          </div>
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><TrophyIcon size={19} /></span>
          <div className="min-w-[130px] flex-1"><p className="text-xs font-extrabold text-charcoal">Weekly move target</p><p className="mt-0.5 text-[11px] text-charcoal-muted">Minutes recorded this week toward 150 min</p></div>
          <p className="text-sm font-black text-charcoal">{weeklyMins}<span className="font-semibold text-charcoal-muted"> / 150 min</span></p>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-extrabold text-brand-700">{challengePct}%</span>
        </div>
        <ProgressBar value={challengePct} className="mt-3" height={7} />
      </div>

      <div className="mt-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-900/15"><UtensilsIcon size={19} /></span>
            <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Today’s nutrition</p><h3 className="mt-0.5 text-lg font-black tracking-tight text-charcoal">Three fresh picks</h3><p className="mt-0.5 text-xs text-charcoal-muted">Chosen for your meal preferences and goals.</p></div>
          </div>
          <button type="button" onClick={() => navigate('/app/physical/nutrition')} className="group inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-extrabold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">Explore meals <ArrowRightIcon size={14} className="transition-transform group-hover:translate-x-0.5" /></button>
        </div>
        {quickMeals.length ? <div className="grid gap-3 sm:grid-cols-3">
          {quickMeals.map((meal, index) => {
            const mealName = meal.name || meal.meal_name || meal.title || 'Recommended meal';
            const cuisineKey = meal.cuisine === 'sri_lankan' || meal.region?.toLowerCase().includes('sri') ? 'sri_lankan' : 'international';
            return <button key={meal.id || meal.name || index} type="button" onClick={() => navigate('/app/physical/nutrition')} className="group relative isolate flex min-h-[190px] flex-col justify-between overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-gradient-to-br from-emerald-950 to-teal-800 p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
              <RecommendationImage src={meal.image} alt={mealName} fallbackSrc={mealImageFallbacks[cuisineKey]} className="absolute inset-0 z-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 z-[1] bg-gradient-to-t from-[#102c26]/95 via-[#102c26]/38 to-[#102c26]/10" />
              <div className="relative z-10 flex items-start justify-between gap-2">
                <span className="rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.13em] text-white backdrop-blur-sm">Pick {String(index + 1).padStart(2, '0')}</span>
                {meal.calories != null && <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-charcoal shadow-sm">{meal.calories} kcal</span>}
              </div>
              <div className="relative z-10 mt-8">
                <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[.16em] text-emerald-200">{meal.cuisine === 'sri_lankan' ? 'Sri Lankan' : meal.region || meal.cuisine || 'Personalized meal'}</p>
                <h4 className="line-clamp-2 text-sm font-black leading-snug text-white">{mealName}</h4>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-white/80">View meal <ArrowUpRightIcon size={12} /></span>
              </div>
            </button>;
          })}
        </div> : <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-6 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UtensilsIcon size={18} /></span><p className="mt-2 text-sm font-bold text-charcoal">Your meal picks will appear here</p><p className="mt-1 text-xs text-charcoal-muted">Complete your assessment to get meals matched to your preferences.</p></div>}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#153f35] px-4 py-3 text-white shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10"><SparklesIcon size={17} className="text-amber-200" /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100">A little encouragement</p><p key={quoteIndex} className="mt-0.5 text-sm font-bold">“{MOTIVATIONAL_QUOTES[quoteIndex]}”</p></div>
        <span className="hidden text-lg sm:block" aria-hidden="true">🌱</span>
      </div>
    </Card>

    {/* Useful destinations; today's specific recommendations are shown above only. */}
    <div className="grid gap-6">
        {/* Quick links */}
        <Card>
          <SectionTitle title="Jump back in" />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { emoji: '📅', label: 'Today’s Plan', desc: 'Your scheduled meals and workouts', to: '/app/physical/plan' },
              { emoji: '🏃', label: 'Movement', desc: `${profile?.available_minutes || 20}-min calibrated sessions`, to: '/app/physical/exercise' },
              { emoji: '🥗', label: 'Nutrition', desc: `${profile?.meal_style?.replace('_', ' ') || 'Sri Lankan'} meal ideas`, to: '/app/physical/nutrition' },
              { emoji: '✨', label: 'Habits', desc: habitStreak > 0 ? `${habitStreak} day streak · manage habits` : 'Track your daily routines', to: '/app/physical/habits' },
              { emoji: '🏆', label: 'Achievements', desc: 'Milestones earned from your activity', to: '/app/physical/achievements' },
              { emoji: '🤝', label: 'Squad Challenges', desc: 'Join shared goals with your peers', to: '/app/physical/challenges' },
              { emoji: '📈', label: 'Progress', desc: 'Review your weekly activity trends', to: '/app/physical/progress' },
              { emoji: '🔄', label: 'AI Adaptation', desc: 'See how your plan responds to check-ins', to: '/app/physical/adaptation' },
              { emoji: '👤', label: 'My Profile', desc: 'Review your assessment and preferences', to: '/app/physical/profile' }
            ].map((q) => <button key={q.label} onClick={() => navigate(q.to)} className="w-full flex items-center gap-3 rounded-2xl bg-cream p-3.5 text-left hover:bg-black/[0.04] transition-colors">
              <span className="text-xl">{q.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-charcoal">{q.label}</p>
                <p className="text-xs text-charcoal-muted">{q.desc}</p>
              </div>
              <ChevronRightIcon size={16} className="text-charcoal-muted" />
            </button>)}
          </div>
        </Card>

    </div>

    {/* Plan adaptation nudge */}
    <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate('/app/physical/adaptation')} className="w-full text-left rounded-3xl bg-brand-50 border border-brand-100 p-5 flex items-center gap-4 hover:bg-brand-100/60 transition-colors">
      <span className="w-11 h-11 rounded-2xl bg-brand-500 text-white flex items-center justify-center shrink-0">
        <RotateCwIcon size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-charcoal">Your Plan Has Been Updated</p>
        <p className="text-sm text-charcoal-light mt-0.5">
          We noticed your exercise completion decreased this week. Tap to review the change.
        </p>
      </div>
      <ChevronRightIcon size={18} className="text-brand-600 shrink-0" />
    </motion.button>

    <AdaptiveLoop activeKey="reco" />
  </div>);
}
