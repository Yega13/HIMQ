import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Search, LayoutDashboard, MessageSquare, User } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const { t } = useTranslation('common');
  const { pathname } = useRouter();

  const items = [
    { href: '/',              label: t('nav.home'),          icon: Home },
    { href: '/opportunities', label: t('nav.opportunities'), icon: Search },
    { href: '/dashboard',     label: t('nav.dashboard'),     icon: LayoutDashboard },
    { href: '/chat',          label: t('nav.learn'),         icon: MessageSquare },
    { href: '/profile',       label: t('nav.profile'),       icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-secondary)] border-t border-[var(--border)] pb-2">
      <div className="flex items-center justify-around py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
                active
                  ? 'text-[var(--color-brand)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
