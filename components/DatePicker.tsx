import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Themed date picker — a clean calendar popover, replacing the browser's native
// (and inconsistent) date input. Value is an ISO "YYYY-MM-DD" string.
export function DatePicker({
  value,
  onChange,
  min,
  placeholder = 'Pick a date',
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value ? fromISO(value) : new Date()));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = value ? fromISO(value) : null;
  const minDate = min ? fromISO(min) : null;

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const disabled = (d: Date) => (minDate ? d < minDate : false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
      >
        <CalendarDays size={15} className="text-[var(--text-muted)] shrink-0" />
        <span className={cn(selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>
          {selected ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-[var(--text-primary)]">{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW.map((d) => (
              <span key={d} className="text-[10px] font-semibold text-[var(--text-muted)] text-center py-1">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const isSel = selected && sameDay(d, selected);
              const isToday = sameDay(d, new Date());
              const dis = disabled(d);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dis}
                  onClick={() => { onChange(toISO(d)); setOpen(false); }}
                  className={cn(
                    'h-8 rounded-lg text-xs font-medium transition-colors',
                    dis ? 'text-[var(--text-muted)]/40 cursor-not-allowed'
                      : isSel ? 'bg-[var(--color-brand)] text-white'
                        : isToday ? 'text-[var(--color-brand)] font-bold hover:bg-[var(--bg-secondary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]',
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
