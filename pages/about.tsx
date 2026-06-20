import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
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
  viewport: { once: true, margin: '-60px' as const },
  transition: { duration: 0.55, delay, ease: EASE },
});

const WHAT_WE_DO = [
  {
    icon: BrainCircuit,
    iconColor: 'bg-blue-500/10 text-[var(--color-brand)]',
    cardBg: 'bg-blue-500/[0.04] border-blue-500/20 hover:border-blue-500/40',
    title: 'AI that actually teaches',
    desc: 'You tell May — our AI — what you want to learn. It asks a few smart questions, then builds a focused 5-lesson course tailored to your level and goal. No generic YouTube rabbit holes.',
  },
  {
    icon: Globe,
    iconColor: 'bg-green-500/10 text-green-600 dark:text-green-400',
    cardBg: 'bg-green-500/[0.04] border-green-500/20 hover:border-green-500/40',
    title: 'Real opportunities in one place',
    desc: 'We collect scholarships, competitions, internships, grants, and events happening in Armenia and make them easy to find, filter, and prepare for — all inside Himq.',
  },
  {
    icon: Zap,
    iconColor: 'bg-yellow-500/10 text-yellow-500',
    cardBg: 'bg-yellow-500/[0.04] border-yellow-500/20 hover:border-yellow-500/40',
    title: 'Motivation that sticks',
    desc: 'XP, daily streaks, and a leaderboard turn lonely studying into something you actually look forward to. Learning should feel like progress — because it is.',
  },
  {
    icon: Heart,
    iconColor: 'bg-blue-500/10 text-[var(--color-brand)]',
    cardBg: 'bg-blue-500/[0.04] border-blue-500/20 hover:border-blue-500/40',
    title: 'Built with love from Armenia',
    desc: 'Every design decision, every translation, every feature was made with Armenian students in mind. This is not a global product localised for Armenia — it was born here.',
  },
];

const STATS = [
  { icon: Users,      value: '3',         label: 'Founders',                   iconBg: 'bg-blue-500/10',   iconColor: 'text-[var(--color-brand)]', border: 'border-blue-500/20' },
  { icon: Rocket,     value: 'June 2026', label: 'Launched',                   iconBg: 'bg-green-500/10',  iconColor: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
  { icon: Clock,      value: '< 5 min',   label: 'To start your first course', iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-500', border: 'border-yellow-500/20' },
  { icon: BadgeCheck, value: 'Free',      label: 'During SSS 2026 demo',       iconBg: 'bg-green-500/10',  iconColor: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
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

// ── 3D Marquee items ──────────────────────────────────────────
const CTA_DESCS = [
  'Tell our AI what you want to learn and get a fully personalized 5-lesson plan built around your exact goal — in minutes.',
  'We collect scholarships, Olympiads, internships, and competitions open to Armenian students so you never miss a deadline.',
  'Every lesson you finish earns XP. Every day you study keeps your streak alive. Learning that actually feels like progress.',
  'Your score appears on the Himq leaderboard alongside every other learner in Armenia. How high can you climb?',
  'Miss a day and your streak resets. Stay consistent and watch your XP compound — small daily habits build big results.',
  'Your roadmap shows every lesson, your current position, and how much XP you\'ve earned — all in one clear view.',
  'Himq is completely free during SSS 2026. No credit card, no trial period. Just sign up and start your first lesson now.',
  'Name any subject — programming, math, history, design — and May will build a focused course tailored to your level.',
];

const MARQUEE_ITEMS: ThreeDMarqueeItem[] = Array.from({ length: 32 }, (_, i) =>
  i % 2 === 0
    ? { type: 'logo' as const }
    : { type: 'cta' as const, desc: CTA_DESCS[Math.floor(i / 2) % CTA_DESCS.length] }
);

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
          <div className="absolute top-8 right-0 w-[22rem] h-[22rem] rounded-full bg-green-400/8 blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 pt-14 pb-8 text-center">
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-brand-soft)] text-[var(--color-brand)] mb-5"
          >
            <Sparkles size={12} /> About us
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05, ease: EASE }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.07] mb-5"
          >
            We&apos;re three students<br />
            <span className="text-[var(--color-brand)]">who got tired of waiting.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
            className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto"
          >
            Tired of watching talented classmates miss scholarships they never heard about.
            Tired of generic courses that teach nothing real.
            Tired of studying alone with no feedback and no direction.
            So in June 2026, we built Himq.
          </motion.p>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
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
              <p className="text-xs text-[var(--text-muted)] leading-snug">{s.label}</p>
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
            <p className="text-base font-semibold">Yerevan, Armenia</p>
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
                  Founded June 2026
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--text-on-deep)]/70 w-fit">
                  <MapPin size={14} className="text-green-400" />
                  Yerevan, Armenia
                </div>
              </div>

              <motion.h2 {...fadeUp()} className="text-2xl sm:text-3xl font-extrabold text-[var(--text-on-deep)] mb-6 leading-snug">
                The story behind Himq
              </motion.h2>

              <div className="space-y-4 text-[var(--text-on-deep)]/75 leading-relaxed text-base">
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
                  <p className="text-sm font-medium">Republic Square</p>
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
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-3">What we built</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] mb-3">
            What Himq actually does
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Not a course catalog. Not another chatbot. Something different.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {WHAT_WE_DO.map((item, i) => (
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
              <h3 className="font-bold text-[var(--text-primary)] text-base mb-2">{item.title}</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed text-sm">{item.desc}</p>
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
            <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-5">Our mission</p>
            <blockquote className="text-3xl sm:text-4xl font-extrabold leading-snug mb-5">
              &ldquo;Every Armenian student deserves a clear path forward — regardless of who they know or where they heard about it.&rdquo;
            </blockquote>
            <p className="text-white/75 text-base leading-relaxed max-w-2xl mx-auto">
              We believe the next generation of Armenian scientists, engineers, artists, and entrepreneurs is already here. They just need the right tools to take the first step. Himq is that first step.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-8 items-start">

          <motion.div {...fadeUp()} className="md:sticky md:top-28">
            <h2 className="text-5xl sm:text-6xl font-extrabold text-[var(--text-primary)] leading-tight">
              Frequently<br />asked<br />questions
            </h2>
          </motion.div>

          <div className="border-t border-[var(--border)]">
            {FAQS.map((item, i) => (
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
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-2">Get in touch</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mb-2">Have a question?</h2>
            <p className="text-[var(--text-secondary)] text-base max-w-sm leading-relaxed">
              We&apos;re three students — we actually read our emails. Drop us a line anytime.
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
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)] mb-3">SSS 2026 · Yerevan, Armenia</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] mb-3">
            Ready to take the next step?
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Armenian students are already building their learning paths on Himq. Start yours free in under 2 minutes.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 mt-6 px-7 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-base hover:bg-[var(--color-brand-hover)] transition-colors shadow-lg"
          >
            Create free account <ArrowRight size={16} />
          </Link>
        </motion.div>

        <ThreeDMarquee items={MARQUEE_ITEMS} />
      </section>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
