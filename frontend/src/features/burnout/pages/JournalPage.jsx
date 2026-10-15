import { useState } from "react";
import { Link } from "react-router-dom";
import { MicIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { addJournal, sendMood } from "../api";

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

export default function JournalPage() {
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [signal, setSignal] = useState(null);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    } catch {
      setError("Could not save your entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="How are you today?" subtitle="Tap how you feel, then write anything on your mind. Only you see what you write." />

      <Card padding="lg">
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

        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anything on your mind…"
          className="mt-5 w-full rounded-2xl border border-black/10 bg-cream/50 px-4 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"
        />
        <div className="flex flex-wrap gap-3 mt-4">
          <Button onClick={save} disabled={!text.trim() || saving}>
            <SaveIcon size={16} /> {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" onClick={dictate} disabled={listening}>
            <MicIcon size={16} className={listening ? "text-brand-500 animate-pulse" : ""} /> {listening ? "Listening…" : "Speak"}
          </Button>
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        {signal && (
          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-sage-light px-4 py-3 text-sm text-emerald-800">
            <SparklesIcon size={15} className="mt-0.5 shrink-0" />
            <div>
              <p>{RESPONSE[signal.label]}</p>
              <Link to="/app/wellbeing" className="mt-1 inline-block font-semibold underline">See your wellbeing</Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
