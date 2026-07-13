import { useState, type ReactNode, type MouseEvent } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

// A soft brand-colored spotlight that follows the cursor across the card, fading
// in on hover. Theme-aware: the glow is `--color-brand` at low alpha, so it
// reads on both light and dark surfaces (unlike the dark-only original). The
// overlay sits on top with pointer-events-none, so it never affects layout or
// interaction — pass the card's own classes via `className`.
export function CardSpotlight({
  children,
  className,
  radius = 340,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
}) {
  const mouseX = useMotionValue(-radius);
  const mouseY = useMotionValue(-radius);
  const [hovered, setHovered] = useState(false);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, color-mix(in srgb, var(--color-brand) 16%, transparent), transparent 78%)`;

  return (
    <div
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn('relative', className)}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{ background, opacity: hovered ? 1 : 0 }}
      />
    </div>
  );
}
