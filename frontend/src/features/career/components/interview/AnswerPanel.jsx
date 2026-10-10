import { useEffect, useState } from "react";
import { MicIcon, SquareIcon, SendIcon, LightbulbIcon, TimerIcon } from "lucide-react";
import { cn } from "../../../../shared/lib/cn";
import Card from "../CareerCard";
import Button from "../CareerButton";
import { ui } from "../../theme";

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Shows one question and collects the answer (typed, or spoken via speech-to-text).
export default function AnswerPanel({ question, index, total, voice, speech, answer, setAnswer, onSubmit, busy, locked }) {
  const [seconds, setSeconds] = useState(0);

  // Simple elapsed-time counter per question (guide: about 2 minutes).
  useEffect(() => {
    setSeconds(0);
    if (locked) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [question.id, locked]);

  const text = voice ? speech.transcript : answer;
  const preview = voice && speech.interim ? `${text} ${speech.interim}`.trim() : text;
  const canSubmit = preview.trim().length > 0 && !busy && !locked;

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold", ui.iconTile)}>
          Question {index + 1} of {total} · {question.category}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-muted">
          <TimerIcon size={14} /> {formatTime(seconds)}
        </span>
      </div>

      <h2 className="text-xl font-extrabold text-charcoal">{question.question}</h2>
      <p className={cn("flex items-start gap-2 text-sm rounded-2xl p-3", ui.highlight, "text-charcoal-light")}>
        <LightbulbIcon size={16} className="mt-0.5 shrink-0 text-[#1F5F53]" /> {question.tip}
      </p>

      {voice && (
        <div className="flex flex-wrap items-center gap-3">
          {speech.listening ? (
            <Button variant="outline" onClick={speech.stop} disabled={locked}>
              <SquareIcon size={16} /> Stop speaking
            </Button>
          ) : (
            <Button onClick={speech.start} disabled={locked || busy}>
              <MicIcon size={16} /> {text ? "Continue speaking" : "Start speaking"}
            </Button>
          )}
          {speech.listening && (
            <span className="flex items-center gap-2 text-sm font-semibold text-[#1F5F53]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> Listening…
            </span>
          )}
          {speech.error && <span className="text-sm font-semibold text-red-600">{speech.error}</span>}
        </div>
      )}

      <textarea
        rows={7}
        value={preview}
        readOnly={locked || (voice && speech.listening)}
        onChange={(e) => (voice ? speech.setTranscript(e.target.value) : setAnswer(e.target.value))}
        placeholder={voice ? "Your spoken answer will appear here. You can correct recognition mistakes after you stop." : "Type your answer as you would say it in an interview…"}
        className="w-full rounded-2xl border border-[#9ADBCC]/60 bg-white px-4 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-[#5DBFA9] focus:ring-2 focus:ring-[#9ADBCC]/40 resize-none"
      />

      {!locked && (
        <Button onClick={() => onSubmit(preview)} disabled={!canSubmit}>
          <SendIcon size={16} /> {busy ? "Evaluating…" : "Submit answer"}
        </Button>
      )}
    </Card>
  );
}
