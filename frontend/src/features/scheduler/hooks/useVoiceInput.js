// [ITEM 6] VOICE INPUT HOOK (reusable)
// Uses the browser's built-in Web Speech API. No extra library and no backend.
// Works in Chrome and Edge. In Firefox `supported` is false, so the page hides the mic button.
//
// How to use:
//   const voice = useVoiceInput({ lang: 'en-US', onText: (text) => setInput(text) });
//   voice.supported  -> can this browser do speech-to-text?
//   voice.listening  -> is the mic on right now?
//   voice.error      -> a friendly error message ('' when no error)
//   voice.toggle()   -> click once to start, click again to stop
import { useCallback, useEffect, useRef, useState } from 'react';

// Chrome/Edge call it webkitSpeechRecognition, the standard name is SpeechRecognition
const SpeechRecognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// Turn browser error codes into simple messages for the user
function messageFor(code) {
    if (code === 'not-allowed' || code === 'service-not-allowed')
        return 'Please allow microphone access';
    if (code === 'no-speech')
        return 'Didn’t catch that, try again';
    if (code === 'audio-capture')
        return 'No microphone found';
    if (code === 'network')
        return 'Voice input needs an internet connection';
    if (code === 'aborted')
        return ''; // we stopped it ourselves, not a real error
    return 'Voice input stopped, please try again';
}

export function useVoiceInput({ lang = 'en-US', onText } = {}) {
    const supported = Boolean(SpeechRecognition);
    const [listening, setListening] = useState(false);
    const [error, setError] = useState('');
    const recognitionRef = useRef(null); // the running SpeechRecognition object
    const heardSomething = useRef(false); // did we get any words this time?

    // Always call the newest onText (so the page can pass a normal inline function)
    const onTextRef = useRef(onText);
    onTextRef.current = onText;

    const start = useCallback(() => {
        if (!supported || recognitionRef.current)
            return;
        setError('');
        heardSomething.current = false;

        const recognition = new SpeechRecognition();
        recognition.lang = lang; // 'en-US' (English) or 'si-LK' (Sinhala)
        recognition.continuous = true; // keep listening until the user clicks stop
        recognition.interimResults = true; // give live text while the user is still speaking

        // Called every time the browser hears more words
        recognition.onresult = (event) => {
            let finalText = '';
            let interimText = '';
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal)
                    finalText += result[0].transcript; // confirmed words
                else
                    interimText += result[0].transcript; // live "guess" words, may still change
            }
            heardSomething.current = true;
            onTextRef.current?.((finalText + interimText).trim());
        };

        recognition.onerror = (event) => setError(messageFor(event.error));

        // Called when listening stops (user clicked stop, silence, or error)
        recognition.onend = () => {
            setListening(false);
            recognitionRef.current = null;
            if (!heardSomething.current)
                setError((prev) => prev || 'Didn’t catch that, try again');
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            setListening(true);
        }
        catch {
            recognitionRef.current = null;
            setError('Voice input stopped, please try again');
        }
    }, [lang, supported]);

    const stop = useCallback(() => {
        recognitionRef.current?.stop(); // onend will set listening = false
    }, []);

    const toggle = useCallback(() => {
        if (recognitionRef.current)
            stop();
        else
            start();
    }, [start, stop]);

    const clearError = useCallback(() => setError(''), []);

    // Turn the mic off if the user leaves the page
    useEffect(() => () => recognitionRef.current?.abort(), []);

    return { supported, listening, error, start, stop, toggle, clearError };
}
