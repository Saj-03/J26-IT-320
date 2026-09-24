import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClockIcon, GaugeIcon, DumbbellIcon, FlameIcon, PlayIcon, BookmarkIcon, ShuffleIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle, AdaptedChip } from '../components/Shared';
import { featuredExercise, alternativeExercises, wellbeingProfile } from '../data';
const adaptFactors = [
    { emoji: '📊', label: 'Fitness level', value: wellbeingProfile.fitnessLevel },
    { emoji: '⏱️', label: 'Available time', value: wellbeingProfile.availableTime },
    { emoji: '🎯', label: 'Your goals', value: 'Fitness, activity' },
    { emoji: '🦵', label: 'Limitations', value: 'Knee discomfort' },
    { emoji: '📈', label: 'Activity history', value: 'Below average' }
];
export function PhysicalExercise() {
    const navigate = useNavigate();
    return (<div className="space-y-6">
      <PageHeader title="Recommended for You" subtitle="Chosen from your fitness level, available time, goals, limitations and recent activity."/>

      <PhysicalNav />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Featured */}
        <Card padding="none" className="lg:col-span-2 overflow-hidden">
          <div className="relative">
            <img src={featuredExercise.image} alt="" className="w-full h-48 sm:h-64 object-cover"/>
            <div className="absolute top-3 left-3">
              <AdaptedChip>Matched to you</AdaptedChip>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-charcoal">{featuredExercise.title}</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              {[
            { icon: ClockIcon, l: 'Duration', v: featuredExercise.duration },
            { icon: GaugeIcon, l: 'Difficulty', v: featuredExercise.difficulty },
            { icon: DumbbellIcon, l: 'Equipment', v: featuredExercise.equipment },
            { icon: FlameIcon, l: 'Est. calories', v: `${featuredExercise.kcal} kcal` }
        ].
            map((s) => <div key={s.l} className="bg-cream rounded-2xl p-3">
                  <s.icon size={14} className="text-brand-500"/>
                  <p className="text-[11px] font-medium text-charcoal-muted mt-1.5">{s.l}</p>
                  <p className="text-sm font-extrabold text-charcoal leading-tight">{s.v}</p>
                </div>)}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <Button size="lg" className="flex-1" onClick={() => navigate('/app/physical/workout')}>
                <PlayIcon size={17} fill="currentColor"/> Start Workout
              </Button>
              <Button size="lg" variant="outline">
                <BookmarkIcon size={16}/> Save for Later
              </Button>
            </div>
          </div>
        </Card>

        {/* Why + factors */}
        <div className="space-y-6">
          <AIInsightCard title="Why this was recommended">
            {featuredExercise.why}
            <span className="block mt-2 font-semibold text-emerald-700">✅ {featuredExercise.benefit}</span>
          </AIInsightCard>

          <Card>
            <SectionTitle title="What shaped this pick" subtitle="Your plan adjusts whenever any of these change."/>
            <div className="space-y-2">
              {adaptFactors.map((f) => <div key={f.label} className="flex items-center gap-2.5 bg-cream rounded-2xl px-3 py-2.5">
                  <span className="shrink-0">{f.emoji}</span>
                  <span className="text-xs text-charcoal-muted font-medium flex-1">{f.label}</span>
                  <span className="text-xs font-bold text-charcoal shrink-0">{f.value}</span>
                </div>)}
            </div>
          </Card>
        </div>
      </div>

      {/* Alternatives */}
      <div>
        <SectionTitle title="Choose Another Activity" subtitle="All options respect your knee-friendly requirement." action={<ShuffleIcon size={17} className="text-charcoal-muted"/>}/>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {alternativeExercises.map((a, i) => <motion.button key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => navigate('/app/physical/workout')} className="text-left rounded-3xl bg-white border border-black/[0.04] shadow-soft p-4 hover:shadow-card transition-shadow">
              <div className="flex items-start justify-between">
                <span className="text-2xl">{a.emoji}</span>
                {a.tag === 'Recommended' &&
                <span className="text-[9px] font-bold uppercase tracking-wide text-white bg-brand-500 rounded-full px-2 py-0.5">
                    Top pick
                  </span>}
              </div>
              <p className="font-bold text-charcoal text-sm mt-2.5 leading-snug">{a.name}</p>
              <p className="text-xs text-charcoal-muted mt-0.5">
                {a.mins} min · {a.difficulty}
              </p>
              <p className="text-[11px] font-semibold text-brand-600 mt-1.5">{a.tag}</p>
            </motion.button>)}
        </div>
      </div>
    </div>);
}
