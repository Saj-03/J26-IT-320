import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MoonIcon, ZapIcon, BookOpenIcon, BriefcaseIcon, UsersIcon, ArrowRightIcon, SparklesIcon, NotebookPenIcon, MessageCircleHeartIcon, RefreshCwIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { LineChart } from '../../../shared/components/charts/Charts';
import { stressData } from '../../../shared/lib/data';
import { cn } from '../../../shared/lib/cn';
import { sendMood, computeSignal, getSummary } from '../api';
const moods = [
    { emoji: '😣', label: 'Struggling', score: 1 },
    { emoji: '😐', label: 'Okay', score: 3 },
    { emoji: '🙂', label: 'Good', score: 4 },
    { emoji: '🔥', label: 'Motivated', score: 5 }
];
const metrics = [
    { icon: null, label: 'Stress level', value: 48, color: 'bg-amber-soft', txt: 'Moderate' },
    { icon: ZapIcon, label: 'Energy', value: 78, color: 'bg-brand-500', txt: 'Good' },
    { icon: MoonIcon, label: 'Sleep', value: 82, color: 'bg-violet-400', txt: '7h 20m' },
    { icon: BookOpenIcon, label: 'Academic pressure', value: 64, color: 'bg-brand-400', txt: 'Elevated' },
    { icon: BriefcaseIcon, label: 'Work pressure', value: 40, color: 'bg-sky-400', txt: 'Low' },
    { icon: UsersIcon, label: 'Social connection', value: 70, color: 'bg-sage', txt: 'Good' }
];
export function Wellbeing() {
    const navigate = useNavigate();
    const [mood, setMood] = useState(null);
    const [signal, setSignal] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [history, setHistory] = useState([]);
    useEffect(() => {
        getSummary().then((s) => { setSignal(s.latest); setHistory(s.history); }).catch(() => { });
    }, []);
    const tapMood = (i) => sendMood(moods[i].score).then(() => setMood(i));
    const updateSignal = async () => {
        setUpdating(true);
        try {
            const s = await computeSignal();
            setSignal(s);
            setHistory((h) => [...h, s.risk_score].slice(-14));
        }
        finally {
            setUpdating(false);
        }
    };
    return (<div className="space-y-6">
      <PageHeader title="Your Wellbeing" subtitle="A calm, honest picture of how you’re really doing this week."/>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Mood + metrics */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <h3 className="font-bold text-charcoal mb-4">How are you feeling today?</h3>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {moods.map((m, i) => <button key={m.label} onClick={() => tapMood(i)} className={cn('flex flex-col items-center gap-2 rounded-3xl py-4 border-2 transition-all', mood === i ? 'border-brand-500 bg-brand-50' : 'border-black/[0.05] bg-white hover:border-brand-200')}>
                  <span className="text-3xl">{m.emoji}</span>
                  <span className="text-xs font-bold text-charcoal">{m.label}</span>
                </button>)}
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="font-bold text-charcoal mb-4">This week’s signals</h3>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {metrics.map((m) => <div key={m.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-charcoal-light flex items-center gap-1.5">
                      {m.icon && <m.icon size={14}/>}
                      {m.label}
                    </span>
                    <span className="text-xs font-bold text-charcoal">{m.txt}</span>
                  </div>
                  <ProgressBar value={m.value} color={m.color}/>
                </div>)}
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
            { icon: NotebookPenIcon, title: 'Write it out', desc: 'Journal with text, emoji or voice.', to: '/app/wellbeing/journal' },
            { icon: MessageCircleHeartIcon, title: 'Talk it through', desc: 'A companion that knows your deadlines.', to: '/app/wellbeing/chat' }
        ].map((l) => <button key={l.to} onClick={() => navigate(l.to)} className="text-left bg-white rounded-3xl border border-black/[0.04] shadow-soft p-5 flex items-center gap-4 hover:shadow-card transition-shadow">
                <span className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><l.icon size={20}/></span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-charcoal">{l.title}</span>
                  <span className="block text-sm text-charcoal-muted">{l.desc}</span>
                </span>
                <ArrowRightIcon size={16} className="text-charcoal-muted shrink-0"/>
              </button>)}
          </div>
        </div>

        {/* Summary + stress trend */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="bg-brand-50 border-brand-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center">
                  <SparklesIcon size={15}/>
                </span>
                <span className="font-bold text-brand-700">Wellbeing summary</span>
              </div>
              <p className="text-charcoal-light leading-relaxed text-sm">
                {signal ? <>Your pattern this week looks <strong className="text-charcoal">{signal.label}</strong> compared with your usual week.</> : <>Not enough information yet. A quick mood tap or a journal entry helps build your picture — everything here is optional.</>}
              </p>
              {signal?.reasons?.length > 0 && signal.reasons[0] !== 'not enough data yet' && <ul className="mt-3 space-y-1 text-xs text-charcoal-light list-disc pl-4">
                  {signal.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>}
              <p className="text-xs text-charcoal-muted mt-3 leading-relaxed">
                This is an awareness tool, not a diagnosis. If you feel unsafe, contact the university counselling service.
              </p>
              <Button variant="soft" size="sm" className="mt-4 mr-2 bg-white" onClick={updateSignal} disabled={updating}>
                <RefreshCwIcon size={14} className={updating ? 'animate-spin' : ''}/> {updating ? 'Updating…' : 'Update pattern'}
              </Button>
              <Button variant="soft" size="sm" className="mt-4 bg-white" onClick={() => navigate('/app/weekly-checkin')}>
                Do weekly check-in <ArrowRightIcon size={14}/>
              </Button>
            </Card>
          </motion.div>

          <Card>
            <h3 className="font-bold text-charcoal mb-1">Your pattern over time</h3>
            <p className="text-xs text-charcoal-muted mb-3">{history.length > 1 ? 'Recent updates (higher = a heavier pattern)' : 'Update your pattern a few times to see a trend'}</p>
            <LineChart data={history.length > 1 ? history.map((v, i) => ({ label: String(i + 1), value: Math.round(v * 100) })) : stressData.map((d) => ({ label: d.day, value: d.value }))} color="#F2B857"/>
          </Card>
        </div>
      </div>

      {/* Stress-aware scheduling */}
      {signal && signal.risk_level !== 'LOW' && <StressAwareScheduling signal={signal}/>}
    </div>);
}
function StressAwareScheduling({ signal }) {
    return (<Card padding="lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-charcoal">Schedule Adaptation</h3>
          <p className="text-sm text-charcoal-muted">How IHSD lightened your day — automatically.</p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs font-bold bg-amber-light text-amber-700 rounded-full px-3 py-1.5">Pattern: {signal.label}</span>
          <span className="text-xs font-bold bg-brand-50 text-brand-700 rounded-full px-3 py-1.5">{Math.round(signal.risk_score * 100)}% · {signal.trend.toLowerCase()}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-black/[0.05] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-3">Before</p>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-charcoal">09:00 Chemistry</span></li>
            <li className="flex justify-between"><span className="text-charcoal">14:00 Math</span></li>
            <li className="flex justify-between"><span className="text-charcoal">16:00 Sociology</span></li>
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-sage/40 bg-sage-light/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">After</p>
          <ul className="space-y-2 text-sm">
            <li className="text-charcoal">09:00 Chemistry <span className="text-xs text-charcoal-muted">(kept)</span></li>
            <li className="text-emerald-700 font-semibold">13:00 Recovery block <span className="text-xs">(+45m)</span></li>
            <li className="text-charcoal">14:00 Math <span className="text-xs text-charcoal-muted">(shortened)</span></li>
            <li className="text-charcoal-muted">Sociology → moved to Thursday</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 bg-cream rounded-2xl p-4 text-sm text-charcoal-light">
        Your schedule has been lightened a little today. You’ve still got space for what matters most.
      </div>
    </Card>);
}
