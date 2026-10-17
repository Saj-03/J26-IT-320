// Interviewer voice: reads text aloud with the browser's built-in text-to-speech (Web Speech API).
// Runs fully in the browser - no audio or text is sent to the ACRDS server.
import { useCallback, useEffect, useState } from "react";

const synth = () => (typeof window !== "undefined" && window.speechSynthesis) || null;

export default function useSpeechSynthesis() {
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const s = synth();
    if (!s) return undefined;
    // Voices load asynchronously in Chrome, so listen for the list to arrive.
    const load = () => setVoices(s.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en")));
    load();
    s.addEventListener("voiceschanged", load);
    return () => {
      s.removeEventListener("voiceschanged", load);
      s.cancel(); // stop talking when the page is left
    };
  }, []);

  /** Speak `text`; any sentence still being spoken is stopped first. */
  const speak = useCallback((text, { voiceURI, rate = 1, onEnd } = {}) => {
    const s = synth();
    if (!s || !text) return;
    s.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = s.getVoices().find((v) => v.voiceURI === voiceURI);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = rate;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = utterance.onerror = () => {
      setSpeaking(false);
      onEnd?.();
    };
    s.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    synth()?.cancel();
    setSpeaking(false);
  }, []);

  return { supported: !!synth(), voices, speaking, speak, cancel };
}
