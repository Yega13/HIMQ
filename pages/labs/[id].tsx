import { GetStaticPaths, GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import Layout from '@/components/Layout';
import CircuitLab from '@/components/labs/CircuitLab';
import CircuitSandbox from '@/components/labs/CircuitSandbox';
import { LABS, getLab } from '@/lib/labs';

export default function LabPage({ id }: { id: string }) {
  const lab = getLab(id);
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

        {lab.status === 'live' && id === 'circuits' ? (
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
