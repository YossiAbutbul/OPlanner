import { useCallback, useEffect, useRef, useState } from "react";

// Speech to text with the browser's own recognizer (Web Speech API): no
// server and no cost. Chrome, Edge and Safari have it; Firefox doesn't, so
// `supported` is false there and callers hide the mic. In Chrome the
// browser sends the audio to Google to recognize it; it never reaches us.

interface RecognitionResult {
  0: { transcript: string };
  length: number;
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
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

// `onText` gets everything heard so far in this session, on every update.
export const useDictation = (onText: (text: string) => void) => {
  const supported = !!recognizer();
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognizer();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = pickLang();
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onTextRef.current(text);
    };
    const done = () => {
      rec.current = null;
      setListening(false);
    };
    r.onend = done;
    // Mic blocked or no speech: just stop; whatever was heard stays.
    r.onerror = done;
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
