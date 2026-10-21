import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MicIcon,
  SaveIcon,
  CalendarDaysIcon,
  PaletteIcon,
  SparklesIcon,
  SearchIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
  PencilIcon,
  FlameIcon,
  ShuffleIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CheckIcon,
  HeartIcon,
  StarIcon,
  BookmarkIcon,
  ArrowRightIcon,
  AlignLeftIcon,
  SlidersHorizontalIcon,
  Maximize2Icon,
  Minimize2Icon,
  PenToolIcon,
} from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { useAuth } from "../../../shared/context/AuthContext";
import { CrisisCard } from "../components/CrisisCard";
import { useJournalStyle, FONTS, PAGES, TEXTURES } from "../journalStyle";
import { InteractiveTipModal } from "../components/InteractiveTipModal";
import {
  addJournal,
  sendMood,
  listJournal,
  deleteJournal,
  updateJournal,
  moodHistory,
} from "../api";

const MOODS = [
  { label: "Struggling", score: 1 },
  { label: "Heavy", score: 2 },
  { label: "Steady", score: 3 },
  { label: "Good", score: 4 },
  { label: "Inspired", score: 5 },
];

const moodLabel = (avg) =>
  avg <= 1.5 ? "Struggling" : avg <= 2.5 ? "Heavy" : avg <= 3.5 ? "Steady" : avg <= 4.5 ? "Good" : "Inspired";

// Clean Feeling Tags to help kickstart self-reflection (no emojis)
const FEELING_TAGS = [
  { id: "grateful", label: "Grateful" },
  { id: "overwhelmed", label: "Overwhelmed" },
  { id: "energized", label: "Energized" },
  { id: "exhausted", label: "Exhausted" },
  { id: "focused", label: "Focused" },
  { id: "anxious", label: "Anxious" },
  { id: "peaceful", label: "Peaceful" },
  { id: "resilient", label: "Resilient" },
  { id: "hopeful", label: "Hopeful" },
];

// Mood-Adaptive Prompts: tailored to the student's emotional state
const ADAPTIVE_PROMPTS = {
  // Low or struggling (scores 1 & 2)
  low: [
    "What is one expectation you can gently give yourself permission to release tonight?",
    "Where in your body are you holding the most tension right now?",
    "What is one small comfort that could make the next hour feel a little lighter?",
    "If a close friend were having your exact week, what compassionate words would you tell them?",
    "What felt heaviest today, and who is someone you could lean on even a little?",
  ],
  // Steady or okay (score 3 or default)
  steady: [
    "What took the biggest share of your energy and focus today?",
    "What is one thing that went better or smoother than you anticipated?",
    "What is something quietly resting on your mind that you haven't spoken out loud?",
    "What do you need more of tomorrow? What do you need less of?",
    "Describe today in three simple words, then reflect on why they fit.",
    "What are you quietly looking forward to in the coming days?",
  ],
  // Good or inspired (scores 4 & 5)
  high: [
    "What energized or sparked your curiosity most today?",
    "What progress or small breakthrough are you proud of this week?",
    "Who or what brought an unexpected moment of warmth or joy to your day?",
    "How can you protect and build upon the positive momentum you have right now?",
    "What is something you learned about yourself during today's focus?",
  ],
};

const RESPONSE = {
  low: "Thank you for checking in. Your wellbeing rhythm looks steady right now.",
  moderate: "Things seem to have felt heavier lately. Remember that resting is productive.",
  elevated: "This stretch looks demanding. ThriveU is easing your schedule so you can recharge.",
};

const STARRED_KEY = "thriveu.journal.starred";
function readStarred() {
  try {
    return JSON.parse(localStorage.getItem(STARRED_KEY) || "[]");
  } catch {
    return [];
  }
}

