import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  Calendar, Globe, ExternalLink, ChevronLeft, Sparkles, ArrowRight, Bookmark, BookmarkCheck,
  Building2, MapPin, Tag, ArrowUp, Heart, Share2, Check, ShieldCheck, ClipboardList, Gift, Link2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { supabase, getBrowserClient, IS_MOCK } from '@/lib/supabase';
import { buildLessonPlan } from '@/lib/mockClient';
import { useUser } from '@/lib/useUser';
import { cn } from '@/lib/utils';
import { isEventSaved, toggleSavedEvent, getLikedIds, toggleLike } from '@/lib/savedEvents';

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
  // Optional — organizers fill these in only when relevant.
  eligibility: string | null;
  requirements: string | null;
  prize: string | null;
  website: string | null;
}

const TYPE_META: Record<string, { labelKey: string; badge: string; tint: string }> = {
  competition: { labelKey: 'home.events_cat_competition', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', tint: 'bg-amber-50/70 dark:bg-amber-900/10' },
  scholarship: { labelKey: 'home.events_cat_scholarship', badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', tint: 'bg-green-50/70 dark:bg-green-900/10' },
  grant: { labelKey: 'home.events_cat_grant', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', tint: 'bg-purple-50/70 dark:bg-purple-900/10' },
  course: { labelKey: 'home.events_cat_course', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', tint: 'bg-blue-50/70 dark:bg-blue-900/10' },
  fellowship: { labelKey: 'home.events_cat_fellowship', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300', tint: 'bg-rose-50/70 dark:bg-rose-900/10' },
  conference: { labelKey: 'home.events_cat_conference', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', tint: 'bg-indigo-50/70 dark:bg-indigo-900/10' },
  workshop: { labelKey: 'home.events_cat_workshop', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', tint: 'bg-teal-50/70 dark:bg-teal-900/10' },
  panel: { labelKey: 'home.events_cat_panel', badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300', tint: 'bg-cyan-50/70 dark:bg-cyan-900/10' },
  meetup: { labelKey: 'home.events_cat_meetup', badge: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300', tint: 'bg-fuchsia-50/70 dark:bg-fuchsia-900/10' },
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
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (event) {
      setSaved(isEventSaved(event.id));
      setLiked(getLikedIds().includes(event.id));
    }
  }, [event]);

  if (!event) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-[var(--text-muted)] mb-4">{t('opportunities.not_found')}</p>
          <Link href="/opportunities" className="text-[var(--color-brand)] hover:underline text-sm">
            ← {t('opportunities.title')}
          </Link>
        </div>
      </Layout>
    );
  }

  const days = daysLeft(event.deadline);
  const closingSoon = days !== null && days >= 0 && days <= 7;
  const typeLabel = t(TYPE_META[event.event_type]?.labelKey ?? '') || event.event_type;
  const meta = TYPE_META[event.event_type];
  const popularity = (event.upvote_count ?? 0) + (liked ? 1 : 0);

  const toggleSave = () => {
    setSaved(toggleSavedEvent({
      id: event.id, title: event.title, event_type: event.event_type, organizer: event.organizer,
      deadline: event.deadline, link: event.link, is_online: event.is_online, location: event.location,
    }));
  };

  const handleLike = () => setLiked(toggleLike(event.id));

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
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

  const facts: { icon: typeof Tag; label: string; value: string; href?: string }[] = [
    { icon: Tag, label: t('opportunities.title'), value: typeLabel },
    { icon: event.is_online ? Globe : MapPin, label: t('opportunities.location'), value: event.is_online ? t('opportunities.online') : event.location ?? '—' },
    { icon: Building2, label: t('opportunities.organizer'), value: event.organizer },
  ];
  if (event.website) facts.push({ icon: Link2, label: t('opportunities.website'), value: event.website.replace(/^https?:\/\//, ''), href: event.website });

  return (
    <Layout>
      <Head><title>{`${event.title} — Himq`}</title></Head>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors mb-6"
        >
          <ChevronLeft size={14} />
          {t('opportunities.title')}
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Header — tinted by event type */}
          <div className={cn('relative rounded-2xl border border-[var(--border)] p-6 mb-4 shadow-[var(--shadow-sm)]', meta?.tint ?? 'bg-[var(--bg-card)]')}>
            {/* Like + Share */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={handleLike}
                aria-label="Like"
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-full border-[1.5px] bg-[var(--bg-card)] transition-all',
                  liked ? 'border-red-200 text-red-500 dark:border-red-900/40' : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-200'
                )}
              >
                <Heart size={16} className={liked ? 'fill-current' : ''} />
              </button>
              <button
                onClick={handleShare}
                aria-label={t('opportunities.share') as string}
                className="flex items-center justify-center w-9 h-9 rounded-full border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-all"
              >
                {copied ? <Check size={16} className="text-[var(--color-green)]" /> : <Share2 size={15} />}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4 pr-24">
              <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', meta?.badge ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300')}>
                {typeLabel}
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <ArrowUp size={12} />{popularity}
              </span>
              {copied && <span className="text-xs font-medium text-[var(--color-green)]">{t('opportunities.link_copied')}</span>}
            </div>

            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mb-1.5 leading-tight">{event.title}</h1>
            <p className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5">
              <Building2 size={14} className="text-[var(--text-muted)]" />
              {event.organizer}
            </p>

            {/* Prominent deadline */}
            {event.deadline && (
              <div className={cn(
                'inline-flex items-center gap-2 mt-4 px-3.5 py-2 rounded-xl text-sm font-semibold',
                closingSoon ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                  : days !== null && days >= 0 && days <= 30 ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)]'
              )}>
                <Calendar size={15} />
                <span>{new Date(event.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                {days !== null && (
                  <span className="opacity-80">· {days > 0 ? `${days} ${t('opportunities.days_left')}` : t('opportunities.ended')}</span>
                )}
                {closingSoon && <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] uppercase tracking-wide">{t('opportunities.closing_soon_tag')}</span>}
              </div>
            )}
          </div>

          {/* About */}
          <Card title={t('opportunities.about') as string}>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{event.description}</p>
          </Card>

          {/* Optional organizer-provided sections */}
          {event.eligibility && (
            <Card title={t('opportunities.eligibility') as string} icon={<ShieldCheck size={15} className="text-[var(--color-green)]" />}>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{event.eligibility}</p>
            </Card>
          )}
          {event.prize && (
            <Card title={t('opportunities.prize') as string} icon={<Gift size={15} className="text-[var(--color-gold)]" />}>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{event.prize}</p>
            </Card>
          )}

          {/* How to prepare */}
          <div className="rounded-2xl border border-[var(--color-brand)]/25 bg-[var(--color-brand-soft)] p-6 mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] mb-3">
              <Sparkles size={15} className="text-[var(--color-brand)]" />
              {t('opportunities.how_to_prepare')}
            </h2>
            {event.requirements && (
              <div className="flex items-start gap-2 mb-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                <ClipboardList size={15} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                <span className="whitespace-pre-line"><span className="font-semibold text-[var(--text-primary)]">{t('opportunities.requirements')}: </span>{event.requirements}</span>
              </div>
            )}
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t('opportunities.prepare_callout')}</p>
          </div>

          {/* Key facts */}
          <Card title={t('opportunities.details') as string}>
            <div className="grid grid-cols-2 gap-5">
              {facts.map((f) => <Detail key={f.label} icon={f.icon} label={f.label} value={f.value} href={f.href} />)}
            </div>
          </Card>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePrepareMe}
              disabled={preparing || userLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60 shadow-[var(--shadow-sm)]"
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
                'flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl border-[1.5px] font-semibold text-sm transition-colors',
                saved
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
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
                className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl border-[1.5px] border-[var(--border-strong)] text-[var(--text-primary)] font-semibold text-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
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

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-4 shadow-[var(--shadow-sm)]">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] mb-3">{icon}{title}</h2>
      {children}
    </div>
  );
}

function Detail({ icon: Icon, label, value, href }: { icon: typeof Tag; label: string; value: string; href?: string }) {
  const valueEl = href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--color-brand)] break-words hover:underline">{value}</a>
  ) : (
    <p className="text-sm font-medium text-[var(--text-primary)] break-words">{value}</p>
  );
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] shrink-0">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-muted)] mb-0.5">{label}</p>
        {valueEl}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, params }) => {
  const id = params?.id as string;

  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('is_approved', true)
    .single();

  const e = data as Record<string, unknown> | null;
  const event: Event | null = e
    ? {
        id: e.id as string,
        title: (e.title as string) ?? '',
        description: (e.description as string) ?? '',
        event_type: (e.event_type as string) ?? '',
        organizer: (e.organizer as string) ?? '',
        location: (e.location as string) ?? null,
        is_online: (e.is_online as boolean) ?? false,
        deadline: (e.deadline as string) ?? null,
        link: (e.link as string) ?? null,
        upvote_count: (e.upvote_count as number) ?? 0,
        eligibility: (e.eligibility as string) ?? null,
        requirements: (e.requirements as string) ?? null,
        prize: (e.prize as string) ?? null,
        website: (e.website as string) ?? null,
      }
    : null;

  return {
    props: {
      event,
      ...(await serverSideTranslations(locale ?? 'am', ['common'])),
    },
  };
};
