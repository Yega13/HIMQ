import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { cn } from '@/lib/utils';
import { getBrowserClient } from '@/lib/supabase';

// Top bar + slide-in menu for phones (the desktop Navbar is hidden < md).
// Gives mobile users the logo, every nav destination (incl. Labs / About /
// Leaderboard that the bottom bar omits), and the language / theme toggles.
export default function MobileHeader() {
  const { t } = useTranslation('common');
  const { pathname } = useRouter();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState('?');

  useEffect(() => {
    getBrowserClient().auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name as string | undefined;
        setInitial(name ? name[0].toUpperCase() : user.email?.[0].toUpperCase() ?? '?');
      }
    });
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }
  }, [open]);

  const links = [
    { href: '/dashboard', label: t('nav.dashboard') },
    { href: '/chat', label: t('nav.learn') },
    { href: '/labs', label: t('nav.labs') },
    { href: '/opportunities', label: t('nav.opportunities') },
    { href: '/about', label: t('nav.about') },
    { href: '/leaderboard', label: t('nav.leaderboard') },
  ];

  return (
    <>
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-b border-[var(--border)]">
        <Logo height={26} />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-2 rounded-lg text-[var(--text-primary)] active:bg-[var(--bg-subtle)]"
        >
          <Menu size={24} />
        </button>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 max-w-[85%] bg-[var(--bg-secondary)] border-l border-[var(--border)] shadow-2xl flex flex-col p-5">
            <div className="flex items-center justify-between mb-5">
              <Logo height={24} />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2 -mr-2 text-[var(--text-primary)]">
                <X size={22} />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {links.map((l) => {
                const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'py-3 px-3.5 rounded-xl text-[15px] font-medium transition-colors',
                      active
                        ? 'bg-[var(--color-brand)] text-white'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-5 border-t border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-[var(--color-logo)] flex items-center justify-center text-white text-sm font-semibold"
              >
                {initial}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
