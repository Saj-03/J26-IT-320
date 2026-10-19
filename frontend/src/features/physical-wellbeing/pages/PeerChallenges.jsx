import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowUpRightIcon, CheckIcon, CopyIcon, LinkIcon, PlusIcon, ShieldCheckIcon, Trash2Icon, UsersRoundIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Field } from '../../../shared/components/ui/Field';
import { PhysicalNav } from '../components/PhysicalNav';
import {
  createPeerChallenge, deletePeerChallenge, getInvitedChallenge, getPeerChallenges,
  joinInvitedChallenge, updateInvitedChallengeScore, updatePeerChallengeScore,
} from '../api';
import { apiErrorMessage } from '../../../shared/api/client';

const METRICS = {
  minutes: { label: 'Active minutes', unit: 'min', icon: '⏱️', max: 240 },
  steps: { label: 'Steps', unit: 'steps', icon: '👟', max: 10000 },
  workouts: { label: 'Workouts', unit: 'workouts', icon: '🏋️', max: 5 },
};

function inviteLink(code) {
  return `${window.location.origin}/challenge/${encodeURIComponent(code)}`;
}

function PrivacyNote({ guest = false }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-3 text-xs leading-relaxed text-emerald-900">
      <ShieldCheckIcon size={16} className="mt-0.5 shrink-0 text-emerald-700" />
      <p>{guest ? 'Guest mode: no app account needed. Only your challenge nickname and total score are stored. Your profile, activity history, health details, and adaptation data are never accessed.' : 'Challenge scores are separate from personal wellbeing profiles. Guest friends only share a nickname and challenge score; their profile, health details, activity history, and adaptation data are never accessed.'}</p>
    </div>
  );
}

function JungleTrail({ percent }) {
  return (
    <div className="relative isolate flex min-h-52 items-end overflow-hidden rounded-3xl border border-emerald-900/20 bg-cover bg-center p-4 shadow-inner sm:min-h-64 sm:p-6" style={{ backgroundImage: "linear-gradient(180deg, rgba(7,32,24,.06) 15%, rgba(7,32,24,.78) 100%), url('/img/jungle-quest-bg.png')" }}>
      <div className="absolute inset-0 -z-10 bg-emerald-950/10" />
      <span className="absolute right-8 top-8 animate-[jungle-float_4s_ease-in-out_infinite] text-4xl drop-shadow" aria-hidden="true">🦋</span>
      <div className="relative w-full rounded-2xl border border-white/25 bg-emerald-950/45 p-4 text-white shadow-lg backdrop-blur-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-extrabold uppercase tracking-wider">🌿 Shared trail progress</span><span className="text-sm font-black">{percent}%</span></div>
        <div className="relative h-3 rounded-full bg-white/40 shadow-inner">
          <div className="h-full rounded-full bg-gradient-to-r from-lime-300 to-amber-300 transition-all duration-700" style={{ width: `${percent}%` }} />
          <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 animate-[jungle-float_2.5s_ease-in-out_infinite] text-2xl drop-shadow transition-[left] duration-700" style={{ left: `${Math.max(4, Math.min(96, percent))}%` }} aria-label="Squad progress marker">🧭</span>
        </div>
        <p className="mt-3 text-xs font-semibold text-white/90">Each check-in moves your squad toward its goal.</p>
      </div>
    </div>
  );
}

function SquadRoster({ challenge }) {
  return <div className="relative">
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-color:#86a98a_transparent] [scrollbar-width:thin]">
      {challenge.participants.map((person, index) => (
        <div key={`${person.nickname}-${index}`} className={`group min-w-[150px] snap-start rounded-2xl border p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md ${person.is_me ? 'border-emerald-200 bg-emerald-50' : 'border-black/[0.05] bg-white'}`}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-10 w-10 shrink-0 animate-[jungle-float_3.5s_ease-in-out_infinite] items-center justify-center rounded-2xl bg-gradient-to-br from-lime-100 to-emerald-200 text-sm font-black text-emerald-900 shadow-inner" style={{ animationDelay: `${index * 180}ms` }}>{person.nickname.slice(0, 1).toUpperCase()}<span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${person.has_contributed ? 'bg-lime-500' : 'bg-slate-300'}`} /></span>
            <div className="min-w-0"><p className="truncate text-xs font-extrabold text-charcoal">{person.nickname}{person.is_me ? ' · you' : ''}</p><p className="mt-0.5 text-[10px] font-semibold text-charcoal-muted">{person.has_contributed ? '🌱 On the trail' : '⏳ Ready to join'}</p></div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className={`h-full rounded-full transition-all duration-700 ${person.has_contributed ? 'w-full bg-gradient-to-r from-lime-400 to-emerald-500' : 'w-1/4 bg-slate-300'}`} /></div>
        </div>
      ))}
    </div>
    <p className="text-[10px] font-medium text-charcoal-muted">Swipe to explore your squad → · individual scores are private</p>
  </div>;
}

