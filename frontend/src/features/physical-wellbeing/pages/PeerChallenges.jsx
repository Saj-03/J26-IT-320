import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowUpRightIcon, CheckIcon, CopyIcon, LinkIcon, PlusIcon, ShieldCheckIcon, TrophyIcon, UsersRoundIcon } from 'lucide-react';
import { PageHeader } from '../../../shared/components/layout/PageHeader';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Field } from '../../../shared/components/ui/Field';
import { PhysicalNav } from '../components/PhysicalNav';
import {
  createPeerChallenge, getInvitedChallenge, getPeerChallenges,
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

function ordinal(value) {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] || 'th');
  return `${value}${suffix}`;
}

function PrivacyNote({ guest = false }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-3 text-xs leading-relaxed text-emerald-900">
      <ShieldCheckIcon size={16} className="mt-0.5 shrink-0 text-emerald-700" />
      <p>{guest ? 'Guest mode: no app account needed. Only your challenge nickname and total score are stored. Your profile, activity history, health details, and adaptation data are never accessed.' : 'Challenge scores are separate from personal wellbeing profiles. Guest friends only share a nickname and challenge score; their profile, health details, activity history, and adaptation data are never accessed.'}</p>
    </div>
  );
}

function Leaderboard({ challenge }) {
  const metric = METRICS[challenge.metric] || METRICS.minutes;
  const maxScore = Math.max(challenge.target, ...challenge.leaderboard.map((person) => person.score), 1);
  return (
    <div className="space-y-2">
      {challenge.leaderboard.map((person, index) => (
        <div key={`${person.nickname}-${index}`} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${person.is_me ? 'border border-brand-200 bg-brand-50' : 'bg-cream/70'}`}>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${index === 0 ? 'bg-amber-100 text-amber-800' : 'bg-white text-charcoal-muted'}`}>{index === 0 ? '👑' : index + 1}</span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-brand-700">{person.nickname.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-bold text-charcoal">{person.nickname}{person.is_me ? <span className="ml-1.5 text-[10px] font-semibold text-brand-700">YOU</span> : null}</p>
              <p className="shrink-0 text-xs font-extrabold text-charcoal">{person.score.toLocaleString()} <span className="font-medium text-charcoal-muted">{metric.unit}</span></p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400" style={{ width: `${Math.min(100, Math.round((person.score / maxScore) * 100))}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChallengeCard({ challenge, onProgress }) {
  const metric = METRICS[challenge.metric] || METRICS.minutes;
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pct = Math.min(100, Math.round((challenge.my_score / challenge.target) * 100));
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
            <p className="mt-0.5 text-xs text-charcoal-muted">Goal: {challenge.target.toLocaleString()} {metric.unit} · {challenge.leaderboard.length} players</p>
          </div>
        </div>
        <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold text-charcoal hover:bg-cream">
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}{copied ? 'Copied' : 'Copy invite'}
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-cream p-3.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-charcoal-muted">Your progress</span>
          <span className="font-extrabold text-charcoal">{challenge.my_score.toLocaleString()} / {challenge.target.toLocaleString()} {metric.unit}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center gap-2"><TrophyIcon size={16} className="text-amber-500" /><h4 className="text-sm font-extrabold text-charcoal">Friendly leaderboard</h4></div>
        <Leaderboard challenge={challenge} />
      </div>

      {!ended && <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <Field label={`Add your ${metric.label.toLowerCase()}`} type="number" min="1" max={metric.max} step="1" placeholder={`Up to ${metric.max.toLocaleString()} ${metric.unit}`} value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Button type="submit" disabled={busy || !amount} className="sm:shrink-0">{busy ? 'Saving…' : 'Log score'} <ArrowUpRightIcon size={15} /></Button>
      </form>}
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}
      <p className="mt-3 text-[10px] leading-relaxed text-charcoal-muted">Scores are self-reported and only count toward this challenge. Each check-in stores a total, not an activity record.</p>
    </Card>
  );
}

