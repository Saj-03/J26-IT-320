import { CheckIcon, TrendingUpIcon, BookOpenIcon, SparklesIcon } from "lucide-react";
import { ProgressRing } from "../../../../shared/components/ui/ProgressRing";
import Card from "../CareerCard";
import ScoreBar from "./ScoreBar";
import { INK, PALETTE, ui } from "../../theme";

const pct = (ratio) => `${Math.round(ratio * 100)}%`;

function List({ title, items, icon: Icon, tone }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-2 text-sm text-charcoal-light">
            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
              <Icon size={12} />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Feedback for one answered question.
export default function FeedbackCard({ feedback }) {
  const { content, delivery, presentation } = feedback;
  const star = content.structure;
  const coach = feedback.llm_feedback; // null when no LLM is configured, it failed, or the student opted out

  return (
    <Card padding="lg" className="space-y-5">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ProgressRing value={feedback.overall_score} size={110} stroke={10} color={INK.ring} track={PALETTE.lime}>
          <span className="text-2xl font-extrabold text-charcoal">{Math.round(feedback.overall_score)}</span>
          <span className="text-[10px] font-semibold text-charcoal-muted">out of 100</span>
        </ProgressRing>
        <div className="flex-1 w-full space-y-3">
          <ScoreBar label="Content" value={content.score}
            hint={`Relevance ${Math.round(content.semantic_similarity)} · key concepts ${Math.round(content.keyword_coverage)} · ${content.word_count} words`} />
          <ScoreBar label="Delivery (voice)" value={delivery?.score}
            hint={delivery ? `${Math.round(delivery.words_per_minute)} words/min · ${delivery.filler_count} filler word(s)` : "Not measured (typed answer)"} />
          <ScoreBar label="Presentation (camera)" value={presentation?.score}
            hint={presentation
              ? `In frame ${pct(presentation.face_presence_ratio)} · facing camera ${pct(presentation.facing_camera_ratio)}`
              : "Not measured (camera off)"} />
        </div>
      </div>

      {star && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-2">STAR structure</p>
          <div className="flex flex-wrap gap-2">
            {["situation", "task", "action", "result"].map((part) => (
              <span key={part} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${star[part] ? ui.match : ui.gap}`}>
                {star[part] ? "✓" : "✗"} {part}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <List title="What went well" items={feedback.strengths} icon={CheckIcon} tone={ui.match} />
        <List title="How to improve" items={feedback.improvements} icon={TrendingUpIcon} tone={ui.gap} />
      </div>

      {coach && (
        <div className="rounded-2xl border border-[#9EB2DB] bg-[#D0F2F7]/40 p-4 space-y-4">
          <p className="text-sm font-bold text-charcoal flex items-center gap-2">
            <SparklesIcon size={16} className="text-[#34477A]" /> AI coach feedback
          </p>
          <div className="grid md:grid-cols-2 gap-5">
            <List title="Strengths" items={coach.strengths} icon={CheckIcon} tone={ui.match} />
            <List title="Improvements" items={coach.improvements} icon={TrendingUpIcon} tone={ui.gap} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-1">A stronger version of your answer</p>
            <p className="text-sm text-charcoal-light">{coach.suggested_answer}</p>
          </div>
          {coach.final_tip && <p className="text-sm font-semibold text-[#34477A]">Tip: {coach.final_tip}</p>}
          <p className="text-xs text-charcoal-muted">
            Written by an AI model ({coach.provider}). It does not change your scores and may contain mistakes.
          </p>
        </div>
      )}

      <details className={`rounded-2xl p-4 ${ui.highlight}`}>
        <summary className="cursor-pointer text-sm font-bold text-charcoal flex items-center gap-2">
          <BookOpenIcon size={16} className="text-[#1F5F53]" /> Show a sample strong answer
        </summary>
        <p className="text-sm text-charcoal-light mt-2">{feedback.sample_answer}</p>
      </details>

      <p className="text-xs text-charcoal-muted">
        {feedback.disclaimer} Scored with {content.scoring_method}.
      </p>
    </Card>
  );
}
