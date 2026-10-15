import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, ArrowLeftIcon, SunriseIcon, SunIcon, MoonIcon, GraduationCapIcon, TrendingUpIcon, HeartIcon, BrainIcon, TargetIcon, BriefcaseIcon, CheckCircle2Icon, SparklesIcon } from 'lucide-react';
import { Logo } from '../shared/components/ui/Logo';
import { Button } from '../shared/components/ui/Button';
import { Field, SelectField } from '../shared/components/ui/Field';
import { ProgressBar } from '../shared/components/ui/ProgressBar';
import { cn } from '../shared/lib/cn';
const TOTAL = 6;
export function Onboarding() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [rhythm, setRhythm] = useState('morning');
    const [balance, setBalance] = useState({ academic: 4, work: 3, sleep: 3, social: 4, wellbeing: 3 });
    const [goals, setGoals] = useState(['Improve focus', 'Reduce stress']);
    const next = () => setStep((s) => Math.min(TOTAL, s + 1));
    const back = () => setStep((s) => Math.max(0, s - 1));
    const toggleGoal = (g) => setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
    const progress = step / TOTAL * 100;
    return (<div className="min-h-screen w-full bg-cream flex flex-col">
      <header className="p-5 flex items-center justify-between max-w-2xl w-full mx-auto">
        <Logo size={34} textClass="text-lg"/>
        {step > 0 && step < TOTAL &&
            <button onClick={() => navigate('/app')} className="text-sm font-semibold text-charcoal-muted hover:text-charcoal">
            Skip
          </button>}
      </header>

      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-xl">
          {step < TOTAL &&
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">
                  Step {step + 1} of {TOTAL}
                </span>
              </div>
              <ProgressBar value={progress}/>
            </div>}

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
              {step === 0 &&
            <div className="text-center">
                  <div className="w-16 h-16 rounded-3xl bg-brand-500 text-white flex items-center justify-center mx-auto mb-6 shadow-glow">
                    <SparklesIcon size={28}/>
                  </div>
                  <h1 className="text-3xl font-extrabold text-charcoal">Welcome to ThriveU</h1>
                  <p className="mt-3 text-charcoal-light max-w-sm mx-auto">Let’s build a system that works with your life.</p>
                </div>}

              {step === 1 &&
            <div>
                  <h1 className="text-2xl font-extrabold text-charcoal mb-1">Academic information</h1>
                  <p className="text-charcoal-muted mb-6">Tell us what you’re studying.</p>
                  <div className="space-y-4">
                    <Field label="University" defaultValue="University of Westford"/>
                    <Field label="Degree" defaultValue="BSc Computer Science"/>
                    <SelectField label="Year of study" defaultValue="2">
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </SelectField>
                    <Field label="Main subjects" placeholder="Chemistry, Mathematics, Software Engineering" defaultValue="Chemistry, Mathematics, Software Engineering"/>
                  </div>
                </div>}

              {step === 2 &&
            <div>
                  <h1 className="text-2xl font-extrabold text-charcoal mb-1">Weekly schedule</h1>
                  <p className="text-charcoal-muted mb-6">We’ll plan your study around what’s already fixed.</p>
                  <div className="space-y-4">
                    <Field label="Lecture times" placeholder="Mon–Fri, 10:00–13:00" defaultValue="Mon–Fri, 10:00–13:00"/>
                    <Field label="Work schedule" placeholder="Tue & Thu evenings" defaultValue="Tue & Thu, 16:00–20:00"/>
                    <Field label="Fixed commitments" placeholder="Gym, society meetings…" defaultValue="Gym Mon/Wed/Fri 7am"/>
                  </div>
                </div>}

              {step === 3 &&
            <div>
                  <h1 className="text-2xl font-extrabold text-charcoal mb-1">When do you focus best?</h1>
                  <p className="text-charcoal-muted mb-6">We’ll schedule your hardest work at your peak.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                    { id: 'morning', label: 'Morning person', icon: SunriseIcon },
                    { id: 'afternoon', label: 'Afternoon person', icon: SunIcon },
                    { id: 'night', label: 'Night owl', icon: MoonIcon }
                ].
                    map((r) => <button key={r.id} onClick={() => setRhythm(r.id)} className={cn('flex flex-col items-center gap-3 rounded-3xl p-5 border-2 transition-all', rhythm === r.id ? 'border-brand-500 bg-brand-50' : 'border-black/[0.06] bg-white hover:border-brand-200')}>
                        <r.icon size={26} className={rhythm === r.id ? 'text-brand-500' : 'text-charcoal-muted'}/>
                        <span className="text-sm font-bold text-charcoal text-center leading-tight">{r.label}</span>
                      </button>)}
                  </div>
                </div>}

              {step === 4 &&
            <div>
                  <h1 className="text-2xl font-extrabold text-charcoal mb-1">Life balance</h1>
                  <p className="text-charcoal-muted mb-6">How are things feeling right now? (1–5)</p>
                  <div className="space-y-5">
                    {[
                    { key: 'academic', label: 'Academic workload' },
                    { key: 'work', label: 'Work pressure' },
                    { key: 'sleep', label: 'Sleep quality' },
                    { key: 'social', label: 'Social connection' },
                    { key: 'wellbeing', label: 'Personal wellbeing' }
                ].
                    map((item) => <div key={item.key}>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-semibold text-charcoal-light">{item.label}</span>
                          <span className="text-sm font-bold text-brand-600">{balance[item.key]}</span>
                        </div>
                        <input type="range" min={1} max={5} value={balance[item.key]} onChange={(e) => setBalance((b) => ({ ...b, [item.key]: Number(e.target.value) }))} className="w-full accent-brand-500"/>
                      </div>)}
                  </div>
                </div>}

              {step === 5 &&
            <div>
                  <h1 className="text-2xl font-extrabold text-charcoal mb-1">Your goals</h1>
                  <p className="text-charcoal-muted mb-6">Pick what matters most — you can change these later.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                    { label: 'Improve grades', icon: GraduationCapIcon },
                    { label: 'Reduce stress', icon: HeartIcon },
                    { label: 'Build better habits', icon: TrendingUpIcon },
                    { label: 'Improve focus', icon: BrainIcon },
                    { label: 'Prepare for career', icon: BriefcaseIcon },
                    { label: 'Stay balanced', icon: TargetIcon }
                ].
                    map((g) => {
                    const on = goals.includes(g.label);
                    return (<button key={g.label} onClick={() => toggleGoal(g.label)} className={cn('flex items-center gap-3 rounded-2xl p-4 border-2 text-left transition-all', on ? 'border-brand-500 bg-brand-50' : 'border-black/[0.06] bg-white hover:border-brand-200')}>
                          <g.icon size={20} className={on ? 'text-brand-500' : 'text-charcoal-muted'}/>
                          <span className="text-sm font-bold text-charcoal">{g.label}</span>
                        </button>);
                })}
                  </div>
                </div>}

              {step === TOTAL &&
            <div className="text-center">
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14 }} className="w-20 h-20 rounded-full bg-sage-light text-emerald-600 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2Icon size={40}/>
                  </motion.div>
                  <h1 className="text-3xl font-extrabold text-charcoal">Your intelligent student profile is ready.</h1>
                  <p className="mt-3 text-charcoal-light max-w-sm mx-auto">
                    We’ve set up ThriveU around your rhythm, your workload and your goals.
                  </p>
                  <Button size="lg" className="mt-8" onClick={() => navigate('/app')}>
                    Build My Schedule <ArrowRightIcon size={18}/>
                  </Button>
                </div>}
            </motion.div>
          </AnimatePresence>

          {step < TOTAL &&
            <div className="flex items-center gap-3 mt-10">
              {step > 0 &&
                    <Button variant="outline" onClick={back}>
                  <ArrowLeftIcon size={16}/> Back
                </Button>}
              <Button className="flex-1" size="lg" onClick={next}>
                {step === 0 ? 'Let’s begin' : 'Continue'} <ArrowRightIcon size={18}/>
              </Button>
            </div>}
        </div>
      </div>
    </div>);
}
