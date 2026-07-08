import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import { cn } from '@/lib/utils';

interface QA { q: string; a: string; }
interface Group { title: string; items: QA[]; }

const GROUPS: Group[] = [
  {
    title: 'General',
    items: [
      { q: 'What is HIMQ?', a: 'HIMQ is an AI learning companion built for students in Armenia. Tell it what you want to learn and it builds a personalized, step-by-step path taught by May — your AI tutor — and connects you to real local scholarships, competitions, and internships.' },
      { q: 'Who is HIMQ for?', a: 'Students and young professionals — especially in Armenia — who want a clear path to learn a skill and want to stop missing opportunities they never hear about.' },
      { q: 'What languages does HIMQ support?', a: 'English, Russian, and Armenian. May teaches and answers in the language you choose, and the whole interface is translated.' },
      { q: 'Is HIMQ free?', a: 'Yes — the Free plan needs no credit card, so you can start right away. If you want more AI usage, paid plans start at $2.50/month. See the Pricing page.' },
    ],
  },
  {
    title: 'Learning',
    items: [
      { q: 'How does HIMQ build my plan?', a: 'May asks you a few quick questions to understand your goal and level, then designs the shortest path that still teaches everything you need — as few lessons as possible, each one specific to you.' },
      { q: 'Can I change the plan?', a: 'Yes. Before you start, you review the plan and can ask May to change it. During learning, you can always ask questions, go slower, or start a new path.' },
      { q: 'What are Practice Labs?', a: 'Hands-on interactive sandboxes where you practice for real — like building live circuits in the Electrical Engineering lab. They behave like the real thing, with correct physics, so you learn by doing, not just reading.' },
      { q: 'How do XP and streaks work?', a: 'You earn XP for completing lessons — more XP for harder ones — and keep a daily streak going. It is there to keep you motivated and to show your progress over time.' },
      { q: 'Can May be wrong?', a: 'May is an AI and can occasionally make mistakes. Always double-check anything important. We route harder and non-English lessons to stronger models to keep quality high.' },
    ],
  },
  {
    title: 'Opportunities',
    items: [
      { q: 'What are opportunities?', a: 'A curated feed of real scholarships, competitions, grants, internships, and events relevant to students in Armenia — with deadlines, so you never miss one.' },
      { q: 'Can I submit an opportunity?', a: 'Yes. Use the "Submit opportunity" button on the Opportunities page. Submissions are reviewed before they go live.' },
    ],
  },
  {
    title: 'Pricing & payments',
    items: [
      { q: "What's a credit?", a: 'A credit is one small unit of AI usage. A quick question costs about 1–6 credits; a deeper answer or a full plan costs more. Your balance refreshes every month, and most learners never reach their limit.' },
      { q: 'How do I pay?', a: 'Payments are handled securely through Polar.sh. Paid plans are launching soon — until then, everyone is on the Free plan.' },
      { q: 'Can I cancel anytime?', a: 'Yes. Paid plans are month-to-month with no lock-in — cancel whenever you like and you keep access until the end of the period.' },
    ],
  },
  {
    title: 'Privacy & account',
    items: [
      { q: 'Is my data safe?', a: 'Your data is stored securely and protected by row-level security so only you can access your own learning history. See our Privacy & Security page for details.' },
      { q: 'Do you sell my data?', a: 'No. We never sell your personal data. We only use it to run and improve HIMQ.' },
      { q: 'How do I delete my account?', a: 'Go to your Profile → Danger zone → Delete account. This permanently removes your account and associated data.' },
    ],
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<string | null>('General-0');

  return (
    <Layout>
      <Head><title>FAQ · HIMQ</title></Head>
      <div className="max-w-3xl mx-auto px-4 pt-6 md:pt-10 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-[var(--color-brand)] mb-3">
            <HelpCircle size={15} />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">FAQ</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Frequently asked questions
          </h1>
        </div>

        <div className="space-y-8">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">{group.title}</h2>
              <div className="space-y-2">
                {group.items.map((item, i) => {
                  const id = `${group.title}-${i}`;
                  const isOpen = open === id;
                  return (
                    <div key={id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                      <button
                        onClick={() => setOpen(isOpen ? null : id)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                        aria-expanded={isOpen}
                      >
                        <span className="text-[14.5px] font-semibold text-[var(--text-primary)]">{item.q}</span>
                        <ChevronDown size={18} className={cn('flex-shrink-0 text-[var(--text-muted)] transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      {isOpen && (
                        <p className="px-4 pb-4 -mt-1 text-[13.5px] text-[var(--text-secondary)] leading-relaxed">{item.a}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[var(--text-secondary)] mt-12">
          Still stuck? Email <a href="mailto:himqaiteam@gmail.com" className="text-[var(--color-brand)] hover:underline">himqaiteam@gmail.com</a> or read our{' '}
          <Link href="/privacy" className="text-[var(--color-brand)] hover:underline">Privacy &amp; Security</Link> page.
        </p>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'en', ['common'])) },
});
