import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

// Minimal typing for the Web Speech API (no DOM lib types for it).
interface SpeechResult { transcript: string; }
interface SpeechResultItem extends ArrayLike<SpeechResult> { isFinal: boolean; }
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResultItem>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SRCtor = new () => SpeechRecognitionLike;

const LANG_MAP: Record<string, string> = { en: 'en-US', ru: 'ru-RU', am: 'hy-AM' };

// Browser-native voice dictation. Tap to start, tap again to stop — recording
// does NOT end on its own after a pause (continuous: true), so a few seconds
// of silence mid-thought doesn't cut you off. The transcript is appended to
// whatever text is already there (captured at start via getText). Hidden when
// the browser has no Speech Recognition support (Chrome/Edge/Safari do).
export function MicButton({
  lang = 'en',
  getText,
  onTranscript,
  disabled,
}: {
  lang?: string;
  getText: () => string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef('');       // text the transcript builds on top of
  const finalRef = useRef('');      // finalized (committed) speech so far, this session
  const lastSetRef = useRef('');    // what we last wrote into the textbox
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;
  const getTextRef = useRef(getText);
  getTextRef.current = getText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    // continuous: true — recording stays open across pauses, only the user
    // toggling the button ends it. The Web Speech API replays already-final
    // results on later events when continuous, so results are walked from
    // e.resultIndex (only what's new this event) and split by result.isFinal:
    // finals accumulate into finalRef once, interim text is shown but never
    // committed, so nothing gets double-counted.
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      // If the textbox no longer matches what we last wrote, the user edited
      // it by hand mid-recording (e.g. fixing a word) — treat their edit as
      // the new base to build on top of, instead of clobbering it with the
      // next transcript update.
      const current = getTextRef.current();
      if (current !== lastSetRef.current) baseRef.current = current;

      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      const base = baseRef.current;
      const spoken = (finalRef.current + interim).trim();
      const combined = (base ? base.trimEnd() + ' ' : '') + spoken;
      lastSetRef.current = combined;
      cbRef.current(combined);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.abort(); } catch { /* noop */ } };
  }, []);

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    baseRef.current = getText();
    finalRef.current = '';
    lastSetRef.current = baseRef.current;
    rec.lang = LANG_MAP[lang] ?? 'en-US';
    try {
      rec.start();
      setListening(true);
    } catch { /* already started */ }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label="Voice input"
      title="Voice input"
      className={cn(
        'shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border transition-colors disabled:opacity-50',
        listening
          ? 'border-red-500 bg-red-500 text-white'
          : 'border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)]',
      )}
    >
      {listening ? (
        <span className="flex items-center gap-[3px] h-4">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-[3px] h-full bg-white rounded-full"
              animate={{ scaleY: [0.55, 1, 0.55] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
            />
          ))}
        </span>
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
