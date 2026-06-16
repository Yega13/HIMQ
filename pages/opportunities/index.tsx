import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Globe, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  title: string;
  description: string;
  event_type: string;
  organizer: string;
  location: string | null;
  is_online: boolean;
  deadline: string | null;
  link: string | null;
  upvote_count: number;
}

interface Props {
  events: Event[];
}

const TYPE_COLORS: Record<string, string> = {
  competition:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  scholarship:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  internship:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  grant:        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  course:       'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  webinar:      'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  fellowship:   'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  summit:       'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const ALL_TYPES = ['all', 'competition', 'scholarship', 'internship', 'grant', 'course', 'fellowship'];

export default function Opportunities({ events }: Props) {
  const { t } = useTranslation('common');
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = activeFilter === 'all'
    ? events
    : events.filter((e) => e.event_type === activeFilter);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{t('opportunities.title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Real opportunities for students and young professionals in Armenia.
        </p>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                activeFilter === type
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]'
              )}
            >
              {type === 'all' ? t('opportunities.filter_all') : type}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t('opportunities.no_events')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((event, i) => {
              const days = daysLeft(event.deadline);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--color-brand)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize', TYPE_COLORS[event.event_type] ?? TYPE_COLORS.course)}>
                      {event.event_type}
                    </span>
                    {days !== null && (
                      <span className={cn(
                        'text-[11px] font-medium flex items-center gap-1',
                        days <= 7 ? 'text-red-500' : days <= 30 ? 'text-orange-500' : 'text-[var(--text-muted)]'
                      )}>
                        <Calendar size={11} />
                        {days > 0 ? `${days} ${t('opportunities.days_left')}` : 'Ended'}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] leading-snug mb-1">{event.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{event.description}</p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                    <span>{event.organizer}</span>
                    {event.is_online && (
                      <span className="flex items-center gap-1">
                        <Globe size={11} />
                        {t('opportunities.online')}
                      </span>
                    )}
                    {event.location && !event.is_online && (
                      <span>{event.location}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-1">
                    {event.link && (
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
                      >
                        {t('opportunities.apply')}
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <Link
                      href={`/opportunities/${event.id}`}
                      className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--color-brand)] transition-colors"
                    >
                      {t('opportunities.prepare_me')}
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  const { data: events } = await supabase
    .from('events')
    .select('id, title, description, event_type, organizer, location, is_online, deadline, link, upvote_count')
    .eq('is_approved', true)
    .order('deadline', { ascending: true });

  return {
    props: {
      events: events ?? [],
      ...(await serverSideTranslations(locale ?? 'am', ['common'])),
    },
  };
};
