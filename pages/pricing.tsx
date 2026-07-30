import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import Layout from '@/components/Layout';
import { CardSpotlight } from '@/components/ui/card-spotlight';
import { cn } from '@/lib/utils';

interface Tier {
  id: string;
  name: string;
  price: string;
  period?: string;
  credits: string;
  tagline: string;
  features: string[];
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'free', name: 'Free', price: '$0', credits: '400 credits / mo', tagline: 'Everything you need to start learning.',
    features: ['Aris, your everyday AI tutor', 'Learning paths', 'Opportunities feed', 'XP, streaks & leaderboard'],
  },
  {
    id: 'student', name: 'Student', price: '$2.50', period: '/mo', credits: '4,000 credits / mo', tagline: 'For learners who show up every day.', popular: true,
    features: ['May-1, our best-quality tutor', 'Aris for everyday questions', 'Core Practice Labs', 'Learning paths built by May-1', 'Opportunities feed', 'XP, streaks & leaderboard'],
  },
  {
    id: 'pro', name: 'Pro', price: '$10', period: '/mo', credits: '15,000 credits / mo', tagline: 'For power learners and multiple goals.',
    features: ['May-1, our best-quality tutor', 'Aris for everyday questions', 'Every Practice Lab', 'Longer conversation memory', 'Learning paths built by May-1', 'Opportunities feed', 'XP, streaks & leaderboard'],
  },
  {
    id: 'max', name: 'Max', price: '$25', period: '/mo', credits: '30,000 credits / mo', tagline: 'For the most intensive study loads.',
    features: ['May-1, our best-quality tutor', 'Aris for everyday questions', 'Every Practice Lab', 'Longest conversation memory', 'Learning paths built by May-1', 'Opportunities feed', 'XP, streaks & leaderboard'],
  },
];

export default function Pricing() {
  return (
    <Layout>
      <Head><title>Pricing · HIMQ</title></Head>
      <div className="max-w-6xl mx-auto px-4 pt-6 md:pt-10 pb-20">
        <div className="text-center max-w-2xl mx-auto mb-4">
          <div className="inline-flex items-center gap-2 text-[var(--color-brand)] mb-3">
            <Sparkles size={15} />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">Pricing</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] text-balance">
            Start free. Upgrade when you&apos;re flying.
          </h1>
          <p className="text-[var(--text-secondary)] mt-3">
            Free gets you the tutor, learning paths, and the opportunities feed. Paid plans add Practice Labs and give May far more room to think.
          </p>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mb-10">
          Paid plans launch soon — for now everyone starts on Free, no card needed.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <CardSpotlight
              key={tier.id}
              className={cn(
                'flex flex-col rounded-2xl border p-6',
                tier.popular
                  ? 'border-[var(--color-brand)] bg-[var(--bg-card)] shadow-[0_20px_50px_-24px_var(--color-brand)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)]'
              )}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--color-brand)] text-white text-[11px] font-bold uppercase tracking-wider">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{tier.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-[var(--text-primary)]">{tier.price}</span>
                {tier.period && <span className="text-sm text-[var(--text-muted)]">{tier.period}</span>}
              </div>
              <p className="text-[13px] font-semibold text-[var(--color-brand)] mt-1">{tier.credits}</p>
              <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-relaxed">{tier.tagline}</p>

              <ul className="mt-5 space-y-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]">
                    <Check size={16} className="flex-shrink-0 mt-0.5 text-[var(--color-green)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/auth"
                className={cn(
                  'mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors',
                  tier.popular
                    ? 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]'
                    : 'border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--color-brand)]'
                )}
              >
                {tier.id === 'free' ? 'Get started' : 'Choose ' + tier.name}
              </Link>
            </CardSpotlight>
          ))}
        </div>

        {/* Credit explainer */}
        <div className="mt-12 max-w-3xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">How the limits work</h3>
          <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
            Every plan is a monthly pool of usage, shared between messages and learning paths. A standard message uses a
            single unit; a premium message on Claude uses about 20, because it costs us about 20× more to run. A generated
            learning path is bigger again. Your pool refreshes every month, so heavy premium use means fewer standard
            messages left over — the daily figures above are what you get if you spread usage evenly.
          </p>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-8">
          Questions about plans? See the <Link href="/faq" className="text-[var(--color-brand)] hover:underline">FAQ</Link> or email himqaiteam@gmail.com.
        </p>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'en', ['common'])) },
});
