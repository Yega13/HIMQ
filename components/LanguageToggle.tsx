import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';

const LANGS = [
  { code: 'am', flagSrc: 'https://flagcdn.com/w40/am.png', label: 'Հայ' },
  { code: 'en', flagSrc: 'https://flagcdn.com/w40/us.png', label: 'EN' },
  { code: 'ru', flagSrc: 'https://flagcdn.com/w40/ru.png', label: 'RU' },
];

export default function LanguageToggle() {
  const router = useRouter();
  const { pathname, query, asPath, locale } = router;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGS.find((l) => l.code === locale) ?? LANGS[1];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const switchTo = (code: string) => {
    setOpen(false);
    router.replace({ pathname, query }, asPath, { locale: code });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch language"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.flagSrc} alt={current.code} width={20} height={14} className="rounded-sm object-cover" style={{ width: 20, height: 14 }} />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-lg)] overflow-hidden z-50">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => switchTo(l.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                l.code === locale
                  ? 'bg-[var(--color-brand)] text-white font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--border)]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.flagSrc} alt={l.code} width={22} height={15} className="rounded-sm object-cover flex-shrink-0" style={{ width: 22, height: 15 }} />
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
