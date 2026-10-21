import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { PhysicalNav } from '../components/PhysicalNav';
import { PhysicalMasterCard } from '../components/PhysicalMasterCard';
import { AIInsightCard } from '../../../shared/components/domain/AIInsightCard';
import { SectionTitle, ChoiceChip } from '../components/Shared';
import { RecommendationImage, mealImageFallbacks } from '../components/RecommendationImage';
import { getRecommendations, getProfile, getFavorites, addFavorite, removeFavorite, getPlanCheckins, savePlanCheckin } from '../api';
import { cn } from '../../../shared/lib/cn';

const slots = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export function PhysicalNutrition() {
  const [slot, setSlot] = useState('Lunch');
  const [cuisineFilter, setCuisineFilter] = useState('All');
  const [showAllMeals, setShowAllMeals] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [eatenSlots, setEatenSlots] = useState([]);
  const [savingMeal, setSavingMeal] = useState(false);
  const [mealSaveError, setMealSaveError] = useState('');
  
  const [recomData, setRecomData] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    Promise.all([
      getRecommendations(false, false).catch(() => null),
      getProfile().catch(() => null),
      getFavorites('meal').catch(() => [])
    ]).then(([rec, prof, savedFavorites]) => {
      setRecomData(rec);
      setProfile(prof);
      setFavorites(savedFavorites || []);
    });
  }, []);

  const slotKey = slot.toLowerCase() === 'snacks' ? 'snack' : slot.toLowerCase();
  const today = (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })();
  useEffect(() => {
    getPlanCheckins(today, today).then((progress) => setEatenSlots(progress?.daily?.[today]?.completed_items || [])).catch(() => setEatenSlots([]));
  }, [today]);
  const currentSlotMeals = recomData?.today_slots?.[slotKey] || [];
  const dailyCalorieTarget = recomData?.nutrition_targets?.target_kcal_per_day;
  const slotCalorieShares = { breakfast: 0.25, lunch: 0.30, dinner: 0.30, snack: 0.15 };
  const slotCalorieTarget = dailyCalorieTarget != null && Number.isFinite(Number(dailyCalorieTarget))
    ? Math.round(Number(dailyCalorieTarget) * (slotCalorieShares[slotKey] || 0.25))
    : null;
  const featuredMeal = currentSlotMeals[0] || recomData?.meals?.[0] || null;

  const allMeals = recomData?.meals || [];
  const filteredMeals = allMeals.filter((m) => {
    if (cuisineFilter === 'All') return true;
    if (cuisineFilter === 'Sri Lankan') return m.cuisine === 'sri_lankan' || m.region?.toLowerCase().includes('sri');
    if (cuisineFilter === 'International') return m.cuisine === 'western' || m.region?.toLowerCase().includes('balanced');
    return true;
  });
  const visibleMeals = showAllMeals ? filteredMeals : filteredMeals.slice(0, 3);
  const isFavorite = (meal) => favorites.some((favorite) => favorite.item_name === meal.name);
  const toggleFavorite = async (meal) => {
    setSavingMeal(true);
    setMealSaveError('');
    try {
      if (isFavorite(meal)) {
        await removeFavorite('meal', meal.name);
        setFavorites((current) => current.filter((favorite) => favorite.item_name !== meal.name));
      } else {
        await addFavorite('meal', meal);
        setFavorites((current) => [...current, { item_type: 'meal', item_name: meal.name, item: meal }]);
      }
    } catch (error) {
      setMealSaveError(error?.response?.data?.detail || 'Could not update this favorite. Please try again.');
    } finally {
      setSavingMeal(false);
    }
  };
  const toggleEaten = async (meal) => {
    const codes = { breakfast: 'bf', lunch: 'lu', dinner: 'dn', snack: 'sn' };
    const code = codes[slotKey];
    const next = eatenSlots.includes(code) ? eatenSlots.filter((item) => item !== code) : [...eatenSlots, code];
    setSavingMeal(true);
    setMealSaveError('');
    try {
      const progress = await getPlanCheckins(today, today);
      const water = progress?.daily?.[today]?.water_glasses || 0;
      await savePlanCheckin({ day: today, completed_items: next, water_glasses: water });
      setEatenSlots(next);
    } catch (error) {
      setMealSaveError(error?.response?.data?.detail || 'Could not save today’s meal check-in. Please try again.');
    } finally {
      setSavingMeal(false);
    }
  };
  const eatenCode = ({ breakfast: 'bf', lunch: 'lu', dinner: 'dn', snack: 'sn' })[slotKey];

  const dietPrefDisplay = profile?.diet_pref === 'vegan' ? 'Vegan 🌱' : (profile?.diet_pref === 'veg' ? 'Vegetarian 🥬' : profile?.diet_pref === 'non-veg' ? 'Non-vegetarian 🥩' : 'No specific preference');
  const mealStyleDisplay = profile?.meal_style === 'sri_lankan' ? 'Sri Lankan 🇱🇰' : (profile?.meal_style === 'western' ? 'International 🌍' : 'Sri Lankan & International');

  return (
    <div className="space-y-6">
      <PhysicalMasterCard
        title="Student Nutrition & Meal Plans"
        subtitle="Healthy Sri Lankan and international meals tailored to your diet, study schedule, and available prep time."
        eyebrow="Food & nourishment"
        imageSet="nutrition"
      />

      <PhysicalNav />

      {/* Slot tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {slots.map((s) => (
          <button
            key={s}
            onClick={() => setSlot(s)}
            className={cn(
              'shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all',
              slot === s
                ? 'bg-brand-500 text-white shadow-soft'
                : 'bg-white text-charcoal-light border border-black/[0.06] hover:border-brand-300'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Featured meal */}
        {!featuredMeal ? <Card padding="lg" className="lg:col-span-2 text-center py-12"><h2 className="font-bold text-charcoal">No meal recommendation available</h2><p className="text-sm text-charcoal-muted mt-2">Complete or update your assessment and try again to get meals matched to your profile.</p></Card> :
        <motion.div
          key={slot + (featuredMeal.name || '')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <Card padding="none" className="overflow-hidden h-full flex flex-col justify-between">
            <RecommendationImage src={featuredMeal.image} alt={featuredMeal.name || 'Recommended meal'} fallbackSrc={featuredMeal.cuisine === 'sri_lankan' ? mealImageFallbacks.sri_lankan : mealImageFallbacks.international} className="h-56 w-full object-cover sm:h-64" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                  Recommended {slot}
                </span>
                <span className="text-xs font-semibold text-charcoal-muted">
                  {featuredMeal.cuisine === 'sri_lankan' ? '🇱🇰 Sri Lankan Cuisine' : '🌍 International Cuisine'}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-charcoal mt-1 leading-snug">
                {featuredMeal.name}
              </h2>

              <p className="text-sm text-charcoal-muted mt-2 leading-relaxed">
                {featuredMeal.description || 'Meal details from the recommendation dataset.'}
              </p>

              {slotCalorieTarget !== null && (
                <div className="mt-4 grid gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Estimated daily target</p>
                    <p className="mt-1 text-xl font-black text-charcoal">{Number(dailyCalorieTarget).toLocaleString()} <span className="text-xs font-bold">kcal/day</span></p>
                    <p className="mt-0.5 text-[11px] text-charcoal-muted">Based on your assessment and goal</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Suggested {slot.toLowerCase()} share</p>
                    <p className="mt-1 text-xl font-black text-charcoal">~{slotCalorieTarget.toLocaleString()} <span className="text-xs font-bold">kcal</span></p>
                    <p className="mt-0.5 text-[11px] text-charcoal-muted">Flexible guide across your meals</p>
                  </div>
                  <p className="sm:col-span-2 text-[11px] leading-relaxed text-charcoal-muted">Targets are estimates. Meal calories below are for the dataset’s listed serving, so the same meal can have the same calories while your daily target changes by goal.</p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2.5 mt-5">
                {[
                  ...(featuredMeal.calories != null ? [{ l: 'Per listed serving', v: `${featuredMeal.calories}`, u: 'kcal' }] : []),
                  ...(featuredMeal.protein != null ? [{ l: 'Protein', v: `${featuredMeal.protein}`, u: 'g' }] : []),
                  ...(featuredMeal.carbs != null ? [{ l: 'Carbs', v: `${featuredMeal.carbs}`, u: 'g' }] : []),
                  ...(featuredMeal.prep_time != null ? [{ l: 'Prep Time', v: `${featuredMeal.prep_time}`, u: 'mins' }] : [])
                ].map((m) => (
                  <div key={m.l} className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
                    <p className="text-base sm:text-lg font-black text-emerald-800 leading-none">{m.v}</p>
                    <p className="text-[10px] text-emerald-700 font-medium mt-0.5">{m.u}</p>
                    <p className="text-[10px] font-bold text-emerald-800/75 mt-1">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 pt-0">
              <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-black/[0.05]">
                <Button size="md" variant={isFavorite(featuredMeal) ? 'secondary' : 'outline'} disabled={savingMeal} aria-label={isFavorite(featuredMeal) ? `Remove ${featuredMeal.name} from favorites` : `Favorite ${featuredMeal.name}`} title={isFavorite(featuredMeal) ? 'Remove from favorites' : 'Add to favorites'} onClick={() => toggleFavorite(featuredMeal)}>
                  <HeartIcon size={18} fill={isFavorite(featuredMeal) ? 'currentColor' : 'none'} />
                </Button>
                <Button size="md" variant={eatenSlots.includes(eatenCode) ? 'secondary' : 'primary'} disabled={savingMeal} onClick={() => toggleEaten(featuredMeal)}>
                  {eatenSlots.includes(eatenCode) ? 'Eaten today' : 'Mark as eaten'}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>}

        {/* Why + Preferences */}
        <div className="space-y-6">
          <AIInsightCard title="Why this meal was suggested">
            Suggestions use your saved food preferences and selected meal time. Check ingredients and nutrition details against your own needs.
          </AIInsightCard>

          <Card>
            <SectionTitle title="Your Active Food Profile" />
            <div className="space-y-2.5 text-sm">
              {[
                { l: 'Dietary Preference', v: dietPrefDisplay },
                { l: 'Meal Style', v: mealStyleDisplay },
                { l: 'Avoiding', v: profile?.avoid_foods || 'Not specified' },
                { l: 'Allergies', v: profile?.allergies || 'Not specified' }
              ].map((p) => (
                <div key={p.l} className="flex items-center justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-xs text-charcoal-muted font-medium">{p.l}</span>
                  <span className="text-xs font-bold text-charcoal">{p.v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Alternatives */}
      <div>
        <SectionTitle
          title="More meal options"
          subtitle="Choose another meal for the selected slot."
        />

        {showAllMeals && <div className="flex gap-2 mb-4">
          {['All', 'Sri Lankan', 'International'].map((c) => (
            <ChoiceChip key={c} selected={cuisineFilter === c} onClick={() => setCuisineFilter(c)}>
              {c}
            </ChoiceChip>
          ))}
        </div>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visibleMeals.map((a, i) => (
            <motion.div
              key={a.name + i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card padding="sm" hover className="h-full flex flex-col justify-between">
                <div>
                  <RecommendationImage src={a.image} alt={a.name || 'Recommended meal'} fallbackSrc={a.cuisine === 'sri_lankan' ? mealImageFallbacks.sri_lankan : mealImageFallbacks.international} className="mb-3 h-36 w-full rounded-2xl object-cover" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted">
                      {a.cuisine === 'sri_lankan' ? '🇱🇰 Sri Lankan' : '🌍 International'}
                    </span>
                    <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                      {a.slot || 'Meal'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-charcoal leading-snug">{a.name}</p>
                  <p className="text-xs text-charcoal-muted mt-1 line-clamp-2">
                    {a.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-black/[0.05] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold text-charcoal">
                    {a.calories} kcal · {a.protein}g P
                  </span>
                  <button type="button" aria-label={isFavorite(a) ? `Remove ${a.name} from favorites` : `Favorite ${a.name}`} title={isFavorite(a) ? 'Remove from favorites' : 'Add to favorites'} disabled={savingMeal} onClick={() => toggleFavorite(a)} className="inline-flex items-center justify-center rounded-full p-2 text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                    <HeartIcon size={17} fill={isFavorite(a) ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" disabled={savingMeal} onClick={() => toggleEaten(a)} className="font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-50">
                    {eatenSlots.includes(eatenCode) ? 'Eaten today' : 'Mark eaten'}
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
        {mealSaveError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{mealSaveError}</p>}
        {filteredMeals.length > 3 && <button type="button" onClick={() => setShowAllMeals((shown) => !shown)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-800">
          {showAllMeals ? <>Show fewer <ChevronUpIcon size={16} /></> : <>See all {filteredMeals.length} options <ChevronDownIcon size={16} /></>}
        </button>}
      </div>
    </div>
  );
}
