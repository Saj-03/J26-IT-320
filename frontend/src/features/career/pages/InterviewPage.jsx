import { useState } from "react";
import { useParams } from "react-router-dom";
import { SparklesIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { ProgressRing } from "../../../shared/components/ui/ProgressRing";
import { evaluateAnswer } from "../api";

const QUESTION = "Tell me about a project where you solved a difficult problem.";

export default function InterviewPage() {
  const { career } = useParams();
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [start] = useState(Date.now());

  // Voice + face metrics are computed in the browser; only numbers are sent (NFR-05)
  const submit = async () => {
    const minutes = (Date.now() - start) / 60000;
    const wpm = answer.split(/\s+/).length / Math.max(minutes, 0.1);
    setBusy(true);
    try {
      setFb(await evaluateAnswer({ career, question: QUESTION, answer, speech_rate_wpm: wpm }));
    } finally {
      setBusy(false);
    }
  };

  const score = fb ? Math.round(fb.content_score * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Interview practice" subtitle={career} />
      <Card padding="lg">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-600 mb-2">Question</p>
        <h3 className="text-lg font-extrabold text-charcoal mb-4">{QUESTION}</h3>
        <textarea
          rows={7}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer as you would say it…"
          className="w-full rounded-2xl border border-black/10 bg-cream/50 px-4 py-3.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 resize-none"
        />
        <Button className="mt-4" onClick={submit} disabled={!answer.trim() || busy}>
          <SparklesIcon size={16} /> {busy ? "Evaluating…" : "Get feedback"}
        </Button>
      </Card>

      {fb && (
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-4">Feedback</h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ProgressRing value={score} size={104} stroke={10}>
              <span className="text-xl font-extrabold text-charcoal">{score}%</span>
              <span className="text-[10px] font-semibold text-charcoal-muted">relevance</span>
            </ProgressRing>
            <div className="flex-1 grid sm:grid-cols-2 gap-3 w-full">
              <div className="bg-cream rounded-2xl p-4">
                <p className="text-xs font-semibold text-charcoal-muted">Voice</p>
                <p className="text-sm font-bold text-charcoal mt-1">{fb.voice}</p>
              </div>
              <div className="bg-cream rounded-2xl p-4">
                <p className="text-xs font-semibold text-charcoal-muted">Presence</p>
                <p className="text-sm font-bold text-charcoal mt-1">{fb.face}</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
