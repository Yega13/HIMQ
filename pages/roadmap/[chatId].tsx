import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { CheckCircle, Lock, ArrowRight, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Lesson {
  id: string;
  lesson_index: number;
  title: string;
  description: string;
  status: 'locked' | 'active' | 'completed';
}

interface Chat {
  id: string;
  title: string;
  current_lesson_index: number;
  total_lessons: number;
  status: string;
}

export default function RoadmapPage({ chatId }: { chatId: string }) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [chat, setChat] = useState<Chat | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/auth');
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!user || !chatId) return;
    const supabase = getBrowserClient();
    Promise.all([
      supabase.from('chats').select('*').eq('id', chatId).eq('user_id', user.id).single(),
      supabase.from('lessons').select('*').eq('chat_id', chatId).order('lesson_index'),
    ]).then(([{ data: chatData }, { data: lessonsData }]) => {
      if (!chatData) { router.replace('/dashboard'); return; }
      setChat(chatData as Chat);
      setLessons((lessonsData ?? []) as Lesson[]);
      setLoading(false);
    });
  }, [user, chatId, router]);

  if (userLoading || loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="h-4 w-24 rounded bg-[var(--border)] animate-pulse mb-6" />
          <div className="h-6 w-64 rounded bg-[var(--border)] animate-pulse mb-2.5" />
          <div className="h-2.5 w-full rounded-full bg-[var(--border)] animate-pulse mb-8" />
          {[0, 1, 2, 3].map((i) => (
            <TimelineSkeleton key={i} last={i === 3} />
          ))}
        </div>
      </Layout>
    );
  }

  const completedCount = lessons.filter((l) => l.status === 'completed').length;
  const discovering = chat ? chat.total_lessons === 0 : false;
  const pct = chat && chat.total_lessons > 0 ? Math.round((completedCount / chat.total_lessons) * 100) : 0;
  const allDone = chat && chat.total_lessons > 0 ? completedCount >= chat.total_lessons : false;

  return (
    <Layout>
      <Head><title>{`${chat?.title ?? 'Roadmap'} — HIMQ`}</title></Head>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors mb-6"
        >
          <ChevronLeft size={14} />
          {t('roadmap.dashboard')}
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] leading-snug mb-1.5">{chat?.title}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {discovering
              ? t('roadmap.discovering')
              : allDone
                ? t('roadmap.course_complete')
                : t('roadmap.lessons_done', { done: completedCount, total: chat?.total_lessons })}
          </p>

          {!discovering && (
            <>
              <div className="h-2.5 rounded-full bg-[var(--border)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[var(--color-brand)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                {t('roadmap.progress_meta', { pct, xp: completedCount * 50 })}
              </p>
            </>
          )}
        </motion.div>

        {/* ── Content ── */}
        {discovering ? (
          <DiscoveringState t={t} />
        ) : (
          <div>
            {lessons.map((lesson, i) => {
              const isCompleted = lesson.status === 'completed';
              const isActive = lesson.status === 'active';
              const isLocked = lesson.status === 'locked';
              const isLast = i === lessons.length - 1;
              const clickable = isCompleted || isActive;

              const card = (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
                      {t('roadmap.lesson', { n: i + 1 })}
                    </p>
                    <h3 className="font-semibold text-[var(--text-primary)] leading-snug">{lesson.title}</h3>
                  </div>
                  {isCompleted ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-green)]">
                      <CheckCircle size={14} /> {t('roadmap.completed')}
                    </span>
                  ) : isActive ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)]">
                      {t('roadmap.in_progress')} <ArrowRight size={13} />
                    </span>
                  ) : (
                    <Lock size={14} className="shrink-0 text-[var(--text-muted)]" />
                  )}
                </div>
              );

              return (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex gap-4"
                >
                  {/* node + connector */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shadow-[var(--shadow-sm)]',
                      isCompleted ? 'bg-[var(--color-green)] text-white'
                        : isActive ? 'bg-[var(--color-brand)] text-white ring-4 ring-[var(--color-brand-soft)]'
                          : 'bg-[var(--bg-card)] border-2 border-dashed border-[var(--border-strong)] text-[var(--text-muted)]'
                    )}>
                      {isCompleted ? <CheckCircle size={20} /> : isLocked ? <Lock size={15} /> : <span className="text-sm font-bold">{i + 1}</span>}
                    </div>
                    {!isLast && (
                      <div className={cn(
                        'w-0.5 flex-1 min-h-[28px] my-1.5 rounded',
                        isCompleted ? 'bg-[var(--color-green)]/50' : 'bg-[var(--border)]'
                      )} />
                    )}
                  </div>

                  {/* content card */}
                  <div className="flex-1 pb-5">
                    {clickable ? (
                      <Link
                        href={`/chat/${chatId}`}
                        className="block rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-md)] transition-all"
                      >
                        {card}
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-4 opacity-70">
                        {card}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        {!discovering && (
          allDone ? (
            <div className="text-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] py-8 px-6 shadow-[var(--shadow-sm)]">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 text-[var(--color-green)] mb-4">
                <CheckCircle size={30} />
              </span>
              <p className="font-bold text-lg text-[var(--text-primary)] mb-1">{t('roadmap.all_done_title')}</p>
              <p className="text-sm text-[var(--text-secondary)] mb-5">{t('roadmap.all_done_desc', { xp: lessons.length * 50 })}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
              >
                {t('roadmap.back_to_dashboard')} <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <Link
              href={`/chat/${chatId}`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors shadow-[var(--shadow-md)]"
            >
              {t('roadmap.continue')}
              <ArrowRight size={16} />
            </Link>
          )
        )}
      </div>
    </Layout>
  );
}

function DiscoveringState({ t }: { t: (k: string) => string }) {
  return (
    <div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center shadow-[var(--shadow-sm)] mb-6">
        <span className="inline-flex w-11 h-11 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin mb-4" />
        <p className="font-bold text-[var(--text-primary)] mb-1">{t('roadmap.discovering')}</p>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto">{t('roadmap.discovering_desc')}</p>
      </div>
      {[0, 1, 2].map((i) => <TimelineSkeleton key={i} last={i === 2} />)}
    </div>
  );
}

function TimelineSkeleton({ last }: { last: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-10 h-10 rounded-full bg-[var(--border)] animate-pulse" />
        {!last && <div className="w-0.5 flex-1 min-h-[28px] my-1.5 bg-[var(--border)]" />}
      </div>
      <div className="flex-1 pb-5">
        <div className="h-[68px] rounded-xl bg-[var(--border)] animate-pulse" />
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, params }) => ({
  props: {
    chatId: params?.chatId ?? '',
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
