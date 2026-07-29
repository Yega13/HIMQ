import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GraduationCap, Search, ArrowRight, Loader2, Info } from 'lucide-react';
import Layout from '@/components/Layout';
import { EXAMS, getExam } from '@/lib/exams';
import {
  assess, gapByExam, VERDICT_ORDER,
  type Verdict, type EducationLevel, type StudentProfile, type ProgramSpec, type Cutoff,
} from '@/lib/eligibility';
import { cn } from '@/lib/utils';

interface ProgramRow {
  id: string;
  name: string;
  name_hy: string;
  degree_level: string;
  admission_type: 'unified_exam' | 'certificate';
  min_education: EducationLevel | null;
  duration_months: number | null;
  qualification: string | null;
  required_exams: { exam: string; required: boolean }[];
  source_url: string | null;
  university: { name: string; name_hy: string; short_name: string | null; city: string } | null;
  cutoffs: Cutoff[];
}

// Only the unified exams — the foreign tests (IELTS/SAT) aren't part of
// Armenian admission and would just clutter the score form.
const UNIFIED = EXAMS.filter((e) => e.category === 'armenian' && e.status === 'live');

const VERDICT_STYLE: Record<Verdict, string> = {
  safe:         'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40',
  likely:       'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40',
  eligible:     'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40',
  reach:        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40',
  unlikely:     'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40',
  not_eligible: 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border)]',
  no_data:      'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border)]',
};

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] ' +
  'text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition';

export default function UniversitiesPage() {
  const { t } = useTranslation('common');

  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // The student's standing. Held in component state for now — persisting it to
  // profiles / student_scores is the next increment, not this one.
  const [educationLevel, setEducationLevel] = useState<EducationLevel | ''>('');
  const [certificateAverage, setCertificateAverage] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/programs')
      .then((r) => (r.ok ? r.json() : { programs: [] }))
      .then((d) => setPrograms(d.programs ?? []))
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, []);

  const student: StudentProfile = useMemo(() => {
    const numeric: Record<string, number> = {};
    for (const [k, v] of Object.entries(scores)) {
      const n = Number(v);
      if (v !== '' && Number.isFinite(n)) numeric[k] = n;
    }
    const avg = Number(certificateAverage);
    return {
      scores: numeric,
      educationLevel: educationLevel || null,
      certificateAverage: certificateAverage !== '' && Number.isFinite(avg) ? avg : null,
    };
  }, [scores, certificateAverage, educationLevel]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs
      .filter((p) => !q
        || p.name.toLowerCase().includes(q)
        || p.name_hy.toLowerCase().includes(q)
        || (p.university?.name ?? '').toLowerCase().includes(q)
        || (p.university?.name_hy ?? '').toLowerCase().includes(q))
      .map((p) => {
        const spec: ProgramSpec = {
          admissionType: p.admission_type,
          requiredExams: p.required_exams,
          minEducation: p.min_education,
        };
        return { program: p, result: assess(student, spec, p.cutoffs ?? []) };
      })
      .sort((a, b) =>
        VERDICT_ORDER.indexOf(a.result.verdict) - VERDICT_ORDER.indexOf(b.result.verdict));
  }, [programs, student, query]);

  return (
    <Layout>
      <Head><title>{t('elig.title')} — HIMQ</title></Head>
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-brand)] mb-3">
            <GraduationCap size={15} /> {t('elig.eyebrow')}
          </span>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2">{t('elig.title')}</h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-2xl">{t('elig.subtitle')}</p>
        </div>

        {/* Your standing */}
        <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 mb-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t('elig.your_standing')}</h2>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t('elig.education_level')}
              </label>
              <div className="flex gap-2">
                {(['grade_9', 'grade_12'] as EducationLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEducationLevel(educationLevel === lvl ? '' : lvl)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                      educationLevel === lvl
                        ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]',
                    )}
                  >
                    {t(`elig.${lvl}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t('elig.certificate_average')}
              </label>
              <input
                type="number" min="0" max="20" step="0.1" inputMode="decimal"
                value={certificateAverage}
                onChange={(e) => setCertificateAverage(e.target.value)}
                placeholder="16.5"
                className={inputCls}
              />
            </div>
          </div>

          <p className="text-xs font-medium text-[var(--text-secondary)] mb-2.5">{t('elig.exam_scores')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {UNIFIED.map((ex) => (
              <div key={ex.id}>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1 truncate">
                  {ex.emoji} {ex.name.replace('Unified — ', '')}
                </label>
                <input
                  type="number" min="0" max="20" step="0.1" inputMode="decimal"
                  value={scores[ex.id] ?? ''}
                  onChange={(e) => setScores((s) => ({ ...s, [ex.id]: e.target.value }))}
                  placeholder="—"
                  className={cn(inputCls, 'py-2 text-sm')}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('elig.search_placeholder') as string}
            className={cn(inputCls, 'pl-10')}
          />
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-[var(--color-brand)]" />
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-1 font-medium">{t('elig.empty_title')}</p>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">{t('elig.empty_body')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(({ program: p, result }, i) => {
              const gaps = result.gap && p.admission_type === 'unified_exam'
                ? gapByExam(student.scores ?? {}, p.required_exams, result.gap)
                : [];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[var(--text-muted)] mb-0.5 truncate">
                        {p.university?.name_hy ?? p.university?.name}
                        {p.university?.city ? ` · ${p.university.city}` : ''}
                      </p>
                      <h3 className="font-bold text-[var(--text-primary)] leading-snug">{p.name_hy}</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{p.name}</p>
                    </div>
                    <span className={cn(
                      'shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border',
                      VERDICT_STYLE[result.verdict],
                    )}>
                      {t(`elig.v_${result.verdict}`)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)] mb-3">
                    {p.qualification && <span>{p.qualification}</span>}
                    {p.duration_months && (
                      <span>{t('elig.duration', { years: (p.duration_months / 12).toFixed(1) })}</span>
                    )}
                    {result.reference !== null && (
                      <span>{t('elig.based_on', {
                        score: result.reference,
                        years: result.yearsUsed.join(', '),
                      })}</span>
                    )}
                  </div>

                  {result.blockedReason && (
                    <p className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)] mb-3">
                      <Info size={13} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                      {result.blockedReason}
                    </p>
                  )}

                  {result.gap !== null && (
                    <p className="text-xs text-[var(--text-secondary)] mb-3">
                      {t('elig.gap', { points: result.gap })}
                    </p>
                  )}

                  {gaps.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {gaps.map((g) => {
                        const ex = getExam(g.exam);
                        if (!ex) return null;
                        return (
                          <Link
                            key={g.exam}
                            href={`/chat/exams?exam=${g.exam}&target=${g.suggestedTarget}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
                          >
                            {t('elig.close_gap', {
                              exam: ex.name.replace('Unified — ', ''),
                              target: g.suggestedTarget,
                            })}
                            <ArrowRight size={13} />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-[var(--text-muted)] mt-8 leading-relaxed">
          {t('elig.disclaimer')}
        </p>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'am', ['common'])) },
});
