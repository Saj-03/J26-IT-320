import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListTodoIcon, TimerIcon, GaugeIcon, FlameIcon, MoonIcon, ZapIcon, HeartPulseIcon, ArrowRightIcon, SparklesIcon } from 'lucide-react';
import { Card } from '../shared/components/ui/Card';
import { Button } from '../shared/components/ui/Button';
import { ProgressRing } from '../shared/components/ui/ProgressRing';
import { ProgressBar } from '../shared/components/ui/ProgressBar';
import { StatCard } from '../shared/components/domain/StatCard';
import { ScheduleTimeline } from '../features/scheduler/components/ScheduleTimeline';
import { AIInsightCard } from '../shared/components/domain/AIInsightCard';
import { BarChart } from '../shared/components/charts/Charts';
import { weeklyTasksData, focusTimeData } from '../shared/lib/data';
import useStudent from '../shared/hooks/useStudent';
import { cn } from '../shared/lib/cn';
// [ITEM 8] Scheduler numbers + greeting come from the scheduler data.js
import { getGreeting, todayTaskCount, peakHours } from '../features/scheduler/data';
const fade = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 }
};
export function Dashboard() {
    const student = useStudent();
    const navigate = useNavigate();
    const xpPct = Math.round(student.xp / student.xpToNext * 100);
    return (<div className="space-y-6">
      {/* Hero card */}
      <motion.div {...fade}>
        <Card padding="lg" className="relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-brand-50" aria-hidden/>
          <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              {/* [ITEM 8] Greeting uses the current time */}
              <p className="text-sm font-semibold text-brand-600">{getGreeting()}, {student.name} 👋</p>
              <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-charcoal leading-snug max-w-xl">
                You have {todayTaskCount} important tasks today. Your schedule has been planned around your peak focus hours.
              </h2>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => navigate('/app/focus')}>
                  <TimerIcon size={16}/> Start focus session
                </Button>
                <Button variant="outline" onClick={() => navigate('/app/schedule')}>
                  View schedule <ArrowRightIcon size={16}/>
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <ProgressRing value={75} size={128} stroke={12}>
                <span className="text-3xl font-extrabold text-charcoal">75%</span>
                <span className="text-xs font-semibold text-charcoal-muted">Today done</span>
              </ProgressRing>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Today's overview */}
      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Today’s Overview</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={ListTodoIcon} label="Tasks Today" value={String(todayTaskCount)}/>
          <StatCard icon={TimerIcon} iconBg="bg-sky-50" iconColor="text-sky-500" label="Focus Time" value="3h 25m" sub={<ProgressBar value={68} color="bg-sky-400" height={6}/>}>
            <span className="text-xs font-semibold text-charcoal-muted">of 5h</span>
          </StatCard>
          <StatCard icon={GaugeIcon} iconBg="bg-sage-light" iconColor="text-emerald-600" label="Focus Score" value="82%" sub={<span className="text-xs font-semibold text-emerald-600">Excellent</span>}/>
          <StatCard icon={FlameIcon} label="Current Streak" value="14 days">
            <span className="text-lg">🔥</span>
          </StatCard>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Schedule */}
        <motion.div {...fade} className="lg:col-span-2">
          <Card padding="lg" className="h-full">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-charcoal">Today’s Smart Schedule</h3>
                <p className="text-sm text-charcoal-muted">Optimised around your focus and wellbeing</p>
              </div>
              <Button variant="soft" size="sm" onClick={() => navigate('/app/schedule')}>
                <SparklesIcon size={14}/> Optimise
              </Button>
            </div>
            <ScheduleTimeline />
          </Card>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          <AIInsightCard>
            Your focus is strongest between <b>{peakHours.label}</b>. We scheduled your most difficult task during this window.
          </AIInsightCard>

          {/* Wellbeing */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-sage-light text-emerald-600 flex items-center justify-center">
                <HeartPulseIcon size={16}/>
              </span>
              <h3 className="font-bold text-charcoal">Today’s Wellbeing</h3>
            </div>
            <div className="space-y-3">
              {[
            { label: 'Mood', value: 'Good', icon: '🙂', tone: 'text-emerald-600' },
            { label: 'Stress', value: 'Moderate', icon: null, tone: 'text-amber-600' },
            { label: 'Sleep', value: '7h 20m', icon: null, tone: 'text-charcoal' },
            { label: 'Energy', value: '78%', icon: null, tone: 'text-charcoal' }
        ].
            map((r) => <div key={r.label} className="flex items-center justify-between">
                  <span className="text-sm text-charcoal-muted font-medium flex items-center gap-2">
                    {r.label === 'Sleep' && <MoonIcon size={14}/>}
                    {r.label === 'Energy' && <ZapIcon size={14}/>}
                    {r.label}
                  </span>
                  <span className={cn('text-sm font-bold flex items-center gap-1.5', r.tone)}>
                    {r.icon} {r.value}
                  </span>
                </div>)}
            </div>
          </Card>

          {/* Level */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-charcoal-muted">Level {student.level}</p>
                <p className="font-extrabold text-charcoal">{student.levelName}</p>
              </div>
              <span className="w-11 h-11 rounded-2xl bg-brand-500 text-white font-extrabold flex items-center justify-center">
                {student.level}
              </span>
            </div>
            <ProgressBar value={xpPct}/>
            <p className="text-xs font-semibold text-charcoal-muted mt-2">
              {student.xp.toLocaleString()} / {student.xpToNext.toLocaleString()} XP
            </p>
          </Card>
        </div>
      </div>

      {/* Weekly progress */}
      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Weekly Progress</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-charcoal">Completed Tasks</h4>
              <span className="text-xs font-semibold text-brand-600">+18% vs last week</span>
            </div>
            <BarChart data={weeklyTasksData}/>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-charcoal">Focus Time (hrs)</h4>
              <span className="text-xs font-semibold text-charcoal-muted">Peak Friday</span>
            </div>
            <BarChart data={focusTimeData.map((d) => ({ label: d.day, value: d.value }))} unit="h"/>
          </Card>
        </div>
      </div>
    </div>);
}
