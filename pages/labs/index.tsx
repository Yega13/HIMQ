import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Layout from '@/components/Layout';
import { LABS } from '@/lib/labs';
import { cn } from '@/lib/utils';

export default function LabsIndex() {
  const live = LABS.filter((l) => l.status === 'live');
  const hero = live[0];
  const rest = LABS.filter((l) => l.id !== hero?.id);

  return (
    <Layout>
      <Head><title>Practice Labs · HIMQ</title></Head>

      <style>{`
        @keyframes lb-trace { to { transform: translateX(24px); } }
        @keyframes lb-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        .lb-grid {
          background-image:
            linear-gradient(color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px);
          background-size: 26px 26px;
          -webkit-mask-image: radial-gradient(120% 90% at 50% 0%, #000 45%, transparent 100%);
          mask-image: radial-gradient(120% 90% at 50% 0%, #000 45%, transparent 100%);
        }
        .lb-trace::after {
          content: ""; position: absolute; inset: 0;
          background: repeating-linear-gradient(90deg, transparent 0 8px, var(--color-brand) 8px 14px, transparent 14px 24px);
          animation: lb-trace 1s linear infinite; opacity: .8;
        }
        .lb-dot { animation: lb-pulse 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .lb-trace::after, .lb-dot { animation: none; } }
      `}</style>

      <div className="relative">
        {/* Blueprint grid backdrop */}
        <div aria-hidden className="lb-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" />

        <div className="relative max-w-5xl mx-auto px-4 pt-28 pb-20">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4">
            <span className="lb-dot w-2 h-2 rounded-full bg-[var(--color-green)] shadow-[0_0_10px_var(--color-green)]" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Practice Labs
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] max-w-2xl text-balance">
            Learn by breaking things.
          </h1>
          <p className="text-[var(--text-secondary)] mt-4 max-w-xl text-[15px] leading-relaxed">
            Hands-on sandboxes that behave like the real world — no hardware, no setup.
            Build it, break it, and see exactly why. When a lesson matches a lab, May brings you straight here.
          </p>

          {/* Featured live lab */}
          {hero && (
            <Link href={`/labs/${hero.id}`} className="block mt-10 group">
              <div className="relative overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-card)] p-6 sm:p-8 transition-all group-hover:border-[var(--color-brand)] group-hover:shadow-[0_20px_50px_-20px_var(--color-brand)]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  {/* Emoji tile */}
                  <div className="flex-none w-20 h-20 rounded-2xl grid place-items-center text-4xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-inner">
                    {hero.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="lb-dot w-1.5 h-1.5 rounded-full bg-[var(--color-green)]" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-green)]">Live now</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">· {hero.subject}</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{hero.title}</h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed max-w-xl">{hero.blurb}</p>
                    <span className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold transition-colors group-hover:bg-[var(--color-brand-hover)]">
                      Open lab <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
                {/* Animated circuit trace */}
                <div className="lb-trace relative h-1 mt-7 rounded-full overflow-hidden bg-[color-mix(in_srgb,var(--color-brand)_18%,transparent)]" />
              </div>
            </Link>
          )}

          {/* Coming soon — blueprint cards */}
          <div className="flex items-center gap-3 mt-14 mb-5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">On the workbench</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {rest.map((lab, i) => {
              const isLive = lab.status === 'live';
              const inner = (
                <div className={cn(
                  'h-full rounded-2xl border p-5 transition-all',
                  isLive
                    ? 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--color-brand)] cursor-pointer'
                    : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-secondary)]/50'
                )}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">LAB_{String(i + 2).padStart(2, '0')}</span>
                    <span className={cn(
                      'font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
                      isLive ? 'bg-[var(--color-green)]/15 text-[var(--color-green)]' : 'bg-[var(--border)] text-[var(--text-muted)]'
                    )}>
                      {isLive ? 'Live' : 'Building'}
                    </span>
                  </div>
                  <div className={cn('text-3xl mt-4', !isLive && 'opacity-45 grayscale')}>{lab.emoji}</div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-3">{lab.subject}</p>
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)] mt-1">{lab.title}</h3>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">{lab.blurb}</p>
                </div>
              );
              return isLive
                ? <Link key={lab.id} href={`/labs/${lab.id}`} className="block h-full">{inner}</Link>
                : <div key={lab.id} className="h-full">{inner}</div>;
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'en', ['common'])) },
});
