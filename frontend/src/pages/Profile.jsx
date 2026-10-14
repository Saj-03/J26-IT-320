import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FlameIcon, TrophyIcon, GraduationCapIcon, BrainIcon, HeartIcon, BriefcaseIcon, ShieldCheckIcon, SettingsIcon } from 'lucide-react';
import { PageHeader } from '../shared/components/layout/PageHeader';
import { Card } from '../shared/components/ui/Card';
import { Button } from '../shared/components/ui/Button';
import { Avatar } from '../shared/components/ui/Avatar';
import { ProgressBar } from '../shared/components/ui/ProgressBar';
import useStudent from '../shared/hooks/useStudent';
const sections = [
    { icon: GraduationCapIcon, title: 'Academic Profile', items: ['BSc Computer Science', '2nd Year', 'Chemistry, Mathematics, Software Eng.'] },
    { icon: BrainIcon, title: 'Productivity Profile', items: ['Morning person', 'Peak focus 9–12', 'Prefers 90-min deep-work blocks'] },
    { icon: HeartIcon, title: 'Wellbeing Preferences', items: ['Recovery blocks enabled', 'Stress-aware scheduling on', 'Sunday weekly check-in'] },
    { icon: BriefcaseIcon, title: 'Career Interests', items: ['Software Engineer', 'Data Scientist', 'Building & problem solving'] }
];
export function Profile() {
    const student = useStudent();
    const navigate = useNavigate();
    const xpPct = Math.round(student.xp / student.xpToNext * 100);
    return (<div className="space-y-6">
      <PageHeader title="Profile" action={<Button variant="outline" onClick={() => navigate('/app/settings')}>
            <SettingsIcon size={16}/> Settings
          </Button>}/>

      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar src={student.avatar} name={student.fullName} size={88} ring/>
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold text-charcoal">{student.fullName}</h2>
            <p className="text-charcoal-muted">{student.university} · {student.degree}</p>
            <p className="text-sm text-charcoal-muted">{student.year}</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-cream rounded-2xl px-4 py-3 text-center">
              <div className="flex items-center gap-1 justify-center text-brand-600">
                <TrophyIcon size={15}/>
                <span className="font-extrabold text-charcoal">{student.level}</span>
              </div>
              <p className="text-[11px] font-semibold text-charcoal-muted mt-0.5">Level</p>
            </div>
            <div className="bg-cream rounded-2xl px-4 py-3 text-center">
              <span className="font-extrabold text-charcoal">{(student.xp / 1000).toFixed(1)}k</span>
              <p className="text-[11px] font-semibold text-charcoal-muted mt-0.5">XP</p>
            </div>
            <div className="bg-cream rounded-2xl px-4 py-3 text-center">
              <div className="flex items-center gap-1 justify-center">
                <FlameIcon size={15} className="text-brand-500"/>
                <span className="font-extrabold text-charcoal">{student.streak}</span>
              </div>
              <p className="text-[11px] font-semibold text-charcoal-muted mt-0.5">Streak</p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs font-semibold text-charcoal-muted mb-1.5">
            <span>Level {student.level} {student.levelName}</span>
            <span>{student.xp.toLocaleString()} / {student.xpToNext.toLocaleString()} XP</span>
          </div>
          <ProgressBar value={xpPct}/>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-5">
        {sections.map((s) => <Card key={s.title} padding="lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-9 h-9 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center">
                <s.icon size={17}/>
              </span>
              <h3 className="font-bold text-charcoal">{s.title}</h3>
            </div>
            <ul className="space-y-2">
              {s.items.map((it) => <li key={it} className="text-sm text-charcoal-light flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-300"/>
                  {it}
                </li>)}
            </ul>
          </Card>)}
      </div>

      <Card padding="lg" className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-sage-light text-emerald-600 flex items-center justify-center">
            <ShieldCheckIcon size={19}/>
          </span>
          <div>
            <h3 className="font-bold text-charcoal">Privacy Controls</h3>
            <p className="text-sm text-charcoal-muted">Manage what data ThriveU collects and keeps.</p>
          </div>
        </div>
        <Button variant="soft" onClick={() => navigate('/app/privacy')}>
          Manage
        </Button>
      </Card>
    </div>);
}
