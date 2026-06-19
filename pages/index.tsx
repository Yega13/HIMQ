import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Target,
  BrainCircuit,
  Route,
  CheckCircle2,
  CircleDot,
  Circle,
  ArrowRight,
  Code,
  Languages,
  Calculator,
  Briefcase,
  Palette,
  GraduationCap,
  CalendarDays,
  Gift,
  Award,
  Flame,
  WalletCards,
} from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

const SUBJECTS = [
  { icon: Code, key: 'home.subj_programming' },
  { icon: Languages, key: 'home.subj_languages' },
  { icon: Calculator, key: 'home.subj_sciences' },
  { icon: Briefcase, key: 'home.subj_business' },
  { icon: Palette, key: 'home.subj_design' },
  { icon: GraduationCap, key: 'home.subj_exams' },
];

const AI_STEPS = [
  { icon: Target, titleKey: 'home.ai_step1_title', descKey: 'home.ai_step1_desc' },
  { icon: BrainCircuit, titleKey: 'home.ai_step2_title', descKey: 'home.ai_step2_desc' },
  { icon: Sparkles, titleKey: 'home.ai_step3_title', descKey: 'home.ai_step3_desc' },
  { icon: Route, titleKey: 'home.ai_step4_title', descKey: 'home.ai_step4_desc' },
];

const EVENT_CATS = [
  'home.events_cat_competition',
  'home.events_cat_scholarship',
  'home.events_cat_grant',
  'home.events_cat_course',
  'home.events_cat_fellowship',
  'home.events_cat_conference',
  'home.events_cat_workshop',
  'home.events_cat_panel',
  'home.events_cat_meetup',
];

const REWARDS = [
  { icon: Flame, titleKey: 'home.rewards_p1_title', descKey: 'home.rewards_p1_desc' },
  { icon: CalendarDays, titleKey: 'home.rewards_p2_title', descKey: 'home.rewards_p2_desc' },
  { icon: WalletCards, titleKey: 'home.rewards_p3_title', descKey: 'home.rewards_p3_desc' },
];

