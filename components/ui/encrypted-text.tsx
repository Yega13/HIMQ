import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Scramble/decrypt reveal: each character starts as a random glyph and settles
// into the real text left-to-right. Pure client animation, no deps.
const CHARS = '!<>-_\\/[]{}=+*^?#0123456789ABCDEF';

interface Props {
  text: string;
  className?: string;
  encryptedClassName?: string;
  revealedClassName?: string;
  revealDelayMs?: number;
}

export function EncryptedText({
  text,
  className,
  encryptedClassName,
  revealedClassName,
  revealDelayMs = 50,
}: Props) {
  const [count, setCount] = useState(0); // how many chars are locked in

  // Reveal one more character every revealDelayMs until the whole string is set.
  useEffect(() => {
    setCount(0);
    let revealed = 0;
    const timer = setInterval(() => {
      revealed += 1;
      setCount(revealed);
      if (revealed >= text.length) clearInterval(timer);
    }, revealDelayMs);
    return () => clearInterval(timer);
  }, [text, revealDelayMs]);

  // Keep the not-yet-revealed tail scrambling until it's all locked in.
  const [, tick] = useState(0);
  useEffect(() => {
    if (count >= text.length) return;
    const scramble = setInterval(() => tick((t) => t + 1), 40);
    return () => clearInterval(scramble);
  }, [count, text.length]);

  return (
    <span className={className} aria-label={text}>
      {text.split('').map((ch, i) => {
        if (ch === ' ') return <span key={i}>{' '}</span>;
        const isRevealed = i < count;
        return (
          <span
            key={i}
            aria-hidden={!isRevealed || undefined}
            className={cn('transition-colors', isRevealed ? revealedClassName : encryptedClassName)}
          >
            {isRevealed ? ch : CHARS[Math.floor(Math.random() * CHARS.length)]}
          </span>
        );
      })}
    </span>
  );
}
