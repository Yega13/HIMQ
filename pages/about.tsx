import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Zap, Globe, Trophy, ArrowRight, Star, Users, Target, Sparkles } from 'lucide-react';
import Layout from '@/components/Layout';

const FEATURES = [
  {
    icon: Sparkles,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    title: 'AI-Powered Learning Paths',
    desc: 'Type any goal — get a 5-lesson personalized course in seconds. No generic content, no wasted time.',
  },
  {
    icon: Globe,
    color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    title: 'Real Armenian Opportunities',
    desc: 'Scholarships, competitions, internships, and grants curated specifically for students in Armenia.',
  },
  {
    icon: Zap,
    color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    title: 'XP & Streak Rewards',
    desc: 'Earn +50 XP per completed lesson. Build daily streaks. Stay motivated with a leaderboard.',
  },
  {
    icon: Trophy,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    title: 'Compete & Collaborate',
    desc: 'See where you rank among other Armenian students. Learning is more fun when it\'s competitive.',
  },
  {
    icon: BookOpen,
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    title: 'Bilingual — Armenian & English',
    desc: 'Switch between Հայերեն and English at any time. The whole platform adapts instantly.',
  },
  {
    icon: Target,
    color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
    title: '"Prepare Me with AI"',
    desc: 'Found a scholarship? Click Prepare Me — Himq builds a custom course to help you qualify.',
  },
];

const PROBLEMS = [
  {
    emoji: '🔍',
    title: 'Finding opportunities is exhausting',
    desc: 'Armenian students spend hours searching scattered websites for scholarships and competitions they might qualify for.',
  },
  {
    emoji: '📚',
    title: 'Generic courses don\'t fit',
    desc: 'Existing platforms aren\'t designed for Armenian students — wrong language, wrong context, wrong difficulty.',
  },
  {
    emoji: '😔',
    title: 'Motivation is hard alone',
    desc: 'Without a community, tracking tools, or rewards, most students give up before reaching their goals.',
  },
];

const STEPS = [
  { step: '1', title: 'Tell us your goal', desc: 'Type what you want to learn or which opportunity you\'re targeting.' },
  { step: '2', title: 'AI builds your path', desc: 'Get a 5-lesson personalized course in under 10 seconds.' },
  { step: '3', title: 'Learn & earn rewards', desc: 'Complete lessons, earn XP, climb the leaderboard, unlock real opportunities.' },
];

const STATS = [
  { value: '5', label: 'lessons per learning path', color: 'text-[var(--color-brand)]' },
  { value: '30+', label: 'Armenian opportunities listed', color: 'text-green-500' },
  { value: '+50 XP', label: 'per completed lesson', color: 'text-yellow-500' },
  { value: '2', label: 'languages supported', color: 'text-purple-500' },
];

export default function AboutPage() {
  return (
    <Layout>
      <Head>
        <title>About Himq — AI Tutor for Armenian Students</title>
        <meta name="description" content="Himq is an AI-powered personal tutor and opportunity discovery platform built for Armenian students." />
      </Head>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[var(--color-brand)] text-xs font-semibold mb-6">
            <Star size={12} className="fill-current" />
            Free during SSS 2026 Demo
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--text-primary)] leading-tight mb-4">
            Your AI study partner,<br />
            <span className="text-[var(--color-brand)]">built for Armenia.</span>
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
            Himq gives every Armenian student a personalized AI tutor and a curated list of real local opportunities — scholarships, competitions, internships — all in one place.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors"
            >
              Get started — it&apos;s free
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm hover:border-[var(--color-brand)] transition-colors"
            >
              Browse opportunities
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Problem */}
      <section className="bg-[var(--bg-secondary)] border-y border-[var(--border)] py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">The problem for Armenian students</h2>
            <p className="text-[var(--text-secondary)] text-center text-sm mb-10">We&apos;ve all been there.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PROBLEMS.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5"
                >
                  <div className="text-3xl mb-3">{p.emoji}</div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-1 text-sm">{p.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{p.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">How Himq works</h2>
          <p className="text-[var(--text-secondary)] text-center text-sm mb-10">Three steps to your next achievement.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand)] text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">{s.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-[var(--bg-secondary)] border-y border-[var(--border)] py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">Everything you need</h2>
            <p className="text-[var(--text-secondary)] text-center text-sm mb-10">Designed around how Armenian students actually study and grow.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${f.color}`}>
                    <f.icon size={18} />
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <p className={`text-3xl font-extrabold mb-1 ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[var(--text-secondary)]">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Team */}
      <section className="bg-[var(--bg-secondary)] border-y border-[var(--border)] py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Built by students, for students</h2>
            <p className="text-[var(--text-secondary)] text-sm max-w-xl mx-auto mb-10">
              We are a team of 4 young builders from Armenia who got tired of watching talented peers miss opportunities because no one told them about it.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-secondary)]">
              <Users size={15} className="text-[var(--color-brand)]" />
              SSS 2026 Starter Track — Yerevan, Armenia
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-3">Ready to start?</h2>
          <p className="text-[var(--text-secondary)] mb-8 text-sm">
            Free during beta. No credit card. Just sign up and start learning in 30 seconds.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-brand)] text-white font-bold text-base hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            Create your free account
            <ArrowRight size={16} />
          </Link>
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
