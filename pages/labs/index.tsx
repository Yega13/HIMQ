import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { FlaskConical, ArrowRight } from 'lucide-react';
import Layout from '@/components/Layout';
import { LABS } from '@/lib/labs';
import { cn } from '@/lib/utils';

export default function LabsIndex() {
  return (
    <Layout>
      <Head><title>Practice Labs · HIMQ</title></Head>
      <div className="max-w-5xl mx-auto px-4 pt-28 pb-20">
        <div className="flex items-center gap-2 text-[var(--color-brand)] mb-3">
          <FlaskConical size={16} />
          <span className="text-xs font-bold uppercase tracking-[0.14em]">Practice Labs</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
          Learn by doing — no hardware needed
        </h1>
        <p className="text-[var(--text-secondary)] mt-3 max-w-2xl">
          Hands-on sandboxes that behave like the real thing. Build it, break it, and see exactly why.
          More labs are on the way — and when a lesson matches one, May will bring you straight here.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mt-10">
          {LABS.map((lab) => {
            const live = lab.status === 'live';
            const card = (
              <div
                className={cn(
                  'h-full rounded-2xl border p-5 transition-all',
                  live
                    ? 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--color-brand)] hover:shadow-lg cursor-pointer'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)] opacity-70'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-3xl">{lab.emoji}</div>
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full',
                    live ? 'bg-[var(--color-green)]/15 text-[var(--color-green)]' : 'bg-[var(--border)] text-[var(--text-muted)]'
                  )}>
                    {live ? 'Live' : 'Coming soon'}
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mt-4">{lab.subject}</p>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">{lab.title}</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{lab.blurb}</p>
                {live && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand)] mt-4">
                    Open lab <ArrowRight size={15} />
                  </span>
                )}
              </div>
            );
            return live
              ? <Link key={lab.id} href={`/labs/${lab.id}`} className="block h-full">{card}</Link>
              : <div key={lab.id} className="h-full">{card}</div>;
          })}
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'en', ['common'])) },
});
