import React from 'react';
import { InfoIcon } from 'lucide-react';
import { Field, SelectField } from '../../../shared/components/ui/Field';
import { SelectCard, ChoiceChip, MedicalDisclaimer } from './Shared';
import { fitnessLevels, wellbeingGoals, limitationOptions, dietOptions } from '../data';
export const initialAssessment = {
    age: '21',
    gender: 'Male',
    height: '174',
    weight: '68',
    fitness: 'moderate',
    goals: ['fitness', 'active'],
    sleep: 7,
    study: 5,
    sitting: 8,
    exerciseFreq: '2–3 / week',
    walking: 'Light',
    availableTime: '20 min',
    preferredTime: 'Evening',
    water: 5,
    limitations: ['knee'],
    limitationNote: '',
    diet: 'nonveg',
    allergies: '',
    avoid: 'Deep fried food',
    favourites: 'Rice & curry, fruit',
    mealStyle: 'Both'
};
function toggle(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
function SliderRow({ label, value, min, max, unit, onChange }) {
    return (<div>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-semibold text-charcoal-light">{label}</span>
        <span className="text-sm font-bold text-brand-600">
          {value} {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-500" aria-label={label}/>
    </div>);
}
/* ---------------- Step 1 ---------------- */
export function StepPersonal({ state, set }) {
    return (<div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age" type="number" value={state.age} onChange={(e) => set('age', e.target.value)}/>
        <SelectField label="Gender" value={state.gender} onChange={(e) => set('gender', e.target.value)}>
          <option>Male</option>
          <option>Female</option>
          <option>Non-binary</option>
          <option>Prefer not to say</option>
        </SelectField>
        <Field label="Height (cm)" type="number" value={state.height} onChange={(e) => set('height', e.target.value)}/>
        <Field label="Weight (kg)" type="number" value={state.weight} onChange={(e) => set('weight', e.target.value)}/>
      </div>

      <div>
        <p className="text-sm font-semibold text-charcoal-light mb-2.5">Current fitness level</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {fitnessLevels.map((f) => <SelectCard key={f.id} selected={state.fitness === f.id} onClick={() => set('fitness', f.id)} emoji={f.emoji} label={f.label} desc={f.desc}/>)}
        </div>
      </div>
    </div>);
}
/* ---------------- Step 2 ---------------- */
export function StepGoals({ state, set }) {
    return (<div>
      <p className="text-sm text-charcoal-muted mb-4">Choose as many as you like — you can change these any time.</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {wellbeingGoals.map((g) => <SelectCard key={g.id} selected={state.goals.includes(g.id)} onClick={() => set('goals', toggle(state.goals, g.id))} emoji={g.emoji} label={g.label}/>)}
      </div>
      <p className="text-xs text-charcoal-muted mt-4">{state.goals.length} selected</p>
    </div>);
}
/* ---------------- Step 3 ---------------- */
export function StepLifestyle({ state, set }) {
    return (<div className="space-y-6">
      <div className="space-y-5">
        <SliderRow label="Average sleep hours" value={state.sleep} min={3} max={12} unit="hrs" onChange={(v) => set('sleep', v)}/>
        <SliderRow label="Daily study hours" value={state.study} min={0} max={14} unit="hrs" onChange={(v) => set('study', v)}/>
        <SliderRow label="Average sitting time" value={state.sitting} min={1} max={16} unit="hrs" onChange={(v) => set('sitting', v)}/>
        <SliderRow label="Daily water intake" value={state.water} min={0} max={12} unit="glasses" onChange={(v) => set('water', v)}/>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <SelectField label="Exercise frequency" value={state.exerciseFreq} onChange={(e) => set('exerciseFreq', e.target.value)}>
          <option>Rarely</option>
          <option>Once a week</option>
          <option>2–3 / week</option>
          <option>4–5 / week</option>
          <option>Almost daily</option>
        </SelectField>
        <SelectField label="Walking / activity level" value={state.walking} onChange={(e) => set('walking', e.target.value)}>
          <option>Very light</option>
          <option>Light</option>
          <option>Moderate</option>
          <option>High</option>
        </SelectField>
      </div>

      <div>
        <p className="text-sm font-semibold text-charcoal-light mb-2.5">Available time for exercise</p>
        <div className="flex flex-wrap gap-2">
          {['10 min', '20 min', '30 min', '45 min', '60+ min'].map((t) => <ChoiceChip key={t} selected={state.availableTime === t} onClick={() => set('availableTime', t)}>
              {t}
            </ChoiceChip>)}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-charcoal-light mb-2.5">Preferred exercise time</p>
        <div className="flex flex-wrap gap-2">
          {['Morning', 'Afternoon', 'Evening', 'Flexible'].map((t) => <ChoiceChip key={t} selected={state.preferredTime === t} onClick={() => set('preferredTime', t)}>
              {t}
            </ChoiceChip>)}
        </div>
      </div>
    </div>);
}
/* ---------------- Step 4 ---------------- */
export function StepConditions({ state, set }) {
    const pick = (id) => {
        if (id === 'none')
            return set('limitations', ['none']);
        set('limitations', toggle(state.limitations.filter((x) => x !== 'none'), id));
    };
    return (<div className="space-y-5">
      <div className="flex gap-3 bg-sky-50 border border-sky-100 rounded-3xl p-4">
        <InfoIcon size={18} className="text-sky-500 shrink-0 mt-0.5"/>
        <p className="text-sm text-sky-900 leading-relaxed">
          This information is used only to adjust activity recommendations. The system does not provide medical
          diagnosis.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {limitationOptions.map((l) => <SelectCard key={l.id} selected={state.limitations.includes(l.id)} onClick={() => pick(l.id)} emoji={l.emoji} label={l.label}/>)}
      </div>

      <div>
        <label htmlFor="limitnote" className="text-sm font-semibold text-charcoal-light">
          Add additional information <span className="text-charcoal-muted font-normal">(optional)</span>
        </label>
        <textarea id="limitnote" rows={3} value={state.limitationNote} onChange={(e) => set('limitationNote', e.target.value)} placeholder="Anything else we should keep in mind when planning your activities?" className="mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-charcoal-muted outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"/>
      </div>

      <MedicalDisclaimer />
    </div>);
}
/* ---------------- Step 5 ---------------- */
export function StepNutrition({ state, set }) {
    return (<div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-charcoal-light mb-2.5">Food preference</p>
        <div className="grid grid-cols-2 gap-3">
          {dietOptions.map((d) => <SelectCard key={d.id} selected={state.diet === d.id} onClick={() => set('diet', d.id)} emoji={d.emoji} label={d.label}/>)}
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Food allergies" value={state.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="e.g. peanuts, shellfish"/>
        <Field label="Foods to avoid" value={state.avoid} onChange={(e) => set('avoid', e.target.value)} placeholder="e.g. deep fried food"/>
        <Field label="Favourite foods" value={state.favourites} onChange={(e) => set('favourites', e.target.value)} placeholder="e.g. rice & curry, fruit"/>
      </div>

      <div>
        <p className="text-sm font-semibold text-charcoal-light mb-2.5">Preferred meal style</p>
        <div className="flex flex-wrap gap-2">
          {['Sri Lankan', 'International', 'Both'].map((m) => <ChoiceChip key={m} selected={state.mealStyle === m} onClick={() => set('mealStyle', m)}>
              {m}
            </ChoiceChip>)}
        </div>
        <p className="text-xs text-charcoal-muted mt-3">
          We include culturally relevant Sri Lankan meals alongside international options.
        </p>
      </div>
    </div>);
}
