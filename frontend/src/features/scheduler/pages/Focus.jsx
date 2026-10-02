import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PauseIcon, PlayIcon, SlidersHorizontalIcon, StarIcon } from 'lucide-react';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { cn } from '../../../shared/lib/cn';
import { getSessionPlan, nextFocusTask } from '../data';
function fmt(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = sec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
// [ITEM 1] Answers for "Did you finish what you planned?"
const finishOptions = ['Yes', 'Partly', 'No'];
export function Focus() {
    const navigate = useNavigate();
    // [ITEM 8] Session length comes from data.js (same numbers as the Session Length page).
    // If the user changed it on the Session Length page, that page sends the new values here.
    const { state } = useLocation();
    const recommended = getSessionPlan();
    const planned = state?.focus ?? recommended.focus;
    const breakMins = state?.breakMins ?? recommended.breakMins;
    const taskTitle = nextFocusTask?.title ?? 'Focus session';
    const total = planned * 60;

    // [ITEM 1] TIMER USING A START TIMESTAMP
    // We do NOT count setInterval ticks (ticks can be late or skipped when the tab is in the background).
    // Instead we save the time the session (re)started and do: Date.now() - startTime.
    //   startTime   = when the timer last started / resumed (milliseconds)
    //   savedMs     = time already done before the last pause
    const startTime = useRef(Date.now());
    const savedMs = useRef(0);
    const sessionStartedAt = useRef(new Date()); // wall-clock start, kept for the session summary
    const [running, setRunning] = useState(true);
    const [now, setNow] = useState(Date.now()); // only used to re-draw the screen every second
    // [ITEM 1] How many times the user paused this session
    const [pauseCount, setPauseCount] = useState(0);
    // [ITEM 1] End-of-session modal (self-report instead of camera tracking)
    const [showEndModal, setShowEndModal] = useState(false);
    const [rating, setRating] = useState(0); // 0 = skipped, 1-5 = stars
    const [finished, setFinished] = useState(null); // 'Yes' | 'Partly' | 'No'

    useEffect(() => {
        if (!running)
            return;
        // The interval only refreshes the screen. The real time comes from Date.now() - startTime.
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [running]);

    const elapsedMs = savedMs.current + (running ? now - startTime.current : 0);
    const elapsed = Math.floor(elapsedMs / 1000);
    const remaining = Math.max(0, total - elapsed);
    const pct = Math.min(100, elapsed / total * 100);

    // [ITEM 1] Pause / resume keeps the timer correct and counts pauses
    const togglePause = () => {
        if (running) {
            savedMs.current += Date.now() - startTime.current; // keep what was done so far
            setPauseCount((c) => c + 1);
        }
        else {
            startTime.current = Date.now(); // start counting again from now
        }
        setNow(Date.now());
        setRunning((r) => !r);
    };

    // [ITEM 1] "End Session" stops the timer and opens the self-report modal
    const endSession = () => {
        if (running) {
            savedMs.current += Date.now() - startTime.current;
            setRunning(false);
        }
        setShowEndModal(true);
    };

    // [ITEM 1] Save the self-report. No backend yet, so we only pass the summary to the next page.
    // skipped = true when the user presses "Skip" (answers are not saved)
    const finishSession = (skipped = false) => {
        const summary = {
            startedAt: sessionStartedAt.current.toISOString(),
            plannedMinutes: planned,
            actualMinutes: Math.round(savedMs.current / 60000),
            pauseCount,
            focusRating: skipped ? null : rating || null, // null = no star rating given
            finishedPlan: skipped ? null : finished
        };
        navigate('/app', { state: { lastSession: summary } });
    };

    return (<div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center max-w-md mx-auto text-center">
      <p className="text-sm font-semibold text-brand-600">Focus Session</p>
      <h1 className="text-2xl font-extrabold text-charcoal mt-1">{taskTitle}</h1>

      <div className="my-10 relative">
        <ProgressRing value={pct} size={264} stroke={16} color="#F5811E">
          <motion.span animate={running ? { scale: [1, 1.02, 1] } : {}} transition={{ duration: 2, repeat: Infinity }} className="text-5xl font-extrabold text-charcoal tracking-tight tabular-nums">
            {fmt(elapsed)}
          </motion.span>
          {/* [ITEM 1] Simple status only (no camera "FOCUSED" detection) */}
          <span className={cn('mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', running ? 'bg-sage-light text-emerald-700' : 'bg-amber-light text-amber-700')}>
            <span className={cn('w-2 h-2 rounded-full', running ? 'bg-sage animate-pulse' : 'bg-amber-soft')}/> {running ? 'IN SESSION' : 'PAUSED'}
          </span>
          {/* [ITEM 1] Pause count shown under the timer */}
          <span className="text-xs text-charcoal-muted mt-2">Paused {pauseCount} {pauseCount === 1 ? 'time' : 'times'}</span>
        </ProgressRing>
      </div>

      {/* [ITEM 1] REMOVED: Focus % / Phone / Keys / Mouse cards (proposal has no camera or activity tracking) */}

      <p className="text-sm text-charcoal-muted mb-1">Time remaining {fmt(remaining)}</p>
      <p className="text-sm font-semibold text-brand-600 mb-6">You’re doing great. Keep going. 💪</p>

      <div className="flex items-center gap-3 w-full">
        <Button size="lg" variant={running ? 'secondary' : 'primary'} className="flex-1" onClick={togglePause}>
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
        {/* [ITEM 1] REMOVED: "Focus detection is on" text and the distraction pop-up */}
      </div>

      {/* [ITEM 1] END-OF-SESSION MODAL — the user tells us how it went */}
      <Modal open={showEndModal} onClose={() => setShowEndModal(false)} title="Session finished 🎉">
        <div className="space-y-6 text-left">
          <p className="text-sm text-charcoal-muted">
            You focused for <b className="text-charcoal">{fmt(elapsed)}</b> and paused {pauseCount} {pauseCount === 1 ? 'time' : 'times'}.
          </p>

          {/* Question 1: 1-5 stars (optional) */}
          <div>
            <p className="text-sm font-bold text-charcoal">How focused were you? <span className="font-medium text-charcoal-muted">(optional)</span></p>
            <div className="flex items-center gap-1.5 mt-2">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} out of 5 stars`} aria-pressed={n <= rating} className="p-1 rounded-full hover:bg-brand-50 transition-colors">
                  <StarIcon size={28} className={n <= rating ? 'text-brand-500' : 'text-black/15'} fill={n <= rating ? 'currentColor' : 'none'}/>
                </button>)}
              {rating > 0 &&
            <button type="button" onClick={() => setRating(0)} className="ml-2 text-xs font-semibold text-charcoal-muted hover:text-charcoal">
                  Clear
                </button>}
            </div>
          </div>

          {/* Question 2: Yes / Partly / No */}
          <div>
            <p className="text-sm font-bold text-charcoal">Did you finish what you planned?</p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {finishOptions.map((o) => <button key={o} type="button" onClick={() => setFinished(o)} aria-pressed={finished === o} className={cn('rounded-2xl py-2.5 text-sm font-semibold border transition-colors', finished === o ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-charcoal border-black/10 hover:bg-black/[0.03]')}>
                  {o}
                </button>)}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="lg" className="flex-1" onClick={() => finishSession(false)}>
              Save
            </Button>
            <Button size="lg" variant="ghost" className="flex-1" onClick={() => finishSession(true)}>
              Skip
            </Button>
          </div>
        </div>
      </Modal>
    </div>);
}
