import { useEffect, useState } from "react";
import { ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { getPreferences, setPreferences, deleteMyData } from "../api";

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="font-semibold text-charcoal">{label}</p>
        <p className="text-sm text-charcoal-muted mt-0.5">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative w-12 h-7 rounded-full transition-colors shrink-0", checked ? "bg-brand-500" : "bg-black/15")}
      >
        <span className={cn("absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export default function PrivacySettings() {
  const [prefs, setPrefs] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { getPreferences().then(setPrefs).catch(() => setError("Could not load your settings.")); }, []);

  const change = async (patch) => {
    setError(""); setMsg("");
    try { setPrefs(await setPreferences(patch)); setMsg("Saved."); } catch { setError("Could not save that change."); }
  };

  const erase = async () => {
    if (!window.confirm("Delete all your journal entries, chat, mood check-ins and wellbeing signals? This cannot be undone.")) return;
    setError(""); setMsg("");
    try { await deleteMyData(); setMsg("Everything has been deleted."); } catch { setError("Could not delete your data."); }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="Privacy and your data" subtitle="You are in control. Every part of this is optional." />

      <Card padding="lg">
        <div className="flex items-center gap-2 mb-3 text-brand-700 font-bold"><ShieldCheckIcon size={18} /> What is stored, and who sees it</div>
        <ul className="space-y-2 text-sm text-charcoal-light list-disc pl-5">
          <li><strong className="text-charcoal">Your journal and chat</strong> are private to you. No other part of ThriveU, and no teacher, can read them.</li>
          <li><strong className="text-charcoal">Your scheduler</strong> only receives a simple level (low, moderate or elevated) and a trend. Never your words.</li>
          <li><strong className="text-charcoal">Physical wellbeing</strong> only receives whether a lighter, recovery-focused plan may help.</li>
          <li><strong className="text-charcoal">Voice entry</strong> uses your browser's speech recognition. Depending on the browser, audio may be processed by the browser provider. Typing keeps everything on ThriveU.</li>
          <li><strong className="text-charcoal">Tips</strong>: we note whether you tried or dismissed a tip (the tip type only, never your words), to learn which ideas help.</li>
          <li><strong className="text-charcoal">This is not a diagnosis.</strong> It is a pattern compared with your own usual week.</li>
        </ul>
      </Card>

      <Card padding="lg">
        {prefs ? (
          <div className="divide-y divide-black/5">
            <Toggle
              label="Share my level with my scheduler"
              hint="Lets ThriveU ease lower-priority tasks when your week looks heavy. Off means your level stays private to you."
              checked={prefs.share_with_scheduler}
              onChange={(v) => change({ share_with_scheduler: v })}
            />
            <Toggle
              label="Talk-it-through chat"
              hint="An optional companion that can use your task load. It is not a therapist."
              checked={prefs.chat_enabled}
              onChange={(v) => change({ chat_enabled: v })}
            />
          </div>
        ) : !error && <p className="text-sm text-charcoal-muted">Loading…</p>}
        {msg && <p role="status" className="mt-3 text-sm text-emerald-700">{msg}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card padding="lg">
        <p className="font-semibold text-charcoal">Delete my wellbeing data</p>
        <p className="text-sm text-charcoal-muted mt-1">Removes your journal, chat, mood check-ins and wellbeing signals, including the levels sent to other parts of ThriveU.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={erase}><Trash2Icon size={14} /> Delete everything</Button>
      </Card>
    </div>
  );
}
