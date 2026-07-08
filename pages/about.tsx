import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, MapPin, CalendarDays, ArrowRight,
  BrainCircuit, Globe, Zap, Heart, Plus, Mail,
  Users, Rocket, Clock, BadgeCheck,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { ThreeDMarquee, type ThreeDMarqueeItem } from '@/components/ui/3d-marquee';

const EASE = 'easeOut' as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  // `amount` is far more reliable than a negative margin on mobile viewports,
  // where the old '-60px' could leave in-view content stuck at opacity 0.
  viewport: { once: true, amount: 0.15 as const },
  transition: { duration: 0.55, delay, ease: EASE },
});

// Visual metadata only — text comes from the `about` i18n namespace by index.
const WHAT_META = [
  { icon: BrainCircuit, iconColor: 'bg-blue-500/10 text-[var(--color-brand)]',              cardBg: 'bg-blue-500/[0.04] border-blue-500/20 hover:border-blue-500/40' },
  { icon: Globe,        iconColor: 'bg-green-500/10 text-green-600 dark:text-green-400',    cardBg: 'bg-green-500/[0.04] border-green-500/20 hover:border-green-500/40' },
  { icon: Zap,          iconColor: 'bg-yellow-500/10 text-yellow-500',                      cardBg: 'bg-yellow-500/[0.04] border-yellow-500/20 hover:border-yellow-500/40' },
  { icon: Heart,        iconColor: 'bg-blue-500/10 text-[var(--color-brand)]',              cardBg: 'bg-blue-500/[0.04] border-blue-500/20 hover:border-blue-500/40' },
];

