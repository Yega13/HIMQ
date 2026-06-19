import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RefreshCw, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';

export default function Auth() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage]   = useState('');
  const [isError, setIsError]   = useState(false);

  // After signup — show email confirmation screen
  const [pendingEmail, setPendingEmail] = useState('');
  const [resending, setResending]       = useState(false);
  const [resent, setResent]             = useState(false);

  // Redirect away if already signed in
  useEffect(() => {
    const next = router.query.next as string | undefined;
    const dest = next && next.startsWith('/') ? next : '/dashboard';
    getBrowserClient().auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(dest);
    });
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const supabase = getBrowserClient();

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        setMessage(error.message);
        setIsError(true);
      } else {
        setPendingEmail(email);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setIsError(true);
      } else {
        const next = router.query.next as string | undefined;
        await router.replace(next && next.startsWith('/') ? next : '/dashboard');
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
          <Link href="/" className="font-bold text-xl text-[var(--color-brand)]">Himq</Link>
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
        <Link href="/" className="font-bold text-xl text-[var(--color-brand)]">Himq</Link>
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
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
