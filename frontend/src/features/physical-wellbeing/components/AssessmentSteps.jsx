import React from 'react';
import { InfoIcon, SparklesIcon } from 'lucide-react';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { SelectCard, ChoiceChip, MedicalDisclaimer } from './Shared';
import {
    wellbeingGoals,
    activityLevels,
    willingActivities,
    equipmentFacilities,
    limitationOptions,
    availableTimeOptions,
    barrierOptions,
    nutritionGoals,
    mealStyles,
    dietOptions,
    mealSources,
    studyHourRanges,
    academicTaskRanges
} from '../data';

export const initialAssessment = {
    // Step 1: Personal & Academic Profile
    age: '21',
    gender: 'Male',
    height: '168',
    weight: '62',
    sleep: 7,
    studyHours: '5–10 hours',
    academicTasks: '3–5 tasks',
    
    // Step 2: Stress & Barriers
    stressLevel: 3,
    burnoutLevel: 3,
    barriers: ['Academic workload', 'Lack of time'],

    // Step 3: Goals & Current Activity
    goals: ['Improve overall fitness', 'Increase physical activity'],
    activityLevel: 'Moderately active',
    exerciseFreq: 3,
    motivation: 4,

    // Step 4: Exercise Preferences & Safety
    activities: ['Home workouts', 'Walking'],
    availableTime: '15–30 minutes',
    equipment: ['No equipment'],
    preferredTime: 'Evening',
    limitations: ['none'],
    limitationNote: '',

    // Step 5: Nutrition & Meals
    nutritionGoals: ['Maintain healthy eating', 'Improve nutritional quality'],
    mealStyle: 'Combination of both',
    diet: 'Non-Vegetarian',
    mealSource: 'Cook at home',
    allergies: '',
    avoid: '',
    favourites: 'Rice & curry, fruits'
};

