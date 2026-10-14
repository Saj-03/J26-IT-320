import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/lib/cn';
import { sendMood } from '../api';
const moods = [
    { emoji: '😣', label: 'Struggling', score: 1 },
    { emoji: '😐', label: 'Okay', score: 3 },
    { emoji: '🙂', label: 'Good', score: 4 },
    { emoji: '🔥', label: 'Motivated', score: 5 }
];
export function MoodCheckin() {
    const navigate = useNavigate();
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const submit = async () => {
        setSaving(true);
        try {
            await sendMood(moods[selected].score);
            navigate('/app');
        }
        finally {
            setSaving(false);
        }
    };
    const struggling = selected === 0;
    return (<div className="min-h-[calc(100vh-8rem)] flex items-center justify-center max-w-lg mx-auto">
      <div className="w-full text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-charcoal">How are you feeling today?</h1>
        <p className="mt-2 text-charcoal-muted">Your answer helps ThriveU adapt today’s schedule.</p>

        <div className="grid grid-cols-2 gap-3 mt-8">
          {moods.map((m, i) => <button key={m.label} onClick={() => setSelected(i)} className={cn('flex flex-col items-center gap-2 rounded-3xl py-7 border-2 transition-all', selected === i ? 'border-brand-500 bg-brand-50 scale-[1.02]' : 'border-black/[0.05] bg-white hover:border-brand-200')}>
              <span className="text-4xl">{m.emoji}</span>
              <span className="font-bold text-charcoal">{m.label}</span>
            </button>)}
        </div>

        <AnimatePresence>
          {struggling &&
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-6 bg-sage-light border border-emerald-100 rounded-3xl p-5 text-left">
                <p className="font-bold text-emerald-800">We’ll make today lighter. 💛</p>
                <ul className="mt-3 space-y-2 text-sm text-emerald-700">
                  {['Reduce today’s workload', 'Add recovery time', 'Move low-priority tasks to later'].map((t) => <li key={t} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-sage text-white flex items-center justify-center shrink-0">
                        <CheckIcon size={12} strokeWidth={3}/>
                      </span>
                      {t}
                    </li>)}
                </ul>
              </div>
            </motion.div>}
        </AnimatePresence>

        <Button size="lg" fullWidth className="mt-8" disabled={selected === null || saving} onClick={submit}>
          Continue
        </Button>
      </div>
    </div>);
}
