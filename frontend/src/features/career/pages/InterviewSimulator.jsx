import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, RotateCcwIcon, FlagIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { apiErrorMessage } from "../../../shared/api/client";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import InterviewSetup from "../components/interview/InterviewSetup";
import AnswerPanel from "../components/interview/AnswerPanel";
import CameraPreview from "../components/interview/CameraPreview";
import FeedbackCard from "../components/interview/FeedbackCard";
import InterviewReport from "../components/interview/InterviewReport";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import useFaceMetrics from "../hooks/useFaceMetrics";
import { evaluateInterviewAnswer, getCareers, getInterviewQuestions, getInterviewReport, health } from "../api/careerApi";
import { careerSession } from "../utils/careerSession";

const QUESTION_SETS = 4;

// Stages: setup -> interview (question, then feedback, x5) -> report
export default function InterviewSimulator() {
  const navigate = useNavigate();
  const speech = useSpeechRecognition();
  const [careers, setCareers] = useState([]);
  const [settings, setSettings] = useState(() => {
    const flow = careerSession.get();
    return {
      careerId: flow.selectedCareer?.career_id || flow.recommendations?.[0]?.career_id || "software_engineer",
      mode: "text",
      variant: 0,
      consent: false,
      useLlm: true,
    };
  });
  const [llm, setLlm] = useState({ enabled: false }); // is an LLM provider configured on the server?
  const [stage, setStage] = useState("setup");
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]); // feedback per question index
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const voice = settings.mode !== "text";
  const camera = useFaceMetrics(stage === "interview" && settings.mode === "camera");

  useEffect(() => {
    getCareers().then(setCareers).catch((err) => setError(apiErrorMessage(err)));
    health().then((h) => setLlm(h.llm_feedback || { enabled: false })).catch(() => {});
  }, []);

  const question = session?.questions[index];
  const feedback = results[index];
  const isLast = session && index === session.questions.length - 1;

  const beginQuestion = () => {
    speech.reset();
    setAnswer("");
    camera.resetCounts();
    setError("");
  };

  const start = async (variant = settings.variant) => {
    setBusy(true);
    setError("");
    try {
      const set = await getInterviewQuestions(settings.careerId, variant);
      setSettings((s) => ({ ...s, variant }));
      setSession(set);
      setIndex(0);
      setResults([]);
      setReport(null);
      beginQuestion();
      setStage("interview");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (text) => {
    speech.stop();
    setBusy(true);
    setError("");
    try {
      const result = await evaluateInterviewAnswer({
        career_id: session.career_id,
        question_id: question.id,
        answer_text: text,
        mode: voice ? "voice" : "text",
        speaking_seconds: voice ? speech.speakingSeconds() : null,
        use_llm: llm.enabled && settings.useLlm,
        ...(settings.mode === "camera" ? camera.getMetrics() : {}),
      });
      setResults((prev) => Object.assign([...prev], { [index]: result }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setResults((prev) => Object.assign([...prev], { [index]: undefined }));
    beginQuestion();
  };

  const finish = async () => {
    const answered = results.filter(Boolean);
    setBusy(true);
    setError("");
    try {
      const summary = await getInterviewReport({
        career_id: session.career_id,
        results: answered.map((r) => ({
          category: r.category,
          overall_score: r.overall_score,
          content_score: r.content.score,
          delivery_score: r.delivery?.score ?? null,
          presentation_score: r.presentation?.score ?? null,
          improvements: r.improvements,
        })),
      });
      setReport(summary);
      setStage("report");
      careerSession.update({ interviewReport: summary });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (isLast) return finish();
    setIndex((i) => i + 1);
    beginQuestion();
  };

  return (
    <CareerPage>
      <PageHeader
        title="AI Interview Simulator"
        subtitle={session && stage !== "setup"
          ? `${session.career_name} · practice set ${settings.variant + 1}`
          : "Practise real interview questions and get feedback on content, voice delivery and camera presence."}
        action={stage === "interview" && results.some(Boolean) && !isLast ? (
          <Button variant="outline" onClick={finish} disabled={busy}><FlagIcon size={16} /> End and see report</Button>
        ) : null}
      />

      {stage === "setup" && (
        <InterviewSetup careers={careers} settings={settings} onChange={setSettings} onStart={() => start()}
          speechSupported={speech.supported} llm={llm} busy={busy} error={error} />
      )}

      {stage === "interview" && question && (
        <div className={settings.mode === "camera" ? "grid lg:grid-cols-[1fr_320px] gap-5 items-start" : "space-y-5"}>
          <div className="space-y-5 min-w-0">
            <AnswerPanel question={question} index={index} total={session.questions.length} voice={voice}
              speech={speech} answer={answer} setAnswer={setAnswer} onSubmit={submit} busy={busy} locked={!!feedback} />

            {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}

            {feedback && (
              <>
                <FeedbackCard feedback={feedback} />
                <div className="flex flex-wrap gap-3">
                  <Button onClick={next} disabled={busy}>
                    {isLast ? "Finish and see report" : "Next question"} <ArrowRightIcon size={16} />
                  </Button>
                  <Button variant="outline" onClick={retry} disabled={busy}><RotateCcwIcon size={16} /> Try this question again</Button>
                </div>
              </>
            )}
          </div>

          {settings.mode === "camera" && (
            <div className="lg:sticky lg:top-6">
              <CameraPreview videoRef={camera.videoRef} status={camera.status} error={camera.error} live={camera.live} />
            </div>
          )}
        </div>
      )}

      {stage === "report" && report && (
        <InterviewReport report={report} results={results.filter(Boolean)}
          onRestart={() => start((settings.variant + 1) % QUESTION_SETS)}
          onRoadmap={() => navigate("/app/career/roadmap")} />
      )}
    </CareerPage>
  );
}
