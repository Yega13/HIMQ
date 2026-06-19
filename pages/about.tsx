import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, MapPin, CalendarDays, ArrowRight,
  BrainCircuit, Globe, Zap, Heart, Plus,
} from 'lucide-react';
import Layout from '@/components/Layout';

const EASE = 'easeOut' as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' as const },
  transition: { duration: 0.55, delay, ease: EASE },
});

const WHAT_WE_DO = [
  {
    icon: BrainCircuit,
    color: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
    title: 'AI that actually teaches',
    desc: 'You tell May — our AI — what you want to learn. It asks a few smart questions, then builds a focused 5-lesson course tailored to your level and goal. No generic YouTube rabbit holes.',
  },
  {
    icon: Globe,
    color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    title: 'Real opportunities in one place',
    desc: 'We collect scholarships, competitions, internships, grants, and events happening in Armenia and make them easy to find, filter, and prepare for — all inside Himq.',
  },
  {
    icon: Zap,
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-500',
    title: 'Motivation that sticks',
    desc: 'XP, daily streaks, and a leaderboard turn lonely studying into something you actually look forward to. Learning should feel like progress — because it is.',
  },
  {
    icon: Heart,
    color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-500',
    title: 'Built with love from Armenia',
    desc: 'Every design decision, every translation, every feature was made with Armenian students in mind. This is not a global product localised for Armenia — it was born here.',
  },
];

