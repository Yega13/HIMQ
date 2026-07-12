import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RefreshCw, CheckCircle, Eye, EyeOff } from 'lucide-react';
import Logo from '@/components/Logo';
import { getBrowserClient, IS_MOCK } from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';

// Only follow same-origin relative redirects. `startsWith('/')` alone is not
// enough for an open-redirect guard:
//   - `//evil.com` and `/\evil.com` start with '/' but browsers treat them as
//     protocol-relative absolute URLs and navigate off-site.
//   - `/\t//evil.com` (a tab after the slash) is stripped by the browser to
//     `///evil.com` before parsing — also off-site.
// Require exactly ONE leading slash, no backslash, and no control characters.
function safeNext(next: unknown): string {
  if (typeof next !== 'string') return '/dashboard';
  return /^\/(?!\/)[^\\\x00-\x1F]*$/.test(next) ? next : '/dashboard';
}

export default function Auth() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage]   = useState('');
  const [isError, setIsError]   = useState(false);

  // After signup — show email confirmation screen
  const [pendingEmail, setPendingEmail] = useState('');
  const [resending, setResending]       = useState(false);
  const [resent, setResent]             = useState(false);

  // Redirect away if already signed in
  useEffect(() => {
    const dest = safeNext(router.query.next);
    getBrowserClient().auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(dest);
    });
  }, [router]);

  const handleGoogle = async () => {
    // OAuth needs the real backend — the local mock has no OAuth provider.
    if (IS_MOCK) {
      setIsError(true);
      setMessage('Google sign-in needs the live backend (not available in local demo mode).');
      return;
    }
    setOauthLoading(true);
    setMessage('');
    const supabase = getBrowserClient();
    // Come back to /auth after Google; the "already signed in" effect below then
    // forwards to the intended destination. Preserve the current locale + `next`.
    const next = safeNext(router.query.next);
    const localePrefix = router.locale && router.locale !== 'en' ? `/${router.locale}` : '';
    const nextParam = next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : '';
    const redirectTo = `${window.location.origin}${localePrefix}/auth${nextParam}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      setMessage(error.message);
      setIsError(true);
      setOauthLoading(false);
    }
    // On success the browser navigates to Google — nothing after this runs.
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const supabase = getBrowserClient();

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        setMessage(error.message);
        setIsError(true);
      } else if (data?.session) {
        // Signed in immediately (no email confirmation required) — go straight in.
        // Record the language they signed up in as their preference.
        if (router.locale) {
          supabase.from('profiles')
            .update({ preferred_language: router.locale })
            .eq('id', data.session.user.id);
        }
        await router.replace(safeNext(router.query.next));
      } else {
        setPendingEmail(email);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setIsError(true);
      } else {
        await router.replace(safeNext(router.query.next));
      }
    }

    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    await getBrowserClient().auth.resend({ type: 'signup', email: pendingEmail });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  };

  // Email confirmation pending screen
  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
        <div className="flex justify-between items-center p-4">
          <Logo height={40} />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md text-center"
          >
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-[var(--shadow-lg)]">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-[var(--color-brand)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Check your inbox</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                We sent a confirmation link to
              </p>
              <p className="font-semibold text-[var(--text-primary)] text-sm mb-6">{pendingEmail}</p>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-left mb-6 space-y-2">
                <p className="text-xs text-[var(--text-secondary)] flex gap-2">
                  <span>1.</span><span>Open the email from Himq</span>
                </p>
                <p className="text-xs text-[var(--text-secondary)] flex gap-2">
                  <span>2.</span><span>Click the confirmation link</span>
                </p>
                <p className="text-xs text-[var(--text-secondary)] flex gap-2">
                  <span>3.</span><span>Come back here and sign in</span>
                </p>
                <p className="text-xs text-[var(--text-muted)] flex gap-2 pt-1">
                  <span>⚠</span><span>Check spam / junk if you don&apos;t see it</span>
                </p>
              </div>

              <button
                onClick={handleResend}
                disabled={resending || resent}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--color-brand)] transition-colors disabled:opacity-60 mb-3"
              >
                <AnimatePresence mode="wait">
                  {resent ? (
                    <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle size={14} /> Email resent!
                    </motion.span>
                  ) : (
                    <motion.span key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                      <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                      {resending ? 'Resending…' : 'Resend confirmation email'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <button
                onClick={() => { setPendingEmail(''); setMode('signin'); }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors"
              >
                Already confirmed? Sign in →
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <div className="flex justify-between items-center p-4">
        <Logo height={40} />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-[var(--shadow-lg)]">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              {mode === 'signin' ? t('auth.sign_in') : t('auth.sign_up')}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              {mode === 'signin' ? t('auth.no_account') : t('auth.already_have_account')}{' '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); setFullName(''); }}
                className="text-[var(--color-brand)] hover:underline font-medium"
              >
                {mode === 'signin' ? t('auth.sign_up') : t('auth.sign_in')}
              </button>
            </p>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={oauthLoading || loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold text-sm hover:border-[var(--color-brand)] hover:bg-[var(--bg-card)] transition-colors disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              {oauthLoading ? t('common.loading') : t('auth.continue_google')}
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">{t('auth.or_continue_with')}</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    {t('auth.full_name')}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition"
                    placeholder="Mayis Gevorgyan"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {message && (
                <p className={`text-sm ${isError ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60"
              >
                {loading ? t('common.loading') : mode === 'signin' ? t('auth.sign_in') : t('auth.sign_up')}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