function ChallengeCard({ challenge, onProgress, onDelete }) {
  const metric = METRICS[challenge.metric] || METRICS.minutes;
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pct = Math.min(100, Math.round((challenge.team_score / challenge.target) * 100));
  const ended = new Date(challenge.ends_at).getTime() < Date.now();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(challenge.invite_code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically. Copy the link from your browser address bar.');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!value || value < 1 || value > metric.max) return;
    setBusy(true);
    setError('');
    try {
      await onProgress(challenge, value);
      setAmount('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save this challenge score.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg" className="overflow-hidden border border-black/[0.05] shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-xl">{metric.icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">{ended ? 'Challenge complete' : `${challenge.duration_days}-day challenge`}</p>
            <h3 className="mt-0.5 text-lg font-extrabold text-charcoal">{challenge.title}</h3>
            <p className="mt-0.5 text-xs text-charcoal-muted">Shared goal: {challenge.goal_text || metric.label} · Target: {challenge.target_text || `${challenge.target.toLocaleString()} ${metric.unit}`} · {challenge.participant_count}/6 explorers · {challenge.invitee_count} guest{challenge.invitee_count === 1 ? '' : 's'} joined</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold text-charcoal hover:bg-cream">
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}{copied ? 'Copied' : 'Copy invite'}
          </button>
          <button type="button" onClick={async () => {
            if (!window.confirm(`Delete “${challenge.title}”? This will end the quest and remove its participants and scores.`)) return;
            setDeleting(true);
            setError('');
            try { await onDelete(challenge); }
            catch (err) { setError(apiErrorMessage(err, 'Could not delete this challenge.')); setDeleting(false); }
          }} disabled={deleting} aria-label={`Delete ${challenge.title}`} title="Delete challenge" className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
            <Trash2Icon size={14} />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-lime-50 p-3.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-emerald-900">Squad trail progress</span>
          <span className="font-extrabold text-emerald-900">{challenge.team_score.toLocaleString()} / {challenge.target.toLocaleString()} {metric.unit}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-[11px] font-medium text-emerald-900/70">Your check-ins add to one shared team score.</p>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-2"><h4 className="text-sm font-extrabold text-charcoal">🌿 Jungle trail</h4><span className="text-[10px] font-bold text-charcoal-muted">{pct}% complete</span></div>
        <JungleTrail percent={pct} />
        <div className="mb-2 mt-5 flex items-center justify-between gap-2"><h4 className="text-sm font-extrabold text-charcoal">Your squad</h4><span className="text-[10px] font-semibold text-charcoal-muted">Individual scores stay private</span></div>
        <SquadRoster challenge={challenge} />
      </div>

      {!ended && <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <Field label={`Add to your ${metric.label.toLowerCase()}`} type="number" min="1" max={metric.max} step="1" placeholder={`Up to ${metric.max.toLocaleString()} ${metric.unit}`} value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Button type="submit" disabled={busy || !amount} className="sm:shrink-0">{busy ? 'Saving…' : 'Move the squad'} <ArrowUpRightIcon size={15} /></Button>
      </form>}
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}
      <p className="mt-3 text-[10px] leading-relaxed text-charcoal-muted">Check-ins only add to this challenge’s shared score. No personal activity records are created or shared.</p>
    </Card>
  );
}

