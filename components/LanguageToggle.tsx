import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase';

// Inline SVG flags — self-contained so a slow/blocked external image host
// (previously flagcdn.com) can never leave a broken-image icon in the navbar.
function Flag({ code, w = 20, h = 14 }: { code: string; w?: number; h?: number }) {
  const common = { width: w, height: h, viewBox: '0 0 3 2', className: 'rounded-sm', style: { width: w, height: h } } as const;
  if (code === 'am') {
    return (
      <svg {...common} aria-hidden>
        <rect width="3" height="2" fill="#0033A0" />
        <rect width="3" height="0.667" fill="#D90012" />
        <rect width="3" height="0.667" y="1.333" fill="#F2A800" />
      </svg>
    );
  }
  if (code === 'ru') {
    return (
      <svg {...common} aria-hidden>
        <rect width="3" height="2" fill="#fff" />
        <rect width="3" height="0.667" y="0.667" fill="#0039A6" />
        <rect width="3" height="0.667" y="1.333" fill="#D52B1E" />
      </svg>
    );
  }
  // en → US flag (simplified: stripes + blue canton)
  return (
    <svg {...common} aria-hidden>
      <rect width="3" height="2" fill="#fff" />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} width="3" height="0.154" y={i * 0.154} fill="#B22234" />
      ))}
      {[8, 10, 12].map((i) => (
        <rect key={i} width="3" height="0.154" y={i * 0.154} fill="#B22234" />
      ))}
      <rect width="1.3" height="1.077" fill="#3C3B6E" />
    </svg>
  );
}

const LANGS = [
  { code: 'am', label: 'Հայ' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
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
    // Persist as the user's preferred language (used for May's language), if
    // signed in. Non-blocking — navigation happens regardless.
    (async () => {
      try {
        const supabase = getBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.from('profiles').update({ preferred_language: code }).eq('id', session.user.id);
        }
      } catch { /* ignore */ }
    })();
    router.replace({ pathname, query }, asPath, { locale: code });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch language"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
      >
        <Flag code={current.code} w={20} h={14} />
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
              <span className="flex-shrink-0"><Flag code={l.code} w={22} h={15} /></span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
