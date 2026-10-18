import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClipboardListIcon, FlameIcon, Gamepad2Icon, LightbulbIcon,
  RotateCcwIcon, SparklesIcon, TrophyIcon, XIcon,
} from "lucide-react";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import CareerSkeleton from "../components/CareerSkeleton";
import { EmptyState } from "../../../shared/components/ui/States";
import { apiErrorMessage } from "../../../shared/api/client";
import { cn } from "../../../shared/lib/cn";
import { CountUp } from "../hooks/useCountUp";
import { celebrate, originOf } from "../utils/celebrate";
import { toast } from "../utils/toast";
import { checkFitAnswer, getFitQuiz, scoreFitQuiz } from "../api/careerApi";
import { careerSession, chooseCareer, currentFitQuiz, useCareerFlow } from "../utils/careerSession";
import { t, useLanguage } from "../i18n";

// Holland RIASEC interest types in plain words (the same six types O*NET uses for every job).
const RIASEC = {
  R: { name: "Hands-on maker", desc: "You like building, fixing and working with tools, machines or nature." },
  I: { name: "Curious thinker", desc: "You like investigating, analysing and solving problems." },
  A: { name: "Creative", desc: "You like designing, writing and expressing new ideas." },
  S: { name: "People helper", desc: "You like teaching, guiding and caring for others." },
  E: { name: "Leader", desc: "You like leading, persuading and making decisions." },
  C: { name: "Organiser", desc: "You like order, accuracy, records and clear plans." },
};
const ENJOY = [
  { value: 2, emoji: "😍", label: "I'd love it" },
  { value: 1, emoji: "🙂", label: "Maybe" },
  { value: 0, emoji: "🙁", label: "Not for me" },
];
const MEDALS = ["🥇", "🥈", "🥉"];
const XP = { interest: 10, enjoy: 5, perfect: 15 }; // a scenario answer also earns its points (10 / 5 / 0)
const RESULT_STYLE = {
  best: { box: "bg-[#C7F2D1] border-[#5DBFA9]", title: "Great choice!" },
  good: { box: "bg-[#D0F2F7] border-[#9ADBCC]", title: "Not bad – there is a better way" },
  miss: { box: "bg-[#9EB2DB]/30 border-[#9EB2DB]", title: "Here is what professionals do" },
};

const levelFor = (xp, max) => (xp >= max * 0.8 ? { icon: "🏆", name: "Career Pro" }
  : xp >= max * 0.55 ? { icon: "⭐", name: "Career Explorer" } : { icon: "🌱", name: "Career Starter" });

function ProgressHeader({ round, index, total, xp, streak }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm font-bold">
        <span className="text-[#1F5F53]">
          {round === 1 ? t("Round 1 · What do you enjoy?") : t("Round 2 · A day in the job")}
          <span className="ml-2 text-charcoal-muted font-semibold">{t("{n} of {total}", { n: index + 1, total })}</span>
        </span>
        <span className="flex items-center gap-3">
          {streak >= 2 && (
            <span key={streak} className="acrds-pop flex items-center gap-1 text-[#B4541A]" aria-label={t("{n} in a row", { n: streak })}>
              <FlameIcon size={16} /> {streak}
            </span>
          )}
          <span className="rounded-full bg-[#1F2840] text-white px-3 py-1 text-xs" aria-live="polite">
            <CountUp value={xp} /> XP
          </span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/70 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total}
        aria-valuenow={index} aria-label={t("Quiz progress")}>
        <div className="h-full bg-gradient-to-r from-[#9ADBCC] to-[#9EB2DB] transition-all duration-500"
          style={{ width: `${(index / total) * 100}%` }} />
      </div>
    </div>
  );
}

