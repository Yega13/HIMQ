import NextDocument, { Html, Head, Main, NextScript, type DocumentContext } from 'next/document';

// Map our app locales to correct BCP-47 language codes for the <html lang>
// attribute (Armenian's code is "hy", not our internal "am").
const LANG: Record<string, string> = { en: 'en', am: 'hy', ru: 'ru' };

export default function Document({ locale }: { locale?: string }) {
  return (
    <Html lang={LANG[locale ?? 'en'] ?? 'en'} suppressHydrationWarning>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#2578e8" />

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
