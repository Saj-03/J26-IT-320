import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClockIcon, GaugeIcon, DumbbellIcon, FlameIcon, PlayIcon,
  ShieldCheckIcon, AlertTriangleIcon
} from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PhysicalNav } from '../components/PhysicalNav';
import { PhysicalMasterCard } from '../components/PhysicalMasterCard';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle, AdaptedChip } from '../components/Shared';
import { getRecommendations, getProfile } from '../api';
import { RecommendationImage, exerciseImageFallback } from '../components/RecommendationImage';
import { ActivityTrackingPanel } from './Activity';

export function PhysicalExercise() {
  const navigate = useNavigate();
  const [recomData, setRecomData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getRecommendations(false, false).catch(() => null),
      getProfile().catch(() => null)
    ]).then(([rec, prof]) => {
      setRecomData(rec);
      setProfile(prof);
      setLoading(false);
    });
  }, []);

  const workouts = recomData?.exercises || [];
  const featured = workouts[0] || {
    name: '20-Min Full-Body Functional Calisthenics',
    minutes: 20,
    intensity: 'Moderate',
    equipment: 'Bodyweight / Home',
    calories_burned: 140,
    adherence_probability: 0.94,
    description: 'Balanced circuit: push-ups, bodyweight romanian deadlifts, wall sits, plank taps, and march-in-place.'
  };

  const workoutMinutes = (workout) => Number(workout?.minutes || workout?.duration_mins || 20);
  const shorterAlternative = workouts.find((workout) => workout !== featured && workoutMinutes(workout) < workoutMinutes(featured));
  const alternatives = [...new Set([
    shorterAlternative,
    ...workouts.filter((workout) => workout !== featured && workout !== shorterAlternative)
  ])].filter(Boolean).slice(0, 3);

  return (
    <div className="space-y-6">
      <PhysicalMasterCard
        title="Movement"
        subtitle="Your personalized workout is the focus, with daily steps and activity alongside it."
        eyebrow="Exercise & activity"
      />

      <PhysicalNav />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Featured Exercise */}
        <Card padding="none" className="lg:col-span-2 overflow-hidden flex flex-col justify-between">
          <RecommendationImage src={featured.image} alt={featured.name || 'Recommended workout'} fallbackSrc={exerciseImageFallback} className="h-56 w-full object-cover sm:h-64" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                Top AI Recommendation
              </span>
              {featured.adherence_probability && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheckIcon size={14} />
                  {Math.round(featured.adherence_probability * 100)}% Predicted Adherence
                </span>
              )}
            </div>

            <h2 className="text-2xl font-black text-charcoal">{featured.name}</h2>
            <p className="text-sm text-charcoal-muted mt-2 leading-relaxed">
              {featured.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
              {[
                { icon: ClockIcon, l: 'Duration', v: `${featured.minutes || 20} min` },
                { icon: GaugeIcon, l: 'Intensity', v: featured.intensity || 'Moderate' },
                { icon: DumbbellIcon, l: 'Equipment', v: featured.equipment || 'Bodyweight' },
                { icon: FlameIcon, l: 'Est. Burn', v: `${featured.calories_burned || 150} kcal` }
              ].map((s) => (
                <div key={s.l} className="bg-cream rounded-2xl p-3 border border-black/[0.04]">
                  <s.icon size={15} className="text-brand-500 mb-1" />
                  <p className="text-[11px] font-medium text-charcoal-muted">{s.l}</p>
                  <p className="text-sm font-extrabold text-charcoal leading-tight mt-0.5">{s.v}</p>
                </div>
              ))}
            </div>

            {featured.limitation_warning && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-800">
                <AlertTriangleIcon size={16} className="shrink-0" />
                <span>Notice: Modify movements to avoid aggravating joint discomfort.</span>
              </div>
            )}
          </div>

          <div className="p-6 pt-0">
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-black/[0.05]">
              <Button size="lg" className="flex-1" disabled={loading} onClick={() => navigate('/app/physical/workout', { state: { workout: featured } })}>
                <PlayIcon size={17} fill="currentColor" /> Start Workout
              </Button>
            </div>
          </div>
        </Card>

        {/* Why + Factors */}
        <div className="space-y-6">
          <AIInsightCard title="Why this was recommended">
            This routine is tailored to your exact <strong>{profile?.available_minutes || 20}-minute</strong> daily window
            and avoids movements conflicting with your reported conditions.
          </AIInsightCard>

          <Card>
            <SectionTitle title="What shaped this pick" subtitle="Real parameters from your assessment." />
            <div className="space-y-2">
              {[
                { emoji: '⏱️', label: 'Workout Time Cap', value: `${profile?.available_minutes || 20} min` },
                { emoji: '🎯', label: 'Primary Goal', value: profile?.goal || 'Fitness' },
                { emoji: '🦵', label: 'Physical Safety', value: profile?.physical_limitations ? `${profile.physical_limitations} Protected` : 'Standard' },
                { emoji: '📊', label: 'Activity Level', value: profile?.activity_level || 'Moderate' }
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 bg-cream rounded-2xl px-3 py-2.5">
                  <span className="shrink-0">{f.emoji}</span>
                  <span className="text-xs text-charcoal-muted font-medium flex-1">{f.label}</span>
                  <span className="text-xs font-bold text-charcoal shrink-0">{f.value}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>

      {/* Alternative Workouts */}
      {alternatives.length > 0 && (
        <div>
          <SectionTitle
            title="Alternative Daily Workouts"
            subtitle={shorterAlternative ? 'Try a different routine, including an option that takes less time.' : 'Other routines matched to your available time.'}
            action={<AdaptedChip>Safe for your profile</AdaptedChip>}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {alternatives.map((a, i) => (
              <motion.button
                key={a.name + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate('/app/physical/workout', { state: { workout: a } })}
                className="text-left rounded-3xl bg-white border border-black/[0.04] shadow-soft p-5 hover:shadow-card transition-all flex flex-col justify-between"
              >
                <div>
                  <RecommendationImage src={a.image} alt={a.name || 'Alternative workout'} fallbackSrc={exerciseImageFallback} className="mb-4 h-36 w-full rounded-2xl object-cover" />
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full">
                      {a.intensity}
                    </span>
                    <span className="text-xs font-black text-charcoal">
                      {a.minutes} min
                    </span>
                  </div>
                  <p className="font-extrabold text-charcoal text-base mt-2 leading-snug">{a.name}</p>
                  <p className="text-xs text-charcoal-muted mt-1 line-clamp-2">{a.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs">
                  <span className="text-charcoal-muted font-semibold flex items-center gap-1">
                    <FlameIcon size={13} className="text-brand-500" /> ~{a.calories_burned} kcal
                  </span>
                  <span className="font-bold text-brand-600">Start Routine →</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <section aria-label="Today's movement" className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-charcoal">Today's movement</h2>
          <p className="text-sm text-charcoal-muted mt-1">View your step history and log today's step count.</p>
        </div>
        <ActivityTrackingPanel embedded />
      </section>

    </div>
  );
}
