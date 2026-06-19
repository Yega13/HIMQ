import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { CheckCircle, Lock, ArrowRight, ChevronLeft, Star } from 'lucide-react';
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
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [chat, setChat]       = useState<Chat | null>(null);
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
        <div className="max-w-xl mx-auto px-4 py-12">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={cn('flex mb-2', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
              <div className="flex flex-col items-center" style={{ width: 90 }}>
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[var(--border)] animate-pulse" />
                <div className="h-2.5 w-14 md:w-20 rounded bg-[var(--border)] animate-pulse mt-2" />
              </div>
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  const completedCount = lessons.filter((l) => l.status === 'completed').length;
  const discovering = chat ? chat.total_lessons === 0 : false;
  const pct = (chat && chat.total_lessons > 0) ? Math.round((completedCount / chat.total_lessons) * 100) : 0;
  const allDone = (chat && chat.total_lessons > 0) ? completedCount >= chat.total_lessons : false;

  return (
    <Layout>
      <Head><title>{chat?.title ?? 'Roadmap'} — EduPath</title></Head>
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Back */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors mb-6"
        >
          <ChevronLeft size={14} />
          Dashboard
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-xl font-bold text-[var(--text-primary)] leading-snug mb-1">{chat?.title}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {discovering ? 'Still setting up your plan…' : allDone ? 'Course complete!' : `${completedCount} of ${chat?.total_lessons} lessons done`}
          </p>

          {/* Progress bar */}
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
              <p className="text-xs text-[var(--text-muted)] mt-1.5">{pct}% complete · +{completedCount * 50} XP earned</p>
            </>
          )}
        </motion.div>

        {/* ── Island path ── */}
        <div className="pb-6">
          {lessons.map((lesson, i) => {
            const isLeft      = i % 2 === 0;
            const isCompleted = lesson.status === 'completed';
            const isActive    = lesson.status === 'active';
            const isLast      = i === lessons.length - 1;

            return (
              <div key={lesson.id}>
                {/* Island node */}
                <div className={cn('flex', isLeft ? 'justify-start' : 'justify-end')}>
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.09, type: 'spring', stiffness: 200 }}
                    className="flex flex-col items-center w-[90px] md:w-[120px]"
                  >
                    {/* Circle */}
                    {isCompleted || isActive ? (
                      <Link href={`/chat/${chatId}`} className="group block">
                        <div className={cn(
                          'w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110',
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : 'bg-[var(--color-brand)] text-white ring-[5px] ring-blue-200 dark:ring-blue-900/50'
                        )}>
                          {isCompleted
                            ? <CheckCircle size={28} className="md:w-8 md:h-8" />
                            : <span className="text-xl md:text-2xl font-bold">{i + 1}</span>
                          }
                        </div>
                      </Link>
                    ) : (
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center bg-[var(--bg-card)] border-2 border-dashed border-[var(--border)] opacity-60">
                        <Lock size={18} className="text-[var(--text-muted)]" />
                      </div>
                    )}

                    {/* Label */}
                    <p className={cn(
                      'text-[10px] md:text-[11px] font-semibold text-center mt-1.5 leading-tight w-[80px] md:w-[100px]',
                      isCompleted ? 'text-green-600 dark:text-green-400' :
                      isActive    ? 'text-[var(--color-brand)]' :
                                    'text-[var(--text-muted)]'
                    )}>
                      {lesson.title}
                    </p>

                    {/* Star badge for completed */}
                    {isCompleted && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {[0, 1, 2].map((s) => (
                          <Star key={s} size={9} className="text-yellow-400 fill-yellow-400" />
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Zig-zag connector to next island */}
                {!isLast && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.09 + 0.15 }}
                    className={cn(
                      'h-10 md:h-14 my-1',
                      isLeft
                        ? 'border-l-[3px] border-b-[3px] rounded-bl-[36px] md:rounded-bl-[48px]'
                        : 'border-r-[3px] border-b-[3px] rounded-br-[36px] md:rounded-br-[48px]',
                      isCompleted
                        ? 'border-green-400 dark:border-green-500'
                        : 'border-[var(--border)]'
                    )}
                    style={{ marginLeft: '12%', marginRight: '12%' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {allDone ? (
          <div className="text-center py-6">
            <div className="flex justify-center gap-1 mb-3">
              {[0, 1, 2].map((s) => (
                <Star key={s} size={28} className="text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="font-bold text-[var(--text-primary)] mb-1">All done!</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">You earned +{lessons.length * 50} XP.</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold"
            >
              Back to Dashboard <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <Link
            href={`/chat/${chatId}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            Continue Learning
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, params }) => ({
  props: {
    chatId: params?.chatId ?? '',
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
