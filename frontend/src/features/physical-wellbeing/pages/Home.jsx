import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon, TrophyIcon, ChevronRightIcon, RotateCwIcon, ActivityIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { AIRecoCard } from '../components/AIRecoCard';
import { AdaptiveLoop } from '../components/AdaptiveLoop';
import { SectionTitle, AdaptedChip } from '../components/Shared';
import ProfileRecommendations from '../components/ProfileRecommendations';
import { todayRings, todayRecommendation, weeklyChallenge, wellbeingProfile } from '../data';
export function PhysicalHome() {
    const navigate = useNavigate();
    const challengePct = Math.round(weeklyChallenge.current / weeklyChallenge.total * 100);
    return (<div className="space-y-6">
      <PageHeader title="Physical Wellbeing" subtitle="Your adaptive exercise, nutrition and habit plan — built around your university lifestyle." action={<Button variant="outline" onClick={() => navigate('/physical-setup')}>
            <ActivityIcon size={16}/> Redo assessment
          </Button>}/>

      <PhysicalNav />

      {/* Hero: wellbeing score */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-brand-50" aria-hidden/>
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing value={wellbeingProfile.score} size={132} stroke={13}>
            <span className="text-3xl font-extrabold text-charcoal">{wellbeingProfile.score}</span>
            <span className="text-xs font-semibold text-charcoal-muted">/ 100</span>
          </ProgressRing>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-semibold text-brand-600">Good morning, {wellbeingProfile.name} 👋</p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-charcoal mt-1 leading-snug max-w-lg">
              Here’s your wellbeing plan for today.
            </h2>
            <p className="text-sm text-charcoal-muted mt-1.5 leading-relaxed max-w-lg">
              Your habits and nutrition are strong. A little more movement would lift your score further.
            </p>
            <div className="mt-3 flex justify-center sm:justify-start">
              <AdaptedChip>Recalculated today</AdaptedChip>
            </div>
          </div>
        </div>
      </Card>

      {/* Today's overview */}
      <div>
        <h3 className="text-lg font-bold text-charcoal mb-3">Today’s Overview</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {todayRings.map((r) => {
            const pct = Math.min(100, r.current / r.total * 100);
            return (<Card key={r.id} padding="sm" hover className="flex items-center gap-3">
                <ProgressRing value={pct} size={54} stroke={6} color={r.color}>
                  <span className="text-sm">{r.emoji}</span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-charcoal-muted">{r.label}</p>
                  <p className="text-lg font-extrabold text-charcoal leading-tight tracking-tight">
                    {r.current.toLocaleString()}
                    <span className="text-charcoal-muted text-sm font-semibold"> / {r.total.toLocaleString()}</span>
                  </p>
                  <p className="text-[10px] text-charcoal-muted">{r.unit}</p>
                </div>
              </Card>);
        })}
        </div>
      </div>

      {/* Recommendations from the student's saved profile */}
      <ProfileRecommendations />

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIRecoCard title={todayRecommendation.title} detail={todayRecommendation.detail} why={todayRecommendation.why} benefit={todayRecommendation.benefit} tag={todayRecommendation.tag} primaryLabel="Start Activity" onPrimary={() => navigate('/app/physical/workout')} onChange={() => navigate('/app/physical/exercise')}/>
        </div>

        <div className="space-y-6">
          {/* Quick links */}
          <Card>
            <SectionTitle title="Jump back in"/>
            <div className="space-y-2">
              {[
            { emoji: '🏃', label: 'Today’s exercise', desc: '20-min beginner cardio', to: '/app/physical/exercise' },
            { emoji: '🥗', label: 'Your nutrition plan', desc: 'Lunch recommended', to: '/app/physical/nutrition' },
            { emoji: '✨', label: 'Healthy habits', desc: `${wellbeingProfile.streak} day streak`, to: '/app/physical/habits' }
        ].
            map((q) => <button key={q.label} onClick={() => navigate(q.to)} className="w-full flex items-center gap-3 rounded-2xl bg-cream p-3.5 text-left hover:bg-black/[0.04] transition-colors">
                  <span className="text-xl">{q.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-charcoal">{q.label}</p>
                    <p className="text-xs text-charcoal-muted">{q.desc}</p>
                  </div>
                  <ChevronRightIcon size={16} className="text-charcoal-muted"/>
                </button>)}
            </div>
          </Card>

          {/* Weekly challenge */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-charcoal">Weekly Challenge</h3>
              <TrophyIcon size={17} className="text-brand-500"/>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{weeklyChallenge.emoji}</span>
              <div>
                <p className="font-extrabold text-charcoal text-sm">{weeklyChallenge.title}</p>
                <p className="text-xs text-charcoal-muted">{weeklyChallenge.goal}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
                <span>
                  {weeklyChallenge.current} / {weeklyChallenge.total} min
                </span>
                <span>{challengePct}%</span>
              </div>
              <ProgressBar value={challengePct}/>
            </div>
            <Button variant="soft" size="sm" className="mt-4" fullWidth onClick={() => navigate('/app/physical/achievements')}>
              Continue Challenge <ArrowRightIcon size={14}/>
            </Button>
          </Card>
        </div>
      </div>

      {/* Plan adaptation nudge */}
      <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate('/app/physical/adaptation')} className="w-full text-left rounded-3xl bg-brand-50 border border-brand-100 p-5 flex items-center gap-4 hover:bg-brand-100/60 transition-colors">
        <span className="w-11 h-11 rounded-2xl bg-brand-500 text-white flex items-center justify-center shrink-0">
          <RotateCwIcon size={20}/>
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-charcoal">Your Plan Has Been Updated</p>
          <p className="text-sm text-charcoal-light mt-0.5">
            We noticed your exercise completion decreased this week. Tap to review the change.
          </p>
        </div>
        <ChevronRightIcon size={18} className="text-brand-600 shrink-0"/>
      </motion.button>

      <AdaptiveLoop activeKey="reco"/>
    </div>);
}
