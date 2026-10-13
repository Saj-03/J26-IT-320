import { MicIcon, SquareIcon } from "lucide-react";
import { cn } from "../../../../shared/lib/cn";
import Button from "../CareerButton";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";

// Quick voice self-test before the interview. Each step that turns green shows the chain is working:
// browser support -> microphone starts -> speech is heard -> text comes back from the speech service.
export default function MicCheck() {
  const speech = useSpeechRecognition();
  const text = `${speech.transcript} ${speech.interim}`.trim();
  const steps = [
    { label: "Browser supports voice (Chrome/Edge on localhost)", ok: speech.supported },
    { label: "Microphone started", ok: ["mic-on", "hearing"].includes(speech.stage) || !!text },
    { label: "Your voice is heard", ok: speech.stage === "hearing" || !!text },
    { label: "Speech turned into text", ok: !!text },
  ];

  return (
    <div className="rounded-2xl border border-[#9ADBCC]/60 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-charcoal">Test your microphone first</p>
        {speech.listening ? (
          <Button size="sm" variant="outline" onClick={speech.stop}><SquareIcon size={14} /> Stop test</Button>
        ) : (
          <Button size="sm" variant="soft" onClick={() => { speech.reset(); speech.start(); }} disabled={!speech.supported}>
            <MicIcon size={14} /> Test microphone
          </Button>
        )}
      </div>
      <p className="text-xs text-charcoal-muted">Click Test microphone, allow access, and say a short sentence.</p>
      <ul className="grid sm:grid-cols-2 gap-1.5">
        {steps.map((s) => (
          <li key={s.label} className={cn("text-xs font-semibold rounded-full px-3 py-1",
            s.ok ? "bg-[#C7F2D1] text-[#1F5E3D]" : "bg-black/[0.04] text-charcoal-muted")}>
            {s.ok ? "✓" : "○"} {s.label}
          </li>
        ))}
      </ul>
      {text && <p className="text-sm text-charcoal bg-[#E3FFD6] rounded-xl px-3 py-2">Heard: “{text}”</p>}
      {(speech.error || speech.problem) && (
        <p className="text-xs font-semibold text-red-700 bg-red-50 rounded-xl px-3 py-2">{speech.error || speech.problem}</p>
      )}
      {speech.hint && !speech.error && <p className="text-xs text-[#34477A]">{speech.hint}</p>}
    </div>
  );
}
