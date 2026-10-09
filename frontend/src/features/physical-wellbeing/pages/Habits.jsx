import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, CheckIcon, XIcon, FlameIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { Field } from '../../../shared/components/ui/Field';
import { PhysicalNav } from '../components/PhysicalNav';
import { habits as seedHabits, wellbeingProfile } from '../data';
import { cn } from '../../../shared/lib/cn';
import { addHabit, habitDone } from '../api';
const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export function PhysicalHabits() {
    const [habits, setHabits] = useState(seedHabits);
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [goal, setGoal] = useState('');
    const toggle = async (id) => {
        const h = habits.find((x) => x.id === id);
        // Habits saved on the server get their streak from /habits/{id}/done; sample habits stay local
        if (h.remote && !h.done) {
            const { streak } = await habitDone(id);
            setHabits((hs) => hs.map((x) => x.id === id ? { ...x, done: true, streak } : x));
            return;
        }
        setHabits((hs) => hs.map((x) => x.id === id ? { ...x, done: !x.done, streak: x.done ? Math.max(0, x.streak - 1) : x.streak + 1 } : x));
    };
    const add = async () => {
        if (!name.trim())
            return;
        const { data } = await addHabit(name.trim());
        setHabits((hs) => [
            ...hs,
            {
                id: data.id,
                remote: true,
                emoji: '⭐',
                name: name.trim(),
                goal: goal.trim() || 'Daily',
                streak: 0,
                done: false,
                history: [false, false, false, false, false, false, false]
            }
        ]);
        setName('');
        setGoal('');
        setOpen(false);
    };
    const doneCount = habits.filter((h) => h.done).length;
    return (<div className="space-y-6">
      <PageHeader title="Healthy Habits" subtitle="Small daily wins that keep your wellbeing score moving." action={<Button onClick={() => setOpen(true)}>
            <PlusIcon size={16}/> Add Habit
          </Button>}/>

      <PhysicalNav />

      {/* Streak hero */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-brand-50" aria-hidden/>
        <div className="relative flex items-center gap-5">
          <div className="text-5xl">🔥</div>
          <div className="flex-1">
            <p className="text-2xl font-extrabold text-charcoal">{wellbeingProfile.streak} Day Streak</p>
            <p className="text-sm text-charcoal-muted mt-0.5">
              {doneCount} of {habits.length} habits done today
            </p>
          </div>
          <FlameIcon size={22} className="text-brand-500 shrink-0"/>
        </div>
      </Card>

      {/* Habit list */}
      <div className="grid md:grid-cols-2 gap-4">
        {habits.map((h, i) => <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card padding="sm" className="h-full">
              <div className="flex items-center gap-3">
                <button onClick={() => toggle(h.id)} aria-pressed={h.done} aria-label={`Mark ${h.name} ${h.done ? 'incomplete' : 'complete'}`} className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors', h.done ? 'bg-brand-500 text-white' : 'bg-cream text-charcoal-muted hover:bg-black/[0.06]')}>
                  {h.done ? <CheckIcon size={18} strokeWidth={3}/> : <XIcon size={16}/>}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={cn('font-bold text-charcoal text-sm', h.done && 'line-through opacity-60')}>
                    {h.emoji} {h.name}
                  </p>
                  <p className="text-xs text-charcoal-muted mt-0.5">
                    Goal: {h.goal} · 🔥 {h.streak} day streak
                  </p>
                </div>
              </div>

              <div className="flex gap-1 mt-3 pt-3 border-t border-black/[0.05]">
                {h.history.map((d, k) => <div key={k} className="flex-1 flex flex-col items-center gap-1">
                    <span className={cn('w-full h-4 rounded-md', d ? 'bg-brand-500' : 'bg-black/[0.07]')}/>
                    <span className="text-[9px] font-semibold text-charcoal-muted">{dayLabels[k]}</span>
                  </div>)}
              </div>
            </Card>
          </motion.div>)}
      </div>

      <div className="rounded-3xl bg-cream p-5 flex gap-3">
        <span className="text-lg shrink-0">💛</span>
        <p className="text-sm text-charcoal-light leading-relaxed">
          Missing a day is fine. The AI looks at your overall pattern, not single days.
        </p>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a habit">
        <div className="space-y-4">
          <Field label="Habit name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stretch after lectures"/>
          <Field label="Daily goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. 5 minutes"/>
          <Button fullWidth size="lg" onClick={add}>
            Create Habit
          </Button>
        </div>
      </Modal>
    </div>);
}
