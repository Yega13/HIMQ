import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import Layout from '@/components/Layout';

const UPDATED = 'July 8, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2.5">{title}</h2>
      <div className="space-y-3 text-[14.5px] text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <Layout>
      <Head><title>Privacy &amp; Security · HIMQ</title></Head>
      <div className="max-w-3xl mx-auto px-4 pt-6 md:pt-10 pb-20">
        <div className="inline-flex items-center gap-2 text-[var(--color-brand)] mb-3">
          <ShieldCheck size={16} />
          <span className="text-xs font-bold uppercase tracking-[0.14em]">Privacy &amp; Security</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">Your data, protected.</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">Last updated {UPDATED}</p>

        <p className="mt-6 text-[14.5px] text-[var(--text-secondary)] leading-relaxed">
          HIMQ (&quot;we&quot;) is built by a small team of students in Armenia. We take your privacy seriously and collect
          only what we need to run the app. This page explains what we store, how we protect it, and the control you have.
        </p>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Account:</strong> your email and name when you sign up.</li>
            <li><strong>Learning data:</strong> the goals you set, your conversations with May, your plans, lesson progress, XP, and streaks.</li>
            <li><strong>Usage:</strong> basic technical data (like language preference and activity dates) needed to make the app work.</li>
          </ul>
        </Section>

        <Section title="How we use it">
          <p>We use your data only to run and improve HIMQ — to build your learning paths, remember your progress, power the leaderboard and streaks, and keep the service secure. We do not use it for advertising.</p>
        </Section>

        <Section title="AI processing">
          <p>
            To generate responses, your messages are sent to our AI providers — Anthropic (Claude) and Google (Gemini) — which
            process them to produce answers. We send only what is needed for the request. These providers handle data under
            their own terms and do not use HIMQ traffic to train their models by default. Please avoid sharing sensitive
            personal information in your chats.
          </p>
        </Section>

        <Section title="Where your data lives &amp; how it's secured">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Data is stored in <strong>Supabase</strong> (a managed PostgreSQL platform).</li>
            <li><strong>Row-level security</strong> ensures each user can only ever read or write their own data.</li>
            <li>All traffic is encrypted over <strong>HTTPS</strong>, and passwords are hashed by Supabase Auth — we never see them.</li>
            <li>Privileged server keys are used only on the server and are never exposed to the browser.</li>
          </ul>
        </Section>

        <Section title="We never sell your data">
          <p>We do not sell, rent, or trade your personal information. We share data only with the infrastructure providers above that are strictly necessary to operate HIMQ.</p>
        </Section>

        <Section title="Your rights">
          <p>
            You can view and edit your profile at any time, and you can permanently delete your account and its data from
            <strong> Profile → Danger zone → Delete account</strong>. If you would like a copy of your data or have any
            privacy request, email us and we&apos;ll help.
          </p>
        </Section>

        <Section title="Cookies">
          <p>We use only the cookies required to keep you signed in. We do not use third-party advertising or tracking cookies.</p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about privacy? Email <a href="mailto:himqaiteam@gmail.com" className="text-[var(--color-brand)] hover:underline">himqaiteam@gmail.com</a>.
            See also our <Link href="/terms" className="text-[var(--color-brand)] hover:underline">Terms of Service</Link>.
          </p>
        </Section>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'en', ['common'])) },
});
