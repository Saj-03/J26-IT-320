import { CheckIcon, TrendingUpIcon, BookOpenIcon, SparklesIcon, LoaderCircleIcon } from "lucide-react";
import { ProgressRing } from "../../../../shared/components/ui/ProgressRing";
import Card from "../CareerCard";
import ScoreBar from "./ScoreBar";
import { INK, PALETTE, ui } from "../../theme";
import { t } from "../../i18n";

const pct = (ratio) => `${Math.round(ratio * 100)}%`;
const STAR_LABEL = { situation: "Situation", task: "Task", action: "Action", result: "Result" };

function List({ title, items, icon: Icon, tone }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-charcoal-light">
            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
              <Icon size={12} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Feedback for one answered question.
export default function FeedbackCard({ feedback, coachLoading = false }) {
  const { content, delivery, presentation } = feedback;
  const star = content.structure;
  const coach = feedback.llm_feedback; // null when no LLM is configured, it failed, or the student opted out

  return (
    <Card padding="lg" className="space-y-5">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ProgressRing value={feedback.overall_score} size={110} stroke={10} color={INK.ring} track={PALETTE.lime}>
          <span className="text-2xl font-extrabold text-charcoal">{Math.round(feedback.overall_score)}</span>
          <span className="text-[10px] font-semibold text-charcoal-muted">{t("out of 100")}</span>
        </ProgressRing>
        <div className="flex-1 w-full space-y-3">
          <ScoreBar label={t("Content")} value={content.score}
            hint={t("Relevance {relevance} · key concepts {concepts} · {words} words", {
              relevance: Math.round(content.semantic_similarity), concepts: Math.round(content.keyword_coverage),
              words: content.word_count,
            })} />
          <ScoreBar label={t("Delivery (voice)")} value={delivery?.score}
            hint={delivery
              ? t("{wpm} words/min · {fillers} filler word(s)", {
                wpm: Math.round(delivery.words_per_minute), fillers: delivery.filler_count,
              })
              : t("Not measured (typed answer)")} />
          <ScoreBar label={t("Presentation (camera)")} value={presentation?.score}
            hint={presentation
              ? t("In frame {frame} · facing camera {facing}", {
                frame: pct(presentation.face_presence_ratio), facing: pct(presentation.facing_camera_ratio),
              })
              : t("Not measured (camera off)")} />
        </div>
      </div>

      {star && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-2">{t("STAR structure")}</p>
          <div className="flex flex-wrap gap-2">
            {["situation", "task", "action", "result"].map((part) => (
              <span key={part} className={`rounded-full px-3 py-1 text-xs font-semibold ${star[part] ? ui.match : ui.gap}`}>
                {star[part] ? "✓" : "✗"} {t(STAR_LABEL[part])}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <List title={t("What went well")} items={feedback.strengths} icon={CheckIcon} tone={ui.match} />
        <List title={t("How to improve")} items={feedback.improvements} icon={TrendingUpIcon} tone={ui.gap} />
      </div>

      {coachLoading && !coach && (
        <p className="flex items-center gap-2 text-sm font-semibold text-[#34477A] bg-[#D0F2F7]/40 rounded-2xl px-4 py-3">
          <LoaderCircleIcon size={16} className="animate-spin" /> {t("AI coach is writing your feedback… (usually 5-30 seconds)")}
        </p>
      )}
      {coach && (
        <div className="rounded-2xl border border-[#9EB2DB] bg-[#D0F2F7]/40 p-4 space-y-4">
          <p className="text-sm font-bold text-charcoal flex items-center gap-2">
            <SparklesIcon size={16} className="text-[#34477A]" /> {t("AI coach feedback")}
          </p>
          <div className="grid md:grid-cols-2 gap-5">
            <List title={t("Strengths")} items={coach.strengths} icon={CheckIcon} tone={ui.match} />
            <List title={t("Improvements")} items={coach.improvements} icon={TrendingUpIcon} tone={ui.gap} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-1">{t("A stronger version of your answer")}</p>
            <p className="text-sm text-charcoal-light">{coach.suggested_answer}</p>
          </div>
          {coach.final_tip && <p className="text-sm font-semibold text-[#34477A]">{t("Tip:")} {coach.final_tip}</p>}
          <p className="text-xs text-charcoal-muted">
            {t("Written by an AI model ({provider}). It does not change your scores and may contain mistakes.", { provider: coach.provider })}
          </p>
        </div>
      )}

      <details className={`rounded-2xl p-4 ${ui.highlight}`}>
        <summary className="cursor-pointer text-sm font-bold text-charcoal flex items-center gap-2">
          <BookOpenIcon size={16} className="text-[#1F5F53]" /> {t("Show a sample strong answer (in English)")}
        </summary>
        <p lang="en" className="text-sm text-charcoal-light mt-2">{feedback.sample_answer}</p>
      </details>

      <p className="text-xs text-charcoal-muted">
        {feedback.disclaimer} {t("Scored with {method}.", { method: content.scoring_method })}
      </p>
    </Card>
  );
}
