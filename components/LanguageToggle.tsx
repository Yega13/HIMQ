import { useRouter } from 'next/router';

export default function LanguageToggle() {
  const router = useRouter();
  const { pathname, query, asPath, locale } = router;
  const isAm = locale === 'am';

  const toggle = () => {
    router.replace({ pathname, query }, asPath, { locale: isAm ? 'en' : 'am' });
  };

  return (
    <button
      onClick={toggle}
      aria-label="Switch language"
      className="px-2.5 py-1 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
    >
      {isAm ? 'EN' : 'ՀԱՅ'}
    </button>
  );
}