const FAQS = [
  {
    q: 'What is Himq?',
    a: 'Himq is an AI-powered learning and opportunity platform built specifically for Armenian students. You describe what you want to learn, our AI builds a personal 5-lesson course for you, and alongside that you get a live feed of scholarships, competitions, internships, and events available in Armenia.',
  },
  {
    q: 'Is Himq free to use?',
    a: 'Yes — Himq is completely free during the SSS 2026 demo period. No credit card required. After the demo, individual student accounts will stay free, and we plan to introduce a small monthly fee (3,000 AMD/month) only for institution or school accounts.',
  },
  {
    q: 'How does the AI learning plan work?',
    a: 'When you start a new course, our AI — called May — asks you a few questions: what you already know, what your goal is, and how much time you have. It then generates a structured 5-lesson plan built around your answers. Each lesson is an interactive conversation where May explains, quizzes, and adapts to your pace.',
  },
  {
    q: 'What subjects can I study on Himq?',
    a: 'Anything you can describe in a sentence. Students have used Himq to study programming, mathematics, English grammar, history, design basics, biology, economics, and more. If you can name the topic, May can build a course around it.',
  },
  {
    q: 'What scholarships and opportunities does Himq track?',
    a: 'Himq aggregates scholarships, Olympiads, hackathons, summer schools, grants, internships, and competitions that are open to students in Armenia. We focus on opportunities that are actually reachable — local deadlines, Armenian-language options, and programs that actively recruit from the South Caucasus region.',
  },
  {
    q: 'Can I use Himq in Armenian, English, or Russian?',
    a: 'Yes. Himq fully supports Armenian (Հայերեն), English, and Russian (Русский). You can switch language from the top navigation bar at any time. The AI conversations, lesson content, and UI all switch with it.',
  },
  {
    q: 'How is Himq different from Coursera, YouTube, or ChatGPT?',
    a: 'Coursera and YouTube offer content for a global audience — they do not know you are in Armenia, do not speak Armenian by default, and do not connect you to local opportunities. ChatGPT is a general assistant, not a structured learning tool. Himq combines a personal AI tutor with a curated Armenian opportunity board — it was designed from day one for students exactly like you.',
  },
  {
    q: 'How does the XP and leaderboard system work?',
    a: 'You earn XP (experience points) for every lesson you complete and every day you keep your streak alive. Your total XP places you on the Himq leaderboard, where you can see how you rank against other learners. Streaks reset if you miss a day, so consistency is rewarded.',
  },
  {
    q: 'Who built Himq, and why?',
    a: 'Himq was built in June 2026 by three students from Armenia — Suren, Hayk, and Artashes. We were frustrated by how scattered information about scholarships is, and how generic learning platforms never felt built for us. We built the tool we wished we had.',
  },
  {
    q: 'How do I get started?',
    a: 'Create a free account at himq.am/auth. No credit card, no verification process — just sign up and start your first course in under two minutes. If you already have an account, sign in and hit "Start learning" on the dashboard.',
  },
];

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' as const }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: EASE }}
      className="border-b border-[var(--border)] last:border-b-0"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
      >
        <span className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-brand)] transition-colors leading-snug">
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="flex-shrink-0 w-7 h-7 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] group-hover:border-[var(--color-brand)] group-hover:text-[var(--color-brand)] transition-colors"
        >
          <Plus size={14} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <p className="pb-5 text-[var(--text-secondary)] leading-relaxed text-sm">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AboutPage() {
  return (
    <Layout>
      <Head>
        <title>About Us — Himq</title>
        <meta name="description" content="Himq was built in June 2026 by 3 students from Armenia who wanted to fix how young people find opportunities and learn new skills." />
      </Head>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-20 w-[32rem] h-[32rem] rounded-full bg-[var(--color-brand)]/10 blur-3xl" />
          <div className="absolute top-8 right-0 w-[22rem] h-[22rem] rounded-full bg-violet-400/8 blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto px-4 pt-20 pb-16 text-center">
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-brand-soft)] text-[var(--color-brand)] mb-6"
          >
            <Sparkles size={12} /> About us
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05, ease: EASE }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.07] mb-6"
          >
            We&apos;re three students<br />
            <span className="text-[var(--color-brand)]">who got tired of waiting.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
            className="text-lg text-[var(--text-secondary)] leading-relaxed"
          >
            Tired of watching talented classmates miss scholarships they never heard about.
            Tired of generic courses that teach nothing real.
            Tired of studying alone with no feedback and no direction.
            So in June 2026, we built Himq.
          </motion.p>
        </div>
      </section>

      {/* ── Origin story (dark band) ───────────────────────────── */}
      <section className="bg-[var(--bg-deep)] py-20 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[40rem] h-[20rem] rounded-full bg-[var(--color-brand)]/8 blur-3xl" />
        <div className="max-w-3xl mx-auto px-4 relative">

          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--text-on-deep)]/70 w-fit">
              <CalendarDays size={14} className="text-[var(--color-brand)]" />
              Founded June 2026
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--text-on-deep)]/70 w-fit">
              <MapPin size={14} className="text-[var(--color-brand)]" />
              Yerevan, Armenia
            </div>
          </div>

          <motion.h2 {...fadeUp()} className="text-2xl sm:text-3xl font-extrabold text-[var(--text-on-deep)] mb-6 leading-snug">
            The story behind Himq
          </motion.h2>

          <div className="space-y-5 text-[var(--text-on-deep)]/75 leading-relaxed text-base">
            <motion.p {...fadeUp(0.07)}>
              We are three students from Armenia — Suren, Hayk, and Artashes — who met through a shared frustration: the gap between ambition and opportunity in our country is huge, but it doesn&apos;t have to be.
            </motion.p>
            <motion.p {...fadeUp(0.12)}>
              Armenian students are sharp, motivated, and hungry. But the information they need — which scholarship to apply for, how to prepare, where to start learning — is scattered across hundreds of websites, Telegram channels, and word-of-mouth. Most students miss deadlines simply because no one told them in time.
            </motion.p>
            <motion.p {...fadeUp(0.17)}>
              At the same time, generic online learning platforms like Coursera or YouTube weren&apos;t built for us. They don&apos;t know that we&apos;re preparing for TUMO selection. They don&apos;t speak Armenian. They don&apos;t point us toward what&apos;s actually available in Yerevan this month.
            </motion.p>
            <motion.p {...fadeUp(0.22)}>
              So we built the tool we wished we had. In June 2026, we launched Himq — an AI that builds your personal learning plan and sits alongside a live feed of real Armenian opportunities. One platform. One goal: help every Armenian student take the next step.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ── What Himq does ────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <motion.div {...fadeUp()} className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-3">What we built</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] mb-3">
            What Himq actually does
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Not a course catalog. Not another chatbot. Something different.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {WHAT_WE_DO.map((item, i) => (
            <motion.div
              key={i}
              {...fadeUp(0.07 + i * 0.08)}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--color-brand)]/40 transition-all"
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl mb-5 ${item.color}`}>
                <item.icon size={22} />
              </div>
              <h3 className="font-bold text-[var(--text-primary)] text-lg mb-2">{item.title}</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Mission statement ─────────────────────────────────── */}
      <section className="bg-[var(--bg-subtle)] border-y border-[var(--border)] py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div {...fadeUp()}>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-6">Our mission</p>
            <blockquote className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] leading-snug mb-6">
              &ldquo;Every Armenian student deserves a clear path forward — regardless of who they know or where they heard about it.&rdquo;
            </blockquote>
            <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-2xl mx-auto">
              We believe the next generation of Armenian scientists, engineers, artists, and entrepreneurs is already here. They just need the right tools to take the first step. Himq is that first step.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-20">
        <motion.div {...fadeUp()} className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] mb-3">
            Frequently asked questions
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Everything you need to know about Himq before you sign up.
          </p>
        </motion.div>

        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {FAQS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} index={i} />
          ))}
        </div>
      </section>

      {/* ── SSS + CTA ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE }}
          className="rounded-3xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-hover)] p-12 sm:p-16 text-center text-white relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-14 -right-14 w-56 h-56 bg-white/10 rounded-full" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 bg-white/10 rounded-full" />
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/20 mb-5">
              SSS 2026 Starter Track · Yerevan, Armenia
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              Want to try it yourself?
            </h2>
            <p className="text-blue-100 text-base mb-8 max-w-sm mx-auto leading-relaxed">
              Himq is completely free during the SSS 2026 demo. No credit card. Just sign up and start learning.
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[var(--color-brand)] font-bold text-base hover:bg-blue-50 transition-colors shadow-lg"
            >
              Create your free account <ArrowRight size={17} />
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
