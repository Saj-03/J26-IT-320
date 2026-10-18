import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon, SparklesIcon, NotebookPenIcon, MessageCircleHeartIcon, LightbulbIcon, CalendarCheckIcon, ShieldCheckIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import { LineChart } from '../../../shared/components/charts/Charts';
import { getSummary, runDemo, logTipEvent } from '../api';

// Real signals only: every bar below comes from the student's own data. A missing signal says "No data yet".
const SIGNALS = [
    { key: 'deviation', label: 'This week vs your usual' },
    { key: 'journal', label: 'Journal tone' },
    { key: 'chat', label: 'Chat tone' },
    { key: 'mood', label: 'Mood check-ins' }
];
const wording = (v) => (v < 0.3 ? 'Steady' : v < 0.6 ? 'Some strain' : 'Heavier');
const barColor = (v) => (v < 0.3 ? 'bg-sage' : v < 0.6 ? 'bg-amber-soft' : 'bg-brand-500');
const factorText = (f) => `${f.feature[0].toUpperCase()}${f.feature.slice(1)} is ${f.direction === 'up' ? 'higher' : 'lower'} than usual`;

export function Wellbeing() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [demoBusy, setDemoBusy] = useState(false);
    const [demoMsg, setDemoMsg] = useState('');
    const [tipAnswer, setTipAnswer] = useState(null);       // null | 'tried' | 'dismissed'
    const shownTip = useRef(null);
    const load = useCallback(() => getSummary().then(setData).catch(() => setData(null)).finally(() => setLoading(false)), []);
    useEffect(() => { load(); }, [load]);
    // Log that a tip was shown (once per tip category; the server also keeps it to once a day)
    useEffect(() => {
        const cat = data?.tip?.category;
        if (cat && shownTip.current !== cat) { shownTip.current = cat; setTipAnswer(null); logTipEvent(cat, 'shown'); }
    }, [data]);
    const answerTip = (action) => { setTipAnswer(action); logTipEvent(data.tip.category, action); };

    const demo = async (scenario) => {
        setDemoBusy(true);
        setDemoMsg('');
        try { await runDemo(scenario); await load(); }
        catch { setDemoMsg('Demo mode is not available.'); }
        finally { setDemoBusy(false); }
    };

    const signal = data?.latest;
    const signals = data?.signals || {};
    const history = data?.history || [];
    const noData = !loading && (!signal || Object.keys(signals).length === 0);

    return (<div className="space-y-6">
      <PageHeader title="Your Wellbeing" subtitle="A calm, honest picture of how you’re doing. Everything here is optional."/>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <h3 className="font-bold text-charcoal mb-4">What this picture is based on</h3>
            {noData ? <p className="text-sm text-charcoal-light">Nothing here yet. A mood tap or a short journal entry starts your picture.</p> :
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {SIGNALS.map((s) => { const v = signals[s.key]; return <div key={s.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-charcoal-light">{s.label}</span>
                      <span className="text-xs font-bold text-charcoal">{v === undefined ? 'No data yet' : wording(v)}</span>
                    </div>
                    <ProgressBar value={v === undefined ? 0 : Math.max(4, Math.round(v * 100))} color={v === undefined ? 'bg-black/10' : barColor(v)}/>
                  </div>; })}
              </div>}
            {data?.factors?.length > 0 && <ul className="mt-5 space-y-1 text-sm text-charcoal-light list-disc pl-5">
                {data.factors.slice(0, 3).map((f) => <li key={f.feature}>{factorText(f)}</li>)}
              </ul>}
          </Card>

          {data?.tip && <Card padding="lg" className="bg-amber-light/40 border-black/[0.04]">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-amber-soft text-white flex items-center justify-center shrink-0"><LightbulbIcon size={17}/></span>
                <div>
                  <p className="font-bold text-charcoal">A small idea for today</p>
                  <p className="mt-1 text-charcoal-light">{data.tip.text}</p>
                  <p className="mt-2 text-xs text-charcoal-muted">{data.tip.reason}</p>
                  {tipAnswer === null ? <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => answerTip('tried')}>I'll try this</Button>
                      <Button variant="soft" size="sm" onClick={() => answerTip('dismissed')}>Not now</Button>
                    </div> : <p className="mt-3 text-xs font-semibold text-emerald-700">{tipAnswer === 'tried' ? 'Great, thank you.' : 'No problem.'}</p>}
                </div>
              </div>
            </Card>}

          {signal && signal.risk_level !== 'LOW' && <Card padding="lg">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-sage-light text-emerald-700 flex items-center justify-center shrink-0"><CalendarCheckIcon size={17}/></span>
                <div>
                  <p className="font-bold text-charcoal">Shared with your scheduler</p>
                  <p className="mt-1 text-sm text-charcoal-light">Your latest pattern is shared with your scheduler, which can ease lower-priority tasks. Urgent deadlines are never moved.</p>
                </div>
              </div>
            </Card>}

          <div className="grid sm:grid-cols-2 gap-4">
            {[
            { icon: NotebookPenIcon, title: 'Check in', desc: 'Tap your mood or write it out.', to: '/app/journal' },
            { icon: MessageCircleHeartIcon, title: 'Talk it through', desc: 'Optional chat that knows your week.', to: '/app/wellbeing/chat' },
            { icon: ShieldCheckIcon, title: 'Privacy and your data', desc: 'See what is stored, opt out, or delete it.', to: '/app/wellbeing/privacy' }
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

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="bg-brand-50 border-brand-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center"><SparklesIcon size={15}/></span>
                <span className="font-bold text-brand-700">Wellbeing summary</span>
              </div>
              <p className="text-charcoal-light leading-relaxed text-sm">
                {signal ? <>Your pattern right now looks <strong className="text-charcoal">{signal.label}</strong>{signal.trend === 'RISING' ? ' and is getting heavier' : signal.trend === 'FALLING' ? ' and is easing' : ''}.</> : <>Not enough information yet.</>}
              </p>
              {signal?.reasons?.length > 0 && signal.reasons[0] !== 'not enough data yet' && <ul className="mt-3 space-y-1 text-xs text-charcoal-light list-disc pl-4">
                  {signal.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>}
              <p className="text-xs text-charcoal-muted mt-3 leading-relaxed">
                This is an awareness tool, not a diagnosis. If you feel unsafe, contact the university counselling service.
              </p>
              <Button variant="soft" size="sm" className="mt-4 bg-white" onClick={() => navigate('/app/weekly-checkin')}>
                Do weekly check-in <ArrowRightIcon size={14}/>
              </Button>
            </Card>
          </motion.div>

          <Card>
            <h3 className="font-bold text-charcoal mb-1">Your pattern over time</h3>
            <p className="text-xs text-charcoal-muted mb-3">{history.length > 1 ? 'Each point is an update (higher = a heavier pattern)' : 'Check in a few times to see a trend'}</p>
            {history.length > 1 && <LineChart data={history.map((v, i) => ({ label: String(i + 1), value: Math.round(v * 100) }))} color="#7F95CC"/>}
          </Card>

          <details className="rounded-2xl border border-dashed border-black/10 p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-charcoal-muted">Demo tools</summary>
            <p className="mt-2 text-xs text-charcoal-muted">Scripts a sample week for this account (replaces your last 7 days of entries).</p>
            <div className="mt-3 flex gap-2">
              <Button variant="soft" size="sm" disabled={demoBusy} onClick={() => demo('bad')}>Bad week</Button>
              <Button variant="soft" size="sm" disabled={demoBusy} onClick={() => demo('normal')}>Normal week</Button>
            </div>
            {demoMsg && <p role="alert" className="mt-2 text-xs text-red-600">{demoMsg}</p>}
          </details>
        </div>
      </div>
    </div>);
}
