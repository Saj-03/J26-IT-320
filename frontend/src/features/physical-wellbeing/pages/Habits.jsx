import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, CheckIcon, FlameIcon, Trash2Icon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { Modal } from '../../../shared/components/ui/Modal';
import { Field } from '../../../shared/components/ui/Field';
import { PhysicalNav } from '../components/PhysicalNav';
import { PhysicalMasterCard } from '../components/PhysicalMasterCard';
import { cn } from '../../../shared/lib/cn';
import { getHabits, addHabit, habitDone, deleteHabit } from '../api';

export function PhysicalHabits() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const fetchHabits = async () => {
    try {
      const data = await getHabits();
      setHabits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('Could not load your habits. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const toggle = async (id) => {
    const selected = habits.find((habit) => habit.id === id);
    if (!selected || selected.done || busyId) return;
    setBusyId(id);
    setError('');
    try {
      const res = await habitDone(id);
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id ? { ...h, done: res.done, streak: res.streak } : h
        )
      );
    } catch (err) {
      console.error(err);
      setError('Could not save that check-in. Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const add = async () => {
    if (!name.trim()) return;
    setError('');
    try {
      const created = await addHabit(name.trim());
      setHabits((prev) => [
        ...prev,
        {
          id: created.data?.id || created.id || Date.now(),
          name: name.trim(),
          streak: 0,
          done: false,
          emoji: '⭐'
        }
      ]);
      setName('');
      setOpen(false);
      await fetchHabits();
    } catch (err) {
      console.error(err);
      setError('Could not save this habit. Please try again.');
    }
  };

  const remove = async (id) => {
    setError('');
    try {
      await deleteHabit(id);
      setHabits((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error(err);
      setError('Could not remove that habit. Please try again.');
    }
  };

  const doneCount = habits.filter((h) => h.done).length;
  const maxStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak || 0), 0) : 0;
  const completionPct = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PhysicalMasterCard
        title="Healthy Habits"
        subtitle="Real daily student habits that train discipline, energy, and mental focus."
        eyebrow="Everyday routines"
      />

      <PhysicalNav />

      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><PlusIcon size={16} /> Add Custom Habit</Button>
      </div>

      {/* Streak Hero Card */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-brand-50" aria-hidden />
        <div className="relative flex items-center gap-5">
          <div className="text-5xl">🔥</div>
          <div className="flex-1">
            <p className="text-2xl font-extrabold text-charcoal">
              {maxStreak > 0 ? `${maxStreak} day streak` : 'Build your first streak'}
            </p>
            <p className="text-sm text-charcoal-muted mt-0.5">
              {habits.length > 0
                ? `${doneCount} of ${habits.length} habits completed today`
                : 'No habits tracked yet. Add a routine that fits your day.'}
            </p>
          </div>
          <FlameIcon size={24} className="text-brand-500 shrink-0" />
        </div>
        {habits.length > 0 && <div className="relative mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-charcoal-muted">Today’s progress</span>
            <span className="font-bold tabular-nums text-brand-700">{doneCount}/{habits.length}</span>
          </div>
          <ProgressBar value={completionPct} color="bg-emerald-500" />
        </div>}
      </Card>

      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

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
            Create a routine you actually want to track. Your list and streaks come from your saved check-ins.
          </p>
          <Button className="mt-5" onClick={() => setOpen(true)}><PlusIcon size={16} /> Create your first habit</Button>
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
                      disabled={h.done || Boolean(busyId)}
                      aria-pressed={h.done}
                      aria-label={h.done ? `${h.name} completed today` : `Mark ${h.name} complete today`}
                      title={h.done ? 'Completed today' : 'Mark complete today'}
                      className={cn(
                        'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors',
                        h.done
                          ? 'bg-brand-500 text-white shadow-soft'
                          : 'bg-cream text-charcoal-muted hover:bg-emerald-50 hover:text-emerald-700'
                      )}
                    >
                      {h.done ? <CheckIcon size={20} strokeWidth={3} /> : <span className="text-[10px] font-bold text-charcoal-muted">DONE</span>}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={cn('font-bold text-charcoal text-sm', h.done && 'line-through opacity-60')}>
                        {h.emoji || '⭐'} {h.name}
                      </p>
                      <p className="text-xs text-charcoal-muted mt-0.5">
                        <span className="text-orange-500">🔥</span> {h.streak || 0} day streak · {h.done ? 'Completed today' : 'Not done yet'}
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

      <div className="rounded-3xl bg-cream p-5 flex gap-3">
        <span className="text-lg shrink-0">💛</span>
        <p className="text-sm text-charcoal-light leading-relaxed">
          Streaks reflect consecutive days with a saved check-in. A missed day resets the streak when you next check in.
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
          <Button fullWidth size="lg" onClick={add} disabled={!name.trim()}>
            Create Habit
          </Button>
        </div>
      </Modal>
    </div>
  );
}