export function PeerChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', goal: '', metric: '', target: '', duration_days: '', nickname: '' });

  const refresh = async () => setChallenges(await getPeerChallenges());
  useEffect(() => {
    getPeerChallenges().then(setChallenges).catch((err) => setError(apiErrorMessage(err, 'Could not load your challenges.'))).finally(() => setLoading(false));
  }, []);

  const create = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      const numericTarget = Number.parseInt(form.target.match(/\d+/)?.[0] || '', 10);
      await createPeerChallenge({ ...form, goal_text: form.goal.trim(), target_text: form.target.trim(), target: numericTarget, duration_days: Number(form.duration_days) });
      setForm({ title: '', goal: '', metric: '', target: '', duration_days: '', nickname: form.nickname });
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create this challenge.'));
    } finally {
      setCreating(false);
    }
  };

  const saveProgress = async (challenge, amount) => {
    const updated = await updatePeerChallengeScore(challenge.id, amount);
    setChallenges((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const removeChallenge = async (challenge) => {
    await deletePeerChallenge(challenge.id);
    setChallenges((current) => current.filter((item) => item.id !== challenge.id));
  };

  return (
    <div className="min-h-screen bg-cover bg-center bg-fixed px-3 py-5 sm:px-6 sm:py-8" style={{ backgroundImage: "linear-gradient(rgba(239,246,235,.76), rgba(239,246,235,.82)), url('/img/jungle-quest-bg.png')" }}>
      <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Squad Challenges" subtitle="Invite a friend, pick one small goal, and cheer each other on." />
      <PhysicalNav />
      <PrivacyNote />

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <Card padding="lg" className="h-fit border border-brand-100 bg-gradient-to-br from-white to-brand-50/60">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white"><PlusIcon size={18} /></span>
            <div><h2 className="font-extrabold text-charcoal">Start a Jungle Quest</h2><p className="text-xs text-charcoal-muted">Pick one shared goal for up to six people.</p></div>
          </div>
          <form onSubmit={create} className="space-y-3.5">
            <Field label="Challenge name" required minLength="3" maxLength="80" placeholder="e.g. Campus walk week" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <Field label="Challenge goal" required value={form.goal}
              onChange={(event) => {
                const goal = event.target.value;
                const normalizedGoal = goal.toLowerCase();
                const metric = normalizedGoal.includes('step') ? 'steps' : normalizedGoal.includes('min') ? 'minutes' : 'workouts';
                setForm({ ...form, goal, metric });
              }} />
            <Field label="Target" type="text" maxLength="120" required value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} />
            <Field label="Length (days)" type="number" inputMode="numeric" min="1" max="30" step="1" required value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: event.target.value })} hint="Choose any length from 1 to 30 days." className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <Field label="Your challenge nickname" required minLength="2" maxLength="24" placeholder="e.g. Nilu" value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} />
            {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
            <Button type="submit" fullWidth disabled={creating || !form.title.trim() || !form.goal.trim() || !form.nickname.trim() || !Number.isInteger(Number.parseInt(form.target.match(/\d+/)?.[0] || '', 10)) || Number.parseInt(form.target.match(/\d+/)?.[0] || '', 10) < 1 || !Number.isInteger(Number(form.duration_days)) || Number(form.duration_days) < 1 || Number(form.duration_days) > 30}>{creating ? 'Creating…' : 'Create & get invite link'} <LinkIcon size={15} /></Button>
          </form>
          <p className="mt-3 text-[10px] leading-relaxed text-charcoal-muted">Friends join from your private link with a nickname. Up to five guests can join you; no IHSD account is needed.</p>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Your private squads</p><h2 className="mt-1 text-xl font-extrabold text-charcoal">Active challenges</h2></div><span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-charcoal-muted"><UsersRoundIcon size={14} /> {challenges.length}</span></div>
          {loading ? <Card padding="lg" className="text-center text-sm text-charcoal-muted">Loading your challenges…</Card> : challenges.length ? challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} onProgress={saveProgress} onDelete={removeChallenge} />) : <Card padding="lg" className="text-center"><span className="text-3xl">🏁</span><h3 className="mt-2 font-extrabold text-charcoal">No challenges yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-charcoal-muted">Create a friendly challenge, copy its private link, and send it to someone you want to cheer on.</p></Card>}
        </section>
      </div>
      </div>
    </div>
  );
}

