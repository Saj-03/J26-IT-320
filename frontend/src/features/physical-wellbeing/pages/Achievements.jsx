import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, TrophyIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { PhysicalNav } from '../components/PhysicalNav';
import { SectionTitle } from '../components/Shared';
import { achievements, weeklyChallenge } from '../data';
import { cn } from '../../../shared/lib/cn';
export function PhysicalAchievements() {
    const challengePct = Math.round(weeklyChallenge.current / weeklyChallenge.total * 100);
    const earned = achievements.filter((a) => a.earned).length;
    return (<div className="space-y-6">
      <PageHeader title="Achievements" subtitle={`${earned} of ${achievements.length} badges earned so far.`}/>

      <PhysicalNav />

      {/* Weekly challenge */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-brand-50" aria-hidden/>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <TrophyIcon size={17} className="text-brand-500"/>
            <p className="text-sm font-semibold text-brand-600">Weekly Challenge</p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-4xl">{weeklyChallenge.emoji}</span>
            <div>
              <h2 className="text-xl font-extrabold text-charcoal">{weeklyChallenge.title}</h2>
              <p className="text-sm text-charcoal-muted">{weeklyChallenge.goal}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-sm font-medium text-charcoal-muted mb-1.5">
              <span>
                <span className="text-charcoal font-extrabold">{weeklyChallenge.current}</span> / {weeklyChallenge.total} minutes
              </span>
              <span>{challengePct}%</span>
            </div>
            <ProgressBar value={challengePct} height={10}/>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-semibold text-charcoal-light bg-cream rounded-full px-4 py-2 w-fit">
              Reward: {weeklyChallenge.reward}
            </span>
            <Button className="sm:ml-auto">
              Continue Challenge <ArrowRightIcon size={16}/>
            </Button>
          </div>
        </div>
      </Card>

      {/* Badges */}
      <div>
        <SectionTitle title="Your badges" subtitle="Earned by showing up, not by being perfect."/>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {achievements.map((a, i) => <motion.div key={a.name} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <Card padding="sm" className={cn('h-full flex flex-col text-center', !a.earned && 'opacity-60')}>
                <div className={cn('w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl', a.earned ? 'bg-brand-50' : 'bg-cream grayscale')}>
                  {a.emoji}
                </div>
                <p className="font-bold text-charcoal text-sm mt-3">{a.name}</p>
                <p className="text-[11px] text-charcoal-muted mt-0.5 leading-tight">{a.desc}</p>
                <div className="mt-auto pt-3">
                  {a.earned ?
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 rounded-full px-2.5 py-1">
                      Earned
                    </span> :
                <>
                      <ProgressBar value={a.progress / a.total * 100} height={5}/>
                      <p className="text-[10px] font-semibold text-charcoal-muted mt-1.5">
                        {a.progress} / {a.total}
                      </p>
                    </>}
                </div>
              </Card>
            </motion.div>)}
        </div>
      </div>
    </div>);
}
