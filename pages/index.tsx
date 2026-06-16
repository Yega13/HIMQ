import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { motion } from 'framer-motion';
import { Zap, Trophy, Target, BookOpen, Star, ArrowRight } from 'lucide-react';

function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-lg mx-auto">
      <circle cx="240" cy="160" r="140" fill="#EFF6FF" className="dark:fill-blue-950/40" />

      {/* Laptop body */}
      <rect x="100" y="100" width="280" height="170" rx="12" fill="#1e40af" />
      <rect x="110" y="110" width="260" height="150" rx="8" fill="#dbeafe" className="dark:fill-blue-900" />

      {/* Chat bubbles on screen */}
      <rect x="124" y="126" width="160" height="22" rx="11" fill="#2578e8" opacity="0.9" />
      <rect x="124" y="156" width="100" height="22" rx="11" fill="#e2e8f0" className="dark:fill-slate-700" />
      <rect x="124" y="186" width="140" height="22" rx="11" fill="#2578e8" opacity="0.9" />
      <rect x="124" y="216" width="80" height="22" rx="11" fill="#e2e8f0" className="dark:fill-slate-700" />

      {/* Laptop base */}
      <path d="M60 272 Q60 278 66 278 H414 Q420 278 420 272 L400 268 H80 L60 272Z" fill="#1e40af" />
      <rect x="60" y="268" width="360" height="10" rx="4" fill="#1d4ed8" />

      {/* XP badge */}
      <rect x="310" y="82" width="80" height="38" rx="10" fill="#22c55e" />
      <text x="330" y="97" fill="white" fontSize="10" fontWeight="700">+50 XP</text>
      <text x="322" y="111" fill="white" fontSize="9" opacity="0.85">Lesson done!</text>

      {/* Streak badge */}
      <rect x="88" y="78" width="74" height="38" rx="10" fill="#f97316" />
      <text x="103" y="93" fill="white" fontSize="10" fontWeight="700">🔥 7 days</text>
      <text x="100" y="108" fill="white" fontSize="9" opacity="0.85">On a streak!</text>

      {/* Stars */}
      <circle cx="420" cy="130" r="4" fill="#eab308" />
      <circle cx="435" cy="110" r="2.5" fill="#eab308" opacity="0.7" />
      <circle cx="55" cy="180" r="3" fill="#eab308" opacity="0.8" />
      <circle cx="440" cy="200" r="2" fill="#eab308" opacity="0.5" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: Zap,
    titleKey: 'home.feature_ai_title',
    descKey: 'home.feature_ai_desc',
    color: 'text-[var(--color-brand)]',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-100 dark:border-blue-900/30',
  },
  {
    icon: Trophy,
    titleKey: 'home.feature_xp_title',
    descKey: 'home.feature_xp_desc',
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-100 dark:border-yellow-900/30',
  },
  {
    icon: Target,
    titleKey: 'home.feature_opp_title',
    descKey: 'home.feature_opp_desc',
    color: 'text-[var(--color-green)]',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-100 dark:border-green-900/30',
  },
];

const STEPS = [
  {
    num: '1',
    icon: BookOpen,
    title: 'Set your goal',
    desc: 'Tell us what you want to learn — Python, marketing, English, anything.',
    color: 'bg-blue-500',
  },
  {
    num: '2',
    icon: Zap,
    title: 'AI builds your plan',
    desc: 'Our AI creates a 5-lesson personalized path in seconds.',
    color: 'bg-yellow-500',
  },
  {
    num: '3',
    icon: Star,
    title: 'Learn & earn XP',
    desc: 'Chat through each lesson, complete them, and climb the leaderboard.',
    color: 'bg-green-500',
  },
];

export default function Home() {
  const { t } = useTranslation('common');

  return (
    <Layout>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 pt-16 pb-12">
        <div className="flex flex-col md:flex-row items-center gap-10">
          <motion.div
            className="flex-1 text-center md:text-left"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mb-5">
              Beta — Free during SSS Demo
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[var(--text-primary)] mb-5 leading-tight">
              {t('home.hero_title')}
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-xl mb-8">
              {t('home.hero_subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                href="/auth"
                className="px-8 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-base hover:bg-[var(--color-brand-hover)] transition-colors shadow-md"
              >
                {t('home.cta_start')}
              </Link>
              <Link
                href="/opportunities"
                className="px-8 py-3.5 rounded-xl border border-[var(--border-strong)] text-[var(--text-primary)] font-semibold text-base hover:bg-[var(--border)] transition-colors"
              >
                {t('home.cta_explore')}
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="flex-1 w-full"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <HeroIllustration />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.titleKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className={`bg-[var(--bg-card)] rounded-2xl p-6 border ${f.border} shadow-[var(--shadow-sm)]`}
            >
              <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${f.bg} mb-4`}>
                <f.icon size={22} className={f.color} />
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">{t(f.titleKey)}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t(f.descKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--bg-secondary)] border-y border-[var(--border)] py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-3">How it works</h2>
            <p className="text-[var(--text-secondary)] text-base">From zero to learning in under 60 seconds.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative flex flex-col items-center text-center"
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px border-t-2 border-dashed border-[var(--border)] z-0" />
                )}
                <div className={`relative z-10 w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center mb-4 shadow-md`}>
                  <step.icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] mb-1.5">{step.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-10 text-center text-white relative overflow-hidden"
        >
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full" />

          <div className="relative z-10">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/20 mb-4">
              100% Free · No credit card
            </span>
            <h2 className="text-3xl font-extrabold mb-3">Ready to start learning?</h2>
            <p className="text-blue-100 text-base mb-7 max-w-md mx-auto">
              Join students across Armenia building skills that actually matter.
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-blue-600 font-bold text-base hover:bg-blue-50 transition-colors shadow-md"
            >
              Get started free
              <ArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      </section>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
