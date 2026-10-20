import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MicIcon, SaveIcon, CalendarDaysIcon, PaletteIcon, SparklesIcon, SearchIcon, PlusIcon, Trash2Icon, XIcon, PencilIcon, FlameIcon, ShuffleIcon, BookOpenIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { useAuth } from "../../../shared/context/AuthContext";
import { CrisisCard } from "../components/CrisisCard";
import { useJournalStyle, FONTS, PAGES } from "../journalStyle";
import { addJournal, sendMood, listJournal, deleteJournal, updateJournal, moodHistory } from "../api";

const MOODS = [
  { emoji: "😣", label: "Struggling", score: 1 },
  { emoji: "😕", label: "Low", score: 2 },
  { emoji: "😐", label: "Okay", score: 3 },
  { emoji: "🙂", label: "Good", score: 4 },
  { emoji: "🔥", label: "Motivated", score: 5 },
];
const moodEmoji = (avg) => (avg <= 1.5 ? "😣" : avg <= 2.5 ? "😕" : avg <= 3.5 ? "😐" : avg <= 4.5 ? "🙂" : "🔥");

// Gentle prompts. They invite, they never push.
const PROMPTS = [
  "What took most of your energy today?",
  "What is one thing that went better than you expected?",
  "What is on your mind that you have not said out loud?",
  "What do you need more of this week? What do you need less of?",
  "Describe today in three words, then say why.",
  "Who or what helped you today, even a little?",
  "What are you looking forward to, however small?",
  "What would make tomorrow feel lighter?",
  "What are you proud of this week?",
  "What would you tell a friend who had your week?",
];

// What the student sees after the signal refreshes: awareness and a next step, never a verdict.
const RESPONSE = {
  low: "Thanks for checking in. Things look steady right now.",
  moderate: "Things seem to have been heavier lately. A short break today could help.",
  elevated: "This stretch looks tough. ThriveU can use this to ease your plan. Be kind to yourself today.",
};

// Dates are shown in the student's own timezone (the API sends UTC).
const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD, local
const todayKey = () => new Date().toLocaleDateString("en-CA");
const dayLabel = (iso) => {
  const d = new Date(iso);
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (dayKey(iso) === todayKey()) return "Today";
  if (dayKey(iso) === yest.toLocaleDateString("en-CA")) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const longDate = (d = new Date()) => d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const snippet = (t) => (t.length > 70 ? t.slice(0, 70).trim() + "…" : t);
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

// Days in a row with at least one entry, counting back from today (or yesterday, so the streak is not lost before you write).
function streakOf(entries) {
  const days = new Set(entries.map((e) => dayKey(e.created_at)));
  const d = new Date();
  if (!days.has(d.toLocaleDateString("en-CA"))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toLocaleDateString("en-CA"))) { n += 1; d.setDate(d.getDate() - 1); }
  return n;
}

