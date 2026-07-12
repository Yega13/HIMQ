import NextDocument, { Html, Head, Main, NextScript, type DocumentContext } from 'next/document';

// Map our app locales to correct BCP-47 language codes for the <html lang>
// attribute (Armenian's code is "hy", not our internal "am").
const LANG: Record<string, string> = { en: 'en', am: 'hy', ru: 'ru' };

export default function Document({ locale }: { locale?: string }) {
  return (
    <Html lang={LANG[locale ?? 'en'] ?? 'en'} suppressHydrationWarning>
      <Head>
        {/* Set the theme class BEFORE first paint so dark-mode users don't get
            a white flash on every navigation. Mirrors ThemeToggle's logic. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
        {/* Inter is now self-hosted via next/font (see _app.tsx) — no external
            font stylesheet to render-block on. */}
        <meta name="theme-color" content="#2578e8" />

        {/* Google Search Console domain-ownership verification (enables custom
            OAuth-consent branding + Search Console). */}
        <meta name="google-site-verification" content="evrKSjJrxvdlxIDkp7T2w8D_ze3ZCWPS0byMJVaEFmQ" />

        {/* Favicons — SVG for modern browsers, PNG/ICO fallbacks, apple-touch for iOS */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=3" />
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (ctx: DocumentContext) => {
  const initialProps = await NextDocument.getInitialProps(ctx);
  return { ...initialProps, locale: ctx.locale };
};
