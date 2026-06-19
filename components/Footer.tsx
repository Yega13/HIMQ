import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import Logo from './Logo';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/profile', label: 'Profile' },
];

export default function Footer() {
  const { t } = useTranslation('common');
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-secondary)] mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">

        {/* Brand */}
        <div>
          <Logo height={30} className="mb-2" />
          <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs">
            {t('footer.tagline')}
          </p>
        </div>

        {/* Links */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('footer.navigate')}</p>
          <ul className="space-y-2">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('footer.contact')}</p>
          <a
            href="mailto:himqaiteam@gmail.com"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors block mb-2"
          >
            himqaiteam@gmail.com
          </a>
          <p className="text-sm text-[var(--text-muted)]">{t('footer.built_for')}</p>
        </div>
      </div>

      <div className="border-t border-[var(--border)] py-4">
        <p className="text-center text-xs text-[var(--text-muted)]">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