export default function Home() {
  const { t } = useTranslation('common');

  return (
    <Layout>
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* soft brand glow background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-24 w-[34rem] h-[34rem] rounded-full bg-[var(--color-brand)]/10 blur-3xl" />
          <div className="absolute top-10 right-0 w-[26rem] h-[26rem] rounded-full bg-[var(--color-brand)]/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-16 pb-14 md:pt-20">
          <div className="grid md:grid-cols-2 items-center gap-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="text-center md:text-left"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-brand-soft)] text-[var(--color-brand)] mb-6">
                <Sparkles size={13} />
                {t('home.badge')}
              </span>
              <h1 className="text-4xl sm:text-5xl md:text-[3.4rem] font-extrabold tracking-tight text-[var(--text-primary)] mb-5 leading-[1.08]">
                {t('home.hero_title')}
              </h1>
              <p className="text-lg text-[var(--text-secondary)] max-w-xl md:max-w-lg mb-8 leading-relaxed mx-auto md:mx-0">
                {t('home.hero_subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-base hover:bg-[var(--color-brand-hover)] transition-colors shadow-[var(--shadow-md)]"
                >
                  {t('home.cta_start')}
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/opportunities"
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold text-base hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
                >
                  {t('home.cta_explore')}
                </Link>
              </div>
            </motion.div>

            {/* Product preview card (replaces stock photo) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative mx-auto w-full max-w-md"
            >
              <PlanPreview t={t} />
            </motion.div>
          </div>

          {/* value strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {[
              { icon: BrainCircuit, key: 'home.value_1' },
              { icon: CalendarDays, key: 'home.value_2' },
              { icon: Gift, key: 'home.value_3' },
            ].map((v) => (
              <div
                key={v.key}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 shadow-[var(--shadow-sm)]"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)] shrink-0">
                  <v.icon size={18} />
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{t(v.key)}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── What you can learn ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <motion.div {...fadeUp} transition={{ duration: 0.45 }} className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-3">{t('home.learn_title')}</h2>
          <p className="text-[var(--text-secondary)] text-base">{t('home.learn_subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {SUBJECTS.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4 shadow-[var(--shadow-sm)] hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-md)] transition-all"
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)] shrink-0 group-hover:scale-105 transition-transform">
                <s.icon size={20} />
              </span>
              <span className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">{t(s.key)}</span>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-sm text-[var(--text-muted)] mt-6">{t('home.learn_hint')}</p>
      </section>

      {/* ─── How the AI works ─────────────────────────────────── */}
      <section className="bg-[var(--bg-subtle)] border-y border-[var(--border)] py-16">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} transition={{ duration: 0.45 }} className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-brand)] mb-3">
              <BrainCircuit size={15} /> AI
            </span>
            <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-3">{t('home.ai_title')}</h2>
            <p className="text-[var(--text-secondary)] text-base">{t('home.ai_subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {AI_STEPS.map((step, i) => (
              <motion.div
                key={step.titleKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]"
              >
                <span className="absolute top-5 right-5 text-5xl font-black text-[var(--color-brand)]/10 leading-none select-none">
                  {i + 1}
                </span>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-brand)] text-white mb-4 shadow-[var(--shadow-sm)]">
                  <step.icon size={22} />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] mb-1.5">{t(step.titleKey)}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t(step.descKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Events / Opportunities ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-brand)] mb-3">
              <CalendarDays size={15} /> {t('nav.opportunities')}
            </span>
            <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-4">{t('home.events_title')}</h2>
            <p className="text-[var(--text-secondary)] text-base leading-relaxed mb-5">{t('home.events_subtitle')}</p>
            <p className="text-[var(--text-secondary)] text-base leading-relaxed mb-7 font-medium">{t('home.events_note')}</p>
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold hover:bg-[var(--color-brand-hover)] transition-colors shadow-[var(--shadow-md)]"
            >
              {t('home.cta_explore')}
              <ArrowRight size={18} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="flex flex-wrap gap-2.5 content-start"
          >
            {EVENT_CATS.map((c, i) => (
              <motion.span
                key={c}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
                {t(c)}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Rewards (XP) — deep navy band ────────────────────── */}
      <section className="bg-[var(--bg-deep)] py-16 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 right-10 w-80 h-80 rounded-full bg-[var(--color-gold)]/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-4 relative">
          <motion.div {...fadeUp} transition={{ duration: 0.45 }} className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-gold)] mb-3">
              <Award size={15} /> XP
            </span>
            <h2 className="text-3xl font-extrabold text-[var(--text-on-deep)] mb-3">{t('home.rewards_title')}</h2>
            <p className="text-[var(--text-on-deep)]/70 text-base">{t('home.rewards_subtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {REWARDS.map((r, i) => {
              const isReward = i === REWARDS.length - 1;
              return (
                <motion.div
                  key={r.titleKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 backdrop-blur-sm"
                >
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${
                      isReward ? 'bg-[var(--color-gold)] text-[#1a1205]' : 'bg-[var(--color-brand)] text-white'
                    }`}
                  >
                    <r.icon size={22} />
                  </div>
                  <h3 className="font-bold text-[var(--text-on-deep)] mb-1.5">{t(r.titleKey)}</h3>
                  <p className="text-sm text-[var(--text-on-deep)]/65 leading-relaxed">{t(r.descKey)}</p>
                </motion.div>
              );
            })}
          </div>
          <p className="text-center text-sm text-[var(--text-on-deep)]/50 mt-8">{t('home.rewards_note')}</p>
        </div>
      </section>

      {/* ─── About / mission ──────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-20 text-center">
        <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mb-5">{t('home.about_title')}</h2>
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed">{t('home.about_body')}</p>
        </motion.div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="rounded-3xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-hover)] p-10 sm:p-14 text-center text-white relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/20 mb-4">
              {t('home.cta_badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">{t('home.cta_title')}</h2>
            <p className="text-blue-100 text-base mb-8 max-w-md mx-auto">{t('home.cta_subtitle')}</p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-[var(--color-brand)] font-bold text-base hover:bg-blue-50 transition-colors shadow-lg"
            >
              {t('home.cta_button')}
              <ArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      </section>
    </Layout>
  );
}

/* ─── Hero product-preview card ──────────────────────────────── */
function PlanPreview({ t }: { t: (k: string) => string }) {
  const lessons = [
    { key: 'home.plan_lesson_1', state: 'done' as const },
    { key: 'home.plan_lesson_2', state: 'done' as const },
    { key: 'home.plan_lesson_3', state: 'current' as const },
    { key: 'home.plan_lesson_4', state: 'todo' as const },
    { key: 'home.plan_lesson_5', state: 'todo' as const },
  ];

  return (
    <div className="relative">
      {/* floating XP chip — tasteful, real mechanic */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-4 -right-3 z-10 flex items-center gap-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2 shadow-[var(--shadow-lg)]"
      >
        <Award size={15} className="text-[var(--color-gold)]" />
        <span className="text-sm font-bold text-[var(--text-primary)]">+40 XP</span>
      </motion.div>

      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-lg)] p-5 sm:p-6">
        {/* header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-brand)] text-white">
              <Sparkles size={16} />
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">{t('home.plan_card_label')}</p>
              <p className="text-sm font-bold text-[var(--text-primary)]">{t('home.plan_card_goal')}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[var(--color-brand)] bg-[var(--color-brand-soft)] px-2.5 py-1 rounded-full">
            AI
          </span>
        </div>

        {/* lessons */}
        <div className="space-y-2.5 mb-5">
          {lessons.map((l) => (
            <div
              key={l.key}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                l.state === 'current'
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-[var(--border)] bg-[var(--bg-secondary)]'
              }`}
            >
              {l.state === 'done' && <CheckCircle2 size={18} className="text-[var(--color-green)] shrink-0" />}
              {l.state === 'current' && <CircleDot size={18} className="text-[var(--color-brand)] shrink-0" />}
              {l.state === 'todo' && <Circle size={18} className="text-[var(--text-muted)] shrink-0" />}
              <span
                className={`text-sm font-medium ${
                  l.state === 'todo' ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                }`}
              >
                {t(l.key)}
              </span>
              {l.state === 'current' && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand)]">
                  {t('home.plan_current')}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{t('home.plan_progress')}</span>
            <span className="text-xs font-bold text-[var(--color-brand)]">40%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '40%' }}
              transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-[var(--color-brand)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
