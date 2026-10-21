// STRESS ADJUST PAGE — the system SUGGESTS a lighter plan, the student DECIDES.
// Data comes from the backend (Component 4's wellbeing signal -> safety rules -> proposal).
// Each change has Accept / Reject; "Save my choices" sends accepted / edited (some) / rejected.
// Tasks the safety rules lock (due soon, fixed, top priority...) are shown with the reason and never moved.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ArrowRightIcon, LeafIcon, XIcon, LockIcon, RotateCcwIcon, Undo2Icon, ScissorsIcon, CalendarClockIcon, CoffeeIcon, InfoIcon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { Badge } from '../../../../shared/components/ui/Badge';
import { LoadingState, ErrorState } from '../../../../shared/components/ui/States';
import { LoadBadge, SectionTitle } from '../../components/PlanPrimitives';
import { apiErrorMessage } from '../../../../shared/api/client';
import { cn } from '../../../../shared/lib/cn';
import {
    decideStressProposal, getStressStatus, getTaskSafety, listStressProposals,
    proposeStressChanges, restoreStressProposal, utcMs, rateStressProposal,
} from '../../api';
import UsefulnessRating from '../../components/UsefulnessRating';

const ICON = { move: CalendarClockIcon, split: ScissorsIcon, rest: CoffeeIcon };
const LOAD_LABEL = { low: 'Light', medium: 'Medium', heavy: 'Heavy' };   // PlanPrimitives uses these words

const statusStyle = {
    pending: 'bg-cream',
    accepted: 'bg-sage-light border border-emerald-100',
    rejected: 'bg-white border border-black/[0.06] opacity-70'
};

const when = (iso) => new Date(utcMs(iso)).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// One line under the title: what exactly changes
function detail(c) {
    if (c.action === 'move')     // NFR-08: old slot -> new slot
        return c.old_start ? <>Move from {when(c.old_start)} to <b>{when(c.to)}</b></> : <>Not planned yet. Start from <b>{when(c.to)}</b></>;
    if (c.action === 'split') return <>Split into {c.pieces.length} pieces: {c.pieces.join(' + ')} min</>;
    return <>Add a {c.minutes}-min break in the next hour</>;
}

