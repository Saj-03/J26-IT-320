import { useState } from "react";
import { MicIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { addJournal } from "../api";

export default function JournalPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);

  // Voice mode: browser Web Speech API -> text (no audio is uploaded)
  const dictate = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Voice input is not supported in this browser");
    const r = new SR();
    r.onresult = (e) => setText((t) => t + " " + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  const save = async () => {
    setSaving(true);
    try { setResult(await addJournal({ mode: "text", text })); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Journal" subtitle="Anything on your mind. Only you see what you write." />
      <Card padding="lg">
        <textarea
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anything on your mind…"
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
        {result && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-sage-light px-4 py-3 text-sm text-emerald-800">
            <SparklesIcon size={15} /> Saved. Detected tone: <strong className="capitalize">{result.emotion}</strong>
          </div>
        )}
      </Card>
    </div>
  );
}
