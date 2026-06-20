import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

export type ThreeDMarqueeItem =
  | { type: "logo" }
  | { type: "cta"; label: string; icon: LucideIcon };

function ItemCard({ item }: { item: ThreeDMarqueeItem }) {
  if (item.type === "logo") {
    return (
      <div className="w-44 h-28 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center shadow-lg flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.png" alt="Himq" className="h-10 w-auto" />
      </div>
    );
  }
  const Icon = item.icon;
  return (
    <div className="w-44 h-28 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col items-center justify-center gap-2 shadow-[var(--shadow-sm)] flex-shrink-0">
      <Icon size={20} className="text-[var(--color-brand)]" />
      <span className="text-sm font-bold text-[var(--text-primary)]">{item.label}</span>
    </div>
  );
}

function MarqueeCol({
  items,
  direction,
  speed,
}: {
  items: ThreeDMarqueeItem[];
  direction: "up" | "down";
  speed: number;
}) {
  const doubled = [...items, ...items];
  return (
    <div
      className="flex flex-col gap-3 flex-shrink-0"
      style={{ animation: `marquee-col-${direction} ${speed}s linear infinite` }}
    >
      {doubled.map((item, i) => (
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
  const cols = 4;
  const perCol = Math.ceil(items.length / cols);
  const columns = Array.from({ length: cols }, (_, i) =>
    items.slice(i * perCol, (i + 1) * perCol)
  );
  const speeds = [22, 17, 26, 20];

  return (
    <div className={cn("relative h-[480px] overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[var(--bg-primary)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />

      <div
        className="flex h-full items-center justify-center"
        style={{ perspective: "1200px" }}
      >
        <div
          className="flex gap-3 items-start"
          style={{
            transform: "rotateX(18deg) rotateZ(5deg)",
            transformOrigin: "center center",
          }}
        >
          {columns.map((col, i) => (
            <MarqueeCol
              key={i}
              items={col}
              direction={i % 2 === 0 ? "up" : "down"}
              speed={speeds[i]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
