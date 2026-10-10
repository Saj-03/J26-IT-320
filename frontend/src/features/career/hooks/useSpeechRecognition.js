// Browser speech-to-text (Web Speech API) for voice answers.
// Only the resulting TEXT and the speaking time leave this hook - audio is never recorded or uploaded by IHUSD.
// Supported in Chrome and Edge (in Chrome, Google processes the audio to produce the transcript).
import { useCallback, useEffect, useRef, useState } from "react";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function useSpeechRecognition(lang = "en-US") {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState(""); // finalised text (editable by the student)
  const [interim, setInterim] = useState("");       // words still being recognised
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const keepListening = useRef(false);
  const startedAt = useRef(null);
  const spokenMs = useRef(0);

  const pauseClock = () => {
    if (startedAt.current) {
      spokenMs.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
  };

  const start = useCallback(() => {
    if (!Recognition || keepListening.current) return;
    setError("");
    const rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript((t) => `${t} ${finalText}`.replace(/\s+/g, " ").trimStart());
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      keepListening.current = false;
      pauseClock();
      setError(e.error === "not-allowed" ? "Microphone permission was denied." : `Speech recognition error: ${e.error}`);
    };
    // Chrome stops after a silence - restart automatically while the student is still answering.
    rec.onend = () => {
      if (keepListening.current) {
        try {
          rec.start();
        } catch {
          /* already restarting */
        }
      } else {
        setListening(false);
        setInterim("");
      }
    };

    recRef.current = rec;
    keepListening.current = true;
    startedAt.current = Date.now();
    rec.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    keepListening.current = false;
    pauseClock();
    recRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    keepListening.current = false;
    recRef.current?.abort();
    startedAt.current = null;
    spokenMs.current = 0;
    setListening(false);
    setTranscript("");
    setInterim("");
    setError("");
  }, []);

  /** Seconds spent speaking (from Start to Stop, across restarts). */
  const speakingSeconds = useCallback(
    () => (spokenMs.current + (startedAt.current ? Date.now() - startedAt.current : 0)) / 1000,
    []
  );

  useEffect(() => () => {
    keepListening.current = false;
    recRef.current?.abort();
  }, []);

  return { supported: !!Recognition, listening, transcript, setTranscript, interim, error, start, stop, reset, speakingSeconds };
}