const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA");
const todayKey = () => new Date().toLocaleDateString("en-CA");
const dayLabel = (iso) => {
  const d = new Date(iso);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (dayKey(iso) === todayKey()) return "Today";
  if (dayKey(iso) === yest.toLocaleDateString("en-CA")) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

const longDate = (d = new Date()) =>
  d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const snippet = (t) => (t.length > 75 ? t.slice(0, 75).trim() + "…" : t);
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

function streakOf(entries) {
  const days = new Set(entries.map((e) => dayKey(e.created_at)));
  const d = new Date();
  if (!days.has(d.toLocaleDateString("en-CA"))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toLocaleDateString("en-CA"))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export default function JournalPage() {
  const { user } = useAuth();
  const firstName = (user?.full_name || "").trim().split(" ")[0];

  const [entries, setEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [moods, setMoods] = useState([]);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [activeTags, setActiveTags] = useState([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [signal, setSignal] = useState(null);
  const [crisis, setCrisis] = useState(null);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showStyle, setShowStyle] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Personalized journal features
  const [starred, setStarred] = useState(readStarred);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [reflectionMode, setReflectionMode] = useState("guided"); // "guided" | "freeflow"
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [customTitleInput, setCustomTitleInput] = useState("");

  const {
    style,
    setStyle,
    fontFamily,
    pageColor,
    pageBorder,
    ribbonColor,
    texture,
    journalTitle,
    setJournalTitle,
  } = useJournalStyle();

  const defaultTitle = firstName ? `${firstName}'s Reflection Journal` : "Personal Reflection Journal";
  const displayTitle = journalTitle || defaultTitle;

  const load = useCallback(
    (q) =>
      Promise.all([listJournal(q), listJournal(""), moodHistory()])
        .then(([filtered, all, m]) => {
          setEntries(filtered);
          setAllEntries(all);
          setMoods(m);
        })
        .catch(() => setError("Could not load your entries.")),
    []
  );

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const toggleStar = (id) => {
    setStarred((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      try {
        localStorage.setItem(STARRED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSaveTitle = () => {
    if (customTitleInput.trim()) {
      setJournalTitle(customTitleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const moodByDay = useMemo(() => {
    const acc = {};
    moods.forEach((m) => {
      const k = dayKey(m.created_at);
      (acc[k] ||= []).push(m.mood);
    });
    return Object.fromEntries(
      Object.entries(acc).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])
    );
  }, [moods]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (date) list = list.filter((e) => dayKey(e.created_at) === date);
    if (showStarredOnly) list = list.filter((e) => starred.includes(e.id));
    return list;
  }, [entries, date, showStarredOnly, starred]);

  const groups = useMemo(() => {
    const out = [];
    filteredEntries.forEach((e) => {
      const k = dayKey(e.created_at);
      if (!out.length || out[out.length - 1].key !== k) {
        out.push({ key: k, label: dayLabel(e.created_at), items: [] });
      }
      out[out.length - 1].items.push(e);
    });
    return out;
  }, [filteredEntries]);

  const streak = useMemo(() => streakOf(allEntries), [allEntries]);
  const weekCount = useMemo(
    () => allEntries.filter((e) => Date.now() - new Date(e.created_at) < 7 * 864e5).length,
    [allEntries]
  );
  const totalWordsWritten = useMemo(
    () => allEntries.reduce((sum, e) => sum + words(e.text), 0),
    [allEntries]
  );

  // Active prompt bucket based on currently selected mood
  const currentPrompts = useMemo(() => {
    if (!mood || mood === 3) return ADAPTIVE_PROMPTS.steady;
    if (mood <= 2) return ADAPTIVE_PROMPTS.low;
    return ADAPTIVE_PROMPTS.high;
  }, [mood]);

  const activePrompt = currentPrompts[promptIdx % currentPrompts.length];

  const shufflePrompt = () => {
    setPromptIdx((i) => (i + 1) % currentPrompts.length);
  };

  const insertPromptToText = () => {
    if (!activePrompt) return;
    setText((prev) => (prev ? `${prev}\n\n[Prompt: ${activePrompt}]\n` : `[Prompt: ${activePrompt}]\n`));
  };

  const toggleTag = (label) => {
    setActiveTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  // Voice recognition mode (SpeechRecognition Web API)
  const dictate = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Voice input is not supported in this browser.");
    const r = new SR();
    r.onresult = (e) => setText((t) => (t + " " + e.results[0][0].transcript).trim());
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  const handleResult = (r) => {
    setSignal(r.signal);
    setCrisis(r.crisis ? r.helplines : null);
  };

  const pickMood = async (score) => {
    setMood(score);
    setError("");
    setPromptIdx(0);
    try {
      const res = await sendMood(score);
      setSignal(res.data?.signal);
      await load(query);
    } catch {
      setError("Could not record your mood. Please try again.");
    }
  };

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError("");

    // Append active feeling tags if any
    let finalContent = text.trim();
    if (activeTags.length > 0 && !finalContent.includes("[Feelings:")) {
      finalContent = `${finalContent}\n\n[Feelings: ${activeTags.join(", ")}]`;
    }

    try {
      if (editing && selected) {
        const r = await updateJournal(selected.id, finalContent);
        handleResult(r);
        setSelected(r.entry);
        setEditing(false);
      } else {
        const r = await addJournal({ mode: "text", text: finalContent });
        handleResult(r);
      }
      setText("");
      setActiveTags([]);
      await load(query);
    } catch {
      setError("Could not save your entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm("Permanently delete this reflection? This cannot be undone.")) return;
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

  const startEdit = () => {
    setText(selected.text);
    setEditing(true);
  };

  const newEntry = () => {
    setSelected(null);
    setEditing(false);
    setText("");
    setActiveTags([]);
  };

  const filtering = Boolean(query || date || showStarredOnly);
  const writing = !selected || editing;
  const shownDate = selected && !editing ? new Date(selected.created_at) : new Date();
  const selectedMood = selected ? moodByDay[dayKey(selected.created_at)] : undefined;
  const wordCount = words(text);

  const wordCommentary =
    wordCount === 0
      ? "Take a deep breath and begin whenever you are ready."
      : wordCount < 30
      ? "A mindful spark captured."
      : wordCount < 80
      ? "A genuine reflection unfolding."
      : "In your deep reflection flow.";

  // Dynamic tactile notebook textures
  const textureStyle = useMemo(() => {
    if (texture === "lined") {
      return {
        backgroundImage:
          "repeating-linear-gradient(transparent, transparent 31px, rgba(0,0,0,0.06) 31px, rgba(0,0,0,0.06) 32px)",
        backgroundAttachment: "local",
      };
    }
    if (texture === "dots") {
      return {
        backgroundImage: "radial-gradient(rgba(0,0,0,0.08) 1.5px, transparent 1.5px)",
        backgroundSize: "22px 22px",
        backgroundAttachment: "local",
      };
    }
    return { backgroundImage: "none" };
  }, [texture]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Sanctuary Banner with Custom Journal Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted">
              Personal Sanctuary · Volume 1
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="Name your journal..."
                  autoFocus
                  className="text-xl sm:text-2xl font-serif font-bold text-charcoal bg-white rounded-xl border border-brand-400 px-3 py-1 outline-none shadow-sm"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                  title="Save title"
                >
                  <CheckIcon size={16} />
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1.5 rounded-lg text-charcoal-muted hover:text-charcoal"
                >
                  <XIcon size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal tracking-tight">
                  {displayTitle}
                </h1>
                <button
                  onClick={() => {
                    setCustomTitleInput(displayTitle);
                    setIsEditingTitle(true);
                  }}
                  className="opacity-40 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-black/[0.05] text-charcoal-muted"
                  title="Rename your journal"
                >
                  <PencilIcon size={14} />
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-charcoal-muted mt-1">
            A quiet refuge for personal truth, learning, and self-compassion. Encrypted & visible only to you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-1.5 bg-white border-black/10 shadow-soft text-brand-700 hover:text-brand-800"
          >
            <SparklesIcon size={14} className="text-brand-600" /> Mindful Activities
          </Button>
          <Link to="/app/journal/month">
            <Button variant="soft" size="sm" className="gap-1.5 bg-white shadow-soft">
              <CalendarDaysIcon size={14} /> Month View
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStyle((v) => !v)}
            className="gap-1.5 bg-white border-black/10 shadow-soft"
          >
            <PaletteIcon size={14} /> Customise Notebook
          </Button>
        </div>
      </div>

      {/* Style & Atmosphere Customizer */}
      <AnimatePresence>
        {showStyle && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card padding="md" className="bg-white/95 border-brand-200/50 shadow-card">
              <div className="flex items-center justify-between mb-3 border-b border-black/[0.05] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal flex items-center gap-1.5">
                  <SlidersHorizontalIcon size={13} /> Notebook Cover, Paper & Texture
                </span>
                <button
                  onClick={() => setShowStyle(false)}
                  className="text-xs text-charcoal-muted hover:text-charcoal"
                >
                  Close
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-5">
                {/* Font selection */}
                <div>
                  <p className="text-xs font-semibold text-charcoal mb-2">Typography</p>
                  <div className="flex flex-col gap-1.5">
                    {FONTS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setStyle({ ...style, font: f.id })}
                        style={{ fontFamily: f.css }}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-1.5 text-sm transition-all border",
                          style.font === f.id
                            ? "border-brand-500 bg-brand-50 font-bold text-brand-900"
                            : "border-black/5 bg-cream/30 hover:border-brand-200 text-charcoal"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paper Tint selection */}
                <div>
                  <p className="text-xs font-semibold text-charcoal mb-2">Paper Color</p>
                  <div className="grid grid-cols-5 gap-2">
                    {PAGES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setStyle({ ...style, page: p.id })}
                        title={p.label}
                        aria-label={p.label}
                        style={{ backgroundColor: p.color }}
                        className={cn(
                          "h-12 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm",
                          style.page === p.id
                            ? "border-brand-500 scale-105 ring-2 ring-brand-300/40"
                            : "border-black/10 hover:border-brand-200"
                        )}
                      >
                        {style.page === p.id && <CheckCircle2Icon size={16} className="text-brand-600" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-charcoal-muted mt-2">
                    Active page: {PAGES.find((p) => p.id === style.page)?.label || "Warm Cream"}
                  </p>
                </div>

                {/* Page Ruling / Texture Option */}
                <div>
                  <p className="text-xs font-semibold text-charcoal mb-2">Page Ruling / Texture</p>
                  <div className="flex flex-col gap-1.5">
                    {TEXTURES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setStyle({ ...style, texture: t.id })}
                        className={cn(
                          "w-full rounded-xl px-3 py-2 border text-left text-xs font-semibold transition-all flex items-center justify-between",
                          texture === t.id
                            ? "border-brand-500 bg-brand-50 text-brand-900"
                            : "border-black/10 bg-cream/30 hover:border-brand-200 text-charcoal"
                        )}
                      >
                        <span>{t.label}</span>
                        {texture === t.id && <CheckIcon size={14} className="text-brand-600" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-charcoal-muted mt-2">Saved safely in your browser.</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gentle Streaks & Consistency Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white/70 p-3 rounded-2xl border border-black/[0.04]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft/20 text-amber-900 font-semibold px-3 py-1 shadow-xs">
            <FlameIcon size={14} className="text-amber-600" />
            {streak > 0 ? `${streak}-day reflection streak` : "Start a streak today"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200/60 text-charcoal px-3 py-1 font-medium">
            <BookOpenIcon size={13} className="text-brand-600" /> {allEntries.length} reflections recorded
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200/60 text-charcoal-light px-3 py-1">
            <PenToolIcon size={12} className="text-charcoal-muted" /> {totalWordsWritten.toLocaleString()} words written
          </span>
        </div>

        {starred.length > 0 && (
          <button
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-colors",
              showStarredOnly
                ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                : "bg-cream-200/60 text-charcoal hover:bg-cream-200"
            )}
          >
            <StarIcon size={13} className={showStarredOnly ? "fill-amber-500 text-amber-500" : "text-amber-600"} />
            {starred.length} {starred.length === 1 ? "Starred moment" : "Starred moments"}
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {crisis && <CrisisCard helplines={crisis} />}

      {signal && !crisis && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl bg-gradient-to-r from-sage-light to-brand-50 px-4 py-3 text-sm text-emerald-900 border border-sage/40 shadow-xs"
        >
          <SparklesIcon size={16} className="mt-0.5 shrink-0 text-emerald-700" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{RESPONSE[signal.label] || "Reflection saved safely."}</p>
          </div>
          <Link to="/app/wellbeing" className="text-xs font-bold text-emerald-800 underline shrink-0">
            View Wellbeing Pulse
          </Link>
        </motion.div>
      )}

      {/* Main Journal Workspace: Left Entries List (1 Col) & Right Notebook Canvas (2 Cols) */}
      <div className={cn("grid gap-6", zenMode ? "grid-cols-1 max-w-4xl mx-auto" : "lg:grid-cols-3")}>
        {/* Left Column: Past Reflections Archive (collapsible in Zen Mode) */}
        {!zenMode && (
          <Card padding="md" className="lg:col-span-1 flex flex-col max-h-[44rem] border-black/[0.04] shadow-soft">
            <div className="relative mb-2">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reflections..."
                aria-label="Search entries"
                className="w-full rounded-xl border border-black/10 bg-cream/40 pl-9 pr-3 py-2 text-xs outline-none focus:border-brand-400 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 mb-2.5">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Filter by date"
                className="flex-1 rounded-xl border border-black/10 bg-cream/40 px-3 py-1.5 text-xs outline-none focus:border-brand-400 focus:bg-white"
              />
              {filtering && (
                <button
                  onClick={() => {
                    setQuery("");
                    setDate("");
                    setShowStarredOnly(false);
                  }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 shrink-0"
                >
                  <XIcon size={12} /> Clear
                </button>
              )}
            </div>

            {/* Filter Pill: All vs Starred */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-cream/50 border border-black/[0.04] mb-3">
              <button
                onClick={() => setShowStarredOnly(false)}
                className={cn(
                  "flex-1 py-1 rounded-lg text-xs font-semibold transition-all text-center",
                  !showStarredOnly ? "bg-white text-charcoal shadow-xs" : "text-charcoal-muted hover:text-charcoal"
                )}
              >
                All ({entries.length})
              </button>
              <button
                onClick={() => setShowStarredOnly(true)}
                className={cn(
                  "flex-1 py-1 rounded-lg text-xs font-semibold transition-all text-center flex items-center justify-center gap-1",
                  showStarredOnly ? "bg-white text-amber-900 shadow-xs" : "text-charcoal-muted hover:text-charcoal"
                )}
              >
                <StarIcon size={12} className={showStarredOnly ? "fill-amber-500 text-amber-500" : "text-amber-500"} />
                Starred ({allEntries.filter((e) => starred.includes(e.id)).length})
              </button>
            </div>

            <Button
              variant="soft"
              size="sm"
              onClick={newEntry}
              className="w-full justify-center gap-1.5 bg-brand-50 text-brand-800 hover:bg-brand-100 shadow-xs"
            >
              <PlusIcon size={14} /> Blank Page
            </Button>

            <div className="mt-3 overflow-y-auto flex-1 -mx-1 px-1 divide-y divide-black/[0.03]">
              {groups.length === 0 ? (
                <div className="py-12 text-center text-xs text-charcoal-muted">
                  {showStarredOnly
                    ? "No starred reflections yet. Click the star on any entry you want to remember."
                    : filtering
                    ? "No entries match your search."
                    : "No entries yet. Your story begins today."}
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.key} className="py-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mb-1.5 flex items-center justify-between">
                      <span>{g.label}</span>
                      {moodByDay[g.key] !== undefined && (
                        <span className="text-[10px] font-semibold text-charcoal-light bg-black/[0.03] px-1.5 py-0.5 rounded">
                          {moodLabel(moodByDay[g.key])}
                        </span>
                      )}
                    </p>
                    <ul className="space-y-1">
                      {g.items.map((e) => {
                        const isStarred = starred.includes(e.id);
                        return (
                          <li key={e.id}>
                            <button
                              onClick={() => {
                                setSelected(e);
                                setEditing(false);
                              }}
                              className={cn(
                                "group relative w-full text-left rounded-xl p-2.5 text-xs transition-all duration-150 border",
                                selected?.id === e.id
                              ? "bg-brand-50 border-brand-300 text-charcoal shadow-sm"
                              : "border-transparent hover:bg-cream/50 text-charcoal-light"
                              )}
                            >
                              <div className="flex items-center justify-between text-[10px] text-charcoal-muted mb-1">
                                <span>{timeLabel(e.created_at)}</span>
                                <div className="flex items-center gap-1.5">
                                  <span>{words(e.text)} words</span>
                                  {isStarred && (
                                    <StarIcon size={11} className="fill-amber-400 text-amber-500" />
                                  )}
                                </div>
                              </div>
                              <p className="line-clamp-2 leading-relaxed text-charcoal">{snippet(e.text)}</p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Right Column: The Sacred Notebook Canvas */}
        <div className={zenMode ? "w-full" : "lg:col-span-2"}>
          <Card
            padding="lg"
            className="border shadow-card relative overflow-hidden transition-all duration-200"
            style={{
              backgroundColor: pageColor,
              borderColor: pageBorder || "rgba(0,0,0,0.06)",
            }}
          >
            {/* Tactile Bookmark Ribbon Hanging from Top */}
            <div
              className="absolute top-0 right-10 w-5 h-8 rounded-b-md shadow-xs pointer-events-none z-10"
              style={{ backgroundColor: ribbonColor || "#2E9C88" }}
            />

            {/* Notebook Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] pb-3.5">
              <div>
                <p className="font-serif font-bold text-charcoal text-xl tracking-tight">
                  {longDate(shownDate)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal-muted mt-0.5">
                  <span>
                    {selected && !editing
                      ? `Penned at ${timeLabel(selected.created_at)}`
                      : editing
                      ? "Editing reflection"
                      : "Fresh Entry"}
                  </span>
                  {selected && !editing && selectedMood !== undefined && (
                    <span className="font-semibold text-charcoal">
                      · Day felt: {moodLabel(selectedMood)}
                    </span>
                  )}
                  {selected && !editing && (
                    <span>· {words(selected.text)} words</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Zen Focus Mode Toggle */}
                <button
                  onClick={() => setZenMode(!zenMode)}
                  className="p-1.5 rounded-xl border border-black/10 bg-white/70 hover:bg-white text-charcoal-muted hover:text-charcoal transition-colors shadow-xs"
                  title={zenMode ? "Exit Zen Mode" : "Focus / Zen Mode"}
                >
                  {zenMode ? <Minimize2Icon size={15} /> : <Maximize2Icon size={15} />}
                </button>

                {selected && !editing && (
                  <>
                    <button
                      onClick={() => toggleStar(selected.id)}
                      className={cn(
                        "p-1.5 rounded-xl border transition-colors shadow-xs",
                        starred.includes(selected.id)
                          ? "bg-amber-50 border-amber-300 text-amber-600"
                          : "border-black/10 bg-white/70 hover:bg-white text-charcoal-muted"
                      )}
                      title={starred.includes(selected.id) ? "Unstar reflection" : "Star reflection"}
                    >
                      <StarIcon
                        size={15}
                        className={starred.includes(selected.id) ? "fill-amber-400 text-amber-500" : ""}
                      />
                    </button>
                    <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5 bg-white/80">
                      <PencilIcon size={13} /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={remove}
                      className="gap-1.5 text-red-700 hover:bg-red-50 hover:border-red-200 bg-white/80"
                    >
                      <Trash2Icon size={13} /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>

            {writing ? (
              <div className="mt-4 space-y-4">
                {/* Reflection Mode Switcher & Inline Mood Stamp */}
                {!editing && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    {/* Mode Toggle: Guided vs Freeflow */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/70 border border-black/[0.05] w-fit shadow-xs">
                      <button
                        onClick={() => setReflectionMode("guided")}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                          reflectionMode === "guided"
                            ? "bg-brand-500 text-white shadow-xs"
                            : "text-charcoal-muted hover:text-charcoal"
                        )}
                      >
                        Guided Prompts
                      </button>
                      <button
                        onClick={() => setReflectionMode("freeflow")}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                          reflectionMode === "freeflow"
                            ? "bg-brand-500 text-white shadow-xs"
                            : "text-charcoal-muted hover:text-charcoal"
                        )}
                      >
                        Free Writing Stream
                      </button>
                    </div>

                    {/* Quick Mood Stamp */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-charcoal-muted mr-1">Today's state:</span>
                      {MOODS.map((m) => (
                        <button
                          key={m.score}
                          onClick={() => pickMood(m.score)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                            mood === m.score
                              ? "bg-brand-500 text-white border-brand-500 shadow-xs"
                              : "bg-white/60 border-black/5 hover:border-brand-200 text-charcoal"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adaptive Prompts Carousel (Only in Guided Mode) */}
                {!editing && reflectionMode === "guided" && (
                  <div className="p-3.5 rounded-2xl bg-white/70 border border-black/[0.04] space-y-2 shadow-xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-serif font-semibold text-charcoal flex items-center gap-1.5">
                        <SparklesIcon size={14} className="text-brand-500" />
                        Gentle Prompt for You
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={shufflePrompt}
                          className="font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                        >
                          <ShuffleIcon size={12} /> Another
                        </button>
                        <button
                          onClick={insertPromptToText}
                          className="text-[11px] font-medium text-charcoal-light hover:text-brand-700 bg-black/[0.04] px-2 py-0.5 rounded-md"
                        >
                          Use in text
                        </button>
                      </div>
                    </div>
                    <p className="italic font-serif text-sm text-charcoal-light leading-relaxed">
                      "{activePrompt}"
                    </p>
                  </div>
                )}

                {/* Feeling Tag Chips (Only in Guided Mode, Zero Emojis) */}
                {!editing && reflectionMode === "guided" && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mb-1.5">
                      Feeling Tags (tap to tag this entry)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FEELING_TAGS.map((tag) => {
                        const isSelected = activeTags.includes(tag.label);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.label)}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-all",
                              isSelected
                                ? "bg-brand-500 text-white border-brand-500 font-semibold shadow-xs"
                                : "bg-white/70 border-black/5 hover:border-brand-200 text-charcoal"
                            )}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* The Writing Area with Tactile Ruling & Custom Typography */}
                <div className="relative">
                  <textarea
                    rows={zenMode ? 16 : 13}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Speak your mind freely. Whatever you feel is valid here..."
                    aria-label="Journal reflection canvas"
                    style={{
                      fontFamily,
                      lineHeight: "2rem",
                      ...textureStyle,
                    }}
                    className="w-full rounded-2xl border border-black/10 bg-white/90 p-4 sm:p-5 text-[15px] text-charcoal placeholder:text-charcoal-muted/70 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none shadow-inner"
                  />
                </div>

                {/* Writing Actions & Sensory Feedback */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Button onClick={save} disabled={!text.trim() || saving} className="gap-2 shadow-sm">
                      <SaveIcon size={15} />
                      {saving ? "Preserving..." : editing ? "Save Changes" : "Record Reflection"}
                    </Button>

                    {editing ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(false);
                          setText("");
                        }}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={dictate}
                        disabled={listening}
                        className={cn(
                          "gap-2 bg-white/80",
                          listening && "border-brand-400 bg-brand-50 text-brand-700"
                        )}
                      >
                        <MicIcon
                          size={15}
                          className={listening ? "text-brand-600 animate-pulse" : "text-charcoal"}
                        />
                        {listening ? "Listening to your voice..." : "Voice Dictation"}
                      </Button>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="block text-xs font-semibold text-charcoal">
                      {wordCount} {wordCount === 1 ? "word" : "words"}
                    </span>
                    <span className="block text-[11px] text-charcoal-muted italic">
                      {wordCommentary}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-charcoal-muted leading-relaxed pt-1">
                  Stored securely in your private database. No other student, lecturer, or component can view your reflections.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div
                  className="whitespace-pre-wrap text-[15px] sm:text-base leading-8 text-charcoal p-2"
                  style={{ fontFamily }}
                >
                  {selected.text}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Interactive Mindful Activities Modal */}
      <InteractiveTipModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        category="reflect"
        onCompleted={() => load(query)}
      />
    </div>
  );
}
