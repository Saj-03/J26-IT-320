import { KeyboardIcon, MicIcon, VideoIcon, ShieldCheckIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { SelectField } from "../../../../shared/components/ui/Field";
import { cn } from "../../../../shared/lib/cn";
import Card from "../CareerCard";
import Button from "../CareerButton";
import { ETHICS_NOTES } from "../../constants";
import { ui } from "../../theme";

const MODES = [
  { id: "text", icon: KeyboardIcon, title: "Typed answers", desc: "Type your answers. Scores content only.", needsSpeech: false },
  { id: "voice", icon: MicIcon, title: "Voice", desc: "Speak your answers. Adds pace and filler-word feedback.", needsSpeech: true },
  { id: "camera", icon: VideoIcon, title: "Voice + camera", desc: "Adds presentation feedback (in frame, facing camera).", needsSpeech: true },
];

const PROVIDER_NAME = { gemini: "Google Gemini", openai: "OpenAI", claude: "Anthropic Claude" };

export default function InterviewSetup({ careers, settings, onChange, onStart, speechSupported, llm, busy, error }) {
  const set = (key, value) => onChange({ ...settings, [key]: value });
  const usesMedia = settings.mode !== "text";

  return (
    <div className="space-y-5">
      <Card padding="lg" className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField name="career" label="Career to practise for" value={settings.careerId}
            onChange={(e) => set("careerId", e.target.value)}>
            {careers.map((c) => <option key={c.career_id} value={c.career_id}>{c.career_name}</option>)}
          </SelectField>
          <SelectField name="variant" label="Question set" value={settings.variant}
            onChange={(e) => set("variant", Number(e.target.value))}>
            {[0, 1, 2, 3].map((v) => <option key={v} value={v}>Practice set {v + 1}</option>)}
          </SelectField>
        </div>

        <div>
          <p className="text-sm font-semibold text-charcoal-light mb-2">Answer mode</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {MODES.map(({ id, icon: Icon, title, desc, needsSpeech }) => {
              const disabled = needsSpeech && !speechSupported;
              return (
                <button key={id} type="button" disabled={disabled} onClick={() => set("mode", id)}
                  className={cn("text-left rounded-2xl border p-4 transition-colors disabled:opacity-50",
                    settings.mode === id ? ui.choiceOn : ui.choiceOff)}>
                  <Icon size={20} className="mb-2" />
                  <p className="font-bold text-sm">{title}</p>
                  <p className="text-xs mt-1 opacity-80">{desc}</p>
                </button>
              );
            })}
          </div>
          {!speechSupported && (
            <p className="text-xs text-charcoal-muted mt-2">
              Voice modes need Chrome or Microsoft Edge (Web Speech API). Typed answers work in every browser.
            </p>
          )}
        </div>
      </Card>

      <Card padding="lg" className="bg-[#D0F2F7]/50 border-[#9EB2DB]">
        <h3 className="font-bold text-charcoal mb-2 flex items-center gap-2">
          <ShieldCheckIcon size={18} className="text-[#1F5F53]" /> Privacy and consent
        </h3>
        <ul className="space-y-1 text-sm text-charcoal-light list-disc pl-5">
          {ETHICS_NOTES.map((n) => <li key={n}>{n}</li>)}
          <li>Only your answer text, speaking time and (in camera mode) three face-detection numbers are sent to the server.</li>
          {usesMedia && <li>Voice answers are converted to text by your browser&apos;s speech recognition (in Chrome this is processed by Google).</li>}
          {settings.mode === "camera" && <li>Face detection runs inside your browser. The video never leaves your device.</li>}
        </ul>
        {/* Shown only when the server has an LLM provider configured */}
        {llm.enabled && (
          <label className="flex items-start gap-2 mt-4 text-sm text-charcoal-light cursor-pointer">
            <input type="checkbox" className="mt-1 accent-[#5DBFA9]" checked={settings.useLlm}
              onChange={(e) => set("useLlm", e.target.checked)} />
            <span>
              <span className="font-semibold text-charcoal flex items-center gap-1">
                <SparklesIcon size={14} /> AI coach feedback (optional)
              </span>
              Sends your answer text and scores to {PROVIDER_NAME[llm.provider] || llm.provider} to write more
              detailed feedback. No name, audio or video is sent. Untick to keep your answers on this system only.
            </span>
          </label>
        )}
        <label className="flex items-start gap-2 mt-4 text-sm font-semibold text-charcoal cursor-pointer">
          <input type="checkbox" className="mt-1 accent-[#5DBFA9]" checked={settings.consent}
            onChange={(e) => set("consent", e.target.checked)} />
          I understand and agree{usesMedia ? " to use my microphone" : ""}{settings.mode === "camera" ? " and camera" : ""} for this practice session.
        </label>
      </Card>

      {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}
      <Button size="lg" fullWidth disabled={!settings.consent || !settings.careerId || busy} onClick={onStart}>
        <PlayIcon size={18} /> {busy ? "Loading questions…" : "Start interview (5 questions)"}
      </Button>
    </div>
  );
}
