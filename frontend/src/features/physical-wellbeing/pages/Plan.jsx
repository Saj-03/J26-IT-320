import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon, PlayIcon, ClockIcon, XIcon, PlusIcon, MinusIcon,
  CalendarIcon, HistoryIcon, SparklesIcon, AlertCircleIcon, ShieldCheckIcon,
  UtensilsIcon, DumbbellIcon, FlameIcon, LayersIcon
} from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { AdaptedChip } from '../components/Shared';
import { getWeekPlan, getWeekPlanHistory, getWeekPlanSnapshot, getProfile } from '../api';
import { cn } from '../../../shared/lib/cn';

const slotMeta = {
  breakfast: { title: 'Breakfast', emoji: '🌅', tint: 'bg-amber-50 text-amber-800 border-amber-200' },
  lunch: { title: 'Lunch', emoji: '☀️', tint: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  dinner: { title: 'Dinner', emoji: '🌆', tint: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  snack: { title: 'Snacks & Hydration', emoji: '🍎', tint: 'bg-rose-50 text-rose-800 border-rose-200' }
};

export function PhysicalPlan() {
  const navigate = useNavigate();

  // Mode and view state
  const [activeTab, setActiveTab] = useState('week'); // 'week' | 'today'
  const [daysCount, setDaysCount] = useState(7); // 7 | 14 | 30
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [isExamPeriod, setIsExamPeriod] = useState(false);
  const [useBaseline, setUseBaseline] = useState(false);

  // Data state
  const [planData, setPlanData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyMode, setHistoryMode] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [loadingSnapshotId, setLoadingSnapshotId] = useState('');
  const [viewingSavedPlan, setViewingSavedPlan] = useState(false);

  // Today timeline statuses
  const [statuses, setStatuses] = useState({});
  const [water, setWater] = useState(5);

  const fetchPlan = async () => {
    setLoading(true);
    setError('');
    try {
      const [wp, prof] = await Promise.all([
        getWeekPlan(isExamPeriod, useBaseline, daysCount).catch(() => null),
        getProfile().catch(() => null)
      ]);
      setPlanData(wp);
      setUserProfile(prof);
      setSelectedDayIdx((prev) => (wp?.days && prev >= wp.days.length ? 0 : prev));
    } catch (err) {
      console.error(err);
      setError('Unable to load your personalized plan. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!viewingSavedPlan) fetchPlan();
  }, [isExamPeriod, useBaseline, daysCount, viewingSavedPlan]);

  const openHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      setHistoryRecords(await getWeekPlanHistory());
      setHistoryMode(true);
    } catch (err) {
      setHistoryError('Could not load your saved plan history. Please try again.');
      setHistoryMode(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openSnapshot = async (record) => {
    setLoadingSnapshotId(record.id);
    setHistoryError('');
    try {
      const saved = await getWeekPlanSnapshot(record.id);
      setPlanData(saved.plan);
      setUserProfile(saved.plan?.user_preferences || null);
      setDaysCount(saved.days_count);
      setIsExamPeriod(Boolean(record.is_exam_period));
      setUseBaseline(Boolean(record.use_baseline));
      setSelectedDayIdx(0);
      setActiveTab('week');
      setViewingSavedPlan(true);
      setHistoryMode(false);
    } catch (err) {
      setHistoryError('Could not open that saved plan. Please try again.');
    } finally {
      setLoadingSnapshotId('');
    }
  };

  const returnToCurrentPlan = () => {
    setHistoryMode(false);
    setViewingSavedPlan(false);
  };

  const setStatus = (id, s) => setStatuses((prev) => ({ ...prev, [id]: s }));

  const currentDay = planData?.days?.[selectedDayIdx] || planData?.days?.[0];
  const userPrefs = planData?.user_preferences || userProfile || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Personalized Wellbeing Plan"
          subtitle={`Adaptive ${daysCount}-day schedule tailored to your available time, dietary preferences, and university workload.`}
        />

        {/* View & Duration Toggles */}
        <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-black/[0.08] shadow-sm">
            {[
              { label: '1 Week', count: 7 },
              { label: '2 Weeks', count: 14 },
              { label: '1 Month', count: 30 }
            ].map((tf) => (
              <button
                key={tf.count}
                onClick={() => setDaysCount(tf.count)}
                disabled={viewingSavedPlan}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                  daysCount === tf.count
                    ? 'bg-charcoal text-white shadow-xs'
                    : 'text-charcoal-light hover:text-charcoal'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-black/[0.08] shadow-sm">
            <button
              onClick={() => setActiveTab('week')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all',
                activeTab === 'week' ? 'bg-brand-500 text-white shadow-soft' : 'text-charcoal-light hover:text-charcoal'
              )}
            >
              <CalendarIcon size={14} /> {daysCount}-Day Plan
            </button>
            <button
              onClick={() => setActiveTab('today')}
                disabled={viewingSavedPlan}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all',
                activeTab === 'today' ? 'bg-brand-500 text-white shadow-soft' : 'text-charcoal-light hover:text-charcoal'
              )}
            >
              <ClockIcon size={14} /> Today's Schedule
            </button>
          </div>

          <button
            type="button"
            onClick={openHistory}
            disabled={historyLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-bold text-charcoal shadow-sm transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            <HistoryIcon size={14} /> {historyLoading ? 'Loading…' : 'Past Plans'}
          </button>
        </div>
      </div>

      <PhysicalNav />

      {viewingSavedPlan && (
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3 border border-brand-200 bg-brand-50/80">
          <p className="text-sm font-semibold text-brand-900">Viewing a saved plan from {planData?.days?.[0]?.date || 'an earlier date'}.</p>
          <Button size="sm" variant="outline" onClick={returnToCurrentPlan}>Back to current plan</Button>
        </Card>
      )}

      {/* Model & Research Evaluation Control Bar */}
      <Card padding="sm" className="bg-gradient-to-r from-cream via-white to-brand-50/40 border border-brand-200/50">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-brand-100 text-brand-700">
              <SparklesIcon size={16} />
            </span>
            <div>
              <p className="font-extrabold text-charcoal">
                {planData?.model_version || 'Adaptive XGBoost Engine'}
              </p>
              <p className="text-[11px] text-charcoal-muted">
                {planData?.context_aware
                  ? 'Dynamically tuned to workload, stress & physical limitations'
                  : 'Static baseline rule filter ignoring stress context'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Exam Period Toggle */}
            <button
              onClick={() => setIsExamPeriod(!isExamPeriod)}
              disabled={viewingSavedPlan}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all border',
                isExamPeriod
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-white text-charcoal-light border-black/10 hover:border-black/20'
              )}
            >
              <span>📚</span> Exam Period Mode: {isExamPeriod ? 'ON (-50% workout time)' : 'OFF'}
            </button>

            {/* Model Toggle for Research Demonstration */}
            <button
              onClick={() => setUseBaseline(!useBaseline)}
              disabled={viewingSavedPlan}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all border',
                useBaseline
                  ? 'bg-charcoal text-white border-charcoal'
                  : 'bg-white text-brand-700 border-brand-300 hover:bg-brand-50'
              )}
              title="Toggle between Model 1 (Static Baseline) and Model 2 (Adaptive AI)"
            >
              <LayersIcon size={13} /> {useBaseline ? 'Model 1 (Baseline)' : 'Model 2 (Adaptive AI)'}
            </button>
          </div>
        </div>

        {/* User Profile Active Preferences Bar */}
        <div className="mt-3 pt-3 border-t border-black/[0.05] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-charcoal-muted uppercase tracking-wider mr-1">
            Active Profile:
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white border border-black/[0.06] font-semibold text-charcoal text-xs">
            🥗 Diet: <strong className="capitalize">{userPrefs.diet_pref || 'Balanced'}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white border border-black/[0.06] font-semibold text-charcoal text-xs">
            🍛 Cuisine: <strong className="capitalize">{String(userPrefs.meal_style || 'Both').replace('_', ' ')}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white border border-black/[0.06] font-semibold text-charcoal text-xs">
            ⏱️ Workout Window: <strong>{planData?.effective_available_minutes || userPrefs.available_minutes || 20} mins</strong>
          </span>
          {userPrefs.physical_limitations && userPrefs.physical_limitations !== 'none' && (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 font-semibold text-amber-800 text-xs">
              🦵 Safety: <strong>{userPrefs.physical_limitations} Protected</strong>
            </span>
          )}
        </div>
      </Card>

      {/* Clinical Risk Triage & Doctor Consultation Banner */}
      {planData?.safety_analysis && planData.safety_analysis.has_limitations && (
        <Card
          padding="md"
          className={cn(
            'border-2 transition-all',
            planData.safety_analysis.doctor_consultation_advised
              ? 'bg-rose-50/80 border-rose-300 text-rose-950 shadow-soft'
              : planData.safety_analysis.choice === 'prefer_not_to_say'
              ? 'bg-blue-50/70 border-blue-200 text-blue-950'
              : 'bg-amber-50/70 border-amber-300 text-amber-950'
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl">
                  {planData.safety_analysis.doctor_consultation_advised ? '🩺' : planData.safety_analysis.choice === 'prefer_not_to_say' ? '🔒' : '🛡️'}
                </span>
                <h3 className="font-extrabold text-sm text-charcoal">
                  {planData.safety_analysis.doctor_consultation_title}
                </h3>
                <span
                  className={cn(
                    'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full',
                    planData.safety_analysis.risk_level === 'high'
                      ? 'bg-rose-600 text-white'
                      : planData.safety_analysis.risk_level === 'moderate'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white'
                  )}
                >
                  Clinical Triage: {planData.safety_analysis.risk_level} risk
                </span>
              </div>

              <p className="text-xs text-charcoal-light leading-relaxed">
                {planData.safety_analysis.doctor_consultation_reason}
              </p>

              {/* Movement exclusions and clinical substitutions */}
              <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-black/[0.06] text-[11px]">
                {planData.safety_analysis.restricted_movements?.length > 0 && (
                  <div className="bg-white/80 rounded-xl p-2.5 border border-black/[0.05]">
                    <span className="font-bold text-rose-700 block mb-1">
                      🚫 Excluded from your routines:
                    </span>
                    <p className="text-charcoal-muted leading-tight">
                      {planData.safety_analysis.restricted_movements.join(', ')}
                    </p>
                  </div>
                )}
                {planData.safety_analysis.safe_modifications?.length > 0 && (
                  <div className="bg-white/80 rounded-xl p-2.5 border border-black/[0.05]">
                    <span className="font-bold text-emerald-700 block mb-1">
                      ✅ Prescribed joint-safe alternatives:
                    </span>
                    <p className="text-charcoal-muted leading-tight">
                      {planData.safety_analysis.safe_modifications.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {planData.safety_analysis.doctor_consultation_advised && (
              <div className="sm:text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-rose-600 text-white px-3 py-1.5 rounded-full shadow-sm">
                  🩺 Doctor Clearance Advised
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <Card padding="lg" className="text-center py-12">
          <div className="w-8 h-8 rounded-full border-3 border-brand-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="font-bold text-charcoal">Generating your personalized weekly schedule…</p>
          <p className="text-xs text-charcoal-muted mt-1">Filtering meals and calibrating workouts to your available minutes.</p>
        </Card>
      ) : error ? (
        <Card padding="lg" className="text-center py-8 bg-rose-50 border border-rose-200">
          <AlertCircleIcon size={24} className="text-rose-600 mx-auto mb-2" />
          <p className="font-bold text-rose-800">{error}</p>
          <Button size="sm" className="mt-4" onClick={fetchPlan}>Try Again</Button>
        </Card>
      ) : historyMode ? (
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-charcoal">Past plan history</h2>
              <p className="mt-1 text-sm text-charcoal-muted">Open a saved schedule to review its workouts and meals.</p>
            </div>
            <Button size="sm" variant="outline" onClick={returnToCurrentPlan}>Back to current plan</Button>
          </div>
          {historyError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{historyError}</p>}
          {historyRecords.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {historyRecords.map((record) => (
                <button key={record.id} type="button" onClick={() => openSnapshot(record)} disabled={Boolean(loadingSnapshotId)} className="rounded-2xl border border-black/[0.07] bg-cream p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-charcoal">{new Date(`${record.plan_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <CalendarIcon size={16} className="text-brand-600" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-charcoal-muted">{record.days_count}-day plan · {record.use_baseline ? 'Baseline model' : 'Adaptive model'}{record.is_exam_period ? ' · Exam mode' : ''}</p>
                  <p className="mt-2 text-xs font-bold text-brand-700">{loadingSnapshotId === record.id ? 'Opening…' : 'View this plan →'}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/15 bg-cream/60 p-8 text-center">
              <span className="text-3xl">🗓️</span>
              <p className="mt-2 font-bold text-charcoal">No saved plans yet</p>
              <p className="mt-1 text-sm text-charcoal-muted">Your schedule will appear here after you open the plan page.</p>
            </div>
          )}
        </Card>
      ) : activeTab === 'week' ? (
        /* ── CUSTOM-DAY WEEK PLAN VIEW ── */
        (!planData?.days || planData.days.length === 0) ? (
          <Card padding="lg" className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3 text-2xl">
              📅
            </div>
            <h3 className="text-lg font-bold text-charcoal">No Plan Generated Yet</h3>
            <p className="text-sm text-charcoal-muted mt-1 max-w-md mx-auto">
              Complete your wellbeing assessment to generate your personalized {daysCount}-day nutrition and workout schedule.
            </p>
            <Button className="mt-4" onClick={() => navigate('/physical-setup')}>
              Take Assessment
            </Button>
          </Card>
        ) : (
        <div className="space-y-6">
          {/* Day Selector Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {planData?.days?.map((day, idx) => {
              const isSelected = idx === selectedDayIdx;
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={cn(
                    'flex flex-col items-center min-w-[90px] py-3 px-3 rounded-2xl border transition-all text-center',
                    isSelected
                      ? 'bg-brand-500 text-white border-brand-600 shadow-card font-bold scale-[1.02]'
                      : 'bg-white text-charcoal border-black/[0.06] hover:border-brand-300'
                  )}
                >
                  <span className={cn('text-[11px] uppercase tracking-wider', isSelected ? 'text-white/80' : 'text-charcoal-muted')}>
                    {day.day_name.slice(0, 3)}
                  </span>
                  <span className="text-base font-extrabold my-0.5">
                    {day.date.slice(8)}
                  </span>
                  <span className={cn('text-[10px] font-medium', isSelected ? 'text-white/90' : 'text-charcoal-light')}>
                    Day {day.day_number}
                  </span>
                </button>
              );
            })}
          </div>

          {currentDay && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentDay.date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Day Header Banner */}
                <div className="flex items-center justify-between bg-white rounded-3xl p-5 border border-black/[0.05] shadow-soft">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                      Day {currentDay.day_number} Plan
                    </span>
                    <h2 className="text-xl font-extrabold text-charcoal mt-0.5">
                      {currentDay.day_name}, {currentDay.date}
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-charcoal-muted block">Estimated Routine Time</span>
                    <span className="text-lg font-black text-brand-600">
                      {currentDay.exercise?.minutes || 20} mins
                    </span>
                  </div>
                </div>

                {/* Section 1: Daily Targeted Exercise Routine */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-extrabold text-charcoal flex items-center gap-2">
                      <DumbbellIcon size={18} className="text-brand-500" /> Daily Exercise Routine
                    </h3>
                    {currentDay.exercise?.adherence_probability && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <ShieldCheckIcon size={14} />
                        {Math.round(currentDay.exercise.adherence_probability * 100)}% Predicted Adherence
                      </span>
                    )}
                  </div>

                  <Card padding="lg" className="bg-gradient-to-br from-white to-cream border border-black/[0.06]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-brand-500 text-white">
                            {currentDay.exercise?.intensity || 'Moderate'} Intensity
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-cream text-charcoal border border-black/10">
                            {currentDay.exercise?.equipment || 'Bodyweight'}
                          </span>
                          {currentDay.exercise?.limitation_warning === false && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800">
                              Limitation Safe ✓
                            </span>
                          )}
                        </div>

                        <h4 className="text-lg font-extrabold text-charcoal">
                          {currentDay.exercise?.name}
                        </h4>
                        <p className="text-sm text-charcoal-muted leading-relaxed">
                          {currentDay.exercise?.description}
                        </p>
                      </div>

                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-black/[0.05]">
                        <div className="text-left md:text-right">
                          <p className="text-2xl font-black text-charcoal leading-none">
                            {currentDay.exercise?.minutes} <span className="text-xs font-bold text-charcoal-muted">mins</span>
                          </p>
                          <p className="text-xs font-semibold text-brand-600 mt-1 flex items-center gap-1">
                            <FlameIcon size={13} /> {currentDay.exercise?.calories_burned} kcal
                          </p>
                        </div>
                        <Button
                          size="md"
                          onClick={() => navigate('/app/physical/workout', { state: { workout: currentDay.exercise, dayName: currentDay.day_name, dayDate: currentDay.date } })}
                          className="shrink-0 shadow-soft"
                        >
                          <PlayIcon size={14} fill="currentColor" /> Start Workout
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Section 2: Four Date-Wise Meal Slots */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-charcoal flex items-center gap-2">
                      <UtensilsIcon size={18} className="text-brand-500" /> Daily Meal Slots (Student Nutrition)
                    </h3>
                    <span className="text-xs font-semibold text-charcoal-muted">
                      Culturally matched to {String(userPrefs.meal_style || 'Both').replace('_', ' ')} & {userPrefs.diet_pref}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {['breakfast', 'lunch', 'dinner', 'snack'].map((slotKey) => {
                      const meta = slotMeta[slotKey];
                      const slotMeals = currentDay.meals?.[slotKey] || [];
                      const primary = slotMeals[0];
                      const alternative = slotMeals[1];

                      return (
                        <Card key={slotKey} padding="md" className="flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-black/[0.05]">
                              <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', meta.tint)}>
                                {meta.emoji} {meta.title}
                              </span>
                              {primary?.cuisine && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted">
                                  {primary.cuisine === 'sri_lankan' ? '🇱🇰 Sri Lankan' : '🌍 International'}
                                </span>
                              )}
                            </div>

                            {primary && (
                              <div className="space-y-2">
                                <h4 className="font-extrabold text-charcoal text-base leading-snug">
                                  {primary.name}
                                </h4>
                                <p className="text-xs text-charcoal-muted line-clamp-2">
                                  {primary.description}
                                </p>

                                <div className="grid grid-cols-3 gap-1.5 py-2">
                                  <div className="bg-cream rounded-xl p-2 text-center">
                                    <span className="block text-xs font-black text-charcoal">{primary.calories}</span>
                                    <span className="text-[10px] text-charcoal-muted">kcal</span>
                                  </div>
                                  <div className="bg-cream rounded-xl p-2 text-center">
                                    <span className="block text-xs font-black text-charcoal">{primary.protein}g</span>
                                    <span className="text-[10px] text-charcoal-muted">Protein</span>
                                  </div>
                                  <div className="bg-cream rounded-xl p-2 text-center">
                                    <span className="block text-xs font-black text-charcoal">{primary.prep_time}m</span>
                                    <span className="text-[10px] text-charcoal-muted">Prep</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {alternative && (
                              <div className="mt-3 pt-2.5 border-t border-black/[0.04]">
                                <span className="text-[10px] font-bold uppercase text-charcoal-muted tracking-wider block mb-1">
                                  Alternative Option:
                                </span>
                                <p className="text-xs font-bold text-charcoal-light">
                                  {alternative.name} <span className="text-[10px] text-charcoal-muted font-normal">({alternative.calories} kcal)</span>
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {primary?.diet_category === 'vegan' ? 'Vegan 🌱' : (primary?.diet_category === 'veg' ? 'Vegetarian 🥬' : 'Balanced 🥩')}
                            </span>
                            <button
                              onClick={() => navigate('/app/physical/nutrition')}
                              className="font-bold text-brand-600 hover:text-brand-700"
                            >
                              View Recipe & Macros →
                            </button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        )
      ) : (
        /* ── TODAY'S SCHEDULE TIMELINE VIEW ── */
        <div className="space-y-6">
          {/* Day progress */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-charcoal">Today's Action Progress</p>
              <span className="text-sm font-extrabold text-brand-600">
                {Object.values(statuses).filter((s) => s === 'done').length} / 4 Completed
              </span>
            </div>
            <ProgressBar value={(Object.values(statuses).filter((s) => s === 'done').length / 4) * 100} />
            <p className="text-xs text-charcoal-muted mt-2.5">
              Marking completions adapts your future recommendations through the XGBoost adherence model.
            </p>
          </Card>

          {/* Timeline Blocks */}
          <div className="space-y-4">
            {/* Morning Breakfast */}
            <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0">
                  🌅
                </span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Morning Breakfast
                  </span>
                  <h4 className="font-extrabold text-charcoal text-base mt-1">
                    {currentDay?.meals?.breakfast?.[0]?.name || 'String Hoppers with Dhal Curry'}
                  </h4>
                  <p className="text-xs text-charcoal-muted">
                    {currentDay?.meals?.breakfast?.[0]?.calories} kcal · {currentDay?.meals?.breakfast?.[0]?.protein}g Protein
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant={statuses['bf'] === 'done' ? 'secondary' : 'primary'}
                  onClick={() => setStatus('bf', statuses['bf'] === 'done' ? 'todo' : 'done')}
                >
                  {statuses['bf'] === 'done' ? 'Done ✓' : 'Mark Done'}
                </Button>
              </div>
            </Card>

            {/* Daily Workout */}
            <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-brand-300">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center text-xl shrink-0">
                  🏃
                </span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                    Daily Exercise ({currentDay?.exercise?.minutes || 20}m)
                  </span>
                  <h4 className="font-extrabold text-charcoal text-base mt-1">
                    {currentDay?.exercise?.name}
                  </h4>
                  <p className="text-xs text-charcoal-muted">
                    {currentDay?.exercise?.intensity} Intensity · Burn ~{currentDay?.exercise?.calories_burned} kcal
                  </p>
                </div>
              </div>
              <Button size="md" onClick={() => navigate('/app/physical/workout', { state: { workout: currentDay?.exercise, dayName: currentDay?.day_name, dayDate: currentDay?.date } })}>
                <PlayIcon size={14} fill="currentColor" /> Start Workout
              </Button>
            </Card>

            {/* Midday Lunch */}
            <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl shrink-0">
                  ☀️
                </span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Midday Lunch
                  </span>
                  <h4 className="font-extrabold text-charcoal text-base mt-1">
                    {currentDay?.meals?.lunch?.[0]?.name || 'Red Rice with Dhal Curry & Vegetables'}
                  </h4>
                  <p className="text-xs text-charcoal-muted">
                    {currentDay?.meals?.lunch?.[0]?.calories} kcal · {currentDay?.meals?.lunch?.[0]?.protein}g Protein
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={statuses['lu'] === 'done' ? 'secondary' : 'primary'}
                onClick={() => setStatus('lu', statuses['lu'] === 'done' ? 'todo' : 'done')}
              >
                {statuses['lu'] === 'done' ? 'Done ✓' : 'Mark Done'}
              </Button>
            </Card>

            {/* Afternoon Hydration & Snack */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center text-lg shrink-0">
                    💧
                  </span>
                  <div>
                    <h4 className="font-bold text-charcoal text-sm">Water & Healthy Snack</h4>
                    <p className="text-xs text-charcoal-muted">
                      {currentDay?.meals?.snack?.[0]?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setWater((w) => Math.max(0, w - 1))}
                    className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-charcoal-light hover:bg-black/[0.06]"
                  >
                    <MinusIcon size={13} />
                  </button>
                  <span className="text-xs font-extrabold text-brand-600 px-1">{water} / 8 glasses</span>
                  <button
                    onClick={() => setWater((w) => Math.min(8, w + 1))}
                    className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600"
                  >
                    <PlusIcon size={13} />
                  </button>
                </div>
              </div>
              <ProgressBar value={(water / 8) * 100} color="bg-sky-400" />
            </Card>

            {/* Evening Dinner */}
            <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-xl shrink-0">
                  🌆
                </span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    Evening Dinner
                  </span>
                  <h4 className="font-extrabold text-charcoal text-base mt-1">
                    {currentDay?.meals?.dinner?.[0]?.name || 'String Hoppers with Vegetable Soup'}
                  </h4>
                  <p className="text-xs text-charcoal-muted">
                    {currentDay?.meals?.dinner?.[0]?.calories} kcal · Light digest for deep sleep
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={statuses['dn'] === 'done' ? 'secondary' : 'primary'}
                onClick={() => setStatus('dn', statuses['dn'] === 'done' ? 'todo' : 'done')}
              >
                {statuses['dn'] === 'done' ? 'Done ✓' : 'Mark Done'}
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
