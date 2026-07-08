import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import Logo from './Logo';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/labs', label: 'Labs' },
  { href: '/dashboard', label: 'Dashboard' },
];

const COMPANY_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy & Security' },
  { href: '/terms', label: 'Terms' },
];

export default function Footer() {
  const { t } = useTranslation('common');
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-secondary)] mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">

        {/* Brand — logo and tagline share the same left edge */}
        <div className="flex flex-col items-start col-span-2 lg:col-span-1">
          <Logo height={28} className="mb-3" />
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs">
            {t('footer.tagline')}
          </p>
        </div>

        {/* Navigate */}
        <div>
          <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('footer.navigate')}</p>
          <ul className="space-y-2">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company / legal */}
        <div>
          <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Company</p>
          <ul className="space-y-2">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('footer.contact')}</p>
          <a
            href="mailto:himqaiteam@gmail.com"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors block mb-2"
          >
            himqaiteam@gmail.com
          </a>
          <p className="text-sm text-[var(--text-secondary)]">{t('footer.built_for')}</p>
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
