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
import useSpeechSynthesis from "../hooks/useSpeechSynthesis";
import { evaluateInterviewAnswer, getCareers, getCoachFeedback, getInterviewQuestions, getInterviewReport, health,
  saveInterviewReport } from "../api/careerApi";
import { careerSession } from "../utils/careerSession";

const QUESTION_SETS = 4;

// Stages: setup -> interview (question, then feedback, x5) -> report
export default function InterviewSimulator() {
  const navigate = useNavigate();
  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();
  const [careers, setCareers] = useState([]);
  const [settings, setSettings] = useState(() => {
    const flow = careerSession.get();
    return {
      careerId: flow.selectedCareer?.career_id || flow.recommendations?.[0]?.career_id || "software_engineer",
      mode: "text",
      variant: 0,
      consent: false,
      useLlm: true,
      readAloud: true, // interviewer voice (text-to-speech in the browser)
      voiceURI: "",
      rate: 1,
    };
  });
  const [llm, setLlm] = useState({ enabled: false }); // is an LLM provider configured on the server?
  const [coachLoading, setCoachLoading] = useState({}); // question index -> waiting for AI coach feedback
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

  const readAloud = settings.readAloud && tts.supported;
  const readQuestion = () => question && tts.speak(question.question, { voiceURI: settings.voiceURI, rate: settings.rate });
  // The interviewer asks each new question; stop talking when the interview stage ends.
  useEffect(() => {
    if (stage === "interview" && readAloud && question) readQuestion();
    else tts.cancel();
  }, [stage, question?.id]);

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
    tts.cancel();
    setBusy(true);
    setError("");
    const qIndex = index;
    const payload = {
      career_id: session.career_id,
      question_id: question.id,
      answer_text: text,
      mode: voice ? "voice" : "text",
      speaking_seconds: voice ? speech.speakingSeconds() : null,
      ...(settings.mode === "camera" ? camera.getMetrics() : {}),
    };
    try {
      // 1) Scores and rule-based feedback come back quickly - show them straight away.
      const result = await evaluateInterviewAnswer({ ...payload, use_llm: false });
      setResults((prev) => Object.assign([...prev], { [qIndex]: result }));
    } catch (err) {
      setError(apiErrorMessage(err));
      return;
    } finally {
      setBusy(false);
    }
    // 2) AI coach feedback (optional, slower) is added to the same result when it arrives.
    if (!(llm.enabled && settings.useLlm)) return;
    setCoachLoading((prev) => ({ ...prev, [qIndex]: true }));
    try {
      const { llm_feedback: coach } = await getCoachFeedback({ ...payload, use_llm: true });
      if (coach) {
        setResults((prev) => prev[qIndex]?.question_id === payload.question_id
          ? Object.assign([...prev], { [qIndex]: { ...prev[qIndex], llm_feedback: coach } })
          : prev);
      }
    } catch {
      /* the rule-based feedback is already shown */
    } finally {
      setCoachLoading((prev) => ({ ...prev, [qIndex]: false }));
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
      saveInterviewReport(session.career_id, summary).catch(() => {}); // practice history in the database
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
    <CareerPage step="interview">
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
          speechSupported={speech.supported} speechProblem={speech.problem} llm={llm} busy={busy} error={error}
          tts={tts} />
      )}

      {stage === "interview" && question && (
        <div className={settings.mode === "camera" ? "grid lg:grid-cols-[1fr_320px] gap-5 items-start" : "space-y-5"}>
          <div className="space-y-5 min-w-0">
            <AnswerPanel question={question} index={index} total={session.questions.length} voice={voice}
              speech={speech} answer={answer} setAnswer={setAnswer} onSubmit={submit} busy={busy} locked={!!feedback}
              interviewer={{ enabled: readAloud, speaking: tts.speaking, read: readQuestion, stop: tts.cancel }} />

            {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}

            {feedback && (
              <>
                <FeedbackCard feedback={feedback} coachLoading={!!coachLoading[index]} />
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
