import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon } from 'lucide-react';
import { Logo } from '../../../shared/components/ui/Logo';
import { Button } from '../../../shared/components/ui/Button';
import { MedicalDisclaimer } from '../components/Shared';
const pills = [
    { emoji: '🚶', label: 'Activity' },
    { emoji: '🏃', label: 'Exercise' },
    { emoji: '🥗', label: 'Nutrition' },
    { emoji: '✨', label: 'Habits' }
];
export function PhysicalWelcome() {
    const navigate = useNavigate();
    return (<div className="min-h-screen w-full bg-cream flex flex-col">
      <header className="p-5 max-w-5xl w-full mx-auto">
        <button onClick={() => navigate('/app')}>
          <Logo size={34} textClass="text-lg"/>
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-md lg:max-w-5xl lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
          {/* Illustration */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mb-8 lg:mb-0">
            <div className="rounded-4xl overflow-hidden bg-white border border-black/[0.04] shadow-card">
              <img src="/9f8f21f5-7d99-47b0-8dbf-4730e56bcdfc.jpg" alt="University students walking, exercising and eating healthy meals together" className="w-full h-auto"/>
            </div>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {pills.map((p) => <span key={p.label} className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 text-xs font-semibold text-charcoal-light border border-black/[0.05] shadow-soft">
                  <span>{p.emoji}</span>
                  {p.label}
                </span>)}
            </div>
          </motion.div>

          {/* Copy */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 text-xs font-bold text-brand-700 shadow-soft border border-black/[0.04]">
              🌿 Physical Wellbeing Module
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-charcoal tracking-tight leading-[1.08]">
              Your Personal <span className="text-brand-500">AI Wellbeing Companion</span>
            </h1>
            <p className="mt-4 text-charcoal-light leading-relaxed max-w-lg">
              Build healthier habits with exercise, nutrition, activity tracking, and personalized AI recommendations
              designed around your university lifestyle.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="flex-1" onClick={() => navigate('/physical-setup/assessment')}>
                Get Started <ArrowRightIcon size={18}/>
              </Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={() => navigate('/app/physical')}>
                I Already Have an Account
              </Button>
            </div>

            <MedicalDisclaimer className="mt-6 text-left"/>
          </motion.div>
        </div>
      </div>
    </div>);
}
