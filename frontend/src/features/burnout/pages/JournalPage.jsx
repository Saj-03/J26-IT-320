import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MicIcon, SaveIcon, SparklesIcon, SearchIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { addJournal, sendMood, listJournal, deleteJournal } from "../api";

const MOODS = [
  { emoji: "😣", label: "Struggling", score: 1 },
  { emoji: "😕", label: "Low", score: 2 },
  { emoji: "😐", label: "Okay", score: 3 },
  { emoji: "🙂", label: "Good", score: 4 },
  { emoji: "🔥", label: "Motivated", score: 5 },
];

// What the student sees after the signal refreshes: awareness and a next step, never a verdict.
const RESPONSE = {
  low: "Thanks for checking in. Things look steady right now.",
  moderate: "Things seem to have been heavier lately. A short break today could help.",
  elevated: "This stretch looks tough. ThriveU can use this to ease your plan. Be kind to yourself today.",
};

// Dates are shown in the student's own timezone (the API sends UTC).
const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD, local
const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (dayKey(iso) === today.toLocaleDateString("en-CA")) return "Today";
  if (dayKey(iso) === yest.toLocaleDateString("en-CA")) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const snippet = (t) => (t.length > 70 ? t.slice(0, 70).trim() + "…" : t);

export default function JournalPage() {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState(null);   // null = writing a new entry
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [signal, setSignal] = useState(null);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback((q) => listJournal(q).then(setEntries).catch(() => setError("Could not load your entries.")), []);
  useEffect(() => { const t = setTimeout(() => load(query), 250); return () => clearTimeout(t); }, [query, load]);

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

  const pickMood = async (score) => {
    setMood(score);
    setError("");
    try { setSignal((await sendMood(score)).data.signal); } catch { setError("Could not save your mood. Please try again."); }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await addJournal({ mode: "text", text });
      setSignal(r.signal);
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
      await load(query);
    } catch {
      setError("Could not delete that entry.");
    }
  };

  const filtering = Boolean(query || date);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Your journal" subtitle="A private place for your thoughts. Only you can read your entries." />

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
      {signal && (
        <div className="flex items-start gap-2 rounded-2xl bg-sage-light px-4 py-3 text-sm text-emerald-800">
          <SparklesIcon size={15} className="mt-0.5 shrink-0" />
          <div>
            <p>{RESPONSE[signal.label]}</p>
            <Link to="/app/wellbeing" className="mt-1 inline-block font-semibold underline">See your wellbeing</Link>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Entry list: search + date filter + grouped by day */}
        <Card padding="md" className="lg:col-span-1 flex flex-col max-h-[34rem]">
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

          <Button variant="soft" size="sm" className="mt-3" onClick={() => { setSelected(null); setText(""); }}>
            <PlusIcon size={14} /> New entry
          </Button>

          <div className="mt-3 overflow-y-auto flex-1 -mx-1 px-1">
            {groups.length === 0 ? (
              <p className="text-sm text-charcoal-muted py-6 text-center">
                {filtering ? "No entries match." : "No entries yet. Write your first one."}
              </p>
            ) : groups.map((g) => (
              <div key={g.key} className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mb-1">{g.label}</p>
                <ul className="space-y-1">
                  {g.items.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => setSelected(e)}
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

        {/* Reader / writer */}
        <Card padding="lg" className="lg:col-span-2">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-charcoal">{dayLabel(selected.created_at)}</p>
                  <p className="text-xs text-charcoal-muted">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                <Button variant="outline" size="sm" onClick={remove}><Trash2Icon size={14} /> Delete</Button>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-charcoal leading-relaxed">{selected.text}</p>
            </>
          ) : (
            <>
              <p className="font-bold text-charcoal mb-3">New entry</p>
              <textarea
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Anything on your mind…"
                aria-label="New journal entry"
                className="w-full rounded-2xl border border-black/10 bg-cream/50 px-4 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"
              />
              <div className="flex flex-wrap gap-3 mt-4">
                <Button onClick={save} disabled={!text.trim() || saving}>
                  <SaveIcon size={16} /> {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" onClick={dictate} disabled={listening}>
                  <MicIcon size={16} className={listening ? "text-brand-500 animate-pulse" : ""} /> {listening ? "Listening…" : "Speak"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
