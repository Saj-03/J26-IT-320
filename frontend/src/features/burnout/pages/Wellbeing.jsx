import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightIcon,
  SparklesIcon,
  NotebookPenIcon,
  MessageCircleHeartIcon,
  LightbulbIcon,
  CalendarCheckIcon,
  ShieldCheckIcon,
  WindIcon,
  HeartHandshakeIcon,
  ActivityIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  CheckCircle2Icon,
  SmileIcon,
  ClockIcon,
  InfoIcon,
  ListTodoIcon,
  EyeIcon,
  CompassIcon,
} from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { ProgressBar } from "../../../shared/components/ui/ProgressBar";
import { LineChart } from "../../../shared/components/charts/Charts";
import { useAuth } from "../../../shared/context/AuthContext";
import { cn } from "../../../shared/lib/cn";
import { getSummary, runDemo, logTipEvent, sendMood } from "../api";
import { InteractiveTipModal } from "../components/InteractiveTipModal";

// Four distinct dimensions of student wellbeing
const DIMENSIONS = [
  {
    key: "deviation",
    title: "Academic Routine & Pacing",
    desc: "Your study rhythms, focus hours, and session timing compared to your natural baseline.",
  },
  {
    key: "journal",
    title: "Inner Reflection Sentiment",
    desc: "Emotional tone and stress indicators detected in your private journal entries.",
  },
  {
    key: "chat",
    title: "Support Conversation Clarity",
    desc: "Tone and perceived cognitive load in your optional support chat discussions.",
  },
  {
    key: "mood",
    title: "Self-Reported Mood Balance",
    desc: "Average of your daily mood check-ins and reflection taps over recent days.",
  },
];

const MOOD_OPTIONS = [
  { score: 1, emoji: "😣", label: "Struggling", tone: "Tough stretch" },
  { score: 2, emoji: "😕", label: "Heavy", tone: "Feeling strained" },
  { score: 3, emoji: "😐", label: "Steady", tone: "Hanging in there" },
  { score: 4, emoji: "🙂", label: "Good", tone: "Feeling positive" },
  { score: 5, emoji: "🔥", label: "Inspired", tone: "Strong energy" },
];

const wording = (v) => {
  if (v === undefined || v === null) return "No data yet";
  if (v < 0.3) return "Balanced & Steady";
  if (v < 0.6) return "Gentle Strain";
  return "Noticeable Load";
};

const barColor = (v) => {
  if (v === undefined || v === null) return "bg-black/10";
  if (v < 0.3) return "bg-sage";
  if (v < 0.6) return "bg-amber-soft";
  return "bg-brand-500";
};

const factorText = (f) =>
  `${f.feature[0].toUpperCase()}${f.feature.slice(1).replace(/_/g, " ")} is ${
    f.direction === "up" ? "higher" : "lower"
  } than your usual rhythm`;

