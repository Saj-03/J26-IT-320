import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  XIcon,
  SparklesIcon,
  CheckCircle2Icon,
  CheckIcon,
  ArrowRightIcon,
  ClockIcon,
  EyeIcon,
  SmileIcon,
  NotebookPenIcon,
  ListTodoIcon,
  MessageCircleHeartIcon,
  WindIcon,
  RotateCcwIcon,
  PartyPopperIcon,
} from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { logTipEvent, addJournal } from "../api";

export function InteractiveTipModal({ isOpen, onClose, category = "break", onCompleted }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(category);
  const [completed, setCompleted] = useState(false);

  // Sync tab with incoming category
  useEffect(() => {
    if (category) {
      setActiveTab(category);
    }
    setCompleted(false);
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleFinish = (cat) => {
    setCompleted(true);
    logTipEvent(cat, "tried");
    if (onCompleted) onCompleted(cat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="relative w-full max-w-lg bg-cream-50 rounded-3xl border border-black/10 shadow-lift overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-white/70">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <SparklesIcon size={16} />
            </span>
            <div>
              <h3 className="font-serif font-bold text-charcoal text-base">Mindful Micro-Activity</h3>
              <p className="text-[11px] text-charcoal-muted">1–2 minute guided decompression</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-charcoal-muted hover:text-charcoal hover:bg-black/[0.05] transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Category Activity Selector Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 overflow-x-auto border-b border-black/[0.04] bg-cream/40 no-scrollbar">
          {[
            { id: "workload", label: "Task Chunking", icon: ListTodoIcon },
            { id: "break", label: "Screen & Neck Reset", icon: EyeIcon },
            { id: "mood", label: "Sensory Grounding", icon: SmileIcon },
            { id: "reflect", label: "3-Line Unburden", icon: NotebookPenIcon },
            { id: "talk", label: "Talk Starter", icon: MessageCircleHeartIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setCompleted(false);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-white/60 text-charcoal-light hover:bg-white hover:text-charcoal border border-black/[0.04]"
              )}
            >
              <tab.icon size={13} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body / Active Activity */}
        <div className="p-6 overflow-y-auto flex-1">
          {completed ? (
            <CelebrationView onClose={onClose} />
          ) : (
            <>
              {activeTab === "workload" && <WorkloadChunkingActivity onFinish={() => handleFinish("workload")} />}
              {activeTab === "break" && <PhysicalScreenResetActivity onFinish={() => handleFinish("break")} />}
              {activeTab === "rest" && <PhysicalScreenResetActivity onFinish={() => handleFinish("rest")} />}
              {activeTab === "mood" && <SensoryGroundingActivity onFinish={() => handleFinish("mood")} />}
              {activeTab === "reflect" && <ThreeLineReflectionActivity onFinish={() => handleFinish("reflect")} />}
              {activeTab === "talk" && <TalkStarterActivity onClose={onClose} onFinish={() => handleFinish("talk")} />}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------
// 1. WORKLOAD: 3-Step Cognitive Deconstruction (Task Chunking)
// -------------------------------------------------------------
function WorkloadChunkingActivity({ onFinish }) {
  const [taskName, setTaskName] = useState("");
  const [steps, setSteps] = useState([
    { text: "Open required doc / code file and read the first requirement", done: false },
    { text: "Draft just 1 rough section or function outline", done: false },
    { text: "Take a real 5-minute break away from screen", done: false },
  ]);

  const toggleStep = (idx) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, done: !s.done } : s))
    );
  };

  const updateStepText = (idx, val) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, text: val } : s))
    );
  };

  const allDone = steps.every((s) => s.done);

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
          Executive Dysfunction Antidote
        </span>
        <h4 className="font-serif font-bold text-charcoal text-lg mt-1">
          The 3-Step Task Deconstruct
        </h4>
        <p className="text-xs text-charcoal-light leading-relaxed">
          When an assignment feels massive, our brain enters freeze mode. Break it down into 3 ridiculously small steps
          that feel easy to begin.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-charcoal">What task is feeling heavy?</label>
        <input
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          placeholder="e.g. IT320 Final Report Architecture Section"
          className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs outline-none focus:border-brand-400"
        />
      </div>

      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold text-charcoal">3 Tiny Next Actions (Click to check off):</p>
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
              step.done
                ? "bg-sage-light/50 border-sage/60 text-emerald-900"
                : "bg-white border-black/10 text-charcoal"
            )}
          >
            <button
              onClick={() => toggleStep(idx)}
              className={cn(
                "w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors",
                step.done
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-black/20 hover:border-brand-400 bg-cream/30"
              )}
            >
              {step.done && <CheckIcon size={14} />}
            </button>
            <input
              value={step.text}
              onChange={(e) => updateStepText(idx, e.target.value)}
              className={cn(
                "flex-1 text-xs bg-transparent outline-none",
                step.done && "line-through opacity-70"
              )}
            />
          </div>
        ))}
      </div>

      <div className="pt-2">
        <Button onClick={onFinish} className="w-full gap-2 shadow-sm">
          <CheckCircle2Icon size={15} /> Complete & Mark Tried
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2. BREAK / REST: 60-Second Physical Screen & Neck Reset
// -------------------------------------------------------------
function PhysicalScreenResetActivity({ onFinish }) {
  const [seconds, setSeconds] = useState(20);
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  const steps = [
    {
      title: "The 20-20-20 Rule",
      desc: "Look away from your screen at an object at least 20 feet away (out the window or down the hall). Relax your gaze.",
      time: 20,
    },
    {
      title: "Shoulder & Chest Roll",
      desc: "Roll both shoulders up toward your ears, then slowly back and down 3 times. Let your collarbones broaden.",
      time: 20,
    },
    {
      title: "Vagus Nerve Long Sigh",
      desc: "Inhale deeply through your nose, then let out a slow, audible sigh through your mouth. Drop your jaw tension.",
      time: 20,
    },
  ];

  useEffect(() => {
    let timer = null;
    if (running && seconds > 0) {
      timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else if (running && seconds === 0) {
      if (stepIdx < steps.length - 1) {
        setStepIdx((i) => i + 1);
        setSeconds(steps[stepIdx + 1].time);
      } else {
        setRunning(false);
        onFinish();
      }
    }
    return () => clearInterval(timer);
  }, [running, seconds, stepIdx, steps, onFinish]);

  const currentStep = steps[stepIdx];

  return (
    <div className="space-y-5 text-center py-2">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full">
          60-Second Ergonomic Reset
        </span>
        <h4 className="font-serif font-bold text-charcoal text-lg mt-1">
          {currentStep.title} (Step {stepIdx + 1} of 3)
        </h4>
        <p className="text-xs text-charcoal-light max-w-sm mx-auto mt-1 leading-relaxed">
          {currentStep.desc}
        </p>
      </div>

      {/* Visual Circular Timer */}
      <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="transparent"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="transparent"
            stroke="#2E9C88"
            strokeWidth="8"
            strokeDasharray={264}
            strokeDashoffset={264 - (264 * (20 - seconds)) / 20}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-serif font-bold text-charcoal">{seconds}s</span>
          <span className="text-[10px] uppercase font-semibold text-charcoal-muted">Remaining</span>
        </div>
      </div>

      <div className="flex justify-center gap-3 pt-2">
        {!running ? (
          <Button onClick={() => setRunning(true)} className="px-6 shadow-sm">
            {seconds === 20 && stepIdx === 0 ? "Start 60s Reset" : "Resume Timer"}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setRunning(false)}>
            Pause
          </Button>
        )}
        <Button variant="soft" onClick={onFinish}>
          Skip to Done
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 3. MOOD: 5-4-3-2-1 Sensory Grounding (Academic Anxiety Reliever)
// -------------------------------------------------------------
function SensoryGroundingActivity({ onFinish }) {
  const [checkedItems, setCheckedItems] = useState({});

  const toggle = (key) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const tasks = [
    { id: "see1", text: "Look around and spot 1 object with a texture", group: "See (3)" },
    { id: "see2", text: "Spot 1 color you hadn't noticed today", group: "See (3)" },
    { id: "see3", text: "Spot 1 light reflection or shadow", group: "See (3)" },
    { id: "touch1", text: "Feel the surface of your desk or laptop with your fingertips", group: "Touch (2)" },
    { id: "touch2", text: "Feel your feet making contact with the floor", group: "Touch (2)" },
    { id: "hear1", text: "Listen carefully for the most distant ambient sound in your room", group: "Hear (1)" },
  ];

  const count = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
          Somatic Grounding
        </span>
        <h4 className="font-serif font-bold text-charcoal text-lg mt-1">
          5-4-3-2-1 Sensory Grounding
        </h4>
        <p className="text-xs text-charcoal-light leading-relaxed">
          Grounding pulls your brain out of future deadline panic and snaps it back to the physical present.
          Tap each sensory observation as you notice it.
        </p>
      </div>

      <div className="space-y-2">
        {tasks.map((t) => {
          const isDone = Boolean(checkedItems[t.id]);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={cn(
                "w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                isDone
                  ? "bg-sage-light/60 border-sage/60 text-emerald-900"
                  : "bg-white border-black/10 hover:border-brand-200 text-charcoal"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 text-xs font-bold transition-colors",
                  isDone
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-black/20 bg-cream/30"
                )}
              >
                {isDone ? "✓" : ""}
              </span>
              <span className="flex-1 text-xs">{t.text}</span>
              <span className="text-[10px] font-bold text-charcoal-muted uppercase">{t.group.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <Button onClick={onFinish} className="w-full gap-2 shadow-sm">
          <CheckCircle2Icon size={15} /> Grounded ({count}/{tasks.length}) — Finish
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 4. REFLECT: 3-Line Mindful Unburdening (Direct to Journal)
// -------------------------------------------------------------
function ThreeLineReflectionActivity({ onFinish }) {
  const [hard, setHard] = useState("");
  const [good, setGood] = useState("");
  const [need, setNeed] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveToJournal = async () => {
    setSaving(true);
    const entryText = `[3-Line Mindful Unburden]\n• What was heavy today: ${hard || "Not specified"}\n• What went okay: ${good || "Not specified"}\n• What I need tomorrow: ${need || "Not specified"}`;
    try {
      await addJournal({ mode: "text", text: entryText });
      onFinish();
    } catch {
      onFinish();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
          Expressive Journaling
        </span>
        <h4 className="font-serif font-bold text-charcoal text-lg mt-1">
          The 3-Line Unburdening
        </h4>
        <p className="text-xs text-charcoal-light leading-relaxed">
          You don't need to write an essay. Answer three simple lines to clear your mental cache for the night.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-charcoal">1. What felt heaviest or hardest today?</label>
          <input
            value={hard}
            onChange={(e) => setHard(e.target.value)}
            placeholder="e.g. Trying to fix that stubborn bug in the database"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-brand-400"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-charcoal">2. What is one thing that went okay or better than expected?</label>
          <input
            value={good}
            onChange={(e) => setGood(e.target.value)}
            placeholder="e.g. Had lunch with a friend / pushed my branch"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-brand-400"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-charcoal">3. What is one small kindness you need tomorrow?</label>
          <input
            value={need}
            onChange={(e) => setNeed(e.target.value)}
            placeholder="e.g. A walk in the sunshine / not opening emails before 9am"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-brand-400"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button onClick={handleSaveToJournal} disabled={saving} className="w-full gap-2 shadow-sm">
          <NotebookPenIcon size={15} />
          {saving ? "Saving to Journal..." : "Save Directly to Private Journal"}
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 5. TALK: Conversational Support Starters
// -------------------------------------------------------------
function TalkStarterActivity({ onClose, onFinish }) {
  const navigate = useNavigate();

  const prompts = [
    {
      title: "Coursework Overwhelm",
      text: "I have so many assignments due at once and I'm feeling paralyzed. Can we break this down together?",
    },
    {
      title: "Imposter Fatigue",
      text: "I'm exhausted and feeling like everyone else on the course is coping much better than I am.",
    },
    {
      title: "Gentle Decompression",
      text: "I just need a safe space to vent about today without being judged.",
    },
  ];

  const launchChatWith = (text) => {
    onFinish();
    onClose();
    // Navigate to chat with message in state
    navigate("/app/wellbeing/chat", { state: { prefilled: text } });
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
          Low-Friction Safe Space
        </span>
        <h4 className="font-serif font-bold text-charcoal text-lg mt-1">
          Talk It Through (Ready-Made Starters)
        </h4>
        <p className="text-xs text-charcoal-light leading-relaxed">
          Starting a conversation is often the hardest step. Click any prompt below to begin a comforting chat with
          your ThriveU academic companion.
        </p>
      </div>

      <div className="space-y-2.5">
        {prompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => launchChatWith(p.text)}
            className="w-full text-left p-3.5 rounded-2xl bg-white border border-black/[0.06] hover:border-brand-300 hover:bg-cream/40 transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-charcoal group-hover:text-brand-700 transition-colors">
                {p.title}
              </span>
              <ArrowRightIcon size={13} className="text-charcoal-muted group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-charcoal-light italic">"{p.text}"</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Celebration View upon Completion
// -------------------------------------------------------------
function CelebrationView({ onClose }) {
  return (
    <div className="py-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-400 to-sage text-white mx-auto flex items-center justify-center shadow-glow">
        <PartyPopperIcon size={30} />
      </div>

      <div>
        <h4 className="font-serif font-bold text-charcoal text-xl">Well Done, Mindful Moment Complete!</h4>
        <p className="text-xs text-charcoal-light max-w-sm mx-auto mt-1 leading-relaxed">
          Taking even 60 seconds to step back, breathe, and ground yourself directly protects your cognitive stamina.
          Your adaptive tip preference has been updated.
        </p>
      </div>

      <div className="pt-3">
        <Button onClick={onClose} className="px-6 shadow-sm">
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