export function PeerChallengeInvite() {
  const { inviteCode } = useParams();
  const tokenKey = `peer-challenge-token:${inviteCode}`;
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || '');
  const [challenge, setChallenge] = useState(null);
  const [nickname, setNickname] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getInvitedChallenge(inviteCode, token).then(setChallenge).catch((err) => setError(apiErrorMessage(err, 'This invite link is unavailable.'))).finally(() => setLoading(false));
  }, [inviteCode, token]);

  const join = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await joinInvitedChallenge(inviteCode, nickname, token);
      localStorage.setItem(tokenKey, result.participant_token);
      setToken(result.participant_token);
      setChallenge(result.challenge);
      setNickname('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not join this challenge.'));
    } finally {
      setBusy(false);
    }
  };

  const submitScore = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await updateInvitedChallengeScore(inviteCode, token, Number(amount));
      setChallenge(updated);
      setAmount('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your score.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-cream p-6 text-center text-sm text-charcoal-muted">Loading invite…</div>;
  if (error && !challenge) return <div className="flex min-h-screen items-center justify-center bg-cream p-5"><Card padding="lg" className="w-full max-w-md text-center"><span className="text-4xl">🔗</span><h1 className="mt-3 text-xl font-extrabold text-charcoal">Invite unavailable</h1><p className="mt-2 text-sm text-charcoal-muted">{error}</p></Card></div>;
  if (!challenge) return null;

  const joined = challenge.my_score !== null;
  const metric = METRICS[challenge.metric] || METRICS.minutes;
  const ended = new Date(challenge.ends_at).getTime() < Date.now();
  const pct = Math.min(100, Math.round((challenge.team_score / challenge.target) * 100));
  return (
    <main className="min-h-screen bg-cover bg-center bg-fixed px-4 py-8 sm:px-6" style={{ backgroundImage: "linear-gradient(rgba(239,246,235,.64), rgba(239,246,235,.78)), url('/img/jungle-quest-bg.png')" }}>
      <div className="mx-auto max-w-xl space-y-5">
        <header className="text-center"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">IHSD · Jungle quest</p><h1 className="mt-2 text-3xl font-black tracking-tight text-charcoal">You’re invited to the trail</h1><p className="mt-2 text-sm text-charcoal-muted">One shared goal. Every check-in moves the whole squad.</p></header>
        <Card padding="lg" className="overflow-hidden border border-brand-100 shadow-card">
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-5 text-white">
            <div className="flex items-center justify-between"><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">{challenge.duration_days}-day quest</span><span className="text-3xl">{metric.icon}</span></div>
            <h2 className="mt-3 text-2xl font-black">{challenge.title}</h2><p className="mt-1 text-sm text-white/80">{challenge.goal_text || 'Squad goal'} · Target: {challenge.target_text || `${challenge.target.toLocaleString()} ${metric.unit}`}</p>
          </div>
          <div className="mt-5"><PrivacyNote guest /></div>
          {joined ? <>
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Shared trail progress</p><p className="mt-1 text-xl font-black text-charcoal">{challenge.team_score.toLocaleString()} / {challenge.target.toLocaleString()} <span className="text-sm font-semibold text-charcoal-muted">{metric.unit}</span></p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-800">👥 {challenge.participant_count}/6 explorers</span></div>
              <div className="mt-3"><JungleTrail percent={pct} /></div>
            </div>
            <div className="mt-5"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-extrabold text-charcoal">Your squad</h3><span className="text-[10px] font-semibold text-charcoal-muted">No ranks · scores stay private</span></div><SquadRoster challenge={challenge} /></div>
            {!ended && <form onSubmit={submitScore} className="mt-5 space-y-3"><Field label={`Add to your ${metric.label.toLowerCase()}`} type="number" min="1" max={metric.max} required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={`1–${metric.max} ${metric.unit}`} /><Button type="submit" fullWidth disabled={busy || !amount}>{busy ? 'Saving…' : 'Add to the trail'} <ArrowUpRightIcon size={16} /></Button></form>}
          </> : ended ? <div className="mt-5 rounded-2xl bg-cream p-4 text-center text-sm font-semibold text-charcoal-muted">This quest has ended.</div> : <form onSubmit={join} className="mt-5 space-y-3"><Field label="Choose a challenge nickname" required minLength="2" maxLength="24" placeholder="This nickname is shown to the squad" value={nickname} onChange={(event) => setNickname(event.target.value)} /><Button type="submit" fullWidth disabled={busy || nickname.trim().length < 2}>{busy ? 'Joining…' : 'Join the squad'} <ArrowUpRightIcon size={16} /></Button></form>}
          {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}
          <p className="mt-4 text-center text-[10px] leading-relaxed text-charcoal-muted">No account, profile, or app download required. Only your nickname and challenge contribution are saved; the squad sees its shared total, not individual scores.</p>
        </Card>
        <p className="text-center text-xs text-charcoal-muted">A private, cooperative challenge. No chats, public rankings, or shared health data. 🌱</p>
      </div>
    </main>
  );
}
