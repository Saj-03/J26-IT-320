import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PauseIcon, PlayIcon, StarIcon, TrophyIcon } from 'lucide-react';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { LoadingState } from '../../../shared/components/ui/States';
import { apiErrorMessage } from '../../../shared/api/client';
import { cn } from '../../../shared/lib/cn';
import { endFocus, getActiveFocus, getTask, pauseFocus, resumeFocus, utcMs } from '../api';

// Badge codes from the backend (progress_service.BADGES) -> what the student sees
const BADGE_NAMES = {
    first_focus: '🌱 First Focus', deep_diver: '🧠 Deep Diver', week_warrior: '🔥 Week Warrior',
    peak_performer: '🎯 Peak Performer', deadline_keeper: '✅ Deadline Keeper', self_care: '🌿 Self-care',
};

function fmt(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = sec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

// Focused seconds = time since start - all pauses (+ the pause going on right now).
// Worked out from the backend's times, so a page refresh never loses the timer.
function focusedSeconds(session, now) {
    const pausedNow = session.paused_at ? now - utcMs(session.paused_at) : 0;
    const ms = now - utcMs(session.started_at) - session.paused_seconds * 1000 - pausedNow;
    return Math.max(0, Math.floor(ms / 1000));
}

export function Focus() {
    const navigate = useNavigate();
    const [session, setSession] = useState(null);     // the running session from the backend
    const [taskTitle, setTaskTitle] = useState('Focus session');
    const [now, setNow] = useState(Date.now());       // only used to re-draw every second
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showEndModal, setShowEndModal] = useState(false);
    const [rating, setRating] = useState(0);          // 0 = no rating, 1-5 = stars
    const [result, setResult] = useState(null);       // answer of /end: completed? XP? level?

    // Load the running session. None -> go and set one up.
    useEffect(() => {
        getActiveFocus()
            .then((s) => {
                if (!s) return navigate('/app/focus/setup', { replace: true });
                setSession(s);
                if (s.task_id) getTask(s.task_id).then((t) => setTaskTitle(t.title)).catch(() => {});
            })
            .catch((e) => setError(apiErrorMessage(e)));
    }, [navigate]);

    const running = session && !session.paused_at && !session.ended_at;
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [running]);

    if (!session) return error ? <p className="text-center text-sm font-semibold text-red-600 mt-16">{error}</p>
                               : <LoadingState label="Loading your session…"/>;

    const total = session.planned_minutes * 60;
    const elapsed = focusedSeconds(session, result ? utcMs(session.ended_at) : now);
    const remaining = Math.max(0, total - elapsed);
    const pct = Math.min(100, elapsed / total * 100);

    // Run one backend call; keep the session it returns
    const call = (request) => {
        setBusy(true);
        setError('');
        return request.then((s) => { setSession(s); setNow(Date.now()); return s; })
            .catch((e) => { setError(apiErrorMessage(e)); throw e; })
            .finally(() => setBusy(false));
    };

    // Pause / resume on the backend - it counts the pauses and the paused time
    const togglePause = () => call(running ? pauseFocus(session.id) : resumeFocus(session.id)).catch(() => {});

    // "End Session": pause first so the time spent in the dialog is not counted, then ask for a rating
    const openEnd = () => {
        (running ? call(pauseFocus(session.id)) : Promise.resolve()).then(() => setShowEndModal(true)).catch(() => {});
    };

    // Save: the backend works out the real focus time, completed or not, and the XP
    const finish = (withRating) => {
        setBusy(true);
        setError('');
        endFocus(session.id, withRating ? rating || null : null)
            .then((r) => { setSession(r.session); setResult(r); })
            .catch((e) => setError(apiErrorMessage(e)))
            .finally(() => setBusy(false));
    };

    return (<div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center max-w-md mx-auto text-center">
      <p className="text-sm font-semibold text-brand-600">Focus Session</p>
      <h1 className="text-2xl font-extrabold text-charcoal mt-1">{taskTitle}</h1>

      <div className="my-10 relative">
        <ProgressRing value={pct} size={264} stroke={16} color="#2E9C88">
          <motion.span animate={running ? { scale: [1, 1.02, 1] } : {}} transition={{ duration: 2, repeat: Infinity }} className="text-5xl font-extrabold text-charcoal tracking-tight tabular-nums">
            {fmt(elapsed)}
          </motion.span>
          <span className={cn('mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', running ? 'bg-sage-light text-emerald-700' : 'bg-amber-light text-amber-700')}>
            <span className={cn('w-2 h-2 rounded-full', running ? 'bg-sage animate-pulse' : 'bg-amber-soft')}/> {running ? 'IN SESSION' : 'PAUSED'}
          </span>
          <span className="text-xs text-charcoal-muted mt-2">Paused {session.pause_count} {session.pause_count === 1 ? 'time' : 'times'}</span>
        </ProgressRing>
      </div>

      <p className="text-sm text-charcoal-muted mb-1">Time remaining {fmt(remaining)}</p>
      <p className="text-sm font-semibold text-brand-600 mb-6">
        {session.planned_minutes} min planned{session.timer_overridden ? ' (your choice)' : ' (suggested)'} · You’re doing great 💪
      </p>

      {error && <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>}

      <div className="flex items-center gap-3 w-full">
        <Button size="lg" variant={running ? 'secondary' : 'primary'} className="flex-1" onClick={togglePause} disabled={busy}>
          {running ? <PauseIcon size={18}/> : <PlayIcon size={18} fill="currentColor"/>}
          {running ? 'Pause Session' : 'Resume'}
        </Button>
        <Button size="lg" variant="outline" onClick={openEnd} disabled={busy}>
          End Session
        </Button>
      </div>

      {/* END-OF-SESSION DIALOG: optional rating -> backend result (completed? XP? level?) */}
      <Modal open={showEndModal} onClose={() => !result && setShowEndModal(false)} title={result ? (result.session.completed ? 'Session completed 🎉' : 'Session saved') : 'End this session?'}>
        {!result ?
            <div className="space-y-6 text-left">
            <p className="text-sm text-charcoal-muted">
              You focused for <b className="text-charcoal">{fmt(elapsed)}</b> of {session.planned_minutes} min and paused {session.pause_count} {session.pause_count === 1 ? 'time' : 'times'}.
            </p>
            <div>
              <p className="text-sm font-bold text-charcoal">How focused were you? <span className="font-medium text-charcoal-muted">(optional)</span></p>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} out of 5 stars`} aria-pressed={n <= rating} className="p-1 rounded-full hover:bg-brand-50 transition-colors">
                    <StarIcon size={28} className={n <= rating ? 'text-brand-500' : 'text-black/15'} fill={n <= rating ? 'currentColor' : 'none'}/>
                  </button>)}
              </div>
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="lg" className="flex-1" onClick={() => finish(true)} disabled={busy}>Save</Button>
              <Button size="lg" variant="ghost" className="flex-1" onClick={() => finish(false)} disabled={busy}>Skip rating</Button>
            </div>
            <button type="button" onClick={() => setShowEndModal(false)} className="w-full text-xs font-semibold text-charcoal-muted hover:text-charcoal">
              Not yet - keep the session (press Resume to continue)
            </button>
          </div> :
            <div className="space-y-5 text-left">
            <p className="text-sm text-charcoal-muted">
              Focused <b className="text-charcoal">{result.session.actual_minutes} min</b> of {result.session.planned_minutes} min planned.
              {!result.session.completed && ' A session counts as completed at 80% of the planned time - shorter is fine, we learn from it.'}
            </p>
            <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
              <TrophyIcon size={28} className="text-brand-600"/>
              <div>
                <p className="text-lg font-extrabold text-charcoal">+{result.xp_awarded} XP</p>
                <p className="text-xs text-charcoal-muted">
                  Total {result.total_xp} XP · Level {result.level}{result.streak > 0 && ` · 🔥 ${result.streak}-day streak`}
                </p>
              </div>
            </div>
            {result.new_badges.length > 0 &&
                <div className="rounded-2xl bg-sage-light p-4">
                <p className="text-sm font-bold text-emerald-800">New badge{result.new_badges.length > 1 ? 's' : ''}!</p>
                <p className="text-sm text-emerald-700 mt-1">{result.new_badges.map((c) => BADGE_NAMES[c] ?? c).join(' · ')}</p>
              </div>}
            <Button size="lg" fullWidth onClick={() => navigate('/app')}>Done</Button>
          </div>}
      </Modal>
    </div>);
}
