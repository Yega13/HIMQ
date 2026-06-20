import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
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
  const [userInitial, setUserInitial] = useState('?');
  const [visible, setVisible] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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

  // All core navigation grouped together (Leaderboard now lives here too).
  const NAV_LINKS = [
    { href: '/dashboard',     label: t('nav.dashboard') },
    { href: '/chat',          label: t('nav.learn') },
    { href: '/opportunities', label: t('nav.opportunities') },
    { href: '/about',         label: t('nav.about') },
    { href: '/leaderboard',   label: t('nav.leaderboard') },
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
        <div className="flex items-center justify-between px-5 py-1.5 rounded-lg bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border)] shadow-[0_6px_20px_-8px_rgba(15,26,51,0.18)]">

          <Logo height={34} />

          <div className="flex items-center gap-4">
            {/* Nav links with sliding pill */}
            <nav
              className="flex items-center gap-1"
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
                        : 'text-[var(--text-nav)] hover:text-[var(--text-primary)]'
                    )}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Divider separating nav from settings/profile */}
            <div className="w-px h-6 bg-[var(--border)]" />

            {/* Settings / profile */}
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link
                href="/profile"
                className="w-8 h-8 rounded-full bg-[var(--color-logo)] flex items-center justify-center text-white text-sm font-semibold"
              >
                {userInitial}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
