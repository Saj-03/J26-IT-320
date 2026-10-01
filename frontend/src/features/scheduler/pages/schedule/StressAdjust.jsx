// [ITEM 2] STRESS ADJUST PAGE — the system SUGGESTS a lighter plan, the user DECIDES.
// Each change is its own row with a reason and Accept / Edit / Reject buttons.
// Tasks with a near deadline are "Protected - due soon" and are never moved.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ArrowRightIcon, LeafIcon, PencilIcon, XIcon, LockIcon, RotateCcwIcon, Undo2Icon } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/layout/PageHeader';
import { Card } from '../../../../shared/components/ui/Card';
import { Button } from '../../../../shared/components/ui/Button';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Modal } from '../../../../shared/components/ui/Modal';
import { Field } from '../../../../shared/components/ui/Field';
import { LoadBadge, SectionTitle } from '../../components/PlanPrimitives';
import { stressSuggestion } from '../../data';
import { cn } from '../../../../shared/lib/cn';

// [ITEM 2] A task is protected when its deadline is close (due within `protectDays` days)
const isProtected = (task) => task.dueInDays <= stressSuggestion.protectDays;
const protectedIds = stressSuggestion.original.filter(isProtected).map((t) => t.id);

// [ITEM 2] Never suggest moving a protected task — drop those suggestions here
const safeChanges = stressSuggestion.changes.filter((c) => !protectedIds.includes(c.taskId));
const droppedCount = stressSuggestion.changes.length - safeChanges.length;

// Every change starts as "pending" (not decided yet)
const startState = () => safeChanges.map((c) => ({ ...c, status: 'pending' }));

const statusStyle = {
    pending: 'bg-cream',
    accepted: 'bg-sage-light border border-emerald-100',
    rejected: 'bg-white border border-black/[0.06] opacity-70'
};