const FUN_ACTIVITIES = [
  {
    id: "workload",
    category: "workload",
    icon: ListTodoIcon,
    iconBg: "bg-amber-soft/20 text-amber-800",
    badge: "1-min chunking",
    badgeColor: "bg-amber-soft/20 text-amber-900",
    title: "The 3-Step Task Deconstruct",
    desc: "Break any overwhelming assignment into 3 tiny 2-minute steps you can start without stress.",
    actionLabel: "Try Chunking",
  },
  {
    id: "break",
    category: "break",
    icon: EyeIcon,
    iconBg: "bg-sage/20 text-emerald-800",
    badge: "60-sec reset",
    badgeColor: "bg-sage/20 text-emerald-900",
    title: "Screen & Neck Reset",
    desc: "20-20-20 visual timer, shoulder roll, and a vagus nerve long sigh to release desk stiffness.",
    actionLabel: "Start 60s Reset",
  },
  {
    id: "mood",
    category: "mood",
    icon: CompassIcon,
    iconBg: "bg-ice text-cyan-800",
    badge: "Somatic grounding",
    badgeColor: "bg-ice text-cyan-900",
    title: "5-4-3-2-1 Sensory Grounding",
    desc: "Snap out of exam panic or brain fog by tapping 5 physical things you can sense around you.",
    actionLabel: "Ground Senses",
  },
  {
    id: "reflect",
    category: "reflect",
    icon: NotebookPenIcon,
    iconBg: "bg-brand-50 text-brand-700",
    badge: "Fast reflection",
    badgeColor: "bg-brand-50 text-brand-800",
    title: "3-Line Mindful Note",
    desc: "Answer 3 quick lines (what was hard, what went okay, what you need) and save to your journal.",
    actionLabel: "Unburden Mind",
  },
  {
    id: "talk",
    category: "talk",
    icon: MessageCircleHeartIcon,
    iconBg: "bg-periwinkle-light text-periwinkle-dark",
    badge: "Ready starters",
    badgeColor: "bg-periwinkle-light text-periwinkle-dark",
    title: "Safe Space Starters",
    desc: "Ready-made prompts to kick off a gentle, non-judgmental talk about your week.",
    actionLabel: "Browse Starters",
  },
  {
    id: "breath",
    category: "break",
    icon: WindIcon,
    iconBg: "bg-brand-100/70 text-brand-800",
    badge: "Box breathing",
    badgeColor: "bg-brand-100/60 text-brand-900",
    title: "1-Min Guided Breath",
    desc: "Follow the smooth expanding orb to downregulate stress and steady your pulse.",
    actionLabel: "Start Breathing",
  },
];

