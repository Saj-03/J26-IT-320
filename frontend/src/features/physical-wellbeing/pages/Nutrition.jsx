import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, ShuffleIcon, CheckIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle, AdaptedChip, ChoiceChip } from '../components/Shared';
import { meals, alternativeMeals } from '../data';
import { cn } from '../../../shared/lib/cn';
const slots = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export function PhysicalNutrition() {
    const [slot, setSlot] = useState('Lunch');
    const [cuisine, setCuisine] = useState('All');
    const [added, setAdded] = useState([]);
    const meal = meals.find((m) => m.slot === slot);
    const alts = alternativeMeals.filter((a) => cuisine === 'All' || a.cuisine === cuisine);
    return (<div className="space-y-6">
      <PageHeader title="Your Nutrition Plan" subtitle="Student-friendly meals that match your preferences and today’s activity level."/>

      <PhysicalNav />

      {/* Slot tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {slots.map((s) => <button key={s} onClick={() => setSlot(s)} className={cn('shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors', slot === s ? 'bg-brand-500 text-white' : 'bg-white text-charcoal-light border border-black/[0.05]')}>
            {s}
          </button>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Featured meal */}
        <motion.div key={meal.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden h-full">
            {meal.image &&
            <div className="relative">
                <img src={meal.image} alt="" className="w-full h-48 sm:h-64 object-cover"/>
                <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide bg-white/90 text-charcoal rounded-full px-2.5 py-1">
                  {meal.cuisine}
                </span>
              </div>}
            <div className="p-5 sm:p-6">
              <p className="text-sm font-semibold text-brand-600">Recommended {meal.slot}</p>
              <h2 className="text-lg sm:text-xl font-extrabold text-charcoal mt-1 leading-snug">
                {meal.emoji} {meal.name}
              </h2>

              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
            { l: 'Calories', v: `${meal.kcal}`, u: 'kcal' },
            { l: 'Protein', v: `${meal.protein}`, u: 'g' },
            { l: 'Carbs', v: `${meal.carbs}`, u: 'g' },
            { l: 'Veg', v: `${meal.veg}`, u: 'serv' }
        ].
            map((m) => <div key={m.l} className="bg-cream rounded-2xl p-3 text-center">
                    <p className="text-base font-extrabold text-charcoal leading-none">{m.v}</p>
                    <p className="text-[10px] text-charcoal-muted font-medium">{m.u}</p>
                    <p className="text-[10px] font-semibold text-charcoal-muted mt-1">{m.l}</p>
                  </div>)}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-5">
                <Button size="lg" className="flex-1" variant={added.includes(meal.id) ? 'secondary' : 'primary'} onClick={() => setAdded((a) => a.includes(meal.id) ? a : [...a, meal.id])}>
                  {added.includes(meal.id) ?
            <>
                      <CheckIcon size={17}/> Added to Today
                    </> :
            <>
                      <PlusIcon size={17}/> Add to Today
                    </>}
                </Button>
                <Button size="lg" variant="outline">
                  <ShuffleIcon size={16}/> Find Alternative
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Why */}
        <div className="space-y-6">
          <AIInsightCard title="Why this meal?">{meal.why}</AIInsightCard>
          <Card>
            <SectionTitle title="Your preferences"/>
            <div className="space-y-2 text-sm">
              {[
            { l: 'Diet', v: 'Non-Vegetarian' },
            { l: 'Meal style', v: 'Sri Lankan & International' },
            { l: 'Avoiding', v: 'Deep fried food' },
            { l: 'Allergies', v: 'None' }
        ].
            map((p) => <div key={p.l} className="flex items-center justify-between">
                  <span className="text-charcoal-muted font-medium">{p.l}</span>
                  <span className="font-bold text-charcoal">{p.v}</span>
                </div>)}
            </div>
          </Card>
        </div>
      </div>

      {/* Alternatives */}
      <div>
        <SectionTitle title="Other options" subtitle="Sri Lankan and international meals, all student-budget friendly." action={<AdaptedChip>Matched to preferences</AdaptedChip>}/>
        <div className="flex gap-2 mb-4">
          {['All', 'Sri Lankan', 'International'].map((c) => <ChoiceChip key={c} selected={cuisine === c} onClick={() => setCuisine(c)}>
              {c}
            </ChoiceChip>)}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {alts.map((a, i) => <motion.div key={a.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card padding="sm" hover className="h-full flex flex-col">
                {a.image && <img src={a.image} alt="" className="w-full h-28 object-cover rounded-2xl mb-3"/>}
                <div className="flex items-start gap-2">
                  <span className="text-xl shrink-0">{a.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-charcoal leading-snug">{a.name}</p>
                    <p className="text-xs text-charcoal-muted mt-0.5">
                      {a.cuisine} · {a.kcal} kcal
                    </p>
                  </div>
                </div>
                <button className="mt-auto pt-3 text-xs font-bold text-brand-600 hover:text-brand-700 text-left">
                  + Add to plan
                </button>
              </Card>
            </motion.div>)}
        </div>
      </div>

      <p className="text-xs text-charcoal-muted bg-cream rounded-2xl p-3.5 leading-relaxed">
        Meal suggestions are general wellbeing guidance, not clinical nutrition advice. Adjust portions to suit you.
      </p>
    </div>);
}
