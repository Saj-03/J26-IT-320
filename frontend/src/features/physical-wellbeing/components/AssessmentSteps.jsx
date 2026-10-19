import React from 'react';
import { InfoIcon, SparklesIcon } from 'lucide-react';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { SelectCard, ChoiceChip, MedicalDisclaimer } from './Shared';
import {
    wellbeingGoals,
    activityLevels,
    willingActivities,
    equipmentFacilities,
    limitationPrimaryChoices,
    limitationOptions,
    limitationSeverities,
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
    primaryGoal: 'fitness',
    primaryGoalText: '',
    goals: ['Improve overall fitness', 'Increase physical activity'],
    activityLevel: 'Moderately active',
    exerciseFreq: 3,
    motivation: 4,

    // Step 4: Exercise Preferences & Safety
    activities: ['Home workouts', 'Walking'],
    availableTime: '15–30 minutes',
    equipment: ['No equipment'],
    preferredTime: 'Evening',
    limitationChoice: 'no',
    limitations: [],
    limitationSeverity: 'mild',
    limitationNote: '',

    // Step 5: Nutrition & Meals
    nutritionGoals: ['Maintain healthy eating', 'Improve nutritional quality'],
    mealStyle: 'Combination of both',
    diet: 'Non-Vegetarian',
    mealSource: 'Cook at home',
    allergies: '',
    avoid: '',
    favourites: 'Rice & curry, fruits',
    planDurationDays: '',
    planDurationAmount: '',
    planDurationUnit: 'days'
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
                <p className="text-sm font-semibold text-charcoal-light mb-1">🎯 Primary Goal</p>
                <p className="text-xs text-charcoal-muted mb-3">Choose the main outcome you want your plan to focus on.</p>
                <SelectField label="Primary goal" value={state.primaryGoal || 'fitness'} onChange={(e) => set('primaryGoal', e.target.value)}>
                    <option value="fitness">Fitness</option>
                    <option value="weight_loss">Lose weight</option>
                    <option value="weight_gain">Gain weight</option>
                    <option value="strength">Build strength</option>
                    <option value="mobility">Flexibility &amp; mobility</option>
                    <option value="custom">Other — type my own</option>
                </SelectField>
                {state.primaryGoal === 'custom' && (
                    <Field
                        label="Your primary goal"
                        placeholder="e.g. Improve my stamina"
                        value={state.primaryGoalText || ''}
                        onChange={(e) => set('primaryGoalText', e.target.value)}
                        className="mt-3"
                    />
                )}
            </div>

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

            {/* Physical Limitations & Clinical Triage */}
            <div className="pt-2 border-t border-black/[0.06]">
                <div className="mb-3">
                    <p className="text-sm font-bold text-charcoal flex items-center gap-1.5">
                        <span>🩺</span> Do you have any physical limitations or health conditions that affect exercise?
                    </p>
                    <p className="text-xs text-charcoal-muted mt-0.5">
                        Informed by sports physiology to calibrate joint safety and determine if physician consultation is recommended.
                    </p>
                </div>

                {/* Primary Choice: No | Prefer not to say | Yes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
                    {limitationPrimaryChoices.map((choice) => {
                        const isSelected = (state.limitationChoice || 'no') === choice.id;
                        return (
                            <button
                                key={choice.id}
                                type="button"
                                onClick={() => {
                                    set('limitationChoice', choice.id);
                                    if (choice.id === 'no') {
                                        set('limitations', ['none']);
                                    } else if (choice.id === 'prefer_not_to_say') {
                                        set('limitations', ['prefer_not_to_say']);
                                    } else {
                                        set('limitations', (state.limitations || []).filter(x => x !== 'none' && x !== 'prefer_not_to_say'));
                                    }
                                }}
                                className={`text-left rounded-2xl p-3.5 border-2 transition-all ${
                                    isSelected 
                                        ? 'border-brand-500 bg-brand-50/70 shadow-sm' 
                                        : 'border-black/[0.07] bg-white hover:border-brand-200'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl">{choice.emoji}</span>
                                    <span className="font-extrabold text-sm text-charcoal">{choice.label}</span>
                                </div>
                                <p className="text-[11px] text-charcoal-muted leading-tight">{choice.desc}</p>
                            </button>
                        );
                    })}
                </div>

                {/* Conditional Sub-panel if 'prefer_not_to_say' */}
                {state.limitationChoice === 'prefer_not_to_say' && (
                    <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 leading-relaxed mb-3">
                        <p className="font-bold flex items-center gap-1.5 mb-1 text-blue-950">
                            <span>🔒</span> Privacy Respected: Precautionary Low-Impact Protocol
                        </p>
                        <p>
                            Because your health status is undisclosed, our adaptive engine will automatically restrict your plan to gentle, low-impact, joint-neutral activities (campus power walking, restorative mobility, yoga). If you ever experience pain or dizziness, please stop immediately and consult a doctor.
                        </p>
                    </div>
                )}

                {/* Conditional Sub-panel if 'yes' */}
                {state.limitationChoice === 'yes' && (
                    <div className="space-y-4 p-4 rounded-3xl bg-amber-50/40 border border-amber-200/80 mb-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-light mb-1.5">
                                1. Select affected areas or conditions <span className="text-brand-600">(Select all that apply)</span>
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {limitationOptions.map((l) => {
                                    const isSelected = (state.limitations || []).includes(l.id);
                                    return (
                                        <SelectCard
                                            key={l.id}
                                            selected={isSelected}
                                            onClick={() => {
                                                const current = (state.limitations || []).filter(x => x !== 'none' && x !== 'prefer_not_to_say');
                                                const updated = current.includes(l.id) ? current.filter(x => x !== l.id) : [...current, l.id];
                                                set('limitations', updated);
                                            }}
                                            emoji={l.emoji}
                                            label={l.label}
                                            desc={l.desc}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Severity Selector */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-light mb-1.5">
                                2. Pain or Discomfort Intensity
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {limitationSeverities.map((sev) => {
                                    const isSelected = (state.limitationSeverity || 'mild') === sev.id;
                                    return (
                                        <button
                                            key={sev.id}
                                            type="button"
                                            onClick={() => set('limitationSeverity', sev.id)}
                                            className={`text-left rounded-2xl p-3 border-2 transition-all ${
                                                isSelected
                                                    ? 'border-brand-500 bg-white shadow-soft font-bold'
                                                    : 'border-black/[0.06] bg-white/70 hover:border-brand-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span>{sev.emoji}</span>
                                                <span className="text-xs font-extrabold text-charcoal">{sev.label}</span>
                                            </div>
                                            <p className="text-[10px] text-charcoal-muted leading-tight">{sev.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Symptoms Textarea */}
                        <div>
                            <label htmlFor="limitnote" className="text-xs font-bold text-charcoal-muted uppercase tracking-wider block mb-1">
                                3. Mention specific symptoms, diagnoses, or triggers <span className="font-normal lowercase">(optional)</span>
                            </label>
                            <textarea
                                id="limitnote"
                                rows={2}
                                value={state.limitationNote}
                                onChange={(e) => set('limitationNote', e.target.value)}
                                placeholder="e.g. sharp right knee pain when bending past 90°, asthma flare-ups during cold runs, lower back stiffness after 3 hours of studying"
                                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-xs text-charcoal placeholder:text-charcoal-muted outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none shadow-sm"
                            />
                        </div>

                        {/* Real-Time Clinical Doctor Consultation Analysis Box */}
                        {(() => {
                            const isSevere = state.limitationSeverity === 'severe';
                            const hasCardio = (state.limitations || []).includes('cardiovascular');
                            const hasSurgery = (state.limitations || []).includes('surgery_injury');
                            const hasRespiratory = (state.limitations || []).includes('respiratory');
                            const needsDoctor = isSevere || hasCardio || hasSurgery || hasRespiratory;

                            if (needsDoctor) {
                                return (
                                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-1.5">
                                        <p className="font-extrabold flex items-center gap-1.5 text-rose-900 text-sm">
                                            <span>🩺</span> Physician / Physiotherapist Consultation Advised
                                        </p>
                                        <p className="leading-relaxed">
                                            {hasCardio 
                                                ? "Cardiovascular symptoms or dizziness require formal medical clearance before starting exercise."
                                                : hasSurgery
                                                ? "Post-surgery or acute musculoskeletal injuries must be evaluated by a physiotherapist."
                                                : hasRespiratory
                                                ? "Asthma or breathing sensitivities require medical management. High-intensity cardio will be excluded."
                                                : "Severe or sharp pain indicates potential joint or tissue damage. We strongly advise a clinical assessment before commencing physical activity."}
                                        </p>
                                        <p className="text-[11px] font-semibold text-rose-800 pt-0.5">
                                            ✓ Our AI recommendation engine will strictly enforce restorative, low-impact movements to safeguard your health.
                                        </p>
                                    </div>
                                );
                            } else {
                                return (
                                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                                        <p className="font-bold flex items-center gap-1.5 text-emerald-900 mb-0.5">
                                            <span>🛡️</span> Adaptive Safety Protection Active
                                        </p>
                                        <p className="leading-relaxed text-emerald-800">
                                            Your selected limitations will be respected. Conflicting movements (such as deep squats, lunges, or spinal shear) will be automatically filtered and replaced throughout your plan.
                                        </p>
                                    </div>
                                );
                            }
                        })()}
                    </div>
                )}
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

export function StepPlanDuration({ state, set }) {
    const unitDays = { days: 1, weeks: 7, months: 30 };
    const maxAmount = { days: 31, weeks: 4, months: 1 }[state.planDurationUnit] || 31;
    const amount = Number(state.planDurationAmount);
    const selectedDays = amount > 0 && amount <= maxAmount ? amount * unitDays[state.planDurationUnit] : '';
    const updateDuration = (nextAmount, nextUnit = state.planDurationUnit) => {
        const nextValue = Number(nextAmount);
        const max = { days: 31, weeks: 4, months: 1 }[nextUnit] || 31;
        set('planDurationAmount', nextAmount);
        set('planDurationUnit', nextUnit);
        set('planDurationDays', nextValue > 0 && nextValue <= max ? String(nextValue * unitDays[nextUnit]) : '');
    };
    return (
        <div className="space-y-5">
            <div>
                <p className="text-sm font-semibold text-charcoal-light">How long should your plan cover?</p>
                <p className="mt-1 text-xs text-charcoal-muted">Enter a length that works for you. You can update it later.</p>
            </div>
            <div className="grid max-w-md grid-cols-[1fr_1fr] gap-3">
                <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-charcoal-light">Length</span>
                    <input type="number" min="1" max={maxAmount} step="1" inputMode="numeric" value={state.planDurationAmount}
                        onChange={(event) => updateDuration(event.target.value)} placeholder="Enter a number"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-charcoal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
                </label>
                <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-charcoal-light">Unit</span>
                    <select value={state.planDurationUnit} onChange={(event) => updateDuration(state.planDurationAmount, event.target.value)}
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-charcoal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20">
                        <option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option>
                    </select>
                </label>
            </div>
            {selectedDays ? <p className="text-sm font-bold text-emerald-800">Your plan will cover {selectedDays} days.</p> : <p className="text-xs font-semibold text-amber-800">Enter a length from 1 to {maxAmount} {state.planDurationUnit}.</p>}
        </div>
    );
}

// Aliases for any legacy references
export const StepLifestyle = StepStressBarriers;
export const StepConditions = StepExerciseSafety;