function Choice({ children, onClick, disabled, state }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("w-full text-left rounded-2xl border-2 px-4 py-3 min-h-12 font-semibold transition-all",
        "active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5DBFA9]",
        state === "best" ? "bg-[#C7F2D1] border-[#5DBFA9] text-[#12352E]"
          : state === "wrong" ? "bg-[#9EB2DB]/25 border-[#9EB2DB] text-[#1E2D57]"
            : state === "dim" ? "bg-white/60 border-transparent text-charcoal-muted"
              : "bg-[#FFFBF0] border-[#9ADBCC]/60 text-charcoal hover:bg-[#E3FFD6] hover:border-[#9ADBCC]")}>
      <span className="flex items-start gap-2">
        {state === "best" && <CheckIcon size={18} className="shrink-0 mt-0.5 text-[#1F5F53]" />}
        {state === "wrong" && <XIcon size={18} className="shrink-0 mt-0.5 text-[#34477A]" />}
        <span>{children}</span>
      </span>
    </button>
  );
}

function FitBar({ value }) {
  return (
    <div className="h-2.5 rounded-full bg-[#E3FFD6] overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-[#5DBFA9] to-[#9EB2DB] transition-all duration-700" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function CareerFitQuiz() {
  useLanguage();
  const navigate = useNavigate();
  const { flow, ready } = useCareerFlow();
  const { profile, recommendations } = flow;
  const saved = currentFitQuiz(flow);

  const [phase, setPhase] = useState(saved ? "result" : "intro"); // intro | interest | scenario | result
  const [quiz, setQuiz] = useState(null);
  const [variant, setVariant] = useState(saved?.variant ?? 0);
  const [index, setIndex] = useState(0);
  const [interests, setInterests] = useState({});
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);   // chosen option in the current scenario
  const [feedback, setFeedback] = useState(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestRun, setBestRun] = useState(0);
  const [gain, setGain] = useState(null);       // "+10 XP" bubble
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const headingRef = useRef(null);
  const resultRef = useRef(null);

  const hasSaved = !!saved;
  // Saved results arrive from the database after the first render: show them instead of the intro.
  useEffect(() => { if (ready && hasSaved && !quiz) setPhase((p) => (p === "intro" ? "result" : p)); }, [ready, hasSaved, quiz]);
  useEffect(() => { headingRef.current?.focus(); }, [phase, index]); // keyboard / screen-reader users follow each question

  if (!ready && !recommendations?.length) return <CareerSkeleton variant="cards" label={t("Loading your saved results…")} />;
  if (!profile || !recommendations?.length) {
    return (
      <Card>
        <EmptyState icon={ClipboardListIcon} title={t("No recommendations yet")}
          desc={t("Complete the career profile survey to see your top 5 career paths.")}
          actionLabel={t("Start survey")} onAction={() => navigate("/app/career/survey")} />
      </Card>
    );
  }
  const careerIds = recommendations.map((r) => r.career_id);
  const recById = Object.fromEntries(recommendations.map((r) => [r.career_id, r]));
  const totalInterest = quiz?.interest_questions.length || 6;
  const totalScenarios = quiz?.scenarios.length || careerIds.length;
  const maxXp = totalInterest * XP.interest + totalScenarios * (10 + XP.enjoy) + XP.perfect;

  const addXp = (amount) => {
    setXp((v) => v + amount);
    const key = Date.now();
    setGain({ amount, key });
    setTimeout(() => setGain((g) => (g?.key === key ? null : g)), 1100); // the "+XP" bubble pops, then goes
  };

  const start = async (nextVariant = variant) => {
    setBusy(true);
    setError("");
    try {
      const q = await getFitQuiz(careerIds, nextVariant);
      setQuiz(q);
      setVariant(nextVariant);
      setInterests({});
      setAnswers([]);
      setIndex(0);
      setXp(0);
      setStreak(0);
      setBestRun(0);
      setPicked(null);
      setFeedback(null);
      setPhase("interest");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const answerInterest = (qid, optionId) => {
    setInterests((a) => ({ ...a, [qid]: optionId }));
    addXp(XP.interest);
    if (index + 1 < totalInterest) setIndex(index + 1);
    else {
      setIndex(0);
      setPhase("scenario");
    }
  };

  const pickScenario = async (option) => {
    const scenario = quiz.scenarios[index];
    setPicked(option);
    setBusy(true);
    try {
      const fb = await checkFitAnswer({ question_id: scenario.id, option });
      setFeedback(fb);
      addXp(fb.points);
      const run = fb.result === "best" ? streak + 1 : 0;
      setStreak(run);
      setBestRun((b) => Math.max(b, run));
    } catch (err) {
      setPicked(null);
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (all, event) => {
    setBusy(true);
    setError("");
    const payload = { interests, scenarios: all };
    try {
      const result = await scoreFitQuiz(payload);
      const perfect = all.length > 0 && bestRun >= all.length;
      const finalXp = xp + XP.enjoy + (perfect ? XP.perfect : 0);
      if (perfect) addXp(XP.perfect + XP.enjoy); else addXp(XP.enjoy);
      careerSession.update({
        fitQuiz: { careerIds, variant, answers: payload, result, xp: finalXp, maxXp, perfect, playedAt: new Date().toISOString() },
      });
      setPhase("result");
      celebrate("big", originOf(event?.currentTarget));
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const rateEnjoyment = (value, event) => {
    const scenario = quiz.scenarios[index];
    const all = [...answers, { career_id: scenario.career_id, question_id: scenario.id, option: picked, enjoyment: value }];
    setAnswers(all);
    setPicked(null);
    setFeedback(null);
    if (index + 1 < totalScenarios) {
      addXp(XP.enjoy);
      setIndex(index + 1);
    } else {
      finish(all, event);
    }
  };

  const select = async (rec) => {
    setBusyId(rec.career_id);
    try {
      await chooseCareer(rec, profile);
      navigate("/app/career/gap-analysis");
    } catch (err) {
      toast.error(t("Could not load the skill gaps. Please try again."));
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  // ---------------------------------------------------------------- intro
  if (phase === "intro") {
    return (
      <CareerPage className="space-y-5" step="careers">
        <Card padding="lg" className="text-center space-y-4">
          <span className="mx-auto w-16 h-16 rounded-3xl bg-[#C7F2D1] text-[#1F5F53] flex items-center justify-center acrds-glow">
            <Gamepad2Icon size={32} />
          </span>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl sm:text-3xl font-extrabold text-charcoal outline-none">
            {t("Career Fit Quiz")}
          </h1>
          <p className="text-charcoal-light max-w-xl mx-auto">
            {t("Which of your 5 careers fits you best? Answer 6 quick questions about what you enjoy, then try one real situation from each job.")}
          </p>
          <div className="grid sm:grid-cols-3 gap-3 text-left max-w-2xl mx-auto">
            {[
              { icon: SparklesIcon, title: "Round 1", desc: "6 quick picks about what you enjoy" },
              { icon: LightbulbIcon, title: "Round 2", desc: "A real situation from each of your 5 careers" },
              { icon: TrophyIcon, title: "Your result", desc: "Your best fit, a badge and XP" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl bg-[#E3FFD6]/70 p-3">
                <Icon size={18} className="text-[#1F5F53]" />
                <p className="font-bold text-charcoal mt-1">{t(title)}</p>
                <p className="text-sm text-charcoal-muted">{t(desc)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-charcoal-muted">{t("About 3 minutes · no wrong interests · it does not change your ranking")}</p>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => start(variant)} disabled={busy}>
              <Gamepad2Icon size={18} /> {busy ? t("Loading…") : t("Start the quiz")}
            </Button>
            <Button variant="outline" onClick={() => navigate("/app/career/recommendations")}>
              <ArrowLeftIcon size={16} /> {t("Back to my careers")}
            </Button>
          </div>
        </Card>
      </CareerPage>
    );
  }

  // ---------------------------------------------------------------- round 1
  if (phase === "interest") {
    const q = quiz.interest_questions[index];
    return (
      <CareerPage className="space-y-5" step="careers">
        <Card padding="lg" className="space-y-5 relative">
          <ProgressHeader round={1} index={index} total={totalInterest} xp={xp} streak={0} />
          {gain && <span key={gain.key} aria-hidden className="acrds-pop absolute right-6 top-14 text-sm font-extrabold text-[#1F5F53]">+{gain.amount} XP</span>}
          <h2 ref={headingRef} tabIndex={-1} className="text-xl sm:text-2xl font-extrabold text-charcoal outline-none">{q.question}</h2>
          <div key={q.id} className="grid gap-3 acrds-fade">
            {q.options.map((o) => (
              <Choice key={o.id} onClick={() => answerInterest(q.id, o.id)}>{o.text}</Choice>
            ))}
          </div>
          <p className="text-xs text-charcoal-muted">{t("There are no wrong answers here – pick what sounds most like you.")}</p>
        </Card>
      </CareerPage>
    );
  }

  // ---------------------------------------------------------------- round 2
  if (phase === "scenario") {
    const s = quiz.scenarios[index];
    const style = feedback && RESULT_STYLE[feedback.result];
    return (
      <CareerPage className="space-y-5" step="careers">
        <Card padding="lg" className="space-y-5 relative">
          <ProgressHeader round={2} index={index} total={totalScenarios} xp={xp} streak={streak} />
          {gain && <span key={gain.key} aria-hidden className="acrds-pop absolute right-6 top-14 text-sm font-extrabold text-[#1F5F53]">+{gain.amount} XP</span>}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#34477A]">
              {t("A day as a {career}", { career: s.career_name })} · {t("Skill: {skill}", { skill: s.skill_label })}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-xl sm:text-2xl font-extrabold text-charcoal outline-none">{s.scenario}</h2>
            <p className="text-sm text-charcoal-muted mt-1">{t("What would you do?")}</p>
          </div>
          <div key={s.id} className="grid gap-3 acrds-fade">
            {s.options.map((text, i) => {
              let state;
              if (feedback) state = i === feedback.best_option ? "best" : i === picked ? "wrong" : "dim";
              return (
                <Choice key={i} onClick={() => pickScenario(i)} disabled={busy || picked !== null} state={state}>{text}</Choice>
              );
            })}
          </div>
          {feedback && (
            <div className={cn("acrds-fade rounded-2xl border-l-4 p-4 space-y-3", style.box)} aria-live="polite">
              <p className="font-extrabold text-charcoal flex items-center gap-2">
                {feedback.result === "best" ? <SparklesIcon size={18} /> : <LightbulbIcon size={18} />}
                {t(style.title)}
                <span className="ml-auto text-sm">+{feedback.points} XP</span>
              </p>
              <p className="text-sm text-charcoal-light">{feedback.why}</p>
              <div className="pt-1">
                <p className="text-sm font-bold text-charcoal mb-2">{t("Would you enjoy doing this kind of work?")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {ENJOY.map((e) => (
                    <button key={e.value} type="button" disabled={busy} onClick={(ev) => rateEnjoyment(e.value, ev)}
                      className="rounded-2xl bg-white/80 hover:bg-white border-2 border-transparent hover:border-[#9ADBCC] px-2 py-3 min-h-12 font-semibold text-sm text-charcoal active:scale-95 motion-reduce:active:scale-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5DBFA9]">
                      <span className="block text-2xl" aria-hidden>{e.emoji}</span>
                      {t(e.label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        </Card>
      </CareerPage>
    );
  }

  // ---------------------------------------------------------------- result
  const fq = currentFitQuiz(careerSession.get()) || saved;
  if (!fq) return null;
  const { result } = fq;
  const level = levelFor(fq.xp ?? 0, fq.maxXp || maxXp);
  const best = result.results[0];
  return (
    <CareerPage className="space-y-5" step="careers">
      <div ref={resultRef} className="scroll-mt-24 space-y-5">
        <Card padding="lg" className="text-center space-y-3 bg-gradient-to-br from-[#E3FFD6] to-[#D0F2F7]">
          <p className="text-5xl acrds-pop" aria-hidden>{level.icon}</p>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl sm:text-3xl font-extrabold text-charcoal outline-none">
            {t("Your best fit: {career}", { career: best.career_name })}
          </h1>
          <p className="text-charcoal-light">{result.summary}</p>
          <div className="flex flex-wrap justify-center gap-2 text-sm font-bold">
            <span className="rounded-full bg-white/80 px-3 py-1">{t(level.name)}</span>
            <span className="rounded-full bg-[#1F2840] text-white px-3 py-1"><CountUp value={fq.xp ?? 0} /> / {fq.maxXp || maxXp} XP</span>
            {fq.perfect && <span className="rounded-full bg-[#FFD27A] text-[#5A3B00] px-3 py-1">{t("Perfect run!")}</span>}
          </div>
          {result.top_types.length > 0 && (
            <p className="text-sm text-charcoal-light max-w-xl mx-auto">
              <span className="font-bold text-charcoal">{t("Your interest type: {types}.", { types: result.top_types.map((k) => t(RIASEC[k].name)).join(" + ") })}</span>{" "}
              {result.top_types.map((k) => t(RIASEC[k].desc)).join(" ")}
            </p>
          )}
        </Card>

        {/* Podium: the top 3 fits */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
          {[1, 0, 2].map((pos) => {
            const r = result.results[pos];
            if (!r) return <div key={pos} />;
            return (
              <div key={r.career_id} className={cn("rounded-3xl text-center p-2 sm:p-4 bg-[#FFFBF0] border border-[#9ADBCC]/60 shadow-card acrds-fade",
                pos === 0 ? "pb-6 sm:pb-10" : pos === 1 ? "pb-3 sm:pb-6" : "pb-2 sm:pb-3")}>
                <p className="text-3xl sm:text-4xl" aria-hidden>{MEDALS[pos]}</p>
                <p className="font-extrabold text-charcoal text-xs sm:text-base leading-tight mt-1">{r.career_name}</p>
                <p className="text-xl sm:text-2xl font-extrabold text-[#1F5F53]"><CountUp value={r.fit} suffix="%" /></p>
                <p className="text-[11px] sm:text-xs font-semibold text-charcoal-muted">{t("fit")}</p>
              </div>
            );
          })}
        </div>

        <Card padding="md" className="space-y-4">
          <h2 className="text-lg font-extrabold text-charcoal">{t("All 5 careers")}</h2>
          {result.results.map((r) => (
            <div key={r.career_id} className={cn("rounded-2xl p-3 sm:p-4 space-y-2", r.rank === 1 ? "bg-[#E3FFD6] ring-2 ring-[#9ADBCC]" : "bg-white/60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#9EB2DB]/30 text-[#34477A] text-sm font-extrabold flex items-center justify-center">#{r.rank}</span>
                <span className="font-extrabold text-charcoal">{r.career_name}</span>
                {r.rank === 1 && <span className="flex items-center gap-1 rounded-full bg-[#9ADBCC] text-[#12352E] px-2.5 py-0.5 text-xs font-bold"><TrophyIcon size={12} /> {t("Best fit")}</span>}
                <span className="ml-auto text-lg font-extrabold text-[#1F5F53]">{r.fit}%</span>
              </div>
              <FitBar value={r.fit} />
              <p className="text-xs font-semibold text-charcoal-muted">
                {t("Interest match {n}%", { n: r.interest_match })} · {t("Enjoyment: {v}", { v: t(ENJOY.find((e) => e.value === r.enjoyment)?.label) })} ·{" "}
                {t("Situation: {n}/10", { n: r.scenario_points })} · {t("Recommended rank #{n}", { n: careerIds.indexOf(r.career_id) + 1 })}
              </p>
              {recById[r.career_id] && (
                <Button size="sm" variant={r.rank === 1 ? "primary" : "soft"} disabled={!!busyId}
                  onClick={() => select(recById[r.career_id])}>
                  {busyId === r.career_id ? t("Analysing…") : t("Select this career")} <ArrowRightIcon size={14} />
                </Button>
              )}
            </div>
          ))}
          <p className="text-xs text-charcoal-muted">{t("Fit = 50% interest match (your answers vs the job's O*NET interest profile) + 30% how much you would enjoy it + 20% your answer to the job situation.")}</p>
          <p className="text-xs font-semibold text-charcoal-muted">{result.advisory}</p>
        </Card>
        {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/app/career/recommendations")}>
            <ArrowLeftIcon size={16} /> {t("Back to my careers")}
          </Button>
          <Button variant="soft" disabled={busy} onClick={() => start((fq.variant ?? variant) + 1)}>
            <RotateCcwIcon size={16} /> {t("Play again with new situations")}
          </Button>
        </div>
      </div>
    </CareerPage>
  );
}
