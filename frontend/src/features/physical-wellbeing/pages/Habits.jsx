import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, CheckIcon, XIcon, FlameIcon, Trash2Icon, SparklesIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { Field } from '../../../shared/components/ui/Field';
import { PhysicalNav } from '../components/PhysicalNav';
import { cn } from '../../../shared/lib/cn';
import { getHabits, addHabit, habitDone, deleteHabit } from '../api';

const STARTER_HABITS = [
  { name: 'Drink 2L Water Daily', emoji: '💧', goal: '2 Liters' },
  { name: '20-Min Campus Walk', emoji: '🚶', goal: '20 mins' },
  { name: '5-Min Posture & Neck Stretch', emoji: '🧘', goal: '5 mins' },
  { name: 'Sleep Before 12:00 AM', emoji: '😴', goal: '7+ hours' }
];

export function PhysicalHabits() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [addingQuick, setAddingQuick] = useState(false);

  const fetchHabits = async () => {
    try {
      const data = await getHabits();
      setHabits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const toggle = async (id) => {
    try {
      const res = await habitDone(id);
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id ? { ...h, done: res.done, streak: res.streak } : h
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const add = async () => {
    if (!name.trim()) return;
    try {
      const created = await addHabit(name.trim());
      setHabits((prev) => [
        ...prev,
        {
          id: created.data?.id || created.id || Date.now(),
          name: name.trim(),
          goal: goal.trim() || 'Daily',
          streak: 0,
          done: false,
          emoji: '⭐'
        }
      ]);
      setName('');
      setGoal('');
      setOpen(false);
      await fetchHabits();
    } catch (err) {
      console.error(err);
    }
  };

  const quickAdd = async (starter) => {
    setAddingQuick(true);
    try {
      await addHabit(starter.name);
      await fetchHabits();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingQuick(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteHabit(id);
      setHabits((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const doneCount = habits.filter((h) => h.done).length;
  const maxStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak || 0), 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Healthy Habits"
          subtitle="Real daily student habits that train discipline, energy, and mental focus."
        />
        <Button onClick={() => setOpen(true)} className="self-start shrink-0">
          <PlusIcon size={16} /> Add Custom Habit
        </Button>
      </div>

      <PhysicalNav />

      {/* Streak Hero Card */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-brand-50" aria-hidden />
        <div className="relative flex items-center gap-5">
          <div className="text-5xl">🔥</div>
          <div className="flex-1">
            <p className="text-2xl font-extrabold text-charcoal">
              {maxStreak > 0 ? `${maxStreak} Day Best Streak` : 'Start Your First Streak'}
            </p>
            <p className="text-sm text-charcoal-muted mt-0.5">
              {habits.length > 0
                ? `${doneCount} of ${habits.length} habits completed today`
                : 'No habits tracked yet. Choose a starter habit below to begin!'}
            </p>
          </div>
          <FlameIcon size={24} className="text-brand-500 shrink-0" />
        </div>
      </Card>

      {/* Habits List or Clean Empty State */}
      {loading ? (
        <Card padding="lg" className="text-center py-10">
          <div className="w-7 h-7 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto mb-2" />
          <p className="text-xs text-charcoal-muted font-bold">Loading your habits…</p>
        </Card>
      ) : habits.length === 0 ? (
        <Card padding="lg" className="text-center py-10">
          <div className="w-14 h-14 rounded-3xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4 text-2xl">
            ✨
          </div>
          <h3 className="text-lg font-extrabold text-charcoal">No Habits Active Yet</h3>
          <p className="text-sm text-charcoal-muted mt-1 max-w-md mx-auto">
            Small daily actions build remarkable student wellbeing over a semester. Tap any recommended habit to start tracking:
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6 max-w-xl mx-auto">
            {STARTER_HABITS.map((s) => (
              <button
                key={s.name}
                disabled={addingQuick}
                onClick={() => quickAdd(s)}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-cream hover:bg-brand-50 hover:border-brand-300 border border-black/[0.04] text-left transition-all group"
              >
                <span className="text-2xl">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-charcoal group-hover:text-brand-700">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-charcoal-muted">{s.goal}</p>
                </div>
                <PlusIcon size={16} className="text-charcoal-muted group-hover:text-brand-600" />
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <AnimatePresence>
            {habits.map((h, i) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card padding="sm" className="h-full flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggle(h.id)}
                      aria-pressed={h.done}
                      className={cn(
                        'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors',
                        h.done
                          ? 'bg-brand-500 text-white shadow-soft'
                          : 'bg-cream text-charcoal-muted hover:bg-black/[0.06]'
                      )}
                    >
                      {h.done ? <CheckIcon size={20} strokeWidth={3} /> : <span className="text-xs font-bold text-charcoal-muted">DONE?</span>}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={cn('font-bold text-charcoal text-sm', h.done && 'line-through opacity-60')}>
                        {h.emoji || '⭐'} {h.name}
                      </p>
                      <p className="text-xs text-charcoal-muted mt-0.5">
                        🔥 {h.streak || 0} day streak · {h.done ? 'Completed today' : 'Pending today'}
                      </p>
                    </div>

                    <button
                      onClick={() => remove(h.id)}
                      title="Delete habit"
                      className="p-2 text-charcoal-muted hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
                    >
                      <Trash2Icon size={16} />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Student Encouragement Note */}
      <div className="rounded-3xl bg-cream p-5 flex gap-3">
        <span className="text-lg shrink-0">💛</span>
        <p className="text-sm text-charcoal-light leading-relaxed">
          Missing a day is completely normal during assignment deadlines. The AI assesses your consistency trends over time rather than penalizing isolated lapses.
        </p>
      </div>

      {/* Add Custom Habit Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create a New Daily Habit">
        <div className="space-y-4">
          <Field
            label="Habit Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 10-Min Evening Walk after Study"
          />
          <Field
            label="Target Goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Daily / 10 minutes"
          />
          <Button fullWidth size="lg" onClick={add} disabled={!name.trim()}>
            Create Habit
          </Button>
        </div>
      </Modal>
    </div>
  );
}
