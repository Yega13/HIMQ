import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { appWithTranslation } from 'next-i18next';
import Head from 'next/head';
import { getBrowserClient } from '@/lib/supabase';
import '@/styles/globals.css';

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

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
    <>
      <Head>
        <title>HIMQ — Learn, Grow, Win</title>
        <meta name="description" content="AI-powered personal tutor for Armenian students. Build a custom learning path and discover real local scholarships, competitions, and internships." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="HIMQ — Learn, Grow, Win" />
        <meta property="og:description" content="AI personal tutor + Armenian opportunities in one place." />
        <meta name="theme-color" content="#2578e8" />
      </Head>
      {navigating && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-transparent overflow-hidden">
          <div className="h-full bg-[var(--color-brand)] animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      <Component {...pageProps} />
    </>
  );
}

export default appWithTranslation(App);
