import { useCallback, useEffect, useRef, useState } from "react";

// Speech to text with the browser's own recognizer (Web Speech API): no
// server and no cost. Chrome, Edge and Safari have it; Firefox doesn't, so
// `supported` is false there and callers hide the mic. In Chrome the
// browser sends the audio to Google to recognize it; it never reaches us.

interface RecognitionResult {
  0: { transcript: string };
  length: number;
  isFinal?: boolean;
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface RecognitionErrorEvent {
  error?: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const recognizer = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

// Hebrew when the student uses Hebrew anywhere in their languages (most do
// here), else the browser's own language.
const pickLang = () => {
  const langs = typeof navigator === "undefined" ? [] : [...(navigator.languages ?? []), navigator.language];
  if (langs.some((l) => /^(he|iw)\b/i.test(l ?? ""))) return "he-IL";
  return langs[0] || "he-IL";
};

// What was said, from the recognizer's results. Some phones (Chrome on
// Android) report each update as a new result holding everything said so
// far, so a result that repeats or extends the previous one replaces it
// rather than being added again.
export const joinResults = (results: ArrayLike<RecognitionResult>): string => {
  const parts: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const t = results[i][0].transcript.trim();
    if (!t) continue;
    const last = parts[parts.length - 1];
    if (last !== undefined && t.startsWith(last)) parts[parts.length - 1] = t;
    else if (last !== undefined && last.startsWith(t)) continue;
    else parts.push(t);
  }
  return parts.join(" ");
};

// Why listening stopped, in words; null when there's nothing to say.
const errorText = (code?: string): string | null => {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it for this site in the browser's settings.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Speech recognition needs a connection. Try again online.";
    case "language-not-supported":
      return "This browser can't recognize this language. Try Chrome.";
    case "no-speech":
      return "Didn't hear anything. Tap the mic and speak.";
    default:
      return null; // "aborted" and the like: stopped on purpose
  }
};

// `onText` gets everything heard so far in this session, on every update;
// `onError` a sentence to show when listening fails.
export const useDictation = (onText: (text: string) => void, onError?: (message: string) => void) => {
  const supported = !!recognizer();
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const handlers = useRef({ onText, onError });
  useEffect(() => {
    handlers.current = { onText, onError };
  }, [onText, onError]);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognizer();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = pickLang();
    // One utterance per tap: ends by itself after a pause. Continuous mode
    // repeats text on phones and hangs silently in some desktop browsers.
    r.continuous = false;
    r.interimResults = true;
    // Some browsers open the mic and then never answer (no words, no
    // error). Give up after a while so the button doesn't stay on forever.
    let heard = false;
    const watchdog = setTimeout(() => {
      if (heard || rec.current !== r) return;
      handlers.current.onError?.(
        "The browser's speech service isn't answering. Try again, or use Chrome on your phone."
      );
      r.abort();
    }, 12_000);
    r.onaudiostart = () => console.debug("Dictation: mic open");
    r.onspeechstart = () => console.debug("Dictation: speech heard");
    r.onresult = (e) => {
      heard = true;
      handlers.current.onText(joinResults(e.results));
    };
    const done = () => {
      clearTimeout(watchdog);
      if (rec.current === r) rec.current = null;
      setListening(false);
    };
    r.onend = done;
    r.onerror = (e) => {
      console.warn("Dictation stopped:", e?.error);
      const msg = errorText(e?.error);
      if (msg) handlers.current.onError?.(msg);
      done();
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      done();
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, start, stop };
};
