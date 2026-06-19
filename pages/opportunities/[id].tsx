import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  Calendar,
  Globe,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  MapPin,
  Tag,
  ArrowUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { supabase, getBrowserClient, IS_MOCK } from '@/lib/supabase';
import { buildLessonPlan } from '@/lib/mockClient';
import { useUser } from '@/lib/useUser';
import { cn } from '@/lib/utils';
import { isEventSaved, toggleSavedEvent } from '@/lib/savedEvents';

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

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

export default function OpportunityDetail({ event }: { event: Event | null }) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [preparing, setPreparing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (event) setSaved(isEventSaved(event.id));
  }, [event]);

  if (!event) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-[var(--text-muted)] mb-4">Opportunity not found.</p>
          <Link href="/opportunities" className="text-[var(--color-brand)] hover:underline text-sm">
            ← {t('opportunities.title')}
          </Link>
        </div>
      </Layout>
    );
  }

  const days = daysLeft(event.deadline);
  const typeLabel = t(TYPE_META[event.event_type]?.labelKey ?? '') || event.event_type;

  const toggleSave = () => {
    const now = toggleSavedEvent({
      id: event.id, title: event.title, event_type: event.event_type, organizer: event.organizer,
      deadline: event.deadline, link: event.link, is_online: event.is_online, location: event.location,
    });
    setSaved(now);
  };

  const handlePrepareMe = async () => {
    if (!user) {
      router.push(`/auth?next=/opportunities/${event.id}`);
      return;
    }
    setPreparing(true);
    try {
      const supabaseClient = getBrowserClient();
      const goal = `Prepare me for: ${event.title}. Help me understand what's required, how to apply, and what to prepare.`;

      if (IS_MOCK) {
        const chatId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
        const lessons = buildLessonPlan(chatId, `Prep: ${event.title}`);
        await supabaseClient.from('chats').insert({
          id: chatId, user_id: user.id, title: `Prep: ${event.title}`, chat_type: 'learning',
          plan: { discovering: false }, total_lessons: lessons.length, current_lesson_index: 0,
          status: 'active', updated_at: new Date().toISOString(),
        });
        await supabaseClient.from('lessons').insert(lessons);
        await supabaseClient.from('messages').insert({
          chat_id: chatId, role: 'assistant',
          content: `Hi! I'm May. Let's get you ready for "${event.title}". I've outlined a plan — open the first step when you're ready.`,
          lesson_index: 0,
        });
        router.push(`/chat/${chatId}`);
        return;
      }

      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ goal, skill_level: 'beginner' }),
      });
      if (!res.ok) throw new Error('Failed to create chat');
      const { chatId } = await res.json();
      router.push(`/chat/${chatId}`);
    } catch {
      setPreparing(false);
    }
  };

  return (
    <Layout>
      <Head><title>{`${event.title} — EduPath`}</title></Head>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors mb-6"
        >
          <ChevronLeft size={14} />
          {t('opportunities.title')}
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-sm)] mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', TYPE_META[event.event_type]?.badge ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300')}>
                {typeLabel}
              </span>
              {days !== null && (
                <span className={cn(
                  'text-xs font-medium flex items-center gap-1',
                  days <= 0 ? 'text-[var(--text-muted)]' : days <= 7 ? 'text-red-500' : days <= 30 ? 'text-orange-500' : 'text-[var(--text-muted)]'
                )}>
                  <Calendar size={12} />
                  {days > 0 ? `${days} ${t('opportunities.days_left')}` : t('opportunities.ended')}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <ArrowUp size={12} />{event.upvote_count ?? 0}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mb-1.5 leading-tight">{event.title}</h1>
            <p className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5">
              <Building2 size={14} className="text-[var(--text-muted)]" />
              {event.organizer}
            </p>
          </div>

          {/* About */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-4 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">{t('opportunities.about')}</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{event.description}</p>
          </div>

          {/* Details */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t('opportunities.details')}</h2>
            <div className="grid grid-cols-2 gap-5">
              <Detail icon={Tag} label={t('opportunities.title')} value={typeLabel} />
              {event.deadline && (
                <Detail
                  icon={Calendar}
                  label={t('opportunities.deadline')}
                  value={new Date(event.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                />
              )}
              <Detail
                icon={event.is_online ? Globe : MapPin}
                label={t('opportunities.location')}
                value={event.is_online ? t('opportunities.online') : event.location ?? '—'}
              />
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePrepareMe}
              disabled={preparing || userLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60"
            >
              {preparing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('opportunities.prepare_building')}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {t('opportunities.prepare_with_ai')}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
            <button
              onClick={toggleSave}
              className={cn(
                'flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl border font-semibold text-sm transition-colors',
                saved
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--color-brand)]'
              )}
            >
              {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {saved ? t('opportunities.saved') : t('opportunities.save')}
            </button>
            {event.link && (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:border-[var(--color-brand)] transition-colors"
              >
                {t('opportunities.apply')}
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {!user && !userLoading && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">{t('opportunities.sign_in_ai')}</p>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] shrink-0">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-muted)] mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[var(--text-primary)] break-words">{value}</p>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, params }) => {
  const id = params?.id as string;

  const { data: event } = await supabase
    .from('events')
    .select('id, title, description, event_type, organizer, location, is_online, deadline, link, upvote_count')
    .eq('id', id)
    .eq('is_approved', true)
    .single();

  return {
    props: {
      event: event ?? null,
      ...(await serverSideTranslations(locale ?? 'am', ['common'])),
    },
  };
};
