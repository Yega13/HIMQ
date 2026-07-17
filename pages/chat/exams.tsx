import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ArrowRight, X, Loader2, ChevronLeft, Check } from 'lucide-react';
import Layout from '@/components/Layout';
import { DatePicker } from '@/components/DatePicker';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';
import { EXAMS, examGoal, type ExamMeta } from '@/lib/exams';
import { cn } from '@/lib/utils';

const CATEGORY_ORDER: ExamMeta['category'][] = ['armenian', 'english', 'university'];

// Hardcoded intake options (id = stable, label = i18n key, en = phrase baked
// into the AI summary). Learning styles only cover what May can actually adapt
// in text — no fake "video/voice" promises.
const LEVELS = [
  { id: 'new', label: 'exams.lvl_new', en: 'a complete beginner' },
  { id: 'basic', label: 'exams.lvl_basic', en: 'have some basics' },
  { id: 'inter', label: 'exams.lvl_inter', en: 'at an intermediate level' },
  { id: 'adv', label: 'exams.lvl_adv', en: 'fairly advanced' },
  { id: 'unsure', label: 'exams.lvl_unsure', en: 'not sure of my level' },
];
const HOURS = [
  { id: 'u5', label: 'exams.hrs_u5', en: 'under 5' },
  { id: '5_10', label: 'exams.hrs_5_10', en: '5-10' },
  { id: '10_15', label: 'exams.hrs_10_15', en: '10-15' },
  { id: '15p', label: 'exams.hrs_15p', en: '15+' },
];
const STYLES = [
  { id: 'examples', label: 'exams.sty_examples', en: 'lots of examples' },
  { id: 'concise', label: 'exams.sty_concise', en: 'concise, to-the-point explanations' },
  { id: 'steps', label: 'exams.sty_steps', en: 'step-by-step detail' },
  { id: 'analogies', label: 'exams.sty_analogies', en: 'real-world analogies' },
];

function buildIntakeSummary(
  exam: ExamMeta, target: string, date: string,
  level: string, weak: string[], hours: string, styles: string[],
): string {
  const parts = [`I'm preparing for the ${exam.fullName}.`];
  if (target.trim()) parts.push(`My target score is ${target.trim()}.`);
  if (date) parts.push(`My exam date is ${date}.`);
  const lvl = LEVELS.find((l) => l.id === level);
  if (lvl) parts.push(`Right now I am ${lvl.en}.`);
  if (weak.length) parts.push(`My weakest sections are: ${weak.join(', ')}.`);
  const hrs = HOURS.find((h) => h.id === hours);
  if (hrs) parts.push(`I can study about ${hrs.en} hours per week.`);
  const styleEn = styles.map((id) => STYLES.find((s) => s.id === id)?.en).filter(Boolean);
  if (styleEn.length) parts.push(`I learn best with ${styleEn.join(', ')}.`);
  return parts.join(' ');
}

export default function ExamsPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useUser();

  const [selected, setSelected] = useState<ExamMeta | null>(null);
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [level, setLevel] = useState('');
  const [weak, setWeak] = useState<string[]>([]);
  const [hours, setHours] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const open = (exam: ExamMeta) => {
    setSelected(exam);
    setTarget(''); setDate(''); setLevel(''); setWeak([]); setHours(''); setStyles([]);
    setError('');
  };

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

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
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` };
      // Skip AI discovery — hand the structured intake straight to plan generation.
      const summary = buildIntakeSummary(selected, target, date, level, weak, hours, styles);
      const res = await fetch('/api/create-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ goal: examGoal(selected, target, date), lang: router.locale, exam: selected.id, intakeSummary: summary }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? (t('exams.error') as string));
      }
      const { chatId } = await res.json();
      const planRes = await fetch('/api/generate-plan', { method: 'POST', headers, body: JSON.stringify({ chatId }) });
      if (!planRes.ok) {
        const body = await planRes.json().catch(() => ({}));
        throw new Error(body.error ?? (t('exams.error') as string));
      }
      await router.push(`/chat/${chatId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : (t('exams.error') as string));
      setStarting(false);
    }
  };

  // Earliest selectable exam date: 3 days out — so there's always at least a
  // little time to prepare (blocking today/past isn't enough).
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

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
              className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)]"
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

              <div className="mt-5 space-y-5">
                {/* Target score */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">{selected.scoreLabel}</label>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={selected.scorePlaceholder}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  />
                  {selected.scoreHint && <p className="text-xs text-[var(--text-muted)] mt-1.5">{selected.scoreHint}</p>}
                </div>

                {/* Exam date */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    {t('exams.setup_date')} <span className="text-[var(--text-muted)] font-normal">· {t('exams.setup_date_hint')}</span>
                  </label>
                  <DatePicker value={date} onChange={setDate} min={minDate} placeholder={t('exams.setup_date') as string} />
                </div>

                {/* Current level */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('exams.intake_level')}</label>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLevel(level === l.id ? '' : l.id)}
                        className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                          level === l.id
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                            : 'border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]')}
                      >
                        {t(l.label)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weakest sections */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('exams.intake_weak')}</label>
                  <div className="flex flex-wrap gap-2">
                    {selected.sections.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggle(weak, s, setWeak)}
                        className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                          weak.includes(s)
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                            : 'border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]')}
                      >
                        {weak.includes(s) && <Check size={12} />}{s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Study time per week */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('exams.intake_hours')}</label>
                  <div className="flex flex-wrap gap-2">
                    {HOURS.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setHours(hours === h.id ? '' : h.id)}
                        className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                          hours === h.id
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                            : 'border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]')}
                      >
                        {t(h.label)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Learning style */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('exams.intake_style')}</label>
                  <div className="flex flex-wrap gap-2">
                    {STYLES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(styles, s.id, setStyles)}
                        className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                          styles.includes(s.id)
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                            : 'border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]')}
                      >
                        {styles.includes(s.id) && <Check size={12} />}{t(s.label)}
                      </button>
                    ))}
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
