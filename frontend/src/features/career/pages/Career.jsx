import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, SparklesIcon, ArrowRightIcon, MapIcon, MicIcon, ClipboardListIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { ProgressRing } from '../../../shared/components/ui/ProgressRing';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { RadarChart } from '../../../shared/components/charts/Charts';
import { aptitudes } from '../../../shared/lib/data';
import { Button } from '../../../shared/components/ui/Button';
import { LoadingState, EmptyState } from '../../../shared/components/ui/States';
import useFetch from '../../../shared/hooks/useFetch';
import { cn } from '../../../shared/lib/cn';
export function Career() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('careers');
    const { data, error, loading } = useFetch('/career/recommendations');
    const careers = (data || []).map((c) => ({
        title: c.career,
        match: Math.round(c.score * 100),
        why: `Because you know ${c.matched_skills.join(', ') || 'related topics'}.`,
        strengths: c.matched_skills
    }));
    const slug = (t) => encodeURIComponent(t);
    return (<div className="space-y-6">
      <PageHeader title="Your Career Path" subtitle="Based on your academic performance, interests, activities, and strengths." action={<Button variant="outline" onClick={() => navigate('/app/career/questionnaire')}>
            <ClipboardListIcon size={16}/> Update my profile
          </Button>}/>

      <div className="flex bg-white rounded-full p-1 border border-black/[0.05] shadow-soft w-fit">
        {['careers', 'aptitude'].map((t) => <button key={t} onClick={() => setTab(t)} className={cn('px-5 py-2 rounded-full text-sm font-semibold transition-colors capitalize', tab === t ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
            {t === 'careers' ? 'Recommendations' : 'Aptitude Profile'}
          </button>)}
      </div>

      {tab === 'careers' ?
            <>
          {loading && !data ? <LoadingState label="Finding your matches…"/> :
                (error || careers.length === 0) ? <Card><EmptyState icon={ClipboardListIcon} title="Tell us about you first" desc="Answer a few questions about your GPA, skills and interests to see your top career matches." actionLabel="Start questionnaire" onAction={() => navigate('/app/career/questionnaire')}/></Card> :
          <div className="grid md:grid-cols-2 gap-5">
            {careers.map((c, i) => <motion.div key={c.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card padding="lg" hover className="h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-charcoal">{c.title}</h3>
                      <p className="text-sm text-charcoal-muted mt-1 leading-relaxed">{c.why}</p>
                    </div>
                    <ProgressRing value={c.match} size={72} stroke={7}>
                      <span className="text-sm font-extrabold text-charcoal">{c.match}%</span>
                    </ProgressRing>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-1.5">Current strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.strengths.map((s) => <span key={s} className="inline-flex items-center gap-1 text-xs font-semibold bg-sage-light text-emerald-700 rounded-full px-2.5 py-1">
                            <CheckIcon size={12}/> {s}
                          </span>)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" variant="soft" onClick={() => navigate(`/app/career/roadmap/${slug(c.title)}`)}>
                      <MapIcon size={14}/> Roadmap
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/app/career/interview/${slug(c.title)}`)}>
                      <MicIcon size={14}/> Practice interview
                    </Button>
                  </div>
                </Card>
              </motion.div>)}
          </div>}

          <Card padding="lg">
            <h3 className="font-bold text-charcoal mb-4">Your Career Profile</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                    { l: 'Academic strengths', v: 'Programming, Mathematics' },
                    { l: 'Extracurricular interests', v: 'Coding club, Hackathons' },
                    { l: 'Skills', v: 'Python, Problem solving' },
                    { l: 'Growth areas', v: 'Communication, Leadership' }
                ].
                    map((x) => <div key={x.l} className="bg-cream rounded-2xl p-4">
                  <p className="text-xs font-semibold text-charcoal-muted">{x.l}</p>
                  <p className="text-sm font-bold text-charcoal mt-1 leading-snug">{x.v}</p>
                </div>)}
            </div>
          </Card>
        </> :
            <div className="grid lg:grid-cols-3 gap-6">
          <Card padding="lg" className="lg:col-span-1">
            <h3 className="font-bold text-charcoal mb-2">Aptitude overview</h3>
            <RadarChart data={aptitudes}/>
            <div className="flex justify-center gap-4 mt-2 text-xs font-semibold text-charcoal-muted">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-500"/> This semester</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300"/> Previous</span>
            </div>
          </Card>

          <Card padding="lg" className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <SparklesIcon size={16} className="text-brand-500"/>
              <h3 className="font-bold text-charcoal">Your strengths evolve over time</h3>
            </div>
            <p className="text-xs text-charcoal-muted mb-5">Growth from last semester in orange</p>
            <div className="space-y-4">
              {aptitudes.map((a) => <div key={a.name}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-semibold text-charcoal-light">{a.name}</span>
                    <span className="text-sm font-bold text-charcoal">
                      {a.value}
                      <span className="text-emerald-600 text-xs ml-1">+{a.value - a.prev}</span>
                    </span>
                  </div>
                  <ProgressBar value={a.value}/>
                </div>)}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2 bg-cream rounded-2xl p-4">
              {['Semester 1', 'Semester 2', 'Semester 3'].map((s, i) => <React.Fragment key={s}>
                  <div className="text-center">
                    <p className="text-xs font-bold text-charcoal">{s}</p>
                    <p className={cn('text-lg font-extrabold', i === 2 ? 'text-brand-600' : 'text-charcoal-muted')}>
                      {[68, 74, 82][i]}
                    </p>
                  </div>
                  {i < 2 && <ArrowRightIcon size={16} className="text-charcoal-muted"/>}
                </React.Fragment>)}
            </div>
          </Card>
        </div>}
    </div>);
}