export default function JournalPage() {
  const { user } = useAuth();
  const firstName = (user?.full_name || "").trim().split(" ")[0];
  const [entries, setEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]);   // unfiltered, for the streak and counts
  const [moods, setMoods] = useState([]);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState(null);     // null = writing a new entry
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [promptIdx, setPromptIdx] = useState(() => new Date().getDate() % PROMPTS.length);
  const [signal, setSignal] = useState(null);
  const [crisis, setCrisis] = useState(null);         // helplines, when the last entry sounded unsafe
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { style, setStyle, fontFamily, pageColor } = useJournalStyle();
  const [showStyle, setShowStyle] = useState(false);

  const load = useCallback((q) => Promise.all([listJournal(q), listJournal(""), moodHistory()])
    .then(([filtered, all, m]) => { setEntries(filtered); setAllEntries(all); setMoods(m); })
    .catch(() => setError("Could not load your entries.")), []);
  useEffect(() => { const t = setTimeout(() => load(query), 250); return () => clearTimeout(t); }, [query, load]);

  const moodByDay = useMemo(() => {
    const acc = {};
    moods.forEach((m) => { const k = dayKey(m.created_at); (acc[k] ||= []).push(m.mood); });
    return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
  }, [moods]);

  const visible = useMemo(() => (date ? entries.filter((e) => dayKey(e.created_at) === date) : entries), [entries, date]);
  const groups = useMemo(() => {
    const out = [];
    visible.forEach((e) => {
      const k = dayKey(e.created_at);
      if (!out.length || out[out.length - 1].key !== k) out.push({ key: k, label: dayLabel(e.created_at), items: [] });
      out[out.length - 1].items.push(e);
    });
    return out;
  }, [visible]);

  const streak = useMemo(() => streakOf(allEntries), [allEntries]);
  const weekCount = useMemo(() => allEntries.filter((e) => Date.now() - new Date(e.created_at) < 7 * 864e5).length, [allEntries]);

  // Voice mode: browser Web Speech API -> text (no audio is uploaded)
  const dictate = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Voice input is not supported in this browser");
    const r = new SR();
    r.onresult = (e) => setText((t) => (t + " " + e.results[0][0].transcript).trim());
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  const handleResult = (r) => { setSignal(r.signal); setCrisis(r.crisis ? r.helplines : null); };

  const pickMood = async (score) => {
    setMood(score);
    setError("");
    try { setSignal((await sendMood(score)).data.signal); await load(query); } catch { setError("Could not save your mood. Please try again."); }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing && selected) {
        const r = await updateJournal(selected.id, text);
        handleResult(r);
        setSelected(r.entry);
        setEditing(false);
      } else {
        handleResult(await addJournal({ mode: "text", text }));
      }
      setText("");
      await load(query);
    } catch {
      setError("Could not save your entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm("Delete this entry? This cannot be undone.")) return;
    try {
      const r = await deleteJournal(selected.id);
      setSignal(r.signal);
      setSelected(null);
      setEditing(false);
      await load(query);
    } catch {
      setError("Could not delete that entry.");
    }
  };

  const startEdit = () => { setText(selected.text); setEditing(true); };
  const newEntry = () => { setSelected(null); setEditing(false); setText(""); };
  const filtering = Boolean(query || date);
  const writing = !selected || editing;
  const shownDate = selected && !editing ? new Date(selected.created_at) : new Date();
  const selectedMood = selected ? moodByDay[dayKey(selected.created_at)] : undefined;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title={`${greeting()}${firstName ? ", " + firstName : ""}`} subtitle="Your private journal. Only you can read what you write here." />

      <div className="flex flex-wrap gap-2">
        <Link to="/app/journal/month"><Button variant="soft" size="sm"><CalendarDaysIcon size={14} /> Month view</Button></Link>
        <Button variant="outline" size="sm" onClick={() => setShowStyle((v) => !v)}><PaletteIcon size={14} /> Customise</Button>
      </div>
      {showStyle && (
        <Card padding="md">
          <p className="text-sm font-semibold text-charcoal mb-2">Font</p>
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <button key={f.id} onClick={() => setStyle({ ...style, font: f.id })} aria-pressed={style.font === f.id}
                style={{ fontFamily: f.css }}
                className={cn("rounded-xl border-2 px-3 py-1.5 text-sm", style.font === f.id ? "border-brand-500 bg-brand-50" : "border-black/10 hover:border-brand-200")}>{f.label}</button>
            ))}
          </div>
          <p className="text-sm font-semibold text-charcoal mt-4 mb-2">Page colour</p>
          <div className="flex flex-wrap gap-2">
            {PAGES.map((p) => (
              <button key={p.id} onClick={() => setStyle({ ...style, page: p.id })} aria-pressed={style.page === p.id} aria-label={p.label} title={p.label}
                style={{ backgroundColor: p.color }}
                className={cn("w-9 h-9 rounded-full border-2", style.page === p.id ? "border-brand-500" : "border-black/10")} />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-charcoal-muted">Saved in this browser only.</p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 text-sm" aria-label="Journal summary">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 font-semibold px-3 py-1.5">
          <FlameIcon size={14} /> {streak > 0 ? `${streak} day${streak > 1 ? "s" : ""} in a row` : "Start a streak today"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] text-charcoal-light px-3 py-1.5">{weekCount} this week</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] text-charcoal-light px-3 py-1.5">
          <BookOpenIcon size={14} /> {allEntries.length} {allEntries.length === 1 ? "entry" : "entries"} in total
        </span>
      </div>

      <Card padding="lg">
        <p className="text-sm font-semibold text-charcoal mb-3">How are you feeling today?</p>
        <div className="grid grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-label="Mood">
          {MOODS.map((m) => (
            <button
              key={m.score}
              role="radio"
              aria-checked={mood === m.score}
              onClick={() => pickMood(m.score)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl py-3 border-2 transition-all",
                mood === m.score ? "border-brand-500 bg-brand-50 scale-[1.03]" : "border-black/[0.05] bg-white hover:border-brand-200"
              )}
            >
              <span className="text-2xl sm:text-3xl">{m.emoji}</span>
              <span className="text-[11px] sm:text-xs font-semibold text-charcoal">{m.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {crisis && <CrisisCard helplines={crisis} />}
      {signal && !crisis && (
        <div className="flex items-start gap-2 rounded-2xl bg-sage-light px-4 py-3 text-sm text-emerald-800">
          <SparklesIcon size={15} className="mt-0.5 shrink-0" />
          <div>
            <p>{RESPONSE[signal.label]}</p>
            <Link to="/app/wellbeing" className="mt-1 inline-block font-semibold underline">See your wellbeing</Link>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Past entries: search + date filter, grouped by day with that day's mood */}
        <Card padding="md" className="lg:col-span-1 flex flex-col max-h-[36rem]">
          <div className="relative">
            <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your entries"
              aria-label="Search entries"
              className="w-full rounded-xl border border-black/10 bg-cream/50 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Filter by date"
              className="flex-1 rounded-xl border border-black/10 bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            {filtering && (
              <button onClick={() => { setQuery(""); setDate(""); }} className="text-xs font-semibold text-brand-600 flex items-center gap-1">
                <XIcon size={12} /> Clear
              </button>
            )}
          </div>

          <Button variant="soft" size="sm" className="mt-3" onClick={newEntry}>
            <PlusIcon size={14} /> New entry
          </Button>

          <div className="mt-3 overflow-y-auto flex-1 -mx-1 px-1">
            {groups.length === 0 ? (
              <p className="text-sm text-charcoal-muted py-6 text-center">
                {filtering ? "No entries match." : "No entries yet. Your first page is waiting."}
              </p>
            ) : groups.map((g) => (
              <div key={g.key} className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mb-1 flex items-center gap-1.5">
                  {g.label} {moodByDay[g.key] !== undefined && <span className="text-sm normal-case" title="Your mood that day">{moodEmoji(moodByDay[g.key])}</span>}
                </p>
                <ul className="space-y-1">
                  {g.items.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => { setSelected(e); setEditing(false); }}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-2 text-sm transition-colors",
                          selected?.id === e.id ? "bg-brand-50 text-charcoal" : "hover:bg-black/[0.03] text-charcoal-light"
                        )}
                      >
                        <span className="block text-[11px] text-charcoal-muted">{timeLabel(e.created_at)}</span>
                        {snippet(e.text)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        {/* The page: reads like a journal page, dated, with a prompt when blank */}
        <Card padding="lg" className="lg:col-span-2" style={{ backgroundColor: pageColor }}>
          <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] pb-3">
            <div>
              <p className="font-bold text-charcoal text-lg">{longDate(shownDate)}</p>
              <p className="text-xs text-charcoal-muted">
                {selected && !editing ? `Written at ${timeLabel(selected.created_at)}` : editing ? "Editing this entry" : "A new page"}
                {selected && !editing && selectedMood !== undefined && <span> · Mood that day {moodEmoji(selectedMood)}</span>}
              </p>
            </div>
            {selected && !editing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={startEdit}><PencilIcon size={14} /> Edit</Button>
                <Button variant="outline" size="sm" onClick={remove}><Trash2Icon size={14} /> Delete</Button>
              </div>
            )}
          </div>

          {writing ? (
            <>
              {!editing && (
                <div className="mt-4 flex items-start justify-between gap-3">
                  <p className="italic text-charcoal-light">{PROMPTS[promptIdx]}</p>
                  <button onClick={() => setPromptIdx((i) => (i + 1) % PROMPTS.length)} className="text-xs font-semibold text-brand-600 flex items-center gap-1 shrink-0" aria-label="Another prompt">
                    <ShuffleIcon size={12} /> Another
                  </button>
                </div>
              )}
              <textarea
                rows={11}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Start writing…"
                aria-label="Journal entry"
                style={{ fontFamily }}
                className="mt-3 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3.5 text-[15px] leading-7 text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"
              />
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Button onClick={save} disabled={!text.trim() || saving}>
                  <SaveIcon size={16} /> {saving ? "Saving…" : editing ? "Save changes" : "Save"}
                </Button>
                {editing ? (
                  <Button variant="outline" onClick={() => { setEditing(false); setText(""); }}>Cancel</Button>
                ) : (
                  <Button variant="outline" onClick={dictate} disabled={listening}>
                    <MicIcon size={16} className={listening ? "text-brand-500 animate-pulse" : ""} /> {listening ? "Listening…" : "Speak"}
                  </Button>
                )}
                <span className="ml-auto text-xs text-charcoal-muted">{words(text)} words</span>
              </div>
              <div>
                <p className="mt-2 text-[11px] text-charcoal-muted">Speak uses your browser's speech recognition. Depending on the browser, your audio may be processed by the browser provider. Typing keeps everything on ThriveU.</p>
              </div>
            </>
          ) : (
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-charcoal" style={{ fontFamily }}>{selected.text}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