export function StressAdjust() {
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);       // GET /stress/status
    const [safety, setSafety] = useState(null);       // changeable / locked tasks
    const [proposal, setProposal] = useState(null);   // the proposal on screen
    const [choices, setChoices] = useState([]);       // 'pending' | 'accepted' | 'rejected' per change
    const [loadFailed, setLoadFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const show = (p) => { setProposal(p); setChoices(p ? p.change_set.map(() => 'pending') : []); };

    const load = () => {
        setLoadFailed(false);
        Promise.all([getStressStatus(), getTaskSafety(), listStressProposals()])
            .then(([s, t, waiting]) => { setStatus(s); setSafety(t); show(waiting[0] ?? null); })
            .catch(() => setLoadFailed(true));
    };
    useEffect(load, []);

    // Run one backend call with a busy flag and a readable error
    const run = (request, then) => {
        setBusy(true);
        setError('');
        request.then(then).catch((e) => setError(apiErrorMessage(e))).finally(() => setBusy(false));
    };

    const askForPlan = () => run(proposeStressChanges(), show);
    const setChoice = (i, value) => setChoices((cs) => cs.map((c, j) => (j === i ? value : c)));
    const setAll = (value) => setChoices((cs) => cs.map(() => value));

    // accepted = all, rejected = none, edited = only the accepted positions
    const save = () => {
        const kept = choices.flatMap((c, i) => (c === 'accepted' ? [i] : []));
        const decision = kept.length === choices.length ? 'accepted' : kept.length === 0 ? 'rejected' : 'edited';
        run(decideStressProposal(proposal.id, decision, decision === 'edited' ? kept : undefined),
            (p) => { setProposal(p); getTaskSafety().then(setSafety); });
    };
    const undo = () => run(restoreStressProposal(proposal.id), (p) => { setProposal(p); getTaskSafety().then(setSafety); });

    if (loadFailed) return <ErrorState onRetry={load}/>;
    if (!status || !safety) return <LoadingState label="Checking your wellbeing signal…"/>;

    const decided = proposal && proposal.decision !== 'proposed';
    const acceptedCount = choices.filter((c) => c === 'accepted').length;
    const allDecided = choices.length > 0 && choices.every((c) => c !== 'pending');
    const level = status.level ? status.level.toLowerCase() : null;

    return (<div className="space-y-6">
      <PageHeader title="We suggest a lighter plan" subtitle="These are only suggestions. You choose what to change."/>

      {/* Signal from Component 4 + what the scheduler will do */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-sage-light border border-emerald-100 p-5 sm:p-6 flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <LeafIcon size={20}/>
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold text-emerald-800">
            {level ? `Your wellbeing signal is ${level}` : 'No wellbeing signal yet'}
            {status.trend && level && <span className="text-sm font-semibold text-emerald-700/80"> · {status.trend.toLowerCase()}</span>}
          </h2>
          <p className="text-sm text-emerald-700/85 mt-1 leading-relaxed max-w-xl">{proposal ? proposal.reason : status.reason}</p>
          {!proposal && status.action === 'propose_changes' &&
            <Button className="mt-4" onClick={askForPlan} disabled={busy}>
              {busy ? 'Thinking…' : 'Show me a lighter plan'}
            </Button>}
        </div>
      </motion.div>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Tasks: which ones may change, which are protected and why */}
        <Card padding="lg" className="lg:col-span-2 h-fit">
          <SectionTitle title="Your tasks"/>
          <div className="space-y-2">
            {[...safety.locked.map((t) => ({ ...t, locked: true })), ...safety.changeable]
                .filter((t) => !/^already /.test(t.reason))                       // hide finished ones
                .map((t) => <div key={t.task_id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal">{t.title}</p>
                  {t.locked ?
                    <Badge className="mt-1.5 bg-brand-50 text-brand-700"><LockIcon size={11}/> Protected - {t.reason}</Badge> :
                    <p className="text-xs text-charcoal-muted mt-0.5">{t.reason}</p>}
                </div>
                <LoadBadge load={LOAD_LABEL[t.cognitive_load]}/>
              </div>)}
            {safety.locked.length + safety.changeable.length === 0 &&
                <p className="text-sm text-charcoal-muted">No tasks yet.</p>}
          </div>
          <p className="text-xs text-charcoal-muted mt-3">Protected tasks are never moved for stress.</p>
        </Card>

        {/* Suggested changes */}
        <Card padding="lg" className="lg:col-span-3 border-2 border-brand-200">
          <SectionTitle title="Suggested changes" subtitle={proposal && !decided ? `${acceptedCount} of ${choices.length} accepted` : undefined}/>
          {!proposal && <p className="text-sm text-charcoal-muted">No suggestions right now - your plan stays as it is.</p>}

          {/* Before deciding: Accept / Reject per change */}
          {proposal && !decided &&
            <div className="space-y-2.5">
              {proposal.change_set.map((c, i) => {
                const Icon = ICON[c.action];
                return <div key={i} className={cn('rounded-2xl p-4 transition-colors', statusStyle[choices[i]])}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-charcoal flex items-center gap-1.5"><Icon size={14}/> {c.title}</p>
                      <p className="text-xs font-semibold text-charcoal-muted mt-0.5">{detail(c)}</p>
                      <p className="text-sm text-charcoal-light mt-1.5">{c.reason}</p>
                    </div>
                    {choices[i] === 'pending' ?
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" onClick={() => setChoice(i, 'accepted')}><CheckIcon size={14}/> Accept</Button>
                        <Button size="sm" variant="ghost" onClick={() => setChoice(i, 'rejected')}><XIcon size={14}/> Reject</Button>
                      </div> :
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('text-xs font-bold', choices[i] === 'accepted' ? 'text-emerald-700' : 'text-charcoal-muted')}>
                          {choices[i] === 'accepted' ? 'Accepted ✓' : 'Rejected'}
                        </span>
                        <button onClick={() => setChoice(i, 'pending')} className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal-muted hover:text-charcoal">
                          <Undo2Icon size={12}/> Undo
                        </button>
                      </div>}
                  </div>
                </div>;
              })}
            </div>}

          {/* After deciding: what really happened (safety is checked again by the backend) */}
          {decided &&
            <div className="space-y-2.5">
              {(proposal.applied ?? []).length === 0 && <p className="text-sm text-charcoal-muted">No changes were made.</p>}
              {(proposal.applied ?? []).map((c, i) => <div key={i} className={cn('rounded-2xl p-4', c.applied ? statusStyle.accepted : statusStyle.rejected)}>
                <p className="text-sm font-bold text-charcoal">{c.title}</p>
                <p className="text-xs font-semibold text-charcoal-muted mt-0.5">
                  {c.applied ? detail(c) : `Not changed - ${c.skipped_because}`}
                </p>
              </div>)}
            </div>}
        </Card>
      </div>

      {/* Page buttons */}
      <AnimatePresence mode="wait">
        {proposal && !decided && (allDecided ?
            <motion.div key="save" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="flex-1" onClick={save} disabled={busy}>
                {acceptedCount === 0 ? 'Keep my original plan' : `Save my choices (${acceptedCount} change${acceptedCount === 1 ? '' : 's'})`}
              </Button>
            </motion.div> :
            <motion.div key="choose" className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="flex-1" onClick={() => setAll('accepted')}><CheckIcon size={18}/> Accept all</Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={() => setAll('rejected')}>Reject all</Button>
            </motion.div>)}

        {decided &&
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="text-3xl">{proposal.decision === 'rejected' ? '👍' : proposal.decision === 'restored' ? '↩️' : '🌿'}</span>
              <div className="flex-1">
                <p className="font-bold text-charcoal">
                  {proposal.decision === 'rejected' ? 'You are keeping your original plan'
                    : proposal.decision === 'restored' ? 'Your original plan is back'
                    : 'Lighter plan active'}
                </p>
                <p className="text-sm text-charcoal-muted mt-0.5">
                  {proposal.decision === 'accepted' || proposal.decision === 'edited'
                    ? 'Changed your mind? You can go back to your original plan.'
                    : 'Remember to take short breaks.'}
                </p>
                {proposal.decision !== 'restored' &&
                  <UsefulnessRating className="mt-3" question="How helpful was this suggestion?"
                      send={(n) => rateStressProposal(proposal.id, n)}/>}
              </div>
              <div className="flex flex-wrap gap-2">
                {(proposal.decision === 'accepted' || proposal.decision === 'edited') &&
                <Button variant="outline" onClick={undo} disabled={busy}>
                    <RotateCcwIcon size={15}/> Restore original plan
                  </Button>}
                <Button onClick={() => navigate('/app/schedule')}>
                  Go to schedule <ArrowRightIcon size={16}/>
                </Button>
              </div>
            </Card>
          </motion.div>}
      </AnimatePresence>

      {/* NFR-12: planning aid, not a diagnosis - with a support pathway */}
      <p className="flex items-start gap-2 text-xs text-charcoal-muted leading-relaxed">
        <InfoIcon size={14} className="mt-0.5 shrink-0"/>
        <span>
          ThriveU only adjusts your study plan. It is a planning aid, not a medical or psychological diagnosis.
          If you feel overwhelmed or unsafe, please talk to the university counselling service or someone you trust.
        </span>
      </p>
    </div>);
}
