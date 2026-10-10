import { RotateCcwIcon, MapIcon, TargetIcon } from "lucide-react";
import { ProgressRing } from "../../../../shared/components/ui/ProgressRing";
import Card from "../CareerCard";
import Button from "../CareerButton";
import ScoreBar from "./ScoreBar";
import { INK, PALETTE, ui } from "../../theme";

const AREA_LABEL = { content: "Answer content", delivery: "Voice delivery", presentation: "Camera presentation" };

// Summary of a full practice session.
export default function InterviewReport({ report, results, onRestart, onRoadmap }) {
  return (
    <div className="space-y-5">
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing value={report.overall_score} size={130} stroke={12} color={INK.ring} track={PALETTE.lime}>
            <span className="text-3xl font-extrabold text-charcoal">{Math.round(report.overall_score)}</span>
            <span className="text-xs font-semibold text-charcoal-muted">overall</span>
          </ProgressRing>
          <div className="space-y-2 text-center sm:text-left">
            <p className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${ui.iconTile}`}>{report.readiness_band}</p>
            <h2 className="text-xl font-extrabold text-charcoal">{report.career_name} interview practice</h2>
            <p className="text-sm text-charcoal-muted">
              {report.questions_answered} question(s) answered · strongest: {AREA_LABEL[report.strongest_area]} ·
              focus on: {AREA_LABEL[report.weakest_area]}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        <Card padding="lg" className="space-y-3">
          <h3 className="font-bold text-charcoal">Scores by area</h3>
          {Object.entries(report.dimension_scores).map(([k, v]) => (
            <ScoreBar key={k} label={AREA_LABEL[k]} value={v} hint={v == null ? "Not measured in this mode" : undefined} />
          ))}
          <h3 className="font-bold text-charcoal pt-2">Scores by question type</h3>
          {Object.entries(report.category_scores).map(([k, v]) => <ScoreBar key={k} label={k} value={v} />)}
        </Card>

        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-3 flex items-center gap-2">
            <TargetIcon size={18} className="text-[#1F5F53]" /> Top things to practise
          </h3>
          {report.focus_tips.length ? (
            <ol className="space-y-2 list-decimal pl-5 text-sm text-charcoal-light">
              {report.focus_tips.map((t) => <li key={t}>{t}</li>)}
            </ol>
          ) : (
            <p className="text-sm text-charcoal-muted">No major issues found - keep practising with new question sets.</p>
          )}

          <h3 className="font-bold text-charcoal mt-5 mb-2">Per question</h3>
          <ul className="space-y-1.5">
            {results.map((r, i) => (
              <li key={r.question_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-charcoal-light truncate">{i + 1}. {r.question}</span>
                <span className="font-bold text-charcoal shrink-0">{Math.round(r.overall_score)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-xs text-charcoal-muted">{report.disclaimer}</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onRestart}><RotateCcwIcon size={16} /> Practise again (new question set)</Button>
        <Button variant="outline" onClick={onRoadmap}><MapIcon size={16} /> Back to my roadmap</Button>
      </div>
    </div>
  );
}
