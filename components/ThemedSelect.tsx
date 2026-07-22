import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

// A fully theme-styled dropdown that replaces the native <select> (whose option
// list can't be dark-themed reliably and renders as a white box in dark mode).
// Closes on outside click / Escape.
export function ThemedSelect({
  value,
  options,
  onChange,
  className,
  buttonClassName,
  leading,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  className?: string;
  buttonClassName?: string;
  leading?: ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 h-12 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-sm)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/30 transition',
          buttonClassName,
        )}
      >
        {leading}
        <span className="flex-1 text-left truncate">{current?.label ?? ''}</span>
        <ChevronDown size={16} className={cn('shrink-0 text-[var(--text-secondary)] transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 mt-1.5 w-full min-w-[11rem] right-0 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)] overflow-hidden py-1"
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-[var(--bg-secondary)]',
                    o.value === value ? 'font-semibold text-[var(--color-brand)]' : 'text-[var(--text-primary)]',
                  )}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.value === value && <Check size={15} className="shrink-0 text-[var(--color-brand)]" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
