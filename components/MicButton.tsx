import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

// Minimal typing for the Web Speech API (no DOM lib types for it).
interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
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

// Browser-native voice dictation. Tap to speak; the transcript is appended to
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
  const baseRef = useRef('');
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let spoken = '';
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      const base = baseRef.current;
      cbRef.current((base ? base.trimEnd() + ' ' : '') + spoken);
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
              animate={{ scaleY: [0.35, 1, 0.35] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
            />
          ))}
        </span>
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
