import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, TrophyIcon, ShieldCheckIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { PhysicalMasterCard } from '../components/PhysicalMasterCard';
import { SectionTitle } from '../components/Shared';
import { getProfile, getActivitySummary, getHabits } from '../api';
import { cn } from '../../../shared/lib/cn';

export function PhysicalAchievements() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activitySummary, setActivitySummary] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProfile().catch(() => null),
      getActivitySummary().catch(() => null),
      getHabits().catch(() => [])
    ]).then(([prof, act, habs]) => {
      setProfile(prof);
      setActivitySummary(act);
      setHabits(Array.isArray(habs) ? habs : []);
      setLoading(false);
    });
  }, []);

  const weeklySteps = activitySummary?.weekly_totals?.steps || 0;
  const weeklyMins = activitySummary?.weekly_totals?.exercise_minutes || 0;
  const maxStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak || 0), 0) : 0;
  const weeklyTarget = 150;
  const challengePct = Math.min(100, Math.round((weeklyMins / weeklyTarget) * 100));

  const badges = [
    {
      id: 'profile',
      name: 'Undergraduate Setup',
      emoji: '🎓',
      desc: 'Completed the intake assessment for personalized recommendations.',
      earned: Boolean(profile?.diet_pref || profile?.goal),
      progress: profile ? 1 : 0,
      total: 1
    },
    {
      id: 'first_steps',
      name: 'First Steps Logged',
      emoji: '👟',
      desc: 'Logged your initial walking activity into the system.',
      earned: weeklySteps > 0,
      progress: weeklySteps > 0 ? 1 : 0,
      total: 1
    },
    {
      id: 'step_10k',
      name: '10,000 Step Milestone',
      emoji: '🚶‍♂️',
      desc: 'Reached 10,000 total walking steps this week.',
      earned: weeklySteps >= 10000,
      progress: Math.min(10000, weeklySteps),
      total: 10000
    },
    {
      id: 'active_60',
      name: '60 Active Minutes',
      emoji: '⏱️',
      desc: 'Completed 60 total minutes of scheduled workouts.',
      earned: weeklyMins >= 60,
      progress: Math.min(60, weeklyMins),
      total: 60
    },
    {
      id: 'habit_pioneer',
      name: 'Habit Pioneer',
      emoji: '⭐',
      desc: 'Added your first daily student habit.',
      earned: habits.length >= 1,
      progress: Math.min(1, habits.length),
      total: 1
    },
    {
      id: 'streak_3',
      name: '3-Day Consistency Streak',
      emoji: '🔥',
      desc: 'Hit a 3-day completion streak on any habit.',
      earned: maxStreak >= 3,
      progress: Math.min(3, maxStreak),
      total: 3
    },
    {
      id: 'safety',
      name: 'Clinical Safety Protocol',
      emoji: '🛡️',
      desc: 'Configured physical limitations with the adaptive engine.',
      earned: Boolean(profile?.physical_limitations && profile.physical_limitations !== 'none'),
      progress: (profile?.physical_limitations && profile.physical_limitations !== 'none') ? 1 : 0,
      total: 1
    },
    {
      id: 'who_150',
      name: 'WHO 150-Min Target',
      emoji: '🏆',
      desc: 'Achieved the WHO recommended 150 active minutes in a week.',
      earned: weeklyMins >= 150,
      progress: Math.min(150, weeklyMins),
      total: 150
    }
  ];

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="space-y-6">
      <PhysicalMasterCard
        title="Student Achievements"
        subtitle={`${earnedCount} of ${badges.length} badges earned so far from real verified activity.`}
        eyebrow="Milestones & motivation"
      />

      <PhysicalNav />

      {/* Real Weekly Challenge */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-brand-50" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <TrophyIcon size={17} className="text-brand-500" />
            <p className="text-sm font-semibold text-brand-600">Weekly Target Challenge</p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-4xl">🏃‍♂️</span>
            <div>
              <h2 className="text-xl font-extrabold text-charcoal">150-Minute Movement Target</h2>
              <p className="text-sm text-charcoal-muted">
                World Health Organization standard for maintaining cognitive sharpness and cardiovascular health during university.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-sm font-medium text-charcoal-muted mb-1.5">
              <span>
                <span className="text-charcoal font-extrabold">{weeklyMins}</span> / {weeklyTarget} minutes logged
              </span>
              <span>{challengePct}%</span>
            </div>
            <ProgressBar value={challengePct} height={10} />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-semibold text-charcoal-light bg-cream rounded-full px-4 py-2 w-fit">
              Reward: Neurocognitive focus badge + 100 XP
            </span>
            <Button className="sm:ml-auto" onClick={() => navigate('/app/physical/activity')}>
              Log Activity <ArrowRightIcon size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Dynamic Badges */}
      <div>
        <SectionTitle
          title="Your Milestones & Badges"
          subtitle="Earned solely through verified logged actions — zero simulated accomplishments."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {badges.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card
                padding="sm"
                className={cn('h-full flex flex-col text-center transition-all', !a.earned && 'opacity-65')}
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl',
                    a.earned ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-cream grayscale'
                  )}
                >
                  {a.emoji}
                </div>
                <p className="font-bold text-charcoal text-sm mt-3">{a.name}</p>
                <p className="text-[11px] text-charcoal-muted mt-1 leading-tight">{a.desc}</p>
                <div className="mt-auto pt-4">
                  {a.earned ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-brand-700 bg-brand-50 rounded-full px-3 py-1 border border-brand-200">
                      Earned ✓
                    </span>
                  ) : (
                    <>
                      <ProgressBar value={Math.round((a.progress / a.total) * 100)} height={5} />
                      <p className="text-[10px] font-semibold text-charcoal-muted mt-1.5">
                        {a.progress.toLocaleString()} / {a.total.toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
