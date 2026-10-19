import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SnowflakeIcon, ShieldIcon } from "lucide-react";
import { PageHeader } from "../shared/components/layout/PageHeader";
import { Card } from "../shared/components/ui/Card";
import { ProgressBar } from "../shared/components/ui/ProgressBar";
import api from "../shared/api/client";
import { useAuth } from "../shared/context/AuthContext";
import useProgress from "../features/scheduler/hooks/useProgress";
import { levelName, toDate } from "../features/scheduler/lib";
import { cn } from "../shared/lib/cn";

// XP, level, streak and badges all come from GET /scheduler/progress (Component 3, Module G).
const XP_PER_LEVEL = 200;          // same as the backend (level = 1 + XP / 200)
const CALENDAR_DAYS = 35;          // 5 weeks
const DAY_CHANGE_HOUR = 3;         // work until 03:00 counts to the day before (same as the backend)
const XP_RULES = [
    { emoji: '⏱️', title: 'Finish a focus session', text: '1 XP per focused minute - ×1.2 for medium and ×1.5 for heavy work.' },
    { emoji: '✅', title: 'Complete a task', text: '+10 light · +20 medium · +35 heavy. Milestones give bonus XP. Every 200 XP is a new level.' },
    { emoji: '🔥', title: 'Keep a streak', text: 'Study a little every day. One missed day a week and stressful days are forgiven.' },
];

export function Progress() {
    const { user } = useAuth();
    const progress = useProgress(user?.id);
    const studyDays = useStudyDays();

    if (!progress) {
        return <div className="space-y-6">
          <PageHeader title="Your Progress" subtitle="Momentum you’ve built — celebrated the way it deserves."/>
          <Card padding="lg"><p className="text-sm text-charcoal-muted">Loading your progress…</p></Card>
        </div>;
    }

    const { total_xp: xp, level, xp_to_next_level: toGo, streak, badges } = progress;
    const levelPct = Math.round((XP_PER_LEVEL - toGo) / XP_PER_LEVEL * 100);
    const earned = badges.filter((b) => b.earned).length;

    return <div className="space-y-6">
      <PageHeader title="Your Progress" subtitle="Momentum you’ve built — celebrated the way it deserves."/>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Level hero */}
        <Card padding="lg" className="lg:col-span-2 relative overflow-hidden flex flex-col">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-brand-50" aria-hidden/>
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-brand-500 text-white flex flex-col items-center justify-center shadow-glow shrink-0">
              <span className="text-3xl font-extrabold leading-none">{level}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Level</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-charcoal">{levelName(level)}</h2>
              <p className="text-sm text-charcoal-muted">{xp.toLocaleString()} XP earned so far</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
                  <span>Progress to Level {level + 1}</span>
                  <span>{levelPct}%</span>
                </div>
                <ProgressBar value={levelPct} height={10}/>
                <p className="text-xs text-charcoal-muted mt-1.5">{toGo.toLocaleString()} XP to go</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
                { l: 'Total XP', v: xp.toLocaleString() },
                { l: 'Badges earned', v: `${earned} / ${badges.length}` },
                { l: 'Study days (5 weeks)', v: studyDays ? studyDays.size : '–' },
            ].map((s) => <div key={s.l} className="bg-cream rounded-2xl p-4 text-center">
                <p className="text-xl font-extrabold text-charcoal">{s.v}</p>
                <p className="text-xs font-semibold text-charcoal-muted mt-0.5">{s.l}</p>
              </div>)}
          </div>

          {/* How XP is earned (same numbers as the backend, engine/gamification.py) */}
          <div className="mt-6 pt-5 border-t border-black/[0.05] flex-1 flex flex-col">
            <h3 className="font-bold text-charcoal">How you earn XP</h3>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 flex-1">
              {XP_RULES.map((r) => <div key={r.title} className="rounded-2xl border border-black/[0.06] p-4">
                  <div className="text-2xl">{r.emoji}</div>
                  <p className="text-sm font-bold text-charcoal mt-2">{r.title}</p>
                  <p className="text-xs text-charcoal-muted mt-1 leading-relaxed">{r.text}</p>
                </div>)}
            </div>
          </div>
        </Card>

        {/* Streak */}
        <Card padding="lg" className="flex flex-col">
          <h3 className="font-bold text-charcoal">Keep Your Momentum</h3>
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="text-5xl">🔥</div>
            <p className="text-3xl font-extrabold text-charcoal mt-2">{streak.current} {streak.current === 1 ? 'Day' : 'Days'}</p>
            <p className="text-sm text-charcoal-muted">
              Current streak{streak.today_done ? ' · today done ✓' : ' · finish a session today to grow it'}
            </p>
          </div>
          <StreakCalendar days={studyDays}/>
          <div className="mt-4 bg-sky-50 rounded-2xl p-3 flex items-center gap-2">
            <SnowflakeIcon size={16} className="text-sky-500"/>
            <p className="text-xs font-semibold text-sky-700">
              {streak.freeze_left_this_week} streak freeze left this week (1 missed day per week is forgiven)
            </p>
          </div>
          {streak.stress_days_skipped > 0 && <div className="mt-2 bg-brand-50 rounded-2xl p-3 flex items-center gap-2">
              <ShieldIcon size={16} className="text-brand-600"/>
              <p className="text-xs font-semibold text-brand-700">
                {streak.stress_days_skipped} stressful {streak.stress_days_skipped === 1 ? 'day' : 'days'} did not break your streak
              </p>
            </div>}
          <p className="text-xs text-charcoal-muted mt-3 text-center">One difficult day should not erase your progress.</p>
        </Card>
      </div>

      {/* Badges */}
      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Badges</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {badges.map((b, i) => <motion.div key={b.code} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
              <Card padding="sm" className={cn('flex flex-col items-center text-center h-full', !b.earned && 'opacity-60')}>
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-2xl', b.earned ? 'bg-brand-500 shadow-glow' : 'bg-black/[0.05] grayscale')}>
                  {b.emoji}
                </div>
                <p className="text-sm font-bold text-charcoal">{b.title}</p>
                <p className="text-[11px] text-charcoal-muted mt-0.5 leading-tight">{b.description}</p>
                {b.earned
                    ? <span className="text-[10px] font-bold text-brand-600 mt-2 uppercase tracking-wide">
                        Earned {toDate(b.earned_at)?.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    : <div className="w-full mt-2">
                        <ProgressBar value={Math.round(b.progress / b.target * 100)}/>
                        <p className="text-[10px] font-bold text-charcoal-muted mt-1">{b.progress} / {b.target}</p>
                      </div>}
              </Card>
            </motion.div>)}
        </div>
      </div>

      <Milestones items={progress.milestones}/>
    </div>;
}

