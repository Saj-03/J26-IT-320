import { useState } from "react";
import { Volume2Icon, SquareIcon } from "lucide-react";
import { cn } from "../../../../shared/lib/cn";
import Button from "../CareerButton";

const TEST_SENTENCE = "Hello, I am your interviewer. If you can hear me clearly, your speakers are working.";
const SPEEDS = [{ value: 0.85, label: "Slow" }, { value: 1, label: "Normal" }, { value: 1.15, label: "Fast" }];

const selectClass = "w-full rounded-xl border border-[#9ADBCC]/60 bg-white px-3 py-2 text-sm text-charcoal outline-none "
  + "focus:border-[#5DBFA9] focus:ring-2 focus:ring-[#9ADBCC]/40";

// Speaker self-test before the interview: play a sentence in the chosen interviewer voice and speed.
export default function SpeakerCheck({ tts, voiceURI, rate, onChange }) {
  const [heard, setHeard] = useState(null); // null = not answered yet, true / false

  if (!tts.supported) {
    return (
      <p className="text-xs font-semibold text-red-700 bg-red-50 rounded-xl px-3 py-2">
        This browser cannot read questions aloud. Use Chrome or Edge, or read the questions on screen.
      </p>
    );
  }

  const play = () => {
    setHeard(null);
    tts.speak(TEST_SENTENCE, { voiceURI, rate });
  };

  return (
    <div className="rounded-2xl border border-[#9ADBCC]/60 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-charcoal">Test your speakers</p>
        {tts.speaking ? (
          <Button size="sm" variant="outline" onClick={tts.cancel}><SquareIcon size={14} /> Stop</Button>
        ) : (
          <Button size="sm" variant="soft" onClick={play}><Volume2Icon size={14} /> Play test sound</Button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-charcoal-light space-y-1">
          <span>Interviewer voice</span>
          <select className={selectClass} value={voiceURI} onChange={(e) => onChange({ voiceURI: e.target.value })}>
            <option value="">Browser default (English)</option>
            {tts.voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </label>
        <div className="text-xs font-semibold text-charcoal-light space-y-1">
          <span>Speaking speed</span>
          <div className="flex gap-2">
            {SPEEDS.map((s) => (
              <button key={s.value} type="button" onClick={() => onChange({ rate: s.value })}
                className={cn("flex-1 rounded-xl border px-2 py-2 text-xs font-bold transition-colors",
                  rate === s.value
                    ? "bg-[#9ADBCC] border-[#9ADBCC] text-[#12352E]"
                    : "bg-[#FFFBF0] border-[#9ADBCC]/50 text-charcoal-light hover:bg-[#E3FFD6]")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-charcoal-light">Did you hear the test sentence?</span>
        <button type="button" onClick={() => setHeard(true)}
          className={cn("rounded-full px-3 py-1 font-bold", heard === true ? "bg-[#C7F2D1] text-[#1F5E3D]" : "bg-black/[0.04] text-charcoal-muted")}>
          Yes
        </button>
        <button type="button" onClick={() => setHeard(false)}
          className={cn("rounded-full px-3 py-1 font-bold", heard === false ? "bg-[#9EB2DB] text-[#1E2D57]" : "bg-black/[0.04] text-charcoal-muted")}>
          No
        </button>
      </div>
      {heard === true && <p className="text-xs font-semibold text-[#1F5E3D]">✓ Speakers work. Each question will be read aloud.</p>}
      {heard === false && (
        <ul className="text-xs text-[#34477A] bg-[#D0F2F7]/60 rounded-xl px-4 py-2 list-disc pl-6 space-y-0.5">
          <li>Turn up the volume and check the tab is not muted (right-click the tab).</li>
          <li>Check the right output device (headphones or speakers) is selected in Windows sound settings.</li>
          <li>Try another voice above - some voices only download after the first use.</li>
          <li>You can still practise: the question is always shown on screen.</li>
        </ul>
      )}
    </div>
  );
}
