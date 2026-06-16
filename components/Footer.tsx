import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/profile', label: 'Profile' },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-secondary)] mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">

        {/* Brand */}
        <div>
          <Link href="/" className="font-extrabold text-xl text-[var(--color-brand)] block mb-2">
            EduPath
          </Link>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs">
            AI-powered learning paths and real Armenian opportunities — all in one place.
          </p>
        </div>

        {/* Links */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Navigate</p>
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
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Contact</p>
          <a
            href="mailto:EduPathSupport@gmail.com"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors block mb-2"
          >
            EduPathSupport@gmail.com
          </a>
          <p className="text-sm text-[var(--text-muted)]">Built for Armenia&apos;s students 🇦🇲</p>
        </div>
      </div>

      <div className="border-t border-[var(--border)] py-4">
        <p className="text-center text-xs text-[var(--text-muted)]">
          © {new Date().getFullYear()} EduPath · Free during SSS 2026 demo
        </p>
      </div>
    </footer>
  );
}
