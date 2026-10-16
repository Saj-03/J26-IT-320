import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon, TrophyIcon, ChevronRightIcon, RotateCwIcon, ActivityIcon, CalendarIcon, SparklesIcon, ShieldCheckIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIRecoCard } from '../components/AIRecoCard';
import { AdaptiveLoop } from '../components/AdaptiveLoop';
import { SectionTitle, AdaptedChip } from '../components/Shared';
import ProfileRecommendations from '../components/ProfileRecommendations';
import { WellbeingHeroBanner } from '../components/WellbeingHeroBanner';
import useStudent from '../../../shared/hooks/useStudent';
import { getRecommendations, getProfile, getActivitySummary, getHabits, saveWorkoutFeedback } from '../api';

export function PhysicalHome() {
  const navigate = useNavigate();
  const student = useStudent();

  const [recomData, setRecomData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activitySummary, setActivitySummary] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    Promise.all([
      getRecommendations(false, false).catch(() => null),
      getProfile().catch(() => null),
      getActivitySummary().catch(() => null),
      getHabits().catch(() => [])
    ]).then(([rec, prof, act, habs]) => {
      setRecomData(rec);
      setProfile(prof);
      setActivitySummary(act);
      setFeedback(act?.today?.workout_feedback ?? null);
      setHabits(Array.isArray(habs) ? habs : []);
      setLoading(false);
    });
  }, []);

  // Real stats
  const todaySteps = activitySummary?.today?.steps || 0;
  const todayMins = activitySummary?.today?.exercise_minutes || 0;
  const targetMins = profile?.available_minutes || 20;
  const totalHabits = habits.length;
  const doneHabits = habits.filter((h) => h.done).length;
  const habitStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak || 0), 0) : 0;

  const weeklyMins = activitySummary?.weekly_totals?.exercise_minutes || 0;
  const weeklyTarget = 150;
  const challengePct = Math.min(100, Math.round((weeklyMins / weeklyTarget) * 100));

  // Dynamic score calculation
  const baseScore = profile ? 40 : 0;
  const stepsScore = Math.min(25, Math.round((todaySteps / 8000) * 25));
  const exerciseScore = Math.min(20, Math.round((todayMins / targetMins) * 20));
  const habitsScore = totalHabits > 0 ? Math.min(15, Math.round((doneHabits / totalHabits) * 15)) : (profile ? 10 : 0);
  const dynamicScore = Math.min(100, baseScore + stepsScore + exerciseScore + habitsScore);

  // Top live recommendation from model
  const topWorkout = recomData?.exercises?.[0];
  const topRecommendation = topWorkout ? {
    title: topWorkout.name,
    detail: topWorkout.description || `${topWorkout.minutes} min session calibrated to your schedule.`,
    why: `Calibrated specifically to your ${profile?.available_minutes || 20}-min available time window and ${profile?.goal?.replace('_', ' ') || 'fitness'} goal.`,
    benefit: `${topWorkout.adherence_probability ? `${Math.round(topWorkout.adherence_probability * 100)}% predicted adherence` : 'High consistency'}. Built to fit your university routine.`,
    tag: `${topWorkout.minutes || 20} min · ${topWorkout.equipment || 'No equipment'}`
  } : {
    title: '20-Minute Personalized Activity Session',
    detail: 'Calibrated to your available time and fitness preferences.',
    why: 'Matched to your daily student schedule and activity preferences.',
    benefit: 'Keeps your daily consistency streak alive.',
    tag: `${profile?.available_minutes || 20} min`
  };

  const studentName = student?.name || profile?.goal || 'Student';

  const isActiveToday = todaySteps > 0 || todayMins > 0;

  const answerWorkout = async (didWorkout) => {
    setFeedbackSaving(true);
    try {
      await saveWorkoutFeedback({
        day: new Date().toLocaleDateString('en-CA'),
        did_workout: didWorkout,
        workout_minutes: didWorkout ? Number(topWorkout?.minutes || topWorkout?.duration_mins || 20) : 0
      });
      setFeedback(didWorkout);
      const refreshed = await getActivitySummary().catch(() => null);
      if (refreshed) setActivitySummary(refreshed);
    } catch (error) {
      console.error('Could not save workout check-in:', error);
    } finally {
      setFeedbackSaving(false);
    }
  };

  return (<div className="space-y-6">
    {/* ── Animated Wellbeing Hero Banner ── */}
    <WellbeingHeroBanner
      studentName={studentName}
      isActive={isActiveToday}
    />

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <PageHeader title="" subtitle="Your adaptive exercise, nutrition and habit plan — built around your university lifestyle." />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/app/physical/plan')}>
          <CalendarIcon size={15} /> View 7-Day Plan
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/physical-setup')}>
          <ActivityIcon size={15} /> Redo assessment
        </Button>
      </div>
    </div>

    <PhysicalNav />

    {false && <Card padding="md" className="overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-charcoal">Did you work out today?</p>
          <p className="text-xs text-charcoal-muted mt-0.5">One quick check-in helps tune future workout lengths.</p>
        </div>
        <span className="text-3xl" aria-hidden="true">{feedback === true ? '😊' : feedback === false ? '😢' : '🙂'}</span>
      </div>
      <div className="relative mt-3 h-12 rounded-2xl bg-brand-50 overflow-hidden" aria-label="Workout check-in avatar">
        <motion.div
          className="absolute top-0.5"
          initial={{ left: '-48px', opacity: 0 }}
          animate={{ left: feedback === true ? 'calc(100% - 42px)' : feedback === false ? '8px' : 'calc(50% - 18px)', opacity: 1 }}
          transition={{ left: { type: 'spring', stiffness: 85, damping: 15 }, opacity: { duration: 0.35 } }}
          role="img"
          aria-label={feedback === true ? 'Happy avatar walking to the right' : feedback === false ? 'Sad avatar walking to the left' : 'Avatar waiting for your answer'}
        >
          <motion.svg viewBox="0 0 48 52" className="h-11 w-10 drop-shadow-sm" animate={feedback === null ? { y: [0, -1, 0] } : { y: [0, -3, 0] }} transition={{ duration: feedback === null ? 1.2 : 0.32, repeat: Infinity }}>
            {/* Friendly cartoon face and hair */}
            <path d="M12 14 Q10 3 23 3 Q36 3 35 15 L32 19 L14 18 Z" fill="#49352d" />
            <circle cx="24" cy="13" r="9" fill="#f2bd91" />
            <path d="M15 11 Q16 4 24 4 Q32 4 33 11 Q28 7 22 8 Q18 8 15 11" fill="#49352d" />
            <circle cx="21" cy="13" r="1" fill="#382a27" /><circle cx="27" cy="13" r="1" fill="#382a27" />
            <circle cx="18" cy="16" r="1.2" fill="#e99587" opacity=".7" /><circle cx="30" cy="16" r="1.2" fill="#e99587" opacity=".7" />
            {feedback === false ? <path d="M21 19 Q24 16 27 19" fill="none" stroke="#65443b" strokeWidth="1.4" strokeLinecap="round" /> : <path d="M20 17 Q24 21 28 17" fill="none" stroke="#65443b" strokeWidth="1.4" strokeLinecap="round" />}
            {/* Shirt, sleeves, arms, trousers, and little shoes */}
            <path d="M17 23 Q24 20 31 23 L34 35 Q24 39 14 35 Z" fill="#55a879" />
            <path d="M17 24 L11 31 M31 24 L37 29" fill="none" stroke="#f2bd91" strokeWidth="4" strokeLinecap="round" />
            <path d="M20 36 L18 45 M28 36 L30 45" fill="none" stroke="#42516b" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M17 46 L14 48 Q14 50 21 49 L22 47 M29 46 L28 48 Q29 50 36 49 L34 47" fill="#f3b84c" stroke="#cc8b2e" strokeWidth=".8" strokeLinejoin="round" />
          </motion.svg>
        </motion.div>
        <span className="absolute left-2 bottom-1 text-[10px] text-charcoal-muted">Not today</span>
        <span className="absolute right-2 bottom-1 text-[10px] text-charcoal-muted">Yes, I did</span>
      </div>
      {feedback === null ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" disabled={feedbackSaving} onClick={() => answerWorkout(false)} className="flex-1">Not today</Button>
          <Button size="sm" disabled={feedbackSaving} onClick={() => answerWorkout(true)} className="flex-1">Yes, I did</Button>
        </div>
      ) : (
        <p className="mt-2 text-xs font-medium text-charcoal-muted" aria-live="polite">
          {feedback ? 'Nice work! Your plan will keep what is working for you.' : 'That’s okay. We’ll make future sessions more manageable.'} You can check in again tomorrow.
        </p>
      )}
      {recomData?.behavior_adaptation && (
        <p className="mt-1 text-[11px] text-charcoal-muted">
          {recomData.behavior_adaptation.check_ins < 3
            ? `${recomData.behavior_adaptation.check_ins}/3 check-ins collected before workout-length adjustments.`
            : recomData.behavior_adaptation.reason === 'shorter_sessions_after_recent_missed_workouts'
              ? 'Your recent check-ins are guiding the plan toward shorter sessions.'
              : 'Recent check-ins are included when choosing your workout duration.'}
        </p>
      )}
    </Card>}

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
            {profile?.diet_pref && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-cream border border-black/[0.06] text-charcoal-light">
                Diet: {profile.diet_pref}
              </span>
            )}
            {profile?.physical_limitations && profile.physical_limitations !== 'none' && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                Safety: {profile.physical_limitations}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>

    {/* Today's overview */}
    <div>
      <h3 className="text-lg font-bold text-charcoal mb-3">Today’s Overview</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            id: 'steps',
            label: 'Steps',
            emoji: '👟',
            current: todaySteps,
            total: 8000,
            unit: 'steps',
            color: '#16a34a'
          },
          {
            id: 'workout',
            label: 'Active Workout',
            emoji: '⏱️',
            current: todayMins,
            total: targetMins,
            unit: 'mins',
            color: '#f59e0b'
          },
          {
            id: 'habits',
            label: 'Habits Done',
            emoji: '⭐',
            current: doneHabits,
            total: Math.max(totalHabits, 1),
            unit: totalHabits === 0 ? 'no habits' : 'habits',
            color: '#3b82f6'
          },
          {
            id: 'energy',
            label: 'Active Energy',
            emoji: '🔥',
            current: Math.round(todaySteps * 0.04 + todayMins * 5),
            total: 300,
            unit: 'kcal burn',
            color: '#ec4899'
          }
        ].map((r) => {
          const pct = Math.min(100, Math.round((r.current / r.total) * 100));
          return (
            <Card key={r.id} padding="sm" hover className="flex items-center gap-3">
              <ProgressRing value={pct} size={54} stroke={6} color={r.color}>
                <span className="text-sm">{r.emoji}</span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-xs font-medium text-charcoal-muted">{r.label}</p>
                <p className="text-lg font-extrabold text-charcoal leading-tight tracking-tight">
                  {r.current.toLocaleString()}
                  <span className="text-charcoal-muted text-sm font-semibold"> / {r.total.toLocaleString()}</span>
                </p>
                <p className="text-[10px] text-charcoal-muted">{r.unit}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>

    {/* Recommendations from the student's saved profile */}
    <ProfileRecommendations />

    {/* Main grid */}
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <AIRecoCard
          title={topRecommendation.title}
          detail={topRecommendation.detail}
          why={topRecommendation.why}
          benefit={topRecommendation.benefit}
          tag={topRecommendation.tag}
          primaryLabel="Start Activity"
          onPrimary={() => navigate('/app/physical/workout', topWorkout ? { state: { workout: topWorkout } } : undefined)}
          onChange={() => navigate('/app/physical/exercise')}
        />
      </div>

      <div className="space-y-6">
        {/* Quick links */}
        <Card>
          <SectionTitle title="Jump back in" />
          <div className="space-y-2">
            {[
              { emoji: '📅', label: '7 to 30-Day Schedule', desc: 'Date-wise meals & workouts', to: '/app/physical/plan' },
              { emoji: '🏃', label: 'Today’s exercise', desc: `${profile?.available_minutes || 20}-min calibrated session`, to: '/app/physical/exercise' },
              { emoji: '🥗', label: 'Your nutrition plan', desc: `${profile?.meal_style?.replace('_', ' ') || 'Sri Lankan'} meals`, to: '/app/physical/nutrition' },
              { emoji: '✨', label: 'Healthy habits', desc: habitStreak > 0 ? `${habitStreak} day streak` : 'Track daily habits', to: '/app/physical/habits' }
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

        {/* Weekly challenge */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-charcoal">Weekly Move Target</h3>
            <TrophyIcon size={17} className="text-brand-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏃‍♂️</span>
            <div>
              <p className="font-extrabold text-charcoal text-sm">150-Min Weekly Goal</p>
              <p className="text-xs text-charcoal-muted">WHO recommended active minutes</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
              <span>
                {weeklyMins} / {weeklyTarget} min
              </span>
              <span>{challengePct}%</span>
            </div>
            <ProgressBar value={challengePct} />
          </div>
          <Button variant="soft" size="sm" className="mt-4" fullWidth onClick={() => navigate('/app/physical/achievements')}>
            View Badges & Rewards <ArrowRightIcon size={14} />
          </Button>
        </Card>
      </div>
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
