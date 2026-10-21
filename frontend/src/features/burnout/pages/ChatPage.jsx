import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SendIcon, SparklesIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { CrisisCard } from "../components/CrisisCard";
import { sendChat, getPreferences, setPreferences } from "../api";

export default function ChatPage() {
  const location = useLocation();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [enabled, setEnabled] = useState(null);       // null = still loading; chat is opt-in
  const [crisis, setCrisis] = useState(null);
  const [knows, setKnows] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (location.state?.prefilled) {
      setInput(location.state.prefilled);
    }
  }, [location.state]);

  useEffect(() => { getPreferences().then((p) => setEnabled(p.chat_enabled)).catch(() => setEnabled(false)); }, []);
  const turnOn = async () => {
    try { setEnabled((await setPreferences({ chat_enabled: true })).chat_enabled); } catch { setError("Could not turn chat on."); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const mine = { role: "user", content: input };
    setMsgs((m) => [...m, mine]);
    setInput("");
    setWaiting(true);
    try {
      const r = await sendChat(mine.content);
      setMsgs((m) => [...m, { role: "assistant", content: r.reply }]);
      setCrisis(r.crisis_flag ? r.helplines : null);
      setKnows(Boolean(r.knows_your_week));
    } catch {
      setError("Could not send that message. Please try again.");
    } finally {
      setWaiting(false);
    }
  };

  if (enabled === false) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader title="Talk it through" subtitle="Optional. You decide." />
        <Card padding="lg">
          <p className="font-bold text-charcoal">Chat is turned off</p>
          <p className="mt-2 text-sm text-charcoal-light leading-relaxed">
            This is a companion you can talk to when you want to. It can use how busy your week is to ask better questions. It is not a therapist and it does not diagnose.
            What you write here stays private to you.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button onClick={turnOn}>Turn on chat</Button>
            <Link to="/app/wellbeing/privacy" className="self-center text-sm font-semibold underline text-brand-600">Privacy and your data</Link>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </Card>
      </div>
    );
  }
  if (enabled === null) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Talk it through" subtitle={knows ? "Using how busy your week is, so it can ask better questions." : "Say as much or as little as you like."} />
      {crisis && <CrisisCard helplines={crisis} />}
      <Card padding="lg" className="flex flex-col">
        <div className="min-h-[320px] max-h-[55vh] overflow-y-auto space-y-3 pr-1">
          {msgs.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <span className="w-14 h-14 rounded-3xl bg-brand-50 text-brand-500 flex items-center justify-center mb-3">
                <SparklesIcon size={22} />
              </span>
              <p className="font-bold text-charcoal">How is this week going?</p>
              <p className="text-sm text-charcoal-muted mt-1">Say as much or as little as you like.</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <p className={cn(
                "max-w-[80%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user" ? "bg-brand-500 text-white rounded-br-lg" : "bg-cream text-charcoal rounded-bl-lg"
              )}>
                {m.content}
              </p>
            </div>
          ))}
          {waiting && <p className="text-xs font-semibold text-charcoal-muted animate-pulse">Typing…</p>}
        </div>

        <form onSubmit={send} className="flex items-center gap-2 mt-4 bg-cream rounded-full pl-4 pr-1.5 py-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-charcoal-muted text-charcoal"
          />
          <Button type="submit" size="sm" disabled={waiting || !input.trim()} aria-label="Send">
            <SendIcon size={15} />
          </Button>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-red-600 text-center">{error}</p>}
        <p className="text-xs text-charcoal-muted mt-3 text-center">Not a therapist and not a diagnosis. <Link to="/app/wellbeing/privacy" className="underline">Privacy</Link></p>
      </Card>
    </div>
  );
}
