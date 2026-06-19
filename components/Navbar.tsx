import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';
import { Trophy, ChevronDown } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { cn } from '@/lib/utils';
import { getBrowserClient } from '@/lib/supabase';

export default function Navbar() {
  const { t } = useTranslation('common');
  const { pathname } = useRouter();
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [userInitial, setUserInitial] = useState('?');
  const leaderboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name as string | undefined;
        setUserInitial(name ? name[0].toUpperCase() : user.email?.[0].toUpperCase() ?? '?');
      }
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (leaderboardRef.current && !leaderboardRef.current.contains(e.target as Node)) {
        setLeaderboardOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const NAV_LINKS = [
    { href: '/dashboard', label: t('nav.dashboard') },
    { href: '/chat',      label: t('nav.learn') },
    { href: '/opportunities', label: t('nav.opportunities') },
  ];

  return (
    <header className="hidden md:block sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-[var(--color-brand)]">
          Himq
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-4 py-2 rounded-lg text-[15px] font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative" ref={leaderboardRef}>
            <button
              onClick={() => setLeaderboardOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
            >
              <Trophy size={16} />
              {t('nav.leaderboard')}
              <ChevronDown size={14} className={cn('transition-transform', leaderboardOpen && 'rotate-180')} />
            </button>

            {leaderboardOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-lg)] animate-fade-in overflow-hidden">
                <div className="p-3 border-b border-[var(--border)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Top Learners</p>
                </div>
                <div className="p-2 max-h-80 overflow-y-auto">
                  <p className="text-xs text-[var(--text-muted)] text-center py-4">Coming soon</p>
                </div>
                <div className="p-2 border-t border-[var(--border)]">
                  <Link
                    href="/leaderboard"
                    onClick={() => setLeaderboardOpen(false)}
                    className="block text-center text-xs text-[var(--color-brand)] hover:underline py-1"
                  >
                    View full leaderboard →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <LanguageToggle />
          <ThemeToggle />

          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-white text-sm font-semibold"
          >
            {userInitial}
          </Link>
        </div>
      </div>
    </header>
  );
}