const STATS_META = [
  { icon: Users,      value: '3',         iconBg: 'bg-blue-500/10',   iconColor: 'text-[var(--color-brand)]',          border: 'border-blue-500/20' },
  { icon: Rocket,     value: 'June 2026', iconBg: 'bg-green-500/10',  iconColor: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
  { icon: Clock,      value: '< 5 min',   iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-500',                    border: 'border-yellow-500/20' },
  { icon: BadgeCheck, value: 'Free',      iconBg: 'bg-green-500/10',  iconColor: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
];

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' as const }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: EASE }}
      className="border-b border-[var(--border)]"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-4 py-6 text-left group"
      >
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="flex-shrink-0 mt-0.5 text-[var(--color-brand)]"
        >
          <Plus size={20} strokeWidth={2.5} />
        </motion.span>
        <span className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--color-brand)] transition-colors leading-snug">
          {q}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <p className="pl-9 pb-6 text-[var(--text-secondary)] leading-relaxed text-base">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AboutPage() {
  const { t } = useTranslation('about');
  const statLabelKeys = ['stat_founders', 'stat_launched', 'stat_start', 'stat_free'];
  // returnObjects gives back the raw key string if the namespace/key is missing;
  // guard so a missing translation can never crash the page.
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const what = asArray<{ title: string; desc: string }>(t('what', { returnObjects: true }));
  const faqs = asArray<{ q: string; a: string }>(t('faqs', { returnObjects: true }));
  const marquee = asArray<string>(t('marquee', { returnObjects: true }));
  const marqueeItems: ThreeDMarqueeItem[] = marquee.length === 0
    ? [{ type: 'logo' as const }]
    : Array.from({ length: 32 }, (_, i) =>
        i % 2 === 0
          ? { type: 'logo' as const }
          : { type: 'cta' as const, desc: marquee[Math.floor(i / 2) % marquee.length] }
      );

  return (
    <Layout>
      <Head>
        <title>About Us — HIMQ</title>
        <meta name="description" content="Himq was built in June 2026 by 3 students from Armenia who wanted to fix how young people find opportunities and learn new skills." />
      </Head>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-20 w-[32rem] h-[32rem] rounded-full bg-[var(--color-brand)]/10 blur-3xl" />
          <div className="absolute top-8 right-0 w-[22rem] h-[22rem] rounded-full bg-green-400/8 blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-14 pb-8 text-center">
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-brand-soft)] text-[var(--color-brand)] mb-5"
          >
            <Sparkles size={12} /> {t('badge')}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05, ease: EASE }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.07] mb-5"
          >
            {t('hero_1')}<br />
            <span className="text-[var(--color-brand)]">{t('hero_2')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
            className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto"
          >
            {t('hero_sub')}
          </motion.p>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS_META.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 + i * 0.07, ease: EASE }}
              className={`flex flex-col items-center text-center p-5 rounded-2xl border bg-[var(--bg-card)] shadow-[var(--shadow-sm)] ${s.border}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.iconBg}`}>
                <s.icon size={18} className={s.iconColor} />
              </div>
              <p className="text-xl font-extrabold text-[var(--text-primary)] leading-none mb-1">{s.value}</p>
              <p className="text-xs text-[var(--text-muted)] leading-snug">{t(statLabelKeys[i])}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Yerevan aerial photo ──────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="relative rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1600758208050-a22f17dc5bb9?w=1600&q=80&auto=format&fit=crop"
            alt="Aerial view of Yerevan, Armenia — where Himq was built"
            className="w-full h-[260px] sm:h-[360px] md:h-[460px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute bottom-5 left-6 text-white">
            <p className="text-base font-semibold">{t('yerevan')}</p>
            <p className="text-xs opacity-50 mt-0.5">Photo: Levon Vardanyan / Unsplash</p>
          </div>
        </motion.div>
      </div>

      {/* ── Origin story (dark band) ───────────────────────────── */}
      <section className="bg-[var(--bg-deep)] py-14 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[40rem] h-[20rem] rounded-full bg-[var(--color-brand)]/8 blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="grid md:grid-cols-2 gap-12 items-start">

            {/* Left: text */}
            <div>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--text-on-deep)]/70 w-fit">
                  <CalendarDays size={14} className="text-[var(--color-brand)]" />
                  {t('founded')}
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--text-on-deep)]/70 w-fit">
                  <MapPin size={14} className="text-green-400" />
                  {t('yerevan')}
                </div>
              </div>

              {/* Critical content — rendered unconditionally (no scroll-reveal)
                  so it can never get stuck invisible on mobile. */}
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-on-deep)] mb-6 leading-snug">
                {t('story_title')}
              </h2>

              <div className="space-y-4 text-[var(--text-on-deep)]/80 leading-relaxed text-base">
                <p>{t('story_p1')}</p>
                <p>{t('story_p2')}</p>
                <p>{t('story_p3')}</p>
                <p>{t('story_p4')}</p>
              </div>
            </div>

            {/* Right: Republic Square photo */}
            <motion.div {...fadeUp(0.1)} className="md:sticky md:top-28">
              <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1697700257503-1b6e2034eb37?w=800&q=80&auto=format&fit=crop"
                  alt="Republic Square, Yerevan"
                  className="w-full h-[320px] sm:h-[440px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="text-sm font-medium">{t('republic_square')}</p>
                  <p className="text-xs opacity-50">Photo: Yuri Oparin / Unsplash</p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── What Himq does ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <motion.div {...fadeUp()} className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-3">{t('what_eyebrow')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] mb-3">
            {t('what_title')}
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            {t('what_sub')}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {WHAT_META.map((item, i) => (
            <motion.div
              key={i}
              {...fadeUp(0.07 + i * 0.08)}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl border p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all ${item.cardBg}`}
            >
              <div className={`flex items-center justify-center w-11 h-11 rounded-xl mb-4 ${item.iconColor}`}>
                <item.icon size={20} />
              </div>
              <h3 className="font-bold text-[var(--text-primary)] text-base mb-2">{what?.[i]?.title}</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed text-sm">{what?.[i]?.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Mission statement ─────────────────────────────────── */}
      <section className="relative overflow-hidden py-14 my-4">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand)] via-blue-600 to-green-500" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-yellow-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-green-400/20 blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 text-center text-white">
          <motion.div {...fadeUp()}>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-5">{t('mission_eyebrow')}</p>
            <blockquote className="text-3xl sm:text-4xl font-extrabold leading-snug mb-5">
              &ldquo;{t('mission_quote')}&rdquo;
            </blockquote>
            <p className="text-white/75 text-base leading-relaxed max-w-2xl mx-auto">
              {t('mission_p')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-8 items-start">

          <motion.div {...fadeUp()} className="md:sticky md:top-28">
            <h2 className="text-5xl sm:text-6xl font-extrabold text-[var(--text-primary)] leading-tight">
              {t('faq_title')}
            </h2>
          </motion.div>

          <div className="border-t border-[var(--border)]">
            {(faqs ?? []).map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} index={i} />
            ))}
          </div>

        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <motion.div
          {...fadeUp()}
          className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-10 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-8"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-2">{t('contact_eyebrow')}</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mb-2">{t('contact_title')}</h2>
            <p className="text-[var(--text-secondary)] text-base max-w-sm leading-relaxed">
              {t('contact_sub')}
            </p>
          </div>
          <a
            href="mailto:himqaiteam@gmail.com"
            className="flex-shrink-0 inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-[var(--color-brand)] text-white font-semibold text-base hover:bg-[var(--color-brand-hover)] transition-colors shadow-lg"
          >
            <Mail size={18} />
            himqaiteam@gmail.com
          </a>
        </motion.div>
      </section>

      {/* ── 3D Marquee ────────────────────────────────────────── */}
      <section className="pb-14 overflow-hidden">
        <motion.div {...fadeUp()} className="text-center mb-10 px-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-3">{t('cta_eyebrow')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] mb-3">
            {t('cta_title')}
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            {t('cta_sub')}
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 mt-6 px-7 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-base hover:bg-[var(--color-brand-hover)] transition-colors shadow-lg"
          >
            {t('cta_button')} <ArrowRight size={16} />
          </Link>
        </motion.div>

        {/* Decorative 3D marquee — desktop only; on phones the giant tilted
            cards overflow and look broken, so we drop them and keep the CTA. */}
        <div className="hidden md:block">
          <ThreeDMarquee items={marqueeItems} />
        </div>
      </section>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common', 'about'])),
  },
});
