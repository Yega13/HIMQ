import { GetStaticPaths, GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { ChevronLeft, Lock } from 'lucide-react';
import Layout from '@/components/Layout';
import CircuitLab from '@/components/labs/CircuitLab';
import CircuitSandbox from '@/components/labs/CircuitSandbox';
import { LABS, getLab } from '@/lib/labs';
import { useLabsAccess } from '@/lib/useLabsAccess';

export default function LabPage({ id }: { id: string }) {
  const lab = getLab(id);
  const { allowed, signedIn, loading } = useLabsAccess();
  if (!lab) return null;

  return (
    <Layout>
      <Head><title>{lab.title} · HIMQ</title></Head>
      <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-24 pb-20">
        <Link href="/labs" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-5">
          <ChevronLeft size={14} /> All labs
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl">{lab.emoji}</div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{lab.subject}</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">{lab.title}</h1>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-10 text-center animate-pulse">
            <p className="text-sm text-[var(--text-muted)]">Checking access…</p>
          </div>
        ) : !allowed && !signedIn ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-10 text-center">
            <Lock size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-lg font-bold text-[var(--text-primary)]">Sign in to access Practice Labs</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-sm mx-auto">
              Create a free account to see what&apos;s available on your plan.
            </p>
            <Link
              href="/auth"
              className="inline-flex mt-5 px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        ) : !allowed ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-10 text-center">
            <Lock size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-lg font-bold text-[var(--text-primary)]">Practice Labs is a paid feature</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-sm mx-auto">
              Upgrade to Student or above to build in interactive labs like this one.
            </p>
            <Link
              href="/pricing"
              className="inline-flex mt-5 px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
            >
              See plans
            </Link>
          </div>
        ) : lab.status === 'live' && id === 'circuits' ? (
          <CircuitLab />
        ) : lab.status === 'live' && id === 'sandbox' ? (
          <CircuitSandbox />
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-10 text-center">
            <div className="text-4xl mb-3">🛠️</div>
            <p className="text-lg font-bold text-[var(--text-primary)]">This lab is coming soon</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5">We&apos;re building it now. Check back shortly.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async ({ locales }) => ({
  // Emit every lab for EVERY locale — otherwise Next only prerenders the default
  // locale (am) and /en/labs/circuits, /ru/labs/circuits 404 with fallback:false.
  paths: (locales ?? ['en']).flatMap((locale) =>
    LABS.map((l) => ({ params: { id: l.id }, locale }))
  ),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params, locale }) => {
  const id = params?.id as string;
  if (!getLab(id)) return { notFound: true };
  return { props: { id, ...(await serverSideTranslations(locale ?? 'en', ['common'])) } };
};
