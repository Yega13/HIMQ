import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ThreeDMarqueeItem =
  | { type: "logo" }
  | { type: "cta"; desc: string };

function ItemCard({ item }: { item: ThreeDMarqueeItem }) {
  if (item.type === "logo") {
    return (
      <div className="w-[420px] h-64 rounded-xl flex items-center justify-center shadow-xl flex-shrink-0 bg-white dark:bg-[var(--bg-secondary)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-light.png" alt="Himq" className="block dark:hidden h-24 w-auto" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="Himq" className="hidden dark:block h-40 w-auto" />
      </div>
    );
  }
  return (
    <div className="w-[420px] h-64 rounded-xl bg-[var(--bg-card)] flex flex-col items-center justify-center gap-4 flex-shrink-0 px-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
      <Link
        href="/auth"
        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--color-brand)] text-white text-xs font-bold hover:bg-[var(--color-brand-hover)] transition-colors"
      >
        Create Path →
      </Link>
    </div>
  );
}

function MarqueeCol({
  items,
  direction,
  speed,
  delay,
}: {
  items: ThreeDMarqueeItem[];
  direction: "up" | "down";
  speed: number;
  delay: number;
}) {
  // Triple content so there's never a gap at any starting position
  const tripled = [...items, ...items, ...items];
  return (
    <div
      className="marquee-anim flex flex-col gap-3 flex-shrink-0"
      style={{
        animation: `marquee-col-${direction} ${speed}s linear infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      {tripled.map((item, i) => (
        <ItemCard key={i} item={item} />
      ))}
    </div>
  );
}

export function ThreeDMarquee({
  items,
  className,
}: {
  items: ThreeDMarqueeItem[];
  className?: string;
}) {
  const [paused, setPaused] = useState(false);

  const cols = 4;
  const perCol = Math.ceil(items.length / cols);
  const columns = Array.from({ length: cols }, (_, i) =>
    items.slice(i * perCol, (i + 1) * perCol)
  );

  // Speeds and negative delays — delay = -speed/3 starts animation 1/3 through
  // so content fills the viewport immediately from the first render
  const speeds = [90, 72, 108, 82];
  const delays = speeds.map((s) => -(s / 3));

  return (
    <div className={cn("relative h-[620px] overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-[var(--bg-primary)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />

      <div
        className="flex h-full items-center justify-center"
        style={{ perspective: "700px" }}
      >
        <div
          className={cn(
            "flex gap-3 p-3 items-start bg-neutral-200 dark:bg-[var(--border-strong)]",
            paused && "marquee-paused"
          )}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          style={{
            transform: "rotateX(35deg) rotateZ(-30deg)",
            transformOrigin: "center center",
          }}
        >
          {columns.map((col, i) => (
            <MarqueeCol
              key={i}
              items={col}
              direction={i % 2 === 0 ? "up" : "down"}
              speed={speeds[i]}
              delay={delays[i]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