export function StressAdjust() {
    const navigate = useNavigate();
    const [changes, setChanges] = useState(startState);
    const [editing, setEditing] = useState(null); // the change being edited in the modal

    // Helpers to update one change or all changes
    const setStatus = (id, status) => setChanges((cs) => cs.map((c) => c.id === id ? { ...c, status } : c));
    const setAll = (status) => setChanges((cs) => cs.map((c) => ({ ...c, status })));

    // [ITEM 2] "Edit" lets the user pick their own new time, then the change counts as accepted
    const saveEdit = () => {
        setChanges((cs) => cs.map((c) => c.id === editing.id ? { ...editing, status: 'accepted' } : c));
        setEditing(null);
    };

    const acceptedCount = changes.filter((c) => c.status === 'accepted').length;
    const allDecided = changes.every((c) => c.status !== 'pending');
    const keptOriginal = allDecided && acceptedCount === 0;

    return (<div className="space-y-6">
      {/* [ITEM 2] New wording: a suggestion, not an automatic change */}
      <PageHeader title="We suggest a lighter plan for today" subtitle="These are only suggestions. You choose what to change."/>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-sage-light border border-emerald-100 p-5 sm:p-6 flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-sage text-white flex items-center justify-center shrink-0">
          <LeafIcon size={20}/>
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-emerald-800">Your stress level looks high today</h2>
          <p className="text-sm text-emerald-700/85 mt-1 leading-relaxed max-w-xl">
            Here are some changes that could make today easier. Accept, edit or reject each one — nothing changes until you decide.
          </p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Original plan (with protected badges) */}
        <Card padding="lg" className="lg:col-span-2 h-fit">
          <SectionTitle title="Your original plan"/>
          <div className="space-y-2">
            {stressSuggestion.original.map((t) => <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-charcoal-muted tabular-nums">{t.time}</p>
                  <p className="text-sm font-bold text-charcoal mt-0.5">{t.title}</p>
                  {/* [ITEM 2] Protected badge for tasks with a near deadline */}
                  {isProtected(t) &&
                <Badge className="mt-1.5 bg-brand-50 text-brand-700">
                      <LockIcon size={11}/> Protected - due soon
                    </Badge>}
                </div>
                <LoadBadge load={t.load}/>
              </div>)}
          </div>
          {droppedCount > 0 &&
            <p className="text-xs text-charcoal-muted mt-3">
              Protected tasks stay where they are, so we did not suggest moving them.
            </p>}
        </Card>

        {/* [ITEM 2] One row per suggested change */}
        <Card padding="lg" className="lg:col-span-3 border-2 border-brand-200">
          <SectionTitle title="Suggested changes" subtitle={`${acceptedCount} of ${changes.length} accepted`}/>
          <div className="space-y-2.5">
            {changes.map((c) => <div key={c.id} className={cn('rounded-2xl p-4 transition-colors', statusStyle[c.status])}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-charcoal">{c.title}</p>
                    <p className="text-xs font-semibold text-charcoal-muted tabular-nums mt-0.5">
                      {c.from ? <>{c.from} <ArrowRightIcon size={11} className="inline -mt-0.5"/> {c.to}</> : <>New · {c.to}</>}
                    </p>
                    {/* Short reason for the change */}
                    <p className="text-sm text-charcoal-light mt-1.5">{c.reason}</p>
                  </div>

                  {c.status === 'pending' ?
                <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" onClick={() => setStatus(c.id, 'accepted')}>
                        <CheckIcon size={14}/> Accept
                      </Button>
                      <Button size="sm" variant="outline" className="bg-white" onClick={() => setEditing(c)}>
                        <PencilIcon size={13}/> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, 'rejected')}>
                        <XIcon size={14}/> Reject
                      </Button>
                    </div> :
                <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-xs font-bold', c.status === 'accepted' ? 'text-emerald-700' : 'text-charcoal-muted')}>
                        {c.status === 'accepted' ? 'Accepted ✓' : 'Rejected'}
                      </span>
                      <button onClick={() => setStatus(c.id, 'pending')} className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal-muted hover:text-charcoal">
                        <Undo2Icon size={12}/> Undo
                      </button>
                    </div>}
                </div>
              </div>)}
          </div>
        </Card>
      </div>

      {/* [ITEM 2] Page buttons: Accept all / Keep my original plan / Restore original plan */}
      <AnimatePresence mode="wait">
        {acceptedCount > 0 ?
            <motion.div key="active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="text-3xl">🌿</span>
              <div className="flex-1">
                <p className="font-bold text-charcoal">Lighter plan active · {acceptedCount} change{acceptedCount === 1 ? '' : 's'} accepted</p>
                <p className="text-sm text-charcoal-muted mt-0.5">Changed your mind? You can go back to your original plan any time.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setAll('rejected')}>
                  <RotateCcwIcon size={15}/> Restore original plan
                </Button>
                <Button onClick={() => navigate('/app/schedule')}>
                  Go to schedule <ArrowRightIcon size={16}/>
                </Button>
              </div>
            </Card>
          </motion.div> :
            keptOriginal ?
                <motion.div key="kept" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="text-3xl">👍</span>
              <div className="flex-1">
                <p className="font-bold text-charcoal">You are keeping your original plan</p>
                <p className="text-sm text-charcoal-muted mt-0.5">No changes were made. Remember to take short breaks.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setChanges(startState())}>
                  See suggestions again
                </Button>
                <Button onClick={() => navigate('/app/schedule')}>
                  Go to schedule <ArrowRightIcon size={16}/>
                </Button>
              </div>
            </Card>
          </motion.div> :
                <motion.div key="choose" className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="flex-1" onClick={() => setAll('accepted')}>
              <CheckIcon size={18}/> Accept all
            </Button>
            <Button size="lg" variant="outline" className="flex-1" onClick={() => setAll('rejected')}>
              Keep my original plan
            </Button>
          </motion.div>}
      </AnimatePresence>

      {/* [ITEM 2] Edit modal — user chooses their own time for this change */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit: ${editing.title}` : ''}>
        {editing &&
            <div className="space-y-4">
            <p className="text-sm text-charcoal-muted">{editing.reason}</p>
            <Field label="New time" value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })}/>
            <Button fullWidth size="lg" onClick={saveEdit} disabled={!editing.to.trim()}>
              Save and accept
            </Button>
          </div>}
      </Modal>
    </div>);
}
