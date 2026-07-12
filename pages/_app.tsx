import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { appWithTranslation } from 'next-i18next';
import Head from 'next/head';
import { Inter } from 'next/font/google';
import { getBrowserClient } from '@/lib/supabase';
import '@/styles/globals.css';

// Self-hosted Inter (Latin + Cyrillic for RU) via next/font — replaces the
// render-blocking Google Fonts <link>. Armenian has no Inter subset and falls
// back to the system sans, exactly as before. Exposed as --font-inter, wired
// into Tailwind's `font-sans`.
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

const SITE_URL = 'https://himqai.com';
const OG_LOCALE: Record<string, string> = { en: 'en_US', am: 'hy_AM', ru: 'ru_RU' };

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  // Canonical URL for the current page (locale-prefixed except default English).
  const cleanPath = (router.asPath.split('#')[0].split('?')[0]) || '/';
  const localePrefix = router.locale && router.locale !== 'en' ? `/${router.locale}` : '';
  const canonical = `${SITE_URL}${localePrefix}${cleanPath === '/' ? '' : cleanPath}` || SITE_URL;

  // Keep <html lang> correct on client-side locale switches / navigation.
  useEffect(() => {
    const map: Record<string, string> = { en: 'en', am: 'hy', ru: 'ru' };
    document.documentElement.lang = map[router.locale ?? 'en'] ?? 'en';
  }, [router.locale]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const supabase = getBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const start = () => setNavigating(true);
    const done  = () => setNavigating(false);
    router.events.on('routeChangeStart',    start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError',    done);
    return () => {
      router.events.off('routeChangeStart',    start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError',    done);
    };
  }, [router.events]);

  return (
    <div className={`${inter.variable} font-sans`}>
      <Head>
        <title>HIMQ — Learn, Grow, Win</title>
        <meta name="description" content="AI-powered personal tutor for Armenian students. Build a custom learning path and discover real local scholarships, competitions, and internships." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonical} />

        {/* Open Graph (link previews) */}
        <meta property="og:site_name" content="HIMQ" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="HIMQ — Learn, Grow, Win" />
        <meta property="og:description" content="AI personal tutor + real Armenian opportunities in one place — build a custom learning path and find scholarships, competitions, and internships." />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={`${SITE_URL}/logo-dark.png`} />
        <meta property="og:locale" content={OG_LOCALE[router.locale ?? 'en'] ?? 'en_US'} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="HIMQ — Learn, Grow, Win" />
        <meta name="twitter:description" content="AI personal tutor + real Armenian opportunities in one place." />
        <meta name="twitter:image" content={`${SITE_URL}/logo-dark.png`} />

        <meta name="theme-color" content="#2578e8" />

        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'HIMQ',
              url: SITE_URL,
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Web',
              description: 'AI-powered personal tutor that builds custom learning paths, plus real Armenian scholarships, competitions, and internships.',
              inLanguage: ['en', 'hy', 'ru'],
            }),
          }}
        />
      </Head>
      {navigating && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-transparent overflow-hidden">
          <div className="h-full bg-[var(--color-brand)] animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      <Component {...pageProps} />
    </div>
  );
}

export default appWithTranslation(App);
