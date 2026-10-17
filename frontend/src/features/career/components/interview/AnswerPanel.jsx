import { useEffect, useState } from "react";
import { MicIcon, SquareIcon, SendIcon, LightbulbIcon, TimerIcon, Volume2Icon } from "lucide-react";
import { cn } from "../../../../shared/lib/cn";
import Card from "../CareerCard";
import Button from "../CareerButton";
import { ui } from "../../theme";
import { t } from "../../i18n";

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

// Same range the scorer rewards (interview_evaluator.length_score): under 40 words is too short.
function lengthHint(words) {
  if (words === 0) return { text: t("Aim for about 80-200 words (1-2 minutes)."), tone: "text-charcoal-muted" };
  if (words < 40) return { text: t("{n} words · a bit short - add an example or result", { n: words }), tone: "text-[#34477A]" };
  if (words > 250) return { text: t("{n} words · quite long - try to be more concise", { n: words }), tone: "text-[#34477A]" };
  return { text: t("{n} words · good length", { n: words }), tone: "text-[#1F5E3D]" };
}

const MIC_STAGE = {
  starting: "Starting microphone…", "mic-on": "Microphone on - start speaking", hearing: "Hearing you - words appear below",
};

// Shows one question and collects the answer (typed, or spoken via speech-to-text).
// `interviewer` (optional): { enabled, speaking, read, stop } - the question read aloud by text-to-speech.
export default function AnswerPanel({ question, index, total, voice, speech, answer, setAnswer, onSubmit, busy, locked,
  interviewer }) {
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
  const length = lengthHint(countWords(preview));
  // Translated question: show the English original too, since the answer is given in English.
  const showEnglish = question.question_en && question.question_en !== question.question;

  const startSpeaking = () => {
    interviewer?.stop(); // the microphone must not pick up the interviewer's voice
    speech.start();
  };
  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault();
      onSubmit(preview);
    }
  };

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold", ui.iconTile)}>
          {t("Question {n} of {total}", { n: index + 1, total })} · {t(question.category)}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-muted">
          <TimerIcon size={14} /> {formatTime(seconds)}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-extrabold text-charcoal">{question.question}</h2>
          {showEnglish && (
            <p lang="en" className="mt-1 text-sm font-semibold text-[#34477A]">
              <span className="text-[10px] font-bold uppercase tracking-wide text-charcoal-muted mr-1">English:</span>
              {question.question_en}
            </p>
          )}
        </div>
        {interviewer?.enabled && (
          interviewer.speaking ? (
            <Button size="sm" variant="outline" onClick={interviewer.stop} aria-label={t("Stop reading the question")}>
              <SquareIcon size={14} /> {t("Stop")}
            </Button>
          ) : (
            <Button size="sm" variant="soft" onClick={interviewer.read} disabled={speech.listening}
              aria-label={t("Read the question aloud again")}>
              <Volume2Icon size={14} /> {t("Listen again")}
            </Button>
          )
        )}
      </div>
      {interviewer?.speaking && (
        <p className="flex items-center gap-2 text-xs font-semibold text-[#34477A]" aria-live="polite">
          <Volume2Icon size={14} className="animate-pulse" /> {t("Interviewer is asking the question…")}
        </p>
      )}
      <p className={cn("flex items-start gap-2 text-sm rounded-2xl p-3", ui.highlight, "text-charcoal-light")}>
        <LightbulbIcon size={16} className="mt-0.5 shrink-0 text-[#1F5F53]" /> {question.tip}
      </p>

      {voice && (
        <div className="flex flex-wrap items-center gap-3">
          {speech.listening ? (
            <Button variant="outline" onClick={speech.stop} disabled={locked}>
              <SquareIcon size={16} /> {t("Stop speaking")}
            </Button>
          ) : (
            <Button onClick={startSpeaking} disabled={locked || busy}>
              <MicIcon size={16} /> {text ? t("Continue speaking") : t("Start speaking")}
            </Button>
          )}
          {speech.listening && (
            <span className="flex items-center gap-2 text-sm font-semibold text-[#1F5F53]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              {t(MIC_STAGE[speech.stage] || "Listening…")}
            </span>
          )}
        </div>
      )}
      {voice && speech.hint && !speech.error && (
        <p className="text-sm text-[#34477A] bg-[#D0F2F7]/60 rounded-2xl px-4 py-2">{speech.hint}</p>
      )}
      {voice && speech.error && (
        <p className="text-sm font-semibold text-red-700 bg-red-50 rounded-2xl px-4 py-3">
          {speech.error} {t("You can also type your answer in the box below.")}
        </p>
      )}

      <textarea
        rows={7}
        value={preview}
        readOnly={locked || (voice && speech.listening)}
        onChange={(e) => (voice ? speech.setTranscript(e.target.value) : setAnswer(e.target.value))}
        onKeyDown={onKeyDown}
        aria-label={t("Your answer")}
        lang="en"
        placeholder={voice
          ? (speech.listening ? t("Listening… start speaking.") : t("Press Start speaking, then talk. Your words appear here, and you can correct them after you stop."))
          : t("Type your answer as you would say it in an interview…")}
        className="w-full rounded-2xl border border-[#9ADBCC]/60 bg-white px-4 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-[#5DBFA9] focus:ring-2 focus:ring-[#9ADBCC]/40 resize-none"
      />

      {!locked && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("text-xs font-semibold", length.tone)}>{length.text}</p>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] text-charcoal-muted">{t("Ctrl + Enter to submit")}</span>
            <Button onClick={() => onSubmit(preview)} disabled={!canSubmit}>
              <SendIcon size={16} /> {busy ? t("Evaluating…") : t("Submit answer")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
