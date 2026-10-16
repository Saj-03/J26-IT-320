import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Logo } from '../../../shared/components/ui/Logo';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import {
  initialAssessment,
  StepPersonal,
  StepStressBarriers,
  StepGoals,
  StepExerciseSafety,
  StepNutrition
} from '../components/AssessmentSteps';
import { saveProfile } from '../api';
import { apiErrorMessage } from '../../../shared/api/client';

// Map study hour strings to numeric hours (matches survey STUDY_MAP)
const STUDY_HOUR_MAP = {
  'Less than 5 hours': 4.0,
  '5–10 hours': 7.5,
  '10–20 hours': 15.0,
  'More than 20 hours': 22.0
};

// Map task range strings to numeric tasks (matches survey TASK_MAP)
const TASK_COUNT_MAP = {
  '1–2 tasks': 1.5,
  '3–5 tasks': 4.0,
  'More than 5 tasks': 6.0
};

// Map available time strings to exact minutes
const TIME_MINUTES_MAP = {
  'Less than 15 minutes': 15,
  '15–30 minutes': 20,
  '31–45 minutes': 35,
  '46–60 minutes': 45,
  'More than 60 minutes': 60
};

// Assessment answers -> the recommender's WellbeingProfile fields
const toProfile = (s) => {
  const h = parseFloat(s.height) / 100 || 1.68;   // height in metres
  const w = parseFloat(s.weight) || 62;
  const bmi = Math.round((w / (h * h)) * 10) / 10;

  // Workload Intensity Score (0 to 100) based on study hours, tasks, and barriers
  const studyHoursVal = STUDY_HOUR_MAP[s.studyHours] || 7.5;
  const taskCountVal = TASK_COUNT_MAP[s.academicTasks] || 4.0;
  const barrierCount = (s.barriers || []).length;
  const workload = Math.min(100.0, Math.round((studyHoursVal * 2.2) + (taskCountVal * 6.5) + (barrierCount * 4.5)));

  // Stress and Burnout: Strictly on 1.0 to 5.0 scale matching the ML model & survey
  const stress = Math.min(5.0, Math.max(1.0, Number(s.stressLevel) || 3.0));
  const burnout = Math.min(5.0, Math.max(1.0, Number(s.burnoutLevel) || 3.0));

  // Equipment access selection
  const equipArr = Array.isArray(s.equipment) && s.equipment.length > 0 ? s.equipment : ['No equipment'];

  // Physical limitations: mapping to keywords recognized by safety filter
  let physical_limitations = 'none';
  if (s.limitationChoice === 'prefer_not_to_say' || (s.limitations || []).includes('prefer_not_to_say')) {
    physical_limitations = 'prefer_not_to_say';
  } else if (s.limitationChoice === 'no' || (s.limitations || []).includes('none')) {
    physical_limitations = 'none';
  } else {
    const lims = (s.limitations || []).filter(x => x !== 'none' && x !== 'prefer_not_to_say');
    const limLabels = lims.map(l => {
      if (l === 'lower_body') return 'lower-body (knee)';
      if (l === 'upper_body') return 'upper-body (back)';
      if (l === 'shoulder_neck') return 'shoulder and neck';
      if (l === 'high_impact') return 'high-impact';
      if (l === 'respiratory') return 'respiratory (asthma)';
      if (l === 'cardiovascular') return 'cardiovascular (blood pressure/dizziness)';
      if (l === 'surgery_injury') return 'recent surgery or injury';
      if (l === 'flexibility') return 'flexibility and stiffness';
      return l;
    });
    if (s.limitationSeverity) {
      limLabels.push(`Severity: ${s.limitationSeverity}`);
    }
    if (s.limitationNote && s.limitationNote.trim()) {
      limLabels.push(`Notes: ${s.limitationNote.trim()}`);
    }
    physical_limitations = limLabels.length ? limLabels.join('; ') : 'none';
  }

  // Primary goal mapping
  let primaryGoal = 'fitness';
  const goalsArr = Array.isArray(s.goals) && s.goals.length > 0 ? s.goals : ['Improve overall fitness'];
  const goalsStr = goalsArr.join(' ').toLowerCase();
  if (goalsStr.includes('weight')) primaryGoal = 'weight_loss';
  else if (goalsStr.includes('strength')) primaryGoal = 'strength';
  else if (goalsStr.includes('flexibility') || goalsStr.includes('mobility')) primaryGoal = 'mobility';

  // Available minutes: parse integer from map or numeric string
  const availMins = TIME_MINUTES_MAP[s.availableTime] || parseInt(String(s.availableTime || '20').replace(/[^0-9]/g, ''), 10) || 20;

  // Meal style mapping: "Sri Lankan meals" -> "sri_lankan", "International meals" -> "western", "Combination of both" -> "both"
  const mealStyleStr = String(s.mealStyle || 'Combination of both').toLowerCase();
  const meal_style = mealStyleStr.includes('sri') ? 'sri_lankan' : (mealStyleStr.includes('inter') ? 'western' : 'both');

  // Diet mapping: preserve vegan vs veg vs non-veg
  const dietStr = String(s.diet || 'Non-Vegetarian').toLowerCase();
  let diet_pref = 'non-veg';
  if (dietStr.includes('vegan')) diet_pref = 'vegan';
  else if (dietStr.includes('vegetarian') && !dietStr.includes('non')) diet_pref = 'veg';
  else if (dietStr.includes('no specific') || dietStr.includes('any')) diet_pref = 'any';

  // Activity level mapping: 'Very inactive' -> 'low', etc.
  const actStr = String(s.activityLevel || 'Moderately active').toLowerCase();
  let activity_level = 'medium';
  if (actStr.includes('inactive') || actStr.includes('lightly')) activity_level = 'low';
  else if (actStr.includes('highly') || actStr.includes('very active')) activity_level = 'high';

  return {
    goal: primaryGoal,
    goals: goalsArr,
    activity_level,
    available_minutes: availMins,
    equipment: equipArr,
    diet_pref,
    meal_style,
    allergies: s.allergies || '',
    avoid_foods: s.avoid || '',
    favourite_foods: s.favourites || '',
    preferred_time: String(s.preferredTime || 'evening').toLowerCase(),
    preferred_activities: Array.isArray(s.activities) ? s.activities : ['Home workouts', 'Walking'],
    sleep_hours: Number(s.sleep) || 7.0,
    workload_intensity_score: workload,
    stress_score: stress,
    burnout_score: burnout,
    bmi,
    physical_limitations,
  };
};