export function PeerChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', metric: 'minutes', target: '150', duration_days: '7', nickname: '' });

  const refresh = async () => setChallenges(await getPeerChallenges());
  useEffect(() => {
    getPeerChallenges().then(setChallenges).catch((err) => setError(apiErrorMessage(err, 'Could not load your challenges.'))).finally(() => setLoading(false));
  }, []);

  const create = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      await createPeerChallenge({ ...form, target: Number(form.target), duration_days: Number(form.duration_days) });
      setForm({ ...form, title: '' });
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

  return (
    <div className="space-y-6">
      <PageHeader title="Squad Challenges" subtitle="Invite a friend, pick one small goal, and cheer each other on." />
      <PhysicalNav />
      <PrivacyNote />

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <Card padding="lg" className="h-fit border border-brand-100 bg-gradient-to-br from-white to-brand-50/60">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white"><PlusIcon size={18} /></span>
            <div><h2 className="font-extrabold text-charcoal">Start a challenge</h2><p className="text-xs text-charcoal-muted">Choose the rules and invite your friend.</p></div>
          </div>
          <form onSubmit={create} className="space-y-3.5">
            <Field label="Challenge name" required minLength="3" maxLength="80" placeholder="e.g. Campus walk week" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <label className="block space-y-1.5"><span className="text-sm font-semibold text-charcoal-light">Challenge goal</span><select className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-charcoal outline-none focus:border-brand-400" value={form.metric} onChange={(event) => setForm({ ...form, metric: event.target.value, target: event.target.value === 'minutes' ? '150' : event.target.value === 'steps' ? '30000' : '5' })}><option value="minutes">Active minutes</option><option value="steps">Steps</option><option value="workouts">Workout sessions</option></select></label>
            <Field label={`Target (${METRICS[form.metric].unit})`} type="number" min="1" max="1000000" required value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} />
            <label className="block space-y-1.5"><span className="text-sm font-semibold text-charcoal-light">Length</span><select className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-charcoal outline-none focus:border-brand-400" value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: event.target.value })}><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>
            <Field label="Your challenge nickname" required minLength="2" maxLength="24" placeholder="e.g. Nilu" value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} />
            {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
            <Button type="submit" fullWidth disabled={creating || !form.title.trim() || !form.nickname.trim()}>{creating ? 'Creating…' : 'Create & get invite link'} <LinkIcon size={15} /></Button>
          </form>
          <p className="mt-3 text-[10px] leading-relaxed text-charcoal-muted">Your friend opens the link in a browser and joins with a nickname. They do not need an IHSD account.</p>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Your private squads</p><h2 className="mt-1 text-xl font-extrabold text-charcoal">Active challenges</h2></div><span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-charcoal-muted"><UsersRoundIcon size={14} /> {challenges.length}</span></div>
          {loading ? <Card padding="lg" className="text-center text-sm text-charcoal-muted">Loading your challenges…</Card> : challenges.length ? challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} onProgress={saveProgress} />) : <Card padding="lg" className="text-center"><span className="text-3xl">🏁</span><h3 className="mt-2 font-extrabold text-charcoal">No challenges yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-charcoal-muted">Create a friendly challenge, copy its private link, and send it to someone you want to cheer on.</p></Card>}
        </section>
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
  const myRank = challenge.leaderboard.findIndex((entry) => entry.is_me) + 1;
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100 via-cream to-cream px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        <header className="text-center"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">IHSD · Friendly challenge</p><h1 className="mt-2 text-3xl font-black tracking-tight text-charcoal">You’re invited to play</h1><p className="mt-2 text-sm text-charcoal-muted">A little encouragement, just between your squad.</p></header>
        <Card padding="lg" className="overflow-hidden border border-brand-100 shadow-card">
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-5 text-white">
            <div className="flex items-center justify-between"><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">{challenge.duration_days}-day challenge</span><span className="text-3xl">{metric.icon}</span></div>
            <h2 className="mt-3 text-2xl font-black">{challenge.title}</h2><p className="mt-1 text-sm text-white/80">First to {challenge.target.toLocaleString()} {metric.unit} wins the bragging rights.</p>
          </div>
          <div className="mt-5"><PrivacyNote guest /></div>
          {joined ? <>
            <div className="mt-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Your score</p><p className="mt-1 text-2xl font-black text-charcoal">{challenge.my_score.toLocaleString()} <span className="text-sm font-semibold text-charcoal-muted">{metric.unit}</span></p></div><span className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-800">🏆 {ordinal(myRank)} place</span></div>
            <div className="mt-5"><h3 className="mb-3 flex items-center gap-2 font-extrabold text-charcoal"><TrophyIcon size={17} className="text-amber-500" /> Squad leaderboard</h3><Leaderboard challenge={challenge} /></div>
            {!ended && <form onSubmit={submitScore} className="mt-5 space-y-3"><Field label={`Add your ${metric.label.toLowerCase()}`} type="number" min="1" max={metric.max} required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={`1–${metric.max} ${metric.unit}`} /><Button type="submit" fullWidth disabled={busy || !amount}>{busy ? 'Saving…' : 'Add to my score'} <ArrowUpRightIcon size={16} /></Button></form>}
          </> : ended ? <div className="mt-5 rounded-2xl bg-cream p-4 text-center text-sm font-semibold text-charcoal-muted">This challenge has ended.</div> : <form onSubmit={join} className="mt-5 space-y-3"><Field label="Choose a challenge nickname" required minLength="2" maxLength="24" placeholder="Only this name appears on the board" value={nickname} onChange={(event) => setNickname(event.target.value)} /><Button type="submit" fullWidth disabled={busy || nickname.trim().length < 2}>{busy ? 'Joining…' : 'Join the challenge'} <ArrowUpRightIcon size={16} /></Button></form>}
          {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}
          <p className="mt-4 text-center text-[10px] leading-relaxed text-charcoal-muted">No account, profile, or app download required. Your nickname and challenge total are kept so the leaderboard can work.</p>
        </Card>
        <p className="text-center text-xs text-charcoal-muted">Friendly competition, with privacy built in. 🌱</p>
      </div>
    </main>
  );
}
