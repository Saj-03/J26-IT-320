import React, { useEffect, useState } from 'react';
import { getActivitySummary, saveMealFeedback, saveWorkoutFeedback } from '../api';

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function BuddyNotificationCheckIn() {
  const day = localDay();
  const [answers, setAnswers] = useState({ workout: null, meals: null });
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getActivitySummary(day).then((summary) => {
      if (active) setAnswers({
        workout: typeof summary?.today?.workout_feedback === 'boolean' ? summary.today.workout_feedback : null,
        meals: typeof summary?.today?.meals_supported_wellbeing === 'boolean' ? summary.today.meals_supported_wellbeing : null,
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [day]);

  const save = async (kind, value) => {
    setSaving(kind);
    setError('');
    try {
      if (kind === 'workout') {
        await saveWorkoutFeedback({ day, did_workout: value, workout_minutes: 0 });
      } else {
        await saveMealFeedback({ day, ate_well: value });
      }
      setAnswers((current) => ({ ...current, [kind]: value }));
      window.dispatchEvent(new Event('notifications:refresh'));
    } catch {
      setError('Could not save this check-in. Please try again.');
    } finally {
      setSaving('');
    }
  };

  return <section className="border-b border-black/[0.06] bg-brand-50/60 px-4 py-3" aria-label="Daily wellbeing check-in">
    <div className="mb-2 flex items-center gap-2">
      <img src="/img/wellbeing-buddy-male.png" alt="" className="h-10 w-8 object-contain" />
      <div><p className="text-xs font-extrabold text-charcoal">A quick check-in</p><p className="text-[11px] text-charcoal-muted">Your answers are saved to today’s wellbeing record.</p></div>
    </div>
    <div className="space-y-2">
      {[
        { key: 'workout', question: 'Did you complete a workout today?', yes: 'Yes', no: 'Not today' },
        { key: 'meals', question: 'Did your meals support your wellbeing today?', yes: 'Yes', no: 'Not quite' },
      ].map(({ key, question, yes, no }) => <div key={key} className="rounded-xl bg-white p-2.5">
        <p className="text-xs font-semibold text-charcoal">{question}</p>
        <div className="mt-2 flex gap-2">
          {[{ value: false, label: no }, { value: true, label: yes }].map(({ value, label }) => <button key={label} type="button" disabled={Boolean(saving)} onClick={() => save(key, value)} className={`flex-1 rounded-full border px-2 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${answers[key] === value ? 'border-brand-500 bg-brand-500 text-white' : 'border-black/10 text-charcoal hover:bg-cream'}`}>
            {saving === key ? 'Saving…' : label}
          </button>)}
        </div>
      </div>)}
    </div>
    {error && <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-700">{error}</p>}
  </section>;
}
