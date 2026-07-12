import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  // Timeline steps: real (lit) lessons, padded with dim placeholders while the
  // plan is still generating so the reader sees steps light up one by one.
  const placeholderCount = loading ? Math.max(1, 5 - lessons.length) : 0;
  const steps = [
    ...lessons.map((l) => ({ text: l, lit: true })),
    ...Array.from({ length: placeholderCount }, () => ({ text: '', lit: false })),
  ];

  return (
    <div className="w-full">
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4 flex items-center gap-2">
                      {loading ? (
                        <>
                          <Sparkles size={13} className="text-[var(--color-brand)]" />
                          {t('sample.building')}
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </>
                      ) : (
                        t('sample.your_plan')
                      )}
                    </p>

                    {/* Timeline — dots light up as each lesson arrives */}
                    <div className="relative">
                      {steps.map((step, i) => {
                        const forming = loading && !step.lit && i === lessons.length;
                        const isLast = i === steps.length - 1;
                        return (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <motion.span
                                initial={false}
                                animate={{ scale: step.lit ? 1 : 0.9 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className={cn(
                                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0',
                                  step.lit
                                    ? 'bg-[var(--color-brand)] text-white shadow-[var(--shadow-sm)]'
                                    : cn('border-2 text-transparent', forming ? 'border-[var(--color-brand)] animate-pulse' : 'border-[var(--border-strong)]'),
                                )}
                              >
                                {i + 1}
                              </motion.span>
                              {!isLast && (
                                <span className={cn('w-0.5 flex-1 my-1 rounded', step.lit ? 'bg-[var(--color-brand)]/30' : 'bg-[var(--border)]')} />
                              )}
                            </div>
                            <div className="flex-1 pb-4 pt-0.5 min-h-[2rem]">
                              {step.text ? (
                                <motion.p
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="text-sm text-[var(--text-primary)] leading-snug"
                                >
                                  {step.text}
                                </motion.p>
                              ) : (
                                <span className="block h-3.5 rounded bg-[var(--bg-subtle)] animate-pulse" style={{ width: `${72 - i * 9}%` }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {done && !loading && lessons.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
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
  );
}
