import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { motion } from 'framer-motion';
import { Compass, ArrowRight, ExternalLink } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase';
import { matchOpportunities, type MatchableEvent } from '@/lib/opportunities';
import { cn } from '@/lib/utils';

interface EventRow extends MatchableEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  organizer: string | null;
  link: string | null;
  upvote_count: number | null;
}

// The lessons ↔ opportunities loop: given what the student is learning (topic),
// surface real Armenian opportunities that match. Fetches approved events and
// matches client-side (see lib/opportunities).
export default function RelatedOpportunities({ topic, className }: { topic: string; className?: string }) {
  const { t } = useTranslation('common');
  const [matches, setMatches] = useState<EventRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getBrowserClient()
      .from('events')
      .select('id, title, description, event_type, organizer, link, upvote_count')
      .eq('is_approved', true)
      .limit(200)
      .then(({ data }: { data: EventRow[] | null }) => {
        if (!alive) return;
        setMatches(matchOpportunities(topic, data ?? [], 3));
        setLoaded(true);
      });
    return () => { alive = false; };
  }, [topic]);

  if (!loaded) return null; // avoid flashing an empty header while loading

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('mt-8', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
          <Compass size={15} />
        </span>
        <h3 className="font-bold text-[var(--text-primary)]">{t('roadmap.opps_title')}</h3>
      </div>

      {matches.length > 0 ? (
        <>
          <p className="text-sm text-[var(--text-secondary)] mb-3">{t('roadmap.opps_subtitle')}</p>
          <div className="space-y-2.5">
            {matches.map((e) => {
              const card = (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-sm)] hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-md)] transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{e.title}</p>
                    {e.organizer && <p className="text-xs text-[var(--text-muted)] truncate">{e.organizer}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    {e.event_type}
                  </span>
                  {e.link
                    ? <ExternalLink size={15} className="shrink-0 text-[var(--text-muted)]" />
                    : <ArrowRight size={15} className="shrink-0 text-[var(--text-muted)]" />}
                </div>
              );
              return e.link ? (
                <a key={e.id} href={e.link} target="_blank" rel="noopener noreferrer" className="block">{card}</a>
              ) : (
                <Link key={e.id} href={`/opportunities/${e.id}`} className="block">{card}</Link>
              );
            })}
          </div>
          <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand)] mt-3 hover:underline">
            {t('roadmap.opps_all')} <ArrowRight size={14} />
          </Link>
        </>
      ) : (
        <Link
          href="/opportunities"
          className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 hover:border-[var(--color-brand)] transition-colors"
        >
          <span className="text-sm text-[var(--text-secondary)]">{t('roadmap.opps_none')}</span>
          <ArrowRight size={16} className="text-[var(--color-brand)] shrink-0" />
        </Link>
      )}
    </motion.div>
  );
}
