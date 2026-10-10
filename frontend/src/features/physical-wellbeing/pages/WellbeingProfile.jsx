import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PencilIcon, RotateCwIcon, ChevronRightIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { PhysicalNav } from '../components/PhysicalNav';
import { SectionTitle, MedicalDisclaimer } from '../components/Shared';
import { getProfile } from '../api';
import useStudent from '../../../shared/hooks/useStudent';

const GOAL_LABELS = { fitness: 'Improve Physical Fitness', weight_loss: 'Lose Weight' };
const LEVEL_LABELS = { low: 'Beginner', medium: 'Moderate', high: 'Active' };
const DIET_LABELS = { any: 'No Preference', veg: 'Vegetarian', 'non-veg': 'Non-Vegetarian', sri_lankan: 'Sri Lankan', vegetarian: 'Vegetarian', international: 'International' };

function buildRows(p) {
  if (!p) return [];
  const lims = (p.physical_limitations || 'none').split(',').filter(x => x && x !== 'none');
  return [
    { emoji: '🎯', label: 'Goal', value: GOAL_LABELS[p.goal] || p.goal },
    { emoji: '📊', label: 'Fitness level', value: LEVEL_LABELS[p.activity_level] || p.activity_level },
    { emoji: '⏱️', label: 'Available workout time', value: `${p.available_minutes} min` },
    { emoji: '😴', label: 'Sleep target', value: `${p.sleep_hours} hours / night` },
    { emoji: '🦵', label: 'Physical limitations', value: lims.length ? lims.join(', ') : 'None' },
    { emoji: '🥗', label: 'Dietary preference', value: DIET_LABELS[p.diet_pref] || p.diet_pref },
    { emoji: '💪', label: 'BMI', value: p.bmi ? p.bmi.toFixed(1) : '—' },
    { emoji: '📚', label: 'Workload score', value: p.workload_intensity_score ? `${Math.round(p.workload_intensity_score)} / 100` : '—' },
  ];
}
export function PhysicalProfile() {
  const student = useStudent();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerated, setRegenerated] = useState(false);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, []);

  const rows = buildRows(profile);

  const regenerate = () => {
    setRegenerating(true);
    setTimeout(() => {
      setRegenerating(false);
      setRegenerated(true);
    }, 1600);
  };
  return (<div className="space-y-6">
    <PageHeader title="My Wellbeing Profile" subtitle="Everything the AI uses to build your plan — fully editable." action={<Button variant="outline" onClick={() => navigate('/physical-setup/assessment')}>
      <PencilIcon size={15} /> Edit Preferences
    </Button>} />

    <PhysicalNav />

    {/* Identity */}
    <Card padding="lg" className="flex flex-col sm:flex-row items-center gap-5">
      <Avatar src={student.avatar} name={student.fullName} size={80} ring />
      <div className="flex-1 text-center sm:text-left">
        <h2 className="text-xl font-extrabold text-charcoal">{student.fullName}</h2>
        {profile && (
          <p className="text-sm text-charcoal-muted">BMI {profile.bmi?.toFixed(1)} · {profile.available_minutes} min workouts</p>
        )}
      </div>
      {profile && (
        <div className="flex gap-3">
          <div className="bg-cream rounded-2xl px-4 py-3 text-center">
            <p className="font-extrabold text-charcoal">{Math.round(profile.workload_intensity_score) || '—'}</p>
            <p className="text-[11px] font-medium text-charcoal-muted mt-0.5">Workload</p>
          </div>
          <div className="bg-cream rounded-2xl px-4 py-3 text-center">
            <p className="font-extrabold text-charcoal">{LEVEL_LABELS[profile.activity_level] || profile.activity_level}</p>
            <p className="text-[11px] font-medium text-charcoal-muted mt-0.5">Level</p>
          </div>
        </div>
      )}
    </Card>

    <div className="grid lg:grid-cols-3 gap-6">
      {/* Preference rows */}
      <Card padding="lg" className="lg:col-span-2">
        <SectionTitle title="Your preferences" />
        {profileLoading ? (
          <p className="text-sm text-charcoal-muted py-4">Loading your saved preferences…</p>
        ) : !profile ? (
          <div className="py-4">
            <p className="text-sm text-charcoal-muted mb-3">No profile found. Complete the assessment to set your preferences.</p>
            <Button size="sm" onClick={() => navigate('/physical-setup/assessment')}>Start Assessment</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-black/[0.05]">
            {rows.map((r) => <div key={r.label} className="flex items-start gap-3 py-3.5">
              <span className="text-lg shrink-0">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-charcoal-muted">{r.label}</p>
                <p className="text-sm font-bold text-charcoal mt-0.5 leading-snug">{r.value}</p>
              </div>
            </div>)}
          </div>
        )}
      </Card>

      {/* Regenerate + links */}
      <div className="space-y-6">
        <Card padding="lg">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
              <RotateCwIcon size={18} />
            </span>
            <div className="flex-1">
              <h3 className="font-bold text-charcoal">Changed something?</h3>
              <p className="text-sm text-charcoal-muted mt-0.5 leading-relaxed">
                Regenerate your plan so exercise, nutrition and habits match your updated profile.
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {regenerated ?
              <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-sage-light p-3.5 flex items-center gap-2.5">
                <span className="text-lg">✅</span>
                <p className="text-sm font-semibold text-emerald-700">Plan regenerated from your latest preferences.</p>
              </motion.div> :
              <Button key="btn" fullWidth className="mt-4" disabled={regenerating} onClick={regenerate}>
                {regenerating ?
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Regenerating…
                  </> :
                  <>
                    <RotateCwIcon size={16} /> Regenerate My Plan
                  </>}
              </Button>}
          </AnimatePresence>
        </Card>

        <div className="space-y-2">
          {[
            { emoji: '🔔', label: 'Notifications', desc: 'Gentle nudges only', to: '/app/physical/notifications' },
            { emoji: '🔒', label: 'Privacy & Data Controls', desc: 'View, download or delete', to: '/app/physical/privacy' }
          ].
            map((l) => <button key={l.label} onClick={() => navigate(l.to)} className="w-full flex items-center gap-3 rounded-3xl bg-white border border-black/[0.04] shadow-soft p-4 text-left hover:shadow-card transition-shadow">
              <span className="w-10 h-10 rounded-2xl bg-cream flex items-center justify-center text-lg shrink-0">{l.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-charcoal text-sm">{l.label}</p>
                <p className="text-xs text-charcoal-muted">{l.desc}</p>
              </div>
              <ChevronRightIcon size={17} className="text-charcoal-muted shrink-0" />
            </button>)}
        </div>
      </div>
    </div>

    <MedicalDisclaimer />
  </div>);
}
