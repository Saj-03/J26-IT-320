import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PencilIcon, RotateCwIcon, ChevronRightIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { PhysicalNav } from '../components/PhysicalNav';
import { MedicalDisclaimer } from '../components/Shared';
import { getProfile } from '../api';
import useStudent from '../../../shared/hooks/useStudent';

const GOAL_LABELS = {
  fitness: 'Improve Physical Fitness',
  weight_loss: 'Weight Management',
  weight_gain: 'Gain Weight',
  lose: 'Weight Loss',
  tone: 'Muscle Tone & Strength',
  strength: 'Strength & Conditioning',
  mobility: 'Flexibility & Posture',
  flexibility: 'Flexibility & Posture',
  active: 'Daily Activity & Energy',
  stress: 'Stress Relief & Decompression'
};
const LEVEL_LABELS = { low: 'Beginner', medium: 'Moderate', high: 'Active' };
const DIET_LABELS = {
  any: 'Balanced (No Preference)',
  veg: 'Vegetarian',
  vegan: 'Vegan (100% Plant-Based)',
  'non-veg': 'Non-Vegetarian'
};

function buildRows(p) {
  if (!p) return [];
  const a = p.assessment_data || {};
  const lims = (p.physical_limitations || 'none').split(',').filter(x => x && x !== 'none');
  const goalsStr = (p.goals && Array.isArray(p.goals) && p.goals.length)
    ? p.goals.map(g => GOAL_LABELS[g] || g).join(', ')
    : (GOAL_LABELS[p.goal] || p.goal || 'General Fitness');

  const mealStyleStr = p.meal_style === 'sri_lankan'
    ? 'Authentic Sri Lankan'
    : (p.meal_style === 'western' ? 'International Healthy' : 'Sri Lankan & International');

  return [
    { emoji: '🎯', label: 'Primary Goal', value: GOAL_LABELS[p.goal] || p.goal || 'General Fitness' },
    { emoji: '✨', label: 'Other Goals', value: goalsStr },
    { emoji: '⏱️', label: 'Available Workout Time', value: `${p.available_minutes || 20} min (Strictly Constrained)` },
    { emoji: '🏋️', label: 'Equipment', value: Array.isArray(p.equipment) && p.equipment.length ? p.equipment.join(', ') : 'No equipment listed' },
    { emoji: '🏃', label: 'Preferred Activities', value: Array.isArray(p.preferred_activities) && p.preferred_activities.length ? p.preferred_activities.join(', ') : 'No activities listed' },
    { emoji: '🥗', label: 'Dietary Preference', value: DIET_LABELS[p.diet_pref] || p.diet_pref },
    { emoji: '🍛', label: 'Cuisine Style', value: mealStyleStr },
    { emoji: '🦵', label: 'Physical Limitations', value: lims.length ? lims.join(', ') : 'None Reported (All exercises safe)' },
    { emoji: '🚫', label: 'Foods to Avoid', value: p.avoid_foods || 'None' },
    { emoji: '🥜', label: 'Food Allergies', value: p.allergies || 'None' },
    { emoji: '❤️', label: 'Favourite Foods', value: p.favourite_foods || 'None listed' },
    { emoji: '🧑', label: 'Age', value: a.age ? `${a.age} years` : 'Not saved' },
    { emoji: '⚧️', label: 'Gender', value: a.gender || 'Not saved' },
    { emoji: '📏', label: 'Height / Weight', value: a.height && a.weight ? `${a.height} cm / ${a.weight} kg` : 'Not saved' },
    { emoji: '📖', label: 'Study Hours', value: a.studyHours || 'Not saved' },
    { emoji: '📝', label: 'Academic Tasks', value: a.academicTasks || 'Not saved' },
    { emoji: '🧠', label: 'Stress / Burnout', value: a.stressLevel && a.burnoutLevel ? `${a.stressLevel} / 5 stress · ${a.burnoutLevel} / 5 burnout` : 'Not saved' },
    { emoji: '🚧', label: 'Barriers', value: Array.isArray(a.barriers) && a.barriers.length ? a.barriers.join(', ') : 'None listed' },
    { emoji: '🌱', label: 'Nutrition Goals', value: Array.isArray(a.nutritionGoals) && a.nutritionGoals.length ? a.nutritionGoals.join(', ') : 'None listed' },
    { emoji: '🍽️', label: 'Meal Source', value: a.mealSource || 'Not saved' },
    { emoji: '📅', label: 'Exercise Frequency', value: a.exerciseFreq !== undefined ? `${a.exerciseFreq} days / week` : 'Not saved' },
    { emoji: '🌅', label: 'Preferred Exercise Time', value: p.preferred_time ? (p.preferred_time.charAt(0).toUpperCase() + p.preferred_time.slice(1)) : 'Morning' },
    { emoji: '📊', label: 'Activity Level', value: LEVEL_LABELS[p.activity_level] || p.activity_level },
    { emoji: '😴', label: 'Sleep Target', value: `${p.sleep_hours || 7} hours / night` },
    { emoji: '💪', label: 'Current BMI', value: p.bmi ? p.bmi.toFixed(1) : '—' },
    { emoji: '📚', label: 'Academic Workload Score', value: p.workload_intensity_score ? `${Math.round(p.workload_intensity_score)} / 100` : '—' },
  ];
}
export function PhysicalProfile() {
  const student = useStudent();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerated, setRegenerated] = useState(false);

  useEffect(() => {
    getProfile()
      .then((savedProfile) => {
        let localAnswers = null;
        try {
          const savedKey = `wellbeing-assessment-saved:${student.email || 'guest'}`;
          if (localStorage.getItem(savedKey) === 'true') {
            localAnswers = JSON.parse(localStorage.getItem(`wellbeing-assessment:${student.email || 'guest'}`) || 'null');
          }
        } catch { /* ignore invalid local draft */ }
        setProfile({
          ...savedProfile,
          assessment_data: savedProfile.assessment_data && Object.keys(savedProfile.assessment_data).length
            ? savedProfile.assessment_data
            : (localAnswers || {}),
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [student.email]);

  const rows = buildRows(profile);
  const preferenceGroups = [
    {
      title: 'Personal & academic', subtitle: 'Your student routine and wellbeing context', emoji: '🎓',
      labels: ['Age', 'Gender', 'Height / Weight', 'Study Hours', 'Academic Tasks', 'Stress / Burnout', 'Barriers', 'Academic Workload Score']
    },
    {
      title: 'Movement & recovery', subtitle: 'How you like to move and recharge', emoji: '🏃',
      labels: ['Primary Goal', 'Other Goals', 'Activity Level', 'Available Workout Time', 'Exercise Frequency', 'Preferred Activities', 'Equipment', 'Physical Limitations', 'Preferred Exercise Time', 'Sleep Target', 'Current BMI']
    },
    {
      title: 'Food & nutrition', subtitle: 'Your food preferences and meal routine', emoji: '🥗',
      labels: ['Dietary Preference', 'Cuisine Style', 'Nutrition Goals', 'Meal Source', 'Foods to Avoid', 'Food Allergies', 'Favourite Foods']
    }
  ].map((group) => ({ ...group, rows: rows.filter((row) => group.labels.includes(row.label)) }));

  const regenerate = () => {
    setRegenerating(true);
    setTimeout(() => {
      setRegenerating(false);
      setRegenerated(true);
    }, 1600);
  };
  return (<div className="space-y-6">
    <PageHeader title="My Wellbeing Profile" subtitle="Everything the AI uses to build your plan — fully editable." action={<Button variant="outline" onClick={() => navigate('/physical-setup/assessment')}>
      <PencilIcon size={15} /> Edit Preferences
    </Button>} />

    <PhysicalNav />

    {/* Identity */}
    <Card padding="sm" className="relative isolate overflow-hidden border-0 bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 text-white shadow-card">
      <div className="absolute -right-12 -top-24 -z-10 h-56 w-56 rounded-full border-[28px] border-white/10" aria-hidden="true" />
      <div className="absolute right-28 -bottom-24 -z-10 h-36 w-36 rounded-full bg-white/[0.06] blur-2xl" aria-hidden="true" />
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
        <div className="rounded-full bg-white/15 p-1 ring-1 ring-white/25"><Avatar src={student.avatar} name={student.fullName} size={54} ring /></div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">Your wellbeing profile</p>
          <h2 className="mt-0.5 text-lg font-extrabold tracking-tight">{student.fullName}</h2>
          <p className="mt-0.5 text-xs text-white/80">A plan shaped around your routine.</p>
        </div>
        {profile && (
          <div className="grid grid-cols-2 gap-1.5 sm:min-w-[230px]">
            {[
              { label: 'Activity level', value: LEVEL_LABELS[profile.activity_level] || profile.activity_level || '—', icon: '⚡' },
              { label: 'Workout window', value: `${profile.available_minutes || 20} min`, icon: '⏱️' },
              { label: 'BMI', value: profile.bmi ? profile.bmi.toFixed(1) : '—', icon: '📊' },
              { label: 'Study load', value: `${Math.round(profile.workload_intensity_score || 0)} / 100`, icon: '📚' },
            ].map((stat) => <div key={stat.label} className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 backdrop-blur-sm">
              <p className="text-[9px] font-semibold text-white/70">{stat.icon} {stat.label}</p>
              <p className="mt-0.5 text-xs font-extrabold text-white">{stat.value}</p>
            </div>)}
          </div>
        )}
      </div>
    </Card>

    <div className="grid items-start gap-5 lg:grid-cols-4 lg:gap-6">
      {/* Preference rows */}
      <Card padding="lg" className="lg:col-span-3">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Made for you</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-charcoal">Your preferences</h2>
            <p className="mt-1 text-sm text-charcoal-muted">The details behind your personalized plan.</p>
          </div>
          {!profileLoading && profile && <span className="rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-700">{rows.length} profile details</span>}
        </div>
        {profileLoading ? (
          <p className="text-sm text-charcoal-muted py-4">Loading your saved preferences…</p>
        ) : !profile ? (
          <div className="py-4">
            <p className="text-sm text-charcoal-muted mb-3">No profile found. Complete the assessment to set your preferences.</p>
            <Button size="sm" className="bg-white text-charcoal border border-black/10 hover:bg-gray-50" onClick={() => navigate('/physical-setup/assessment')}>Start Assessment</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {preferenceGroups.map((group) => <section key={group.title} className="rounded-3xl border border-black/[0.05] bg-white p-4 sm:p-5 shadow-[0_4px_18px_rgba(31,54,48,0.035)]">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-xl">{group.emoji}</span>
                <div>
                  <h3 className="font-extrabold text-charcoal">{group.title}</h3>
                  <p className="text-xs text-charcoal-muted">{group.subtitle}</p>
                </div>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {group.rows.map((row) => <div key={row.label} className="min-w-0 rounded-2xl bg-cream/70 px-3.5 py-3 transition-colors hover:bg-brand-50/70">
                  <p className="flex items-center gap-2 text-[11px] font-semibold text-charcoal-muted"><span aria-hidden="true">{row.emoji}</span>{row.label}</p>
                  <p className="mt-1 break-words text-sm font-bold leading-snug text-charcoal">{row.value}</p>
                </div>)}
              </div>
            </section>)}
          </div>
        )}
      </Card>

      {/* Regenerate + links */}
      <div className="space-y-3 lg:sticky lg:top-5">
        <Card padding="sm" className="border border-black/[0.04]">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <RotateCwIcon size={15} />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-charcoal">Update your plan</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-charcoal-muted">
                Match recommendations to your preferences.
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {regenerated ?
              <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 rounded-xl bg-sage-light p-2.5">
                <span>✅</span>
                <p className="text-xs font-semibold text-emerald-700">Plan updated.</p>
              </motion.div> :
              <Button key="btn" size="sm" fullWidth className="mt-3" disabled={regenerating} onClick={regenerate}>
                {regenerating ?
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Regenerating…
                  </> :
                  <>
                    <RotateCwIcon size={16} /> Regenerate My Plan
                  </>}
              </Button>}
          </AnimatePresence>
        </Card>

        <div className="space-y-2">
          {[
            { emoji: '🔔', label: 'Notifications', desc: 'Gentle nudges only', to: '/app/physical/notifications' },
            { emoji: '🔒', label: 'Privacy & Data Controls', desc: 'View, download or delete', to: '/app/physical/privacy' }
            ].
            map((l) => <button key={l.label} onClick={() => navigate(l.to)} className="flex w-full items-center gap-2.5 rounded-2xl border border-black/[0.04] bg-white p-3 text-left shadow-soft transition-shadow hover:shadow-card">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cream text-base">{l.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-charcoal">{l.label}</p>
                <p className="text-[10px] leading-snug text-charcoal-muted">{l.desc}</p>
              </div>
              <ChevronRightIcon size={15} className="shrink-0 text-charcoal-muted" />
            </button>)}
        </div>
      </div>
    </div>

    <MedicalDisclaimer />
  </div>);
}
