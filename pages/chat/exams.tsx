import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ArrowRight, X, Loader2, CalendarDays, ChevronLeft } from 'lucide-react';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';
import { EXAMS, examGoal, type ExamMeta } from '@/lib/exams';
import { cn } from '@/lib/utils';

const CATEGORY_ORDER: ExamMeta['category'][] = ['armenian', 'english', 'university'];

export default function ExamsPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useUser();

  const [selected, setSelected] = useState<ExamMeta | null>(null);
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const open = (exam: ExamMeta) => {
    setSelected(exam);
    setTarget('');
    setDate('');
    setError('');
  };

  const startPrep = async () => {
    if (!selected) return;
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent('/chat/exams')}`);
      return;
    }
    setStarting(true);
    setError('');
    try {
      const supabase = getBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ goal: examGoal(selected, target, date), lang: router.locale, exam: selected.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? (t('exams.error') as string));
      }
      const { chatId } = await res.json();
      await router.push(`/chat/${chatId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : (t('exams.error') as string));
      setStarting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <Head><title>Exam Prep · HIMQ</title></Head>

      <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-10 pb-20">
        {/* Back to Learn */}
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors mb-6"
        >
          <ChevronLeft size={14} />
          {t('nav.learn')}
        </Link>

        {/* Header */}
        <div className="max-w-2xl mb-10">
          <div className="inline-flex items-center gap-2 text-[var(--color-brand)] mb-3">
            <GraduationCap size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">{t('exams.eyebrow')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] text-balance">
            {t('exams.title')}
          </h1>
          <p className="text-[var(--text-secondary)] mt-3">{t('exams.subtitle')}</p>
        </div>

        {/* Exams grouped by category */}
        {CATEGORY_ORDER.map((cat) => {
          const items = EXAMS.filter((e) => e.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t(`exams.cat_${cat}`)}
                </h2>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((exam) => {
                  const isLive = exam.status === 'live';
                  return (
                    <button
                      key={exam.id}
                      type="button"
                      disabled={!isLive}
                      onClick={() => isLive && open(exam)}
                      className={cn(
                        'text-left rounded-2xl border p-5 transition-all',
                        isLive
                          ? 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-md)] cursor-pointer'
                          : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-secondary)]/50 cursor-default',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <span className={cn('text-3xl', !isLive && 'opacity-45 grayscale')}>{exam.emoji}</span>
                        {!isLive && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--border)] text-[var(--text-muted)]">
                            {t('exams.soon')}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mt-3">{exam.name}</h3>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{exam.fullName}</p>
                      <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-relaxed">{exam.blurb}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {exam.sections.map((s) => (
                          <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]">
                            {s}
                          </span>
                        ))}
                      </div>
                      {isLive && (
                        <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-[var(--color-brand)]">
                          {t('exams.prepare')} <ArrowRight size={14} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Setup modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !starting && setSelected(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{selected.emoji}</span>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">{selected.name}</h3>
                    <p className="text-[11px] text-[var(--text-muted)]">{selected.fullName}</p>
                  </div>
                </div>
                <button onClick={() => !starting && setSelected(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">{selected.scoreLabel}</label>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={selected.scorePlaceholder}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  />
                  {selected.scoreHint && (
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">{selected.scoreHint}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    {t('exams.setup_date')} <span className="text-[var(--text-muted)] font-normal">· {t('exams.setup_date_hint')}</span>
                  </label>
                  <div className="relative">
                    <CalendarDays size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      type="date"
                      min={today}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>}

              <button
                onClick={startPrep}
                disabled={starting}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60"
              >
                {starting ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
                {starting ? t('exams.starting') : t('exams.start')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'en', ['common'])) },
});