// "12 / 25 h", "7 / 10 tasks", "3 / 7 days"
const UNIT = { focus_minutes: (n) => `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}`, tasks_done: (n) => `${n}`, study_days: (n) => `${n}` };
const UNIT_WORD = { focus_minutes: '', tasks_done: ' tasks', study_days: ' days' };

function Milestones({ items }) {
    if (!items?.length) return null;
    return <div>
      <h3 className="text-lg font-bold text-charcoal mb-3">Milestones</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((m) => <Card key={m.code} padding="sm" className={cn('flex flex-col gap-2', !m.earned && 'opacity-80')}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-charcoal">{m.earned ? '🏁 ' : ''}{m.title}</p>
              <span className="text-xs font-bold bg-brand-50 text-brand-700 rounded-full px-2.5 py-1 shrink-0">+{m.xp} XP</span>
            </div>
            <ProgressBar value={Math.round(m.progress / m.target * 100)} color={m.earned ? 'bg-sage' : 'bg-brand-500'}/>
            <p className="text-xs font-semibold text-charcoal-muted">
              {m.earned ? `Reached ${toDate(m.earned_at)?.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                  : `${UNIT[m.unit](m.progress)} / ${UNIT[m.unit](m.target)}${UNIT_WORD[m.unit]}`}
            </p>
          </Card>)}
      </div>
    </div>;
}

// Study days (with a completed focus session) in the last 5 weeks, as "YYYY-MM-DD" in local time
function useStudyDays() {
    const [days, setDays] = useState(null);
    useEffect(() => {
        const from = new Date(Date.now() - CALENDAR_DAYS * 86400000);
        api.get("/scheduler/focus/history", { params: { from: from.toISOString(), completed: true, limit: 200 } })
            .then((r) => setDays(new Set(r.data.items.map((s) => dayKey(toDate(s.started_at))))))
            .catch(() => setDays(new Set()));
    }, []);
    return days;
}

const dayKey = (d) => {
    const x = new Date(d.getTime() - DAY_CHANGE_HOUR * 3600000);
    return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
};

// Last 5 weeks, oldest first: green = studied, grey = no session, outline = today
function StreakCalendar({ days }) {
    const today = new Date();
    const cells = Array.from({ length: CALENDAR_DAYS }, (_, i) => {
        const d = new Date(today.getTime() - (CALENDAR_DAYS - 1 - i) * 86400000);
        return { key: dayKey(d), label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), isToday: i === CALENDAR_DAYS - 1 };
    });
    return <div className="grid grid-cols-7 gap-1.5">
      {cells.map((c) => <span key={c.key} title={c.label}
            className={cn('aspect-square rounded-md', days?.has(c.key) ? 'bg-brand-500' : 'bg-black/[0.06]', c.isToday && 'ring-2 ring-brand-300')}/>)}
    </div>;
}
