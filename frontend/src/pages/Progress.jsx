import React from "react";
import { motion } from "framer-motion";
import { FlameIcon, TargetIcon, RefreshCwIcon, SunriseIcon, FlagIcon, ShieldIcon, AwardIcon, MoonIcon, SnowflakeIcon } from "lucide-react";
import { PageHeader } from "../shared/components/layout/PageHeader";
import { Card } from "../shared/components/ui/Card";
import { ProgressBar } from "../shared/components/ui/ProgressBar";
import { badges, challenges } from "../shared/lib/data";
import useStudent from "../shared/hooks/useStudent";
import { cn } from "../shared/lib/cn";
const iconMap = {
    target: TargetIcon,
    refresh: RefreshCwIcon,
    sunrise: SunriseIcon,
    flag: FlagIcon,
    flame: FlameIcon,
    shield: ShieldIcon,
    award: AwardIcon,
    moon: MoonIcon
};
export function Progress() {
    const student = useStudent();
    const xpPct = Math.round(student.xp / student.xpToNext * 100);
    return <div className="space-y-6">
      <PageHeader title="Your Progress" subtitle="Momentum you’ve built — celebrated the way it deserves."/>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Level hero */}
        <Card padding="lg" className="lg:col-span-2 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-brand-50" aria-hidden/>
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-brand-500 text-white flex flex-col items-center justify-center shadow-glow shrink-0">
              <span className="text-3xl font-extrabold leading-none">{student.level}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Level</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-charcoal">{student.levelName}</h2>
              <p className="text-sm text-charcoal-muted">{student.xp.toLocaleString()} XP earned so far</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
                  <span>Progress to Level {student.level + 1}</span>
                  <span>{xpPct}%</span>
                </div>
                <ProgressBar value={xpPct} height={10}/>
                <p className="text-xs text-charcoal-muted mt-1.5">
                  {(student.xpToNext - student.xp).toLocaleString()} XP to go
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[{
                l: 'XP Today',
                v: '215'
            }, {
                l: 'Weekly XP',
                v: '1,340'
            }, {
                l: 'Monthly XP',
                v: '5,890'
            }].map((s) => <div key={s.l} className="bg-cream rounded-2xl p-4 text-center">
                <p className="text-xl font-extrabold text-charcoal">{s.v}</p>
                <p className="text-xs font-semibold text-charcoal-muted mt-0.5">{s.l}</p>
              </div>)}
          </div>
        </Card>

        {/* Streak */}
        <Card padding="lg" className="flex flex-col">
          <h3 className="font-bold text-charcoal">Keep Your Momentum</h3>
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="text-5xl">🔥</div>
            <p className="text-3xl font-extrabold text-charcoal mt-2">{student.streak} Days</p>
            <p className="text-sm text-charcoal-muted">Current streak</p>
          </div>
          <StreakCalendar />
          <div className="mt-4 bg-sky-50 rounded-2xl p-3 flex items-center gap-2">
            <SnowflakeIcon size={16} className="text-sky-500"/>
            <p className="text-xs font-semibold text-sky-700">{student.freezeTokens} Streak Freeze Tokens available</p>
          </div>
          <p className="text-xs text-charcoal-muted mt-3 text-center">One difficult day should not erase your progress.</p>
        </Card>
      </div>

      {/* Badges */}
      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Badges</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {badges.map((b, i) => {
            const Icon = iconMap[b.icon] ?? AwardIcon;
            return <motion.div key={b.name} initial={{
                    opacity: 0,
                    scale: 0.9
                }} whileInView={{
                    opacity: 1,
                    scale: 1
                }} viewport={{
                    once: true
                }} transition={{
                    delay: i * 0.04
                }}>
                <Card padding="sm" className={cn('flex flex-col items-center text-center', !b.earned && 'opacity-55')}>
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-3', b.earned ? 'bg-brand-500 text-white shadow-glow' : 'bg-black/[0.05] text-charcoal-muted')}>
                    <Icon size={24}/>
                  </div>
                  <p className="text-sm font-bold text-charcoal">{b.name}</p>
                  <p className="text-[11px] text-charcoal-muted mt-0.5 leading-tight">{b.desc}</p>
                  {!b.earned && <span className="text-[10px] font-bold text-charcoal-muted mt-2 uppercase tracking-wide">Locked</span>}
                </Card>
              </motion.div>;
        })}
        </div>
      </div>

      {/* Weekly challenges */}
      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Weekly Challenges</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {challenges.map((c) => {
            const pct = Math.round(c.progress / c.total * 100);
            const done = c.progress >= c.total;
            return <Card key={c.title} padding="lg">
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-charcoal">{c.title}</h4>
                  <span className="text-xs font-bold bg-brand-50 text-brand-700 rounded-full px-2.5 py-1 shrink-0">
                    +{c.reward} XP
                  </span>
                </div>
                <p className="text-sm text-charcoal-muted mt-1 leading-relaxed">{c.desc}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
                    <span>{done ? 'Completed 🎉' : 'In progress'}</span>
                    <span>
                      {c.progress}/{c.total}
                    </span>
                  </div>
                  <ProgressBar value={pct} color={done ? 'bg-sage' : 'bg-brand-500'}/>
                </div>
              </Card>;
        })}
        </div>
      </div>
    </div>;
}
function StreakCalendar() {
    // 5 weeks x 7 days
    const cells = Array.from({
        length: 35
    }).map((_, i) => {
        if (i === 12)
            return 'freeze';
        if (i === 8 || i === 19)
            return 'missed';
        if (i > 34 - 14)
            return 'done';
        return i % 3 === 0 ? 'done' : i % 5 === 0 ? 'idle' : 'done';
    });
    const styles = {
        done: 'bg-brand-500',
        missed: 'bg-black/[0.08]',
        idle: 'bg-black/[0.05]',
        freeze: 'bg-sky-400'
    };
    return <div className="grid grid-cols-7 gap-1.5">
      {cells.map((c, i) => <span key={i} className={cn('aspect-square rounded-md', styles[c])} title={c}/>)}
    </div>;
}