const steps = [
  { title: 'Personal & Academic Profile', subtitle: 'Calibrating body metrics and study schedules from your university routine.' },
  { title: 'Academic Stress & Barriers', subtitle: 'Helping our adaptive model balance workout intensity with your academic pressure.' },
  { title: 'Physical Goals & Activity Level', subtitle: 'Targeting your fitness ambitions and baseline stamina.' },
  { title: 'Exercise Preferences & Safety', subtitle: 'Tailoring activity types, available time, and protecting physical limitations.' },
  { title: 'Nutrition & Meal Preferences', subtitle: 'Personalizing culturally authentic Sri Lankan & international healthy meals.' }
];

export function PhysicalAssessment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState(initialAssessment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setState((s) => ({ ...s, [key]: value }));

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      await saveProfile(toProfile(state));
      navigate('/physical-setup/generating');
    }
    catch (err) {
      console.error('Save profile error:', err);
      setError(apiErrorMessage(err, 'Could not save your profile. Please try again.'));
    }
    finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === steps.length - 1)
      finish();
    else
      setStep((s) => s + 1);
  };

  const back = () => {
    if (step === 0)
      navigate('/physical-setup');
    else
      setStep((s) => s - 1);
  };

  return (
    <div className="min-h-screen w-full bg-cream flex flex-col">
      <header className="p-5 flex items-center justify-between max-w-2xl w-full mx-auto">
        <Logo size={34} textClass="text-lg" />
        <button onClick={() => navigate('/app/physical')} className="text-sm font-semibold text-charcoal-muted hover:text-charcoal">
          Skip
        </button>
      </header>

      <div className="flex-1 max-w-2xl w-full mx-auto px-5 pb-32">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={back} className="w-9 h-9 rounded-full bg-white border border-black/[0.05] shadow-soft flex items-center justify-center text-charcoal-light shrink-0" aria-label="Back">
              <ArrowLeftIcon size={17} />
            </button>
            <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">
              Step {step + 1} of {steps.length}
            </span>
          </div>
          <ProgressBar value={(step + 1) / steps.length * 100} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28 }}>
            <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">{steps[step].title}</h1>
            <p className="text-sm text-charcoal-muted mt-1 mb-6">{steps[step].subtitle}</p>

            {step === 0 && <StepPersonal state={state} set={set} />}
            {step === 1 && <StepStressBarriers state={state} set={set} />}
            {step === 2 && <StepGoals state={state} set={set} />}
            {step === 3 && <StepExerciseSafety state={state} set={set} />}
            {step === 4 && <StepNutrition state={state} set={set} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-cream/90 backdrop-blur-xl border-t border-black/[0.05] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-sm font-semibold text-brand-700 text-center mb-2">{error}</p>}
          <Button size="lg" fullWidth onClick={next} disabled={saving}>
            {step === steps.length - 1 ? 'Create My Plan' : 'Continue'} <ArrowRightIcon size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
