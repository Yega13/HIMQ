import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';
import { Trophy, ChevronDown } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import { motion } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import Logo from './Logo';
import { cn } from '@/lib/utils';
import { getBrowserClient } from '@/lib/supabase';

export default function Navbar() {
  const { t } = useTranslation('common');
  const { pathname } = useRouter();
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [userInitial, setUserInitial] = useState('?');
  const [visible, setVisible] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const leaderboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const current = window.scrollY;
      if (current < 80) {
        setVisible(true);
      } else if (current > lastScrollY) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollY = current;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    { href: '/dashboard',     label: t('nav.dashboard') },
    { href: '/chat',          label: t('nav.learn') },
    { href: '/opportunities', label: t('nav.opportunities') },
    { href: '/about',         label: t('nav.about') },
  ];

  const activeLink = NAV_LINKS.find(
    (l) => pathname === l.href || pathname.startsWith(l.href + '/')
  );
  // The pill follows hover; when not hovering it rests on the active link
  const highlightHref = hoveredItem ?? activeLink?.href ?? null;

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="hidden md:block fixed top-4 inset-x-0 z-50 px-4"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between px-5 py-2.5 rounded-2xl bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border)] shadow-[0_4px_24px_rgba(0,0,0,0.10)]">

          <Logo height={34} />

          {/* Nav links with sliding pill */}
          <nav
            className="flex items-center"
            onMouseLeave={() => setHoveredItem(null)}
          >
            {NAV_LINKS.map(({ href, label }) => {
              const isHighlighted = href === highlightHref;
              return (
                <Link
                  key={href}
                  href={href}
                  onMouseEnter={() => setHoveredItem(href)}
                  className="relative px-4 py-2 text-[15px] font-medium"
                >
                  {isHighlighted && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-[var(--color-brand)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className={cn(
                    'relative z-10 transition-colors duration-150',
                    isHighlighted
                      ? 'text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative" ref={leaderboardRef}>
              <button
                onClick={() => setLeaderboardOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[15px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
              >
                <Trophy size={16} />
                {t('nav.leaderboard')}
                <ChevronDown size={14} className={cn('transition-transform duration-200', leaderboardOpen && 'rotate-180')} />
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
      </div>
    </motion.header>
  );
}
