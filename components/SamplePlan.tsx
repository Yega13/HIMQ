import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Wand2, Loader2 } from 'lucide-react';

// Logged-out "try it": type a goal, watch May stream a real short plan — no
// account. Talks to /api/sample-plan (IP-rate-limited, streamed).
export default function SamplePlan() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const examples = [t('sample.ex1'), t('sample.ex2'), t('sample.ex3')] as string[];

  const run = async (g: string) => {
    const goalText = g.trim();
    if (!goalText || loading) return;
    setGoal(goalText);
    setPlan('');
    setDone(false);
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/sample-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalText, lang: router.locale ?? 'en' }),
      });
      if (!res.ok || !res.body) {
        let msg = t('sample.error') as string;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done: rdone, value } = await reader.read();
        if (rdone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: { delta?: string; done?: boolean };
          try { evt = JSON.parse(payload); } catch { continue; }
          if (typeof evt.delta === 'string' && evt.delta) {
            const d = evt.delta;
            setPlan((p) => p + d);
          }
          if (evt.done) setDone(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (t('sample.error') as string));
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  const lessons = plan
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
  const started = loading || plan.length > 0 || !!error;

  return (
    <section className="max-w-3xl mx-auto px-4">
      <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 sm:p-8 shadow-[var(--shadow-lg)] overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-[var(--color-brand)]/10 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-brand)] mb-2">
            <Wand2 size={14} /> {t('sample.badge')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mb-1.5">{t('sample.title')}</h2>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base mb-5">{t('sample.subtitle')}</p>

          <form
            onSubmit={(e) => { e.preventDefault(); run(goal); }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={200}
              placeholder={t('sample.placeholder') as string}
              className="flex-1 px-4 py-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition"
            />
            <button
              type="submit"
              disabled={loading || !goal.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60 shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? t('sample.building') : t('sample.button')}
            </button>
          </form>

          {/* Example chips (only before the first run) */}
          {!started && (
            <div className="flex flex-wrap gap-2 mt-3">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => run(ex)}
                  className="px-3 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-medium hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* Result */}
          <AnimatePresence>
            {started && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6"
              >
                {error ? (
                  <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                      {t('sample.your_plan')}
                    </p>
                    <div className="space-y-2">
                      {lessons.map((l, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3"
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)] text-xs font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm text-[var(--text-primary)]">{l}</span>
                        </motion.div>
                      ))}
                      {loading && (
                        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm px-1 py-1">
                          <Loader2 size={14} className="animate-spin" /> {t('sample.building')}
                        </div>
                      )}
                    </div>

                    {done && !loading && lessons.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5">
                        <Link
                          href="/auth"
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-brand)] text-white font-bold text-sm hover:bg-[var(--color-brand-hover)] transition-colors shadow-[var(--shadow-md)]"
                        >
                          {t('sample.cta')}
                          <ArrowRight size={16} />
                        </Link>
                        <p className="text-xs text-[var(--text-muted)] mt-2">{t('sample.disclaimer')}</p>
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
