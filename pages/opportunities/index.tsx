import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Calendar, Globe, ExternalLink, Search, Bookmark, BookmarkCheck, ArrowUp, ChevronDown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { supabase, getBrowserClient, IS_MOCK } from '@/lib/supabase';
import { buildLessonPlan } from '@/lib/mockClient';
import { useUser } from '@/lib/useUser';
import { cn } from '@/lib/utils';
import { getSavedEvents, toggleSavedEvent, type SavedEvent } from '@/lib/savedEvents';

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

const TYPE_META: Record<string, { labelKey: string; badge: string }> = {
  competition: { labelKey: 'home.events_cat_competition', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  scholarship: { labelKey: 'home.events_cat_scholarship', badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  grant: { labelKey: 'home.events_cat_grant', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  course: { labelKey: 'home.events_cat_course', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  fellowship: { labelKey: 'home.events_cat_fellowship', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' },
  conference: { labelKey: 'home.events_cat_conference', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  workshop: { labelKey: 'home.events_cat_workshop', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  panel: { labelKey: 'home.events_cat_panel', badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
  meetup: { labelKey: 'home.events_cat_meetup', badge: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300' },
};
const TYPE_ORDER = ['competition', 'scholarship', 'grant', 'course', 'fellowship', 'conference', 'workshop', 'panel', 'meetup'];

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function toSaved(e: Event): SavedEvent {
  return {
    id: e.id, title: e.title, event_type: e.event_type, organizer: e.organizer,
    deadline: e.deadline, link: e.link, is_online: e.is_online, location: e.location,
  };
}

function EventCardSkeleton() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="h-5 w-24 bg-[var(--border)] rounded-full" />
        <div className="h-4 w-16 bg-[var(--border)] rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-[var(--border)] rounded w-3/4" />
        <div className="h-3 bg-[var(--border)] rounded w-full" />
        <div className="h-3 bg-[var(--border)] rounded w-2/3" />
      </div>
      <div className="h-8 w-full bg-[var(--border)] rounded-xl mt-2" />
    </div>
  );
}

export default function Opportunities({ events }: Props) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useUser();

  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [closingSoon, setClosingSoon] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('deadline');
  const [pageLoading, setPageLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    setSavedIds(getSavedEvents().map((e) => e.id));
  }, []);

  useEffect(() => {
    const start = () => setPageLoading(true);
    const done = () => setPageLoading(false);
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
    };
  }, [router.events]);

  const typeLabel = (type: string) => t(TYPE_META[type]?.labelKey ?? '') || type;

  const handleSave = (e: Event) => {
    const nowSaved = toggleSavedEvent(toSaved(e));
    setSavedIds((prev) => (nowSaved ? [...prev, e.id] : prev.filter((id) => id !== e.id)));
  };

  const handlePrepare = async (e: Event) => {
    if (!user) {
      router.push('/auth?next=/opportunities');
      return;
    }
    setPreparingId(e.id);
    try {
      const client = getBrowserClient();
      const goal = `Prepare me for: ${e.title}. Help me understand what's required, how to apply, and what to prepare.`;

      if (IS_MOCK) {
        const chatId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
        const lessons = buildLessonPlan(chatId, `Prep: ${e.title}`);
        await client.from('chats').insert({
          id: chatId, user_id: user.id, title: `Prep: ${e.title}`, chat_type: 'learning',
          plan: { discovering: false }, total_lessons: lessons.length, current_lesson_index: 0,
          status: 'active', updated_at: new Date().toISOString(),
        });
        await client.from('lessons').insert(lessons);
        await client.from('messages').insert({
          chat_id: chatId, role: 'assistant',
          content: `Hi! I'm May. Let's get you ready for "${e.title}". I've outlined a plan — open the first step when you're ready.`,
          lesson_index: 0,
        });
        router.push(`/chat/${chatId}`);
        return;
      }

      const { data: { session } } = await client.auth.getSession();
      const res = await fetch('/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ goal, skill_level: 'beginner' }),
      });
      if (!res.ok) throw new Error('Failed to create chat');
      const { chatId } = await res.json();
      router.push(`/chat/${chatId}`);
    } catch {
      setPreparingId(null);
    }
  };

  const visible = useMemo(() => {
    let list = events.slice();
    if (activeType !== 'all') list = list.filter((e) => e.event_type === activeType);
    if (onlineOnly) list = list.filter((e) => e.is_online);
    if (closingSoon) list = list.filter((e) => {
      const d = daysLeft(e.deadline);
      return d !== null && d >= 0 && d <= 7;
    });
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q) || e.organizer.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sort === 'popular') return (b.upvote_count ?? 0) - (a.upvote_count ?? 0);
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return sort === 'newest' ? db - da : da - db;
    });
    return list;
  }, [events, activeType, onlineOnly, closingSoon, query, sort]);

  // only show category chips for types that actually appear
  const presentTypes = useMemo(() => TYPE_ORDER.filter((tp) => events.some((e) => e.event_type === tp)), [events]);

  return (
    <Layout>
      <Head><title>Opportunities — Himq</title></Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mb-2 tracking-tight">{t('opportunities.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('opportunities.subtitle')}</p>
        </motion.div>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('opportunities.search_placeholder') as string}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
            />
          </div>
          <div className="relative sm:w-52">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition cursor-pointer"
            >
              <option value="deadline">{t('opportunities.sort_deadline')}</option>
              <option value="popular">{t('opportunities.sort_popular')}</option>
              <option value="newest">{t('opportunities.sort_newest')}</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>

        {/* Type filters */}
        <div className="flex gap-2 flex-wrap mb-3">
          <FilterChip active={activeType === 'all'} onClick={() => setActiveType('all')}>
            {t('opportunities.filter_all')}
          </FilterChip>
          {presentTypes.map((type) => (
            <FilterChip key={type} active={activeType === type} onClick={() => setActiveType(type)}>
              {typeLabel(type)}
            </FilterChip>
          ))}
        </div>

        {/* Extra toggles */}
        <div className="flex gap-2 flex-wrap mb-6">
          <ToggleChip active={onlineOnly} onClick={() => setOnlineOnly((v) => !v)}>
            <Globe size={12} /> {t('opportunities.filter_online')}
          </ToggleChip>
          <ToggleChip active={closingSoon} onClick={() => setClosingSoon((v) => !v)}>
            <Calendar size={12} /> {t('opportunities.filter_closing')}
          </ToggleChip>
          <span className="ml-auto self-center text-xs text-[var(--text-muted)]">
            {t('opportunities.results', { count: visible.length })}
          </span>
        </div>

        {pageLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <EventCardSkeleton key={i} />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--text-muted)]">{t('opportunities.no_events')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((event, i) => {
              const days = daysLeft(event.deadline);
              const saved = savedIds.includes(event.id);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="group bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl flex flex-col hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-md)] transition-all"
                >
                  <Link href={`/opportunities/${event.id}`} className="flex-1 p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', TYPE_META[event.event_type]?.badge ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300')}>
                        {typeLabel(event.event_type)}
                      </span>
                      {days !== null && (
                        <span className={cn(
                          'text-[11px] font-medium flex items-center gap-1 shrink-0',
                          days <= 0 ? 'text-[var(--text-muted)]' : days <= 7 ? 'text-red-500' : days <= 30 ? 'text-orange-500' : 'text-[var(--text-muted)]'
                        )}>
                          <Calendar size={11} />
                          {days > 0 ? `${days} ${t('opportunities.days_left')}` : t('opportunities.ended')}
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-bold text-[var(--text-primary)] leading-snug mb-1 group-hover:text-[var(--color-brand)] transition-colors">{event.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{event.description}</p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                      <span className="truncate">{event.organizer}</span>
                      {event.is_online ? (
                        <span className="flex items-center gap-1 shrink-0"><Globe size={11} />{t('opportunities.online')}</span>
                      ) : event.location ? (
                        <span className="shrink-0">{event.location}</span>
                      ) : null}
                      <span className="ml-auto flex items-center gap-0.5 shrink-0" title="Popularity">
                        <ArrowUp size={11} />{event.upvote_count ?? 0}
                      </span>
                    </div>
                  </Link>

                  {/* actions */}
                  <div className="border-t border-[var(--border)] px-5 py-3 space-y-2">
                    <button
                      onClick={() => handlePrepare(event)}
                      disabled={preparingId === event.id}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-xs font-bold hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60"
                    >
                      {preparingId === event.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t('opportunities.prepare_building')}
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          {t('opportunities.prepare_with_ai')}
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(event)}
                        className={cn(
                          'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                          saved
                            ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]'
                        )}
                      >
                        {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                        {saved ? t('opportunities.saved') : t('opportunities.save')}
                      </button>
                      {event.link && (
                        <a
                          href={event.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
                        >
                          {t('opportunities.apply')}
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        active
          ? 'bg-[var(--color-brand)] text-white'
          : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]'
      )}
    >
      {children}
    </button>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
        active
          ? 'border-[var(--color-green)] text-[var(--color-green)] bg-green-50 dark:bg-green-900/20'
          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--color-green)]'
      )}
    >
      {children}
    </button>
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
