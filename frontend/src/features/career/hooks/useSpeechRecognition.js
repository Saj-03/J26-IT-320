// Browser speech-to-text (Web Speech API) for voice answers.
// Only the resulting TEXT and the speaking time leave this hook - audio is never recorded or uploaded by IHUSD.
// Supported in Chrome and Edge (in Chrome, Google processes the audio to produce the transcript, so it needs internet).
import { useCallback, useEffect, useRef, useState } from "react";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
// Brave exposes the API but its speech service does not work.
const isBrave = typeof navigator !== "undefined" && !!navigator.brave;

/** Why voice input cannot work in this browser/page, or "" if it can. */
export function voiceProblem() {
  if (!Recognition || isBrave) return "Voice answers need Google Chrome or Microsoft Edge.";
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Voice answers only work on http://localhost:5173 (not an IP address like 192.168.x.x). Open the site via localhost.";
  }
  return "";
}

const ERROR_TEXT = {
  "not-allowed": "Microphone access is blocked. Click the camera/microphone icon in the address bar, allow the microphone, then try again.",
  "service-not-allowed": "The browser's speech service is blocked. Use Chrome or Edge with microphone access allowed.",
  "audio-capture": "No microphone was found. Check that a microphone is connected and selected in your system settings.",
  network: "Speech recognition needs an internet connection (Chrome sends the audio to Google to turn it into text).",
  "language-not-supported": "English speech recognition is not available in this browser.",
};

const joinText = (a, b) => `${a} ${b}`.replace(/\s+/g, " ").trim();

export default function useSpeechRecognition(lang = "en-US") {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState(""); // finalised text (editable by the student)
  const [interim, setInterim] = useState("");       // words still being recognised
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");             // non-fatal notice (e.g. no speech heard yet)
  // "" | "starting" | "mic-on" | "hearing" - shows where voice input stops working when debugging
  const [stage, setStage] = useState("");
  const recRef = useRef(null);
  const interimRef = useRef("");
  const keepListening = useRef(false);
  const startedAt = useRef(null);
  const spokenMs = useRef(0);

  const pauseClock = () => {
    if (startedAt.current) {
      spokenMs.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
  };

  // Chrome sometimes never finalises the last phrase when listening stops - keep those words.
  const flushInterim = () => {
    if (interimRef.current) {
      const words = interimRef.current;
      setTranscript((t) => joinText(t, words));
    }
    interimRef.current = "";
    setInterim("");
  };

  const start = useCallback(() => {
    const problem = voiceProblem();
    if (problem) {
      setError(problem);
      return;
    }
    if (keepListening.current) return;
    setError("");
    setHint("");

    const rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    const isCurrent = () => recRef.current === rec; // ignore events from an older recogniser
    rec.onaudiostart = () => isCurrent() && setStage("mic-on");
    rec.onspeechstart = () => isCurrent() && setStage("hearing");

    rec.onresult = (e) => {
      if (!isCurrent()) return;
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += `${r[0].transcript} `;
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript((t) => joinText(t, finalText));
      interimRef.current = interimText;
      setInterim(interimText);
      setHint("");
    };
    rec.onerror = (e) => {
      if (!isCurrent() || e.error === "aborted") return;
      if (e.error === "no-speech") {
        setHint("No speech heard yet - speak a little louder or check your microphone.");
        return; // not fatal: onend restarts listening
      }
      keepListening.current = false;
      pauseClock();
      setError(ERROR_TEXT[e.error] || `Speech recognition stopped (${e.error}). Try again, or type your answer.`);
    };
    // Chrome stops after a pause - restart automatically while the student is still answering.
    rec.onend = () => {
      if (!isCurrent()) return;
      if (keepListening.current) {
        try {
          rec.start();
          return;
        } catch {
          keepListening.current = false;
        }
      }
      pauseClock();
      flushInterim();
      setListening(false);
      setStage("");
    };

    recRef.current = rec;
    keepListening.current = true;
    try {
      rec.start();
    } catch {
      keepListening.current = false;
      recRef.current = null;
      setError("Could not start the microphone. Close other tabs using it and try again.");
      return;
    }
    startedAt.current = Date.now();
    setStage("starting");
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    keepListening.current = false;
    pauseClock();
    recRef.current?.stop(); // onend then flushes any unfinished words
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    keepListening.current = false;
    const rec = recRef.current;
    recRef.current = null; // detach first so its late events are ignored
    rec?.abort();
    startedAt.current = null;
    spokenMs.current = 0;
    interimRef.current = "";
    setListening(false);
    setTranscript("");
    setInterim("");
    setError("");
    setHint("");
    setStage("");
  }, []);

  /** Seconds spent speaking (from Start to Stop, across restarts). */
  const speakingSeconds = useCallback(
    () => (spokenMs.current + (startedAt.current ? Date.now() - startedAt.current : 0)) / 1000,
    []
  );

  useEffect(() => () => {
    keepListening.current = false;
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
  }, []);

  return {
    supported: !voiceProblem(), problem: voiceProblem(),
    listening, stage, transcript, setTranscript, interim, error, hint, start, stop, reset, speakingSeconds,
  };
}
