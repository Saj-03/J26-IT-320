import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PauseIcon, PlayIcon, SmartphoneIcon, KeyboardIcon, MouseIcon, EyeIcon, ShieldIcon, SlidersHorizontalIcon } from 'lucide-react';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import useFetch from '../../../shared/hooks/useFetch';
import { logFocus } from '../api';
function fmt(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = sec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
export function Focus() {
    const navigate = useNavigate();
    // Session length comes from the adaptive pomodoro (sized to attention capacity)
    const { data } = useFetch('/scheduler/plan');
    const planned = data?.pomodoro?.focus_minutes ?? 25;
    const breakMins = data?.pomodoro?.break_minutes ?? 5;
    const taskTitle = data?.tasks?.[0]?.title ?? 'Focus session';
    const total = planned * 60;
    const started = useRef(new Date());
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(true);
    const [distraction, setDistraction] = useState(false);
    useEffect(() => {
        if (!running)
            return;
        const id = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(id);
    }, [running]);
    const remaining = Math.max(0, total - elapsed);
    const pct = Math.min(100, elapsed / total * 100);
    const endSession = async () => {
        setRunning(false);
        const actual = Math.round(elapsed / 60);
        try {
            await logFocus({ task_id: data?.tasks?.[0]?.id ?? null, started_at: started.current.toISOString(), planned_minutes: planned, actual_minutes: actual, completed: actual >= planned });
        }
        finally {
            navigate('/app');
        }
    };
    return (<div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center max-w-md mx-auto text-center">
      <p className="text-sm font-semibold text-brand-600">Focus Session</p>
      <h1 className="text-2xl font-extrabold text-charcoal mt-1">{taskTitle}</h1>

      <div className="my-10 relative">
        <ProgressRing value={pct} size={264} stroke={16} color="#F5811E">
          <motion.span animate={running ? { scale: [1, 1.02, 1] } : {}} transition={{ duration: 2, repeat: Infinity }} className="text-5xl font-extrabold text-charcoal tracking-tight tabular-nums">
            {fmt(elapsed)}
          </motion.span>
          <span className="mt-2 inline-flex items-center gap-1.5 bg-sage-light text-emerald-700 rounded-full px-3 py-1 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-sage animate-pulse"/> FOCUSED
          </span>
          <span className="text-xs text-charcoal-muted mt-2">Focus score 82%</span>
        </ProgressRing>
      </div>

      {/* Signals */}
      <div className="grid grid-cols-4 gap-2 w-full mb-6">
        {[
            { icon: EyeIcon, l: 'Focus', v: '82%', ok: true },
            { icon: SmartphoneIcon, l: 'Phone', v: 'None', ok: true },
            { icon: KeyboardIcon, l: 'Keys', v: 'Active', ok: true },
            { icon: MouseIcon, l: 'Mouse', v: 'Active', ok: true }
        ].
            map((s) => <div key={s.l} className="bg-white rounded-2xl border border-black/[0.04] shadow-soft p-3 flex flex-col items-center">
            <s.icon size={16} className={s.ok ? 'text-emerald-500' : 'text-amber-500'}/>
            <span className="text-xs font-bold text-charcoal mt-1.5">{s.v}</span>
            <span className="text-[10px] text-charcoal-muted">{s.l}</span>
          </div>)}
      </div>

      <p className="text-sm text-charcoal-muted mb-1">Time remaining {fmt(remaining)}</p>
      <p className="text-sm font-semibold text-brand-600 mb-6">You’re doing great. Keep going. 💪</p>

      <div className="flex items-center gap-3 w-full">
        <Button size="lg" variant={running ? 'secondary' : 'primary'} className="flex-1" onClick={() => setRunning((r) => !r)}>
          {running ? <PauseIcon size={18}/> : <PlayIcon size={18} fill="currentColor"/>}
          {running ? 'Pause Session' : 'Resume'}
        </Button>
        <Button size="lg" variant="outline" onClick={endSession}>
          End Session
        </Button>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <button onClick={() => navigate('/app/focus/setup')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
          <SlidersHorizontalIcon size={13}/> Adjust session length · {planned} min focus / {breakMins} min break
        </button>
        <button onClick={() => setDistraction(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-muted hover:text-charcoal">
          <ShieldIcon size={13}/> Focus detection is on · processed locally
        </button>
      </div>

      {/* Gentle distraction toast */}
      <AnimatePresence>
        {distraction &&
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm">
            <Card className="flex items-center gap-3">
              <span className="text-2xl">👋</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-charcoal">{taskTitle} is waiting.</p>
                <p className="text-xs text-charcoal-muted">Ready to jump back in?</p>
              </div>
              <Button size="sm" onClick={() => setDistraction(false)}>
                I’m back
              </Button>
            </Card>
          </motion.div>}
      </AnimatePresence>
    </div>);
}
