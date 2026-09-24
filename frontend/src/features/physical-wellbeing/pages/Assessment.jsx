import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Logo } from '../../../shared/components/ui/Logo';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { initialAssessment, StepPersonal, StepGoals, StepLifestyle, StepConditions, StepNutrition } from '../components/AssessmentSteps';
import { saveProfile } from '../api';
// Assessment answers -> the recommender's WellbeingProfile fields
const toProfile = (s) => ({
    goal: s.goals.includes('lose') ? 'weight_loss' : 'fitness',
    activity_level: { beginner: 'low', moderate: 'medium' }[s.fitness] || 'high',
    available_minutes: parseInt(s.availableTime, 10) || 20,
    equipment: [],
    diet_pref: { veg: 'veg', vegan: 'veg', nonveg: 'non-veg' }[s.diet] || 'any',
    sleep_hours: Number(s.sleep)
});
const steps = [
    { title: 'Personal Information', subtitle: 'This helps us size your plan correctly.' },
    { title: 'What would you like to achieve?', subtitle: 'Your goals shape every recommendation.' },
    { title: 'Your university lifestyle', subtitle: 'We plan around your real week, not an ideal one.' },
    { title: 'Physical conditions', subtitle: 'Do you have any limitations we should consider?' },
    { title: 'Tell us about your food preferences', subtitle: 'So meals actually fit what you like to eat.' }
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
        catch {
            setError('Could not save your profile. Please try again.');
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
    return (<div className="min-h-screen w-full bg-cream flex flex-col">
      <header className="p-5 flex items-center justify-between max-w-2xl w-full mx-auto">
        <Logo size={34} textClass="text-lg"/>
        <button onClick={() => navigate('/app/physical')} className="text-sm font-semibold text-charcoal-muted hover:text-charcoal">
          Skip
        </button>
      </header>

      <div className="flex-1 max-w-2xl w-full mx-auto px-5 pb-32">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={back} className="w-9 h-9 rounded-full bg-white border border-black/[0.05] shadow-soft flex items-center justify-center text-charcoal-light shrink-0" aria-label="Back">
              <ArrowLeftIcon size={17}/>
            </button>
            <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">
              Step {step + 1} of {steps.length}
            </span>
          </div>
          <ProgressBar value={(step + 1) / steps.length * 100}/>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28 }}>
            <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">{steps[step].title}</h1>
            <p className="text-sm text-charcoal-muted mt-1 mb-6">{steps[step].subtitle}</p>

            {step === 0 && <StepPersonal state={state} set={set}/>}
            {step === 1 && <StepGoals state={state} set={set}/>}
            {step === 2 && <StepLifestyle state={state} set={set}/>}
            {step === 3 && <StepConditions state={state} set={set}/>}
            {step === 4 && <StepNutrition state={state} set={set}/>}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-cream/90 backdrop-blur-xl border-t border-black/[0.05] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-sm font-semibold text-brand-700 text-center mb-2">{error}</p>}
          <Button size="lg" fullWidth onClick={next} disabled={saving}>
            {step === steps.length - 1 ? 'Create My Plan' : 'Continue'} <ArrowRightIcon size={18}/>
          </Button>
        </div>
      </div>
    </div>);
}
