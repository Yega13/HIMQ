import { motion } from 'framer-motion';
import { useMemo } from 'react';

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#eab308', '#ec4899', '#8b5cf6'];

// Lightweight one-shot confetti burst — no dependency, pure framer. Mount it
// only when you want the burst (e.g. on course completion); it plays once and
// the pieces fall off-screen. pointer-events-none so it never blocks clicks.
export function Confetti({ count = 46 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 1.7 + Math.random() * 1.5,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 180,
        color: COLORS[i % COLORS.length],
        w: 7 + Math.random() * 7,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ top: '-8%', opacity: 1, rotate: p.rotate }}
          animate={{ top: '110%', x: p.drift, rotate: p.rotate + 480, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 0.55,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