export function Wellbeing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = (user?.full_name || "").trim().split(" ")[0];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");
  const [tipAnswer, setTipAnswer] = useState(null);
  const [recentMoodScore, setRecentMoodScore] = useState(null);
  const [moodToast, setMoodToast] = useState("");
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState("Inhale");
  const [breathingActive, setBreathingActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeModalCategory, setActiveModalCategory] = useState("break");
  const shownTip = useRef(null);

  const load = useCallback(() => {
    return getSummary()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle tip impression logging
  useEffect(() => {
    const cat = data?.tip?.category;
    if (cat && shownTip.current !== cat) {
      shownTip.current = cat;
      setTipAnswer(null);
      logTipEvent(cat, "shown");
    }
  }, [data]);

  const answerTip = (action) => {
    if (!data?.tip?.category) return;
    setTipAnswer(action);
    logTipEvent(data.tip.category, action);
  };

  const handleQuickMood = async (score) => {
    setRecentMoodScore(score);
    try {
      const res = await sendMood(score);
      setMoodToast("Thank you for checking in. Your wellbeing rhythm has been updated.");
      if (res.data?.signal) {
        await load();
      }
      setTimeout(() => setMoodToast(""), 4500);
    } catch {
      setMoodToast("Could not record your mood. Please try again.");
    }
  };

  // Breathing exercise timer
  useEffect(() => {
    if (!breathingActive) return;
    const phases = [
      { text: "Breathe In Slowly...", duration: 4000 },
      { text: "Hold Gently...", duration: 4000 },
      { text: "Release Slowly...", duration: 4000 },
      { text: "Rest & Relax...", duration: 4000 },
    ];
    let idx = 0;
    setBreathingPhase(phases[0].text);
    const interval = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setBreathingPhase(phases[idx].text);
    }, 4000);
    return () => clearInterval(interval);
  }, [breathingActive]);

  const demo = async (scenario) => {
    setDemoBusy(true);
    setDemoMsg("");
    try {
      await runDemo(scenario);
      await load();
    } catch {
      setDemoMsg("Demo mode is not available.");
    } finally {
      setDemoBusy(false);
    }
  };

  const signal = data?.latest;
  const signals = data?.signals || {};
  const history = data?.history || [];
  const noData = !loading && (!signal || Object.keys(signals).length === 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cream via-cream-50 to-brand-50/50 p-6 sm:p-8 border border-black/[0.04] shadow-soft">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100/60 text-brand-800 text-xs font-semibold">
              <SparklesIcon size={13} className="text-brand-600" />
              <span>Personal Wellbeing & Balance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal tracking-tight">
              Your Wellbeing
            </h1>
            <p className="text-charcoal-light text-sm sm:text-base max-w-2xl leading-relaxed">
              A private, calm picture of your academic rhythm, energy, and balance.
              Everything here is designed to support you with zero judgment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBreathingOpen((v) => !v);
                setBreathingActive((v) => !v);
              }}
              className="bg-white/80 hover:bg-white text-charcoal border-black/10 gap-2 shadow-soft"
            >
              <WindIcon size={15} className="text-brand-600" />
              {breathingOpen ? "Close Grounding" : "1-Min Breath"}
            </Button>
          </div>
        </div>

        {/* Ambient Subtle Background */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-brand-200/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Primary Sanctuary Hub: Top 3 Core Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            icon: NotebookPenIcon,
            title: "Private Journal",
            desc: "Write or speak your inner reflections safely. Encrypted and visible only to you.",
            to: "/app/journal",
            tag: "Reflection",
            cta: "Open Journal",
          },
          {
            icon: MessageCircleHeartIcon,
            title: "Safe Space Chat",
            desc: "Supportive AI companion that understands your current academic workload.",
            to: "/app/wellbeing/chat",
            tag: "Support",
            cta: "Talk It Through",
          },
          {
            icon: ShieldCheckIcon,
            title: "Privacy & Data",
            desc: "Inspect stored signals, toggle sharing, or permanently erase records.",
            to: "/app/wellbeing/privacy",
            tag: "Your Control",
            cta: "Manage Settings",
          },
        ].map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="group text-left bg-white rounded-3xl border border-black/[0.04] shadow-soft p-5 flex flex-col justify-between hover:shadow-card hover:border-brand-200 transition-all duration-200"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors shadow-xs">
                  <item.icon size={19} />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted bg-black/[0.03] px-2.5 py-1 rounded-full">
                  {item.tag}
                </span>
              </div>
              <h3 className="font-serif font-bold text-charcoal text-base group-hover:text-brand-700 transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-charcoal-muted mt-1 leading-relaxed">{item.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.04] flex items-center justify-between text-xs font-semibold text-brand-600">
              <span>{item.cta}</span>
              <ArrowRightIcon size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        ))}
      </div>

      {/* 1-Minute Calming Breathing Exercise Widget */}
      <AnimatePresence>
        {breathingOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card padding="lg" className="bg-gradient-to-r from-brand-50/70 via-ice/40 to-sage-light/60 border-brand-200/60 text-center">
              <div className="max-w-md mx-auto py-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700 inline-flex items-center gap-1.5">
                    <WindIcon size={14} /> Guided Calming Breath
                  </span>
                  <button
                    onClick={() => {
                      setBreathingOpen(false);
                      setBreathingActive(false);
                    }}
                    className="text-xs text-charcoal-muted hover:text-charcoal"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="py-6 flex flex-col items-center justify-center">
                  <motion.div
                    animate={{
                      scale:
                        breathingPhase.includes("Inhale")
                          ? [1, 1.35]
                          : breathingPhase.includes("Hold")
                          ? 1.35
                          : breathingPhase.includes("Release")
                          ? [1.35, 1]
                          : 1,
                    }}
                    transition={{
                      duration: 4,
                      ease: "easeInOut",
                    }}
                    className="w-28 h-28 rounded-full bg-gradient-to-br from-brand-400 to-sage flex items-center justify-center text-white shadow-glow"
                  >
                    <HeartHandshakeIcon size={32} className="opacity-90" />
                  </motion.div>
                  <p className="mt-5 font-serif text-lg font-semibold text-charcoal">{breathingPhase}</p>
                  <p className="text-xs text-charcoal-muted mt-1">Four seconds in, four seconds still, four seconds out.</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Mood Pulse Check-In Directly on Dashboard */}
      <Card padding="md" className="bg-white/90 border-black/[0.04] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-serif font-bold text-charcoal text-base">How does your mind feel right now?</h3>
            <p className="text-xs text-charcoal-muted">Tap to log your mood instantly. It refreshes your personal picture with no extra clicks.</p>
          </div>
          {recentMoodScore && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
              <CheckCircle2Icon size={13} /> Checked in
            </span>
          )}
        </div>

        <div className="grid grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-label="Quick Mood Pulse">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.score}
              onClick={() => handleQuickMood(m.score)}
              className={cn(
                "group relative flex flex-col items-center justify-center py-3 px-2 rounded-2xl border transition-all duration-200",
                recentMoodScore === m.score
                  ? "bg-brand-50/80 border-brand-400 scale-[1.03] shadow-soft"
                  : "bg-cream/40 border-black/[0.05] hover:bg-cream hover:border-brand-200"
              )}
            >
              <span className="text-2xl sm:text-3xl transition-transform group-hover:scale-110">{m.emoji}</span>
              <span className="mt-1 text-xs font-semibold text-charcoal">{m.label}</span>
              <span className="hidden sm:inline text-[10px] text-charcoal-muted">{m.tone}</span>
            </button>
          ))}
        </div>

        {moodToast && (
          <p className="mt-2 text-xs font-medium text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2Icon size={14} /> {moodToast}
          </p>
        )}
      </Card>

      {/* Main Grid: Left 2 Cols (Pulse Breakdown & Suggestions), Right 1 Col (Summary & Trends) */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Multi-Dimensional Wellbeing Rhythm */}
          <Card padding="lg" className="border-black/[0.04]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-charcoal text-lg">Four Dimensions of Your Rhythm</h3>
                <p className="text-xs text-charcoal-muted">Calculated safely from your habits, reflections, and pacing.</p>
              </div>
              <span className="text-xs font-medium text-charcoal-muted bg-black/[0.03] px-2.5 py-1 rounded-full">
                Multi-Signal Fusion
              </span>
            </div>

            {noData ? (
              <div className="py-8 text-center bg-cream/40 rounded-2xl border border-dashed border-black/10 p-6">
                <SmileIcon size={32} className="mx-auto text-brand-400 mb-2 opacity-80" />
                <p className="font-semibold text-charcoal">Your picture begins with you</p>
                <p className="text-sm text-charcoal-light mt-1 max-w-sm mx-auto">
                  A single mood tap above or a short journal reflection begins shaping your personal rhythm.
                </p>
                <Link to="/app/journal" className="inline-block mt-4">
                  <Button size="sm" variant="soft">Write your first reflection</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {DIMENSIONS.map((dim) => {
                  const val = signals[dim.key];
                  const hasData = val !== undefined && val !== null;
                  return (
                    <div
                      key={dim.key}
                      className="p-3.5 rounded-2xl bg-cream/30 border border-black/[0.03] hover:bg-cream/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div>
                          <p className="text-sm font-bold text-charcoal">{dim.title}</p>
                          <p className="text-xs text-charcoal-muted">{dim.desc}</p>
                        </div>
                        <span
                          className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                            !hasData
                              ? "bg-black/[0.05] text-charcoal-muted"
                              : val < 0.3
                              ? "bg-sage/20 text-emerald-800"
                              : val < 0.6
                              ? "bg-amber-soft/20 text-amber-900"
                              : "bg-brand-500/20 text-brand-900"
                          )}
                        >
                          {wording(val)}
                        </span>
                      </div>
                      <ProgressBar
                        value={!hasData ? 0 : Math.max(5, Math.round(val * 100))}
                        color={barColor(val)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contextual Top Factors */}
            {data?.factors?.length > 0 && (
              <div className="mt-5 pt-4 border-t border-black/[0.05]">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-2 flex items-center gap-1.5">
                  <InfoIcon size={13} /> Contributing Factors
                </p>
                <ul className="space-y-1.5 text-xs text-charcoal-light">
                  {data.factors.slice(0, 3).map((f) => (
                    <li key={f.feature} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                      <span>{factorText(f)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Personalized Bandit Daily Suggestion */}
          {data?.tip && (
            <Card padding="lg" className="bg-gradient-to-br from-amber-light/50 via-cream to-peach/30 border-amber-soft/30 shadow-soft">
              <div className="flex items-start gap-4">
                <span className="w-11 h-11 rounded-2xl bg-amber-soft text-white flex items-center justify-center shrink-0 shadow-sm">
                  <LightbulbIcon size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-serif font-bold text-charcoal text-base">A Mindful Idea for Today</p>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/70 text-charcoal-muted">
                      Personalized Nudge
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-charcoal leading-relaxed">{data.tip.text}</p>
                  <p className="mt-2 text-xs text-charcoal-muted italic">{data.tip.reason}</p>

                  <div className="mt-4 pt-3 border-t border-black/[0.04]">
                    {tipAnswer === null ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveModalCategory(data.tip.category || "break");
                            setModalOpen(true);
                          }}
                          className="gap-1.5 shadow-sm bg-brand-600 hover:bg-brand-700 text-white"
                        >
                          <SparklesIcon size={14} /> Try This 1-Min Activity
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => answerTip("tried")}
                          className="gap-1.5 bg-white/80"
                        >
                          <CheckCircle2Icon size={14} /> Mark Tried
                        </Button>
                        <Button variant="soft" size="sm" onClick={() => answerTip("dismissed")}>
                          Not now
                        </Button>
                        <button
                          onClick={() => {
                            setActiveModalCategory("workload");
                            setModalOpen(true);
                          }}
                          className="text-xs font-semibold text-brand-700 hover:underline ml-auto"
                        >
                          Explore All Activities →
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2Icon size={14} />
                          {tipAnswer === "tried"
                            ? "Wonderful! We've noted your preference to tailor future ideas."
                            : "Understood — you are in full control of your habits."}
                        </p>
                        <button
                          onClick={() => {
                            setActiveModalCategory(data.tip.category || "break");
                            setModalOpen(true);
                          }}
                          className="text-xs font-semibold text-brand-700 hover:underline"
                        >
                          Reopen Activity
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Quick Mindful Resets & Fun Activities Shelf */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-charcoal text-base sm:text-lg flex items-center gap-2">
                  <SparklesIcon size={17} className="text-brand-500" />
                  Quick Mindful Resets & Activities
                </h3>
                <p className="text-xs text-charcoal-muted">
                  Bite-sized (1–2 min) fun activities you can try out anytime to take a mental pause or refocus.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FUN_ACTIVITIES.map((act) => (
                <button
                  key={act.id}
                  onClick={() => {
                    if (act.id === "breath") {
                      setBreathingOpen(true);
                      setBreathingActive(true);
                    } else {
                      setActiveModalCategory(act.category);
                      setModalOpen(true);
                    }
                  }}
                  className="group text-left p-3.5 rounded-2xl bg-white border border-black/[0.04] shadow-soft hover:shadow-card hover:border-brand-200 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-110",
                          act.iconBg
                        )}
                      >
                        <act.icon size={16} />
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          act.badgeColor
                        )}
                      >
                        {act.badge}
                      </span>
                    </div>
                    <h4 className="font-bold text-charcoal text-xs sm:text-sm group-hover:text-brand-700 transition-colors">
                      {act.title}
                    </h4>
                    <p className="text-[11px] text-charcoal-muted mt-1 leading-relaxed line-clamp-2">
                      {act.desc}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-black/[0.03] flex items-center justify-between text-xs font-semibold text-brand-600">
                    <span>{act.actionLabel}</span>
                    <ArrowRightIcon size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Emotional Summary & Trend Horizon */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg" className="bg-gradient-to-br from-brand-50 via-cream to-ice/30 border-brand-200/50 shadow-soft">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                  <ActivityIcon size={16} />
                </span>
                <span className="font-serif font-bold text-brand-900 text-base">Wellbeing Pulse</span>
              </div>

              <div className="space-y-3">
                <p className="text-charcoal-light leading-relaxed text-sm">
                  {signal ? (
                    <>
                      Your current pattern reads as{" "}
                      <strong className="text-charcoal font-bold">{signal.label}</strong>
                      {signal.trend === "RISING" ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold ml-1">
                          <TrendingUpIcon size={14} /> (gradually elevating)
                        </span>
                      ) : signal.trend === "FALLING" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold ml-1">
                          <TrendingDownIcon size={14} /> (gradually easing)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-charcoal-muted font-semibold ml-1">
                          <MinusIcon size={14} /> (steady)
                        </span>
                      )}
                      .
                    </>
                  ) : (
                    "Not enough data to calculate a pattern yet."
                  )}
                </p>

                {signal?.reasons?.length > 0 && signal.reasons[0] !== "not enough data yet" && (
                  <div className="bg-white/70 rounded-2xl p-3 border border-black/[0.04]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mb-1.5">Observations</p>
                    <ul className="space-y-1 text-xs text-charcoal-light list-disc pl-4">
                      {signal.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-charcoal-muted leading-relaxed">
                  This is a personal awareness tool, not a clinical diagnosis. If you ever feel in crisis or overwhelmed,
                  support is available around the clock.
                </p>

                <div className="pt-2">
                  <Button
                    variant="soft"
                    size="sm"
                    className="w-full justify-between bg-white/90 border border-black/[0.05]"
                    onClick={() => navigate("/app/weekly-checkin")}
                  >
                    <span>Complete Weekly Check-in</span>
                    <ArrowRightIcon size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Adaptive Scheduler & Recovery Mode Sync */}
          {signal && signal.risk_level !== "LOW" && (
            <Card padding="lg" className="bg-gradient-to-r from-sage-light/70 to-brand-50/70 border-sage/40 shadow-soft">
              <div className="flex items-start gap-3.5">
                <span className="w-10 h-10 rounded-2xl bg-white text-emerald-700 flex items-center justify-center shrink-0 shadow-sm border border-sage/30">
                  <CalendarCheckIcon size={18} />
                </span>
                <div>
                  <h4 className="font-bold text-charcoal text-sm">Adaptive Scheduler Active</h4>
                  <p className="mt-1 text-xs text-charcoal-light leading-relaxed">
                    Because strain is elevated, your Adaptive Scheduler will softly stagger lower-priority study
                    tasks. Urgent deadlines are never moved.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Historical Trend */}
          <Card padding="lg" className="border-black/[0.04] shadow-soft">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-serif font-bold text-charcoal text-base">Pattern Over Time</h3>
              <ClockIcon size={15} className="text-charcoal-muted" />
            </div>
            <p className="text-xs text-charcoal-muted mb-3">
              {history.length > 1
                ? "Past 14 signal updates. Lower on the curve indicates a calmer, more sustainable rhythm."
                : "Check in over several days to watch your trend take shape."}
            </p>

            {history.length > 1 ? (
              <div className="pt-2">
                <LineChart
                  data={history.map((v, i) => ({
                    label: `T-${history.length - i}`,
                    value: Math.round(v * 100),
                  }))}
                  color="#2E9C88"
                />
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-charcoal-muted bg-cream/30 rounded-2xl border border-dashed border-black/10">
                Log a few more days to view your continuous curve.
              </div>
            )}
          </Card>

          {/* Demo tools for Viva / Evaluation */}
          <details className="rounded-2xl border border-dashed border-black/15 p-4 text-sm bg-white/50">
            <summary className="cursor-pointer font-semibold text-charcoal-muted hover:text-charcoal">
              Viva & Demonstration Scenarios
            </summary>
            <p className="mt-2 text-xs text-charcoal-muted leading-relaxed">
              Instantly simulates 7 days of realistic student data for examiner evaluations without modifying other accounts.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="soft" size="sm" disabled={demoBusy} onClick={() => demo("bad")}>
                Simulate Strained Week
              </Button>
              <Button variant="soft" size="sm" disabled={demoBusy} onClick={() => demo("normal")}>
                Simulate Steady Week
              </Button>
            </div>
            {demoMsg && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {demoMsg}
              </p>
            )}
          </details>
        </div>
      </div>

      {/* Interactive Micro-Activities Modal */}
      <InteractiveTipModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        category={activeModalCategory}
        onCompleted={(cat) => answerTip("tried")}
      />
    </div>
  );
}