function toggle(list, id) {
    if (!list) return [id];
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function SliderRow({ label, value, min, max, unit, subtext, onChange }) {
    return (
        <div>
            <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm font-semibold text-charcoal-light">{label}</span>
                <span className="text-sm font-bold text-brand-600">
                    {value} {unit}
                </span>
            </div>
            {subtext && <p className="text-xs text-charcoal-muted mb-2">{subtext}</p>}
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-brand-500 cursor-pointer"
                aria-label={label}
            />
        </div>
    );
}

/* ──────────────── Step 1: Personal & Academic Profile ──────────────── */
export function StepPersonal({ state, set }) {
    const h = parseFloat(state.height) / 100 || 1.68;
    const w = parseFloat(state.weight) || 62;
    const bmi = Math.round((w / (h * h)) * 10) / 10;

    let bmiCategory = 'Healthy weight';
    let bmiColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (bmi < 18.5) {
        bmiCategory = 'Underweight';
        bmiColor = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (bmi >= 25.0 && bmi < 30.0) {
        bmiCategory = 'Slightly elevated';
        bmiColor = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (bmi >= 30.0) {
        bmiCategory = 'Higher range';
        bmiColor = 'bg-rose-50 text-rose-700 border-rose-200';
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Age" type="number" value={state.age} onChange={(e) => set('age', e.target.value)} />
                <SelectField label="Gender" value={state.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                </SelectField>
                <Field label="Height (cm)" type="number" value={state.height} onChange={(e) => set('height', e.target.value)} />
                <Field label="Current Weight (kg)" type="number" value={state.weight} onChange={(e) => set('weight', e.target.value)} />
            </div>

            {/* Dynamic BMI Indicator */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-black/5 shadow-soft">
                <div className="flex items-center gap-2">
                    <SparklesIcon size={16} className="text-brand-500" />
                    <span className="text-xs font-semibold text-charcoal-light">Calculated BMI</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-charcoal">{bmi}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${bmiColor}`}>
                        {bmiCategory}
                    </span>
                </div>
            </div>

            {/* Sleep and Academic Workload */}
            <div className="space-y-4 pt-2">
                <SliderRow
                    label="Average sleep per night"
                    value={state.sleep}
                    min={3}
                    max={12}
                    unit="hours"
                    subtext="Healthy student recommendation: 7–8 hours"
                    onChange={(v) => set('sleep', v)}
                />

                <div>
                    <label className="text-xs font-bold text-charcoal-muted uppercase tracking-wider mb-2 block">
                        Study hours per week (outside lectures)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {studyHourRanges.map((range) => (
                            <ChoiceChip
                                key={range}
                                selected={state.studyHours === range}
                                onClick={() => set('studyHours', range)}
                            >
                                {range}
                            </ChoiceChip>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-charcoal-muted uppercase tracking-wider mb-2 block">
                        Academic tasks in a typical week
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {academicTaskRanges.map((taskRange) => (
                            <ChoiceChip
                                key={taskRange}
                                selected={state.academicTasks === taskRange}
                                onClick={() => set('academicTasks', taskRange)}
                            >
                                {taskRange}
                            </ChoiceChip>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────── Step 2: Academic Stress & Barriers ──────────────── */
export function StepStressBarriers({ state, set }) {
    const stressLabels = [
        '',
        '1 - Calm & well managed',
        '2 - Mild academic pressure',
        '3 - Moderate occasional stress',
        '4 - Frequently pressured / anxious',
        '5 - Highly overwhelmed by deadlines'
    ];

    const burnoutLabels = [
        '',
        '1 - Fresh & energetic',
        '2 - Normal post-lecture fatigue',
        '3 - Moderate evening exhaustion',
        '4 - Worn out before studying',
        '5 - Chronic physical & mental burnout'
    ];

    return (
        <div className="space-y-6">
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-3xl p-4 flex gap-3 text-xs text-amber-900 leading-relaxed">
                <InfoIcon size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p>
                    Our Adaptive Model uses your academic stress and fatigue levels to dynamically scale down workout durations
                    and swap into restorative, high-adherence routines during heavy exam pressure.
                </p>
            </div>

            <div className="space-y-5">
                <SliderRow
                    label="Perceived Academic Stress"
                    value={state.stressLevel || 3}
                    min={1}
                    max={5}
                    unit={`/ 5 (${stressLabels[state.stressLevel || 3]})`}
                    onChange={(v) => set('stressLevel', v)}
                />

                <SliderRow
                    label="Study Fatigue & Exhaustion"
                    value={state.burnoutLevel || 3}
                    min={1}
                    max={5}
                    unit={`/ 5 (${burnoutLabels[state.burnoutLevel || 3]})`}
                    onChange={(v) => set('burnoutLevel', v)}
                />
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">
                    What makes it difficult to maintain healthy habits?
                </p>
                <p className="text-xs text-charcoal-muted mb-3">Select all that apply to you</p>
                <div className="flex flex-wrap gap-2">
                    {barrierOptions.map((b) => (
                        <ChoiceChip
                            key={b}
                            selected={(state.barriers || []).includes(b)}
                            onClick={() => set('barriers', toggle(state.barriers || [], b))}
                        >
                            {b}
                        </ChoiceChip>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ──────────────── Step 3: Physical Wellbeing Goals & Current Activity ──────────────── */
export function StepGoals({ state, set }) {
    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">
                    What are your main physical wellbeing goals?
                </p>
                <p className="text-xs text-charcoal-muted mb-3">Select all that apply</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {wellbeingGoals.map((g) => (
                        <SelectCard
                            key={g.id}
                            selected={(state.goals || []).includes(g.id)}
                            onClick={() => set('goals', toggle(state.goals || [], g.id))}
                            emoji={g.emoji}
                            label={g.label}
                            desc={g.desc}
                        />
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">
                    How would you describe your current physical activity level?
                </p>
                <p className="text-xs text-charcoal-muted mb-3">Select the closest match</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activityLevels.map((lvl) => (
                        <SelectCard
                            key={lvl.id}
                            selected={state.activityLevel === lvl.id}
                            onClick={() => set('activityLevel', lvl.id)}
                            emoji={lvl.emoji}
                            label={lvl.label}
                            desc={lvl.desc}
                        />
                    ))}
                </div>
            </div>

            <div className="space-y-4 pt-1">
                <SliderRow
                    label="How often do you currently exercise?"
                    value={state.exerciseFreq !== undefined ? state.exerciseFreq : 3}
                    min={0}
                    max={7}
                    unit="days / week"
                    onChange={(v) => set('exerciseFreq', v)}
                />

                <SliderRow
                    label="Motivation to maintain healthy physical habits"
                    value={state.motivation || 4}
                    min={1}
                    max={5}
                    unit="/ 5"
                    onChange={(v) => set('motivation', v)}
                />
            </div>
        </div>
    );
}

/* ──────────────── Step 4: Exercise Preferences, Time & Safety ──────────────── */
export function StepExerciseSafety({ state, set }) {
    const pickLimitation = (id) => {
        if (id === 'none') return set('limitations', ['none']);
        const updated = toggle((state.limitations || []).filter((x) => x !== 'none'), id);
        set('limitations', updated.length === 0 ? ['none'] : updated);
    };

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">
                    Which physical activities would you be willing to do regularly?
                </p>
                <p className="text-xs text-charcoal-muted mb-3">Select all that interest you</p>
                <div className="flex flex-wrap gap-2">
                    {willingActivities.map((act) => (
                        <ChoiceChip
                            key={act.id}
                            selected={(state.activities || []).includes(act.id)}
                            onClick={() => set('activities', toggle(state.activities || [], act.id))}
                        >
                            <span className="mr-1">{act.emoji}</span> {act.label}
                        </ChoiceChip>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">
                    Realistically available time on a typical university day
                </p>
                <p className="text-xs text-charcoal-muted mb-3">Recommendations will strictly respect this limit</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableTimeOptions.map((opt) => (
                        <ChoiceChip
                            key={opt.id}
                            selected={state.availableTime === opt.id}
                            onClick={() => set('availableTime', opt.id)}
                        >
                            {opt.label}
                        </ChoiceChip>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">
                    Exercise facilities or equipment you have access to
                </p>
                <p className="text-xs text-charcoal-muted mb-3">Select all that apply</p>
                <div className="flex flex-wrap gap-2">
                    {equipmentFacilities.map((eq) => (
                        <ChoiceChip
                            key={eq.id}
                            selected={(state.equipment || []).includes(eq.id)}
                            onClick={() => set('equipment', toggle(state.equipment || [], eq.id))}
                        >
                            <span className="mr-1">{eq.emoji}</span> {eq.label}
                        </ChoiceChip>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">Preferred exercise time</p>
                <div className="flex flex-wrap gap-2">
                    {['Morning', 'Afternoon', 'Evening', 'Flexible'].map((t) => (
                        <ChoiceChip
                            key={t}
                            selected={state.preferredTime === t}
                            onClick={() => set('preferredTime', t)}
                        >
                            {t}
                        </ChoiceChip>
                    ))}
                </div>
            </div>

            {/* Physical Limitations */}
            <div className="pt-2">
                <p className="text-sm font-semibold text-charcoal-light mb-1">
                    Do you have any physical limitations or areas of discomfort?
                </p>
                <p className="text-xs text-charcoal-muted mb-3">
                    Our safety engine completely filters out conflicting movements across your 7-day plan
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {limitationOptions.map((l) => (
                        <SelectCard
                            key={l.id}
                            selected={(state.limitations || []).includes(l.id)}
                            onClick={() => pickLimitation(l.id)}
                            emoji={l.emoji}
                            label={l.label}
                            desc={l.desc}
                        />
                    ))}
                </div>

                <div className="mt-3">
                    <label htmlFor="limitnote" className="text-xs font-bold text-charcoal-muted uppercase tracking-wider block mb-1">
                        Additional details or notes <span className="font-normal lowercase">(optional)</span>
                    </label>
                    <textarea
                        id="limitnote"
                        rows={2}
                        value={state.limitationNote}
                        onChange={(e) => set('limitationNote', e.target.value)}
                        placeholder="e.g. slight right knee strain after running, lower back stiffness from sitting"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-xs text-charcoal placeholder:text-charcoal-muted outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"
                    />
                </div>
            </div>

            <MedicalDisclaimer />
        </div>
    );
}

/* ──────────────── Step 5: Nutrition & Meal Preferences ──────────────── */
export function StepNutrition({ state, set }) {
    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">Main Nutrition Goals</p>
                <p className="text-xs text-charcoal-muted mb-3">Select all that apply</p>
                <div className="flex flex-wrap gap-2">
                    {nutritionGoals.map((ng) => (
                        <ChoiceChip
                            key={ng.id}
                            selected={(state.nutritionGoals || []).includes(ng.id)}
                            onClick={() => set('nutritionGoals', toggle(state.nutritionGoals || [], ng.id))}
                        >
                            <span className="mr-1">{ng.emoji}</span> {ng.label}
                        </ChoiceChip>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">Dietary Preference</p>
                <p className="text-xs text-charcoal-muted mb-3">Meals will strictly honor your diet choice</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {dietOptions.map((d) => (
                        <SelectCard
                            key={d.id}
                            selected={state.diet === d.id}
                            onClick={() => set('diet', d.id)}
                            emoji={d.emoji}
                            label={d.label}
                            desc={d.desc}
                        />
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">Preferred Meal Style (Cuisine)</p>
                <p className="text-xs text-charcoal-muted mb-3">
                    Curated authentic Sri Lankan dishes & healthy international recipes
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {mealStyles.map((m) => (
                        <SelectCard
                            key={m.id}
                            selected={state.mealStyle === m.id}
                            onClick={() => set('mealStyle', m.id)}
                            emoji={m.emoji}
                            label={m.label}
                            desc={m.desc}
                        />
                    ))}
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-charcoal-light mb-1">Where do you usually get your meals?</p>
                <div className="flex flex-wrap gap-2">
                    {mealSources.map((source) => (
                        <ChoiceChip
                            key={source}
                            selected={state.mealSource === source}
                            onClick={() => set('mealSource', source)}
                        >
                            {source}
                        </ChoiceChip>
                    ))}
                </div>
            </div>

            <div className="space-y-3.5 pt-1">
                <Field
                    label="Food allergies (if any)"
                    value={state.allergies}
                    onChange={(e) => set('allergies', e.target.value)}
                    placeholder="e.g. peanuts, shellfish, lactose"
                />
                <Field
                    label="Foods to avoid / Dislikes"
                    value={state.avoid}
                    onChange={(e) => set('avoid', e.target.value)}
                    placeholder="e.g. deep fried food, high sugar beverages"
                />
                <Field
                    label="Favourite meals or ingredients"
                    value={state.favourites}
                    onChange={(e) => set('favourites', e.target.value)}
                    placeholder="e.g. red rice & dhal, chickpea salad, fresh papaya"
                />
            </div>
        </div>
    );
}

// Aliases for any legacy references
export const StepLifestyle = StepStressBarriers;
export const StepConditions = StepExerciseSafety;
