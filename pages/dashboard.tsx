import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Zap, Flame, MessageSquare, ArrowRight, BookOpen, Map } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';

interface Profile {
  xp: number;
  streak_days: number;
  full_name: string | null;
}

interface Chat {
  id: string;
  title: string;
  current_lesson_index: number;
  total_lessons: number;
  updated_at: string;
}

export default function Dashboard() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [profile, setProfile]   = useState<Profile | null>(null);
  const [chats, setChats]       = useState<Chat[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!userLoading && !user) router.replace('/auth');
  }, [user, userLoading, router]);

  // Load data
  useEffect(() => {
    if (!user) return;

    async function load() {
      const supabase = getBrowserClient();
      const [{ data: profileData }, { data: chatsData }] = await Promise.all([
        supabase.from('profiles').select('xp, streak_days, full_name').eq('id', user!.id).single(),
        supabase.from('chats')
          .select('id, title, current_lesson_index, total_lessons, updated_at')
          .eq('user_id', user!.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(10),
      ]);

      setProfile(profileData as Profile ?? { xp: 0, streak_days: 0, full_name: null });
      setChats((chatsData ?? []) as Chat[]);
      setDataLoading(false);
    }

    load();
  }, [user]);

  if (userLoading || dataLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-7 w-52 rounded-xl bg-[var(--border)] animate-pulse mb-2" />
          <div className="h-4 w-64 rounded-lg bg-[var(--border)] animate-pulse mb-8" />
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                <div className="w-9 h-9 rounded-xl bg-[var(--border)] animate-pulse mb-3" />
                <div className="h-3 w-16 rounded bg-[var(--border)] animate-pulse mb-2" />
                <div className="h-7 w-20 rounded-lg bg-[var(--border)] animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <div className="h-5 w-36 rounded bg-[var(--border)] animate-pulse" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-5 py-4 border-b border-[var(--border)] last:border-0">
                <div className="h-4 w-3/4 rounded bg-[var(--border)] animate-pulse mb-2" />
                <div className="h-2 w-1/3 rounded bg-[var(--border)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0]
    ?? user?.user_metadata?.full_name?.split(' ')[0]
    ?? '';

  const stats = [
    {
      label: t('dashboard.xp_total'),
      value: `${profile?.xp ?? 0} XP`,
      icon: Zap,
      color: 'text-[var(--color-green)]',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: t('dashboard.streak'),
      value: profile?.streak_days ?? 0,
      icon: Flame,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      label: t('dashboard.active_chats'),
      value: `${chats.length} / 10`,
      icon: MessageSquare,
      color: 'text-[var(--color-brand)]',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
  ];

  return (
    <Layout>
      <Head><title>Dashboard — Himq</title></Head>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
            {firstName ? `Welcome back, ${firstName} 👋` : t('dashboard.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            {chats.length > 0
              ? `You have ${chats.length} active learning session${chats.length !== 1 ? 's' : ''}.`
              : "Ready to learn something new?"}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5"
            >
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${s.bg} mb-3`}>
                <s.icon size={18} className={s.color} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">{s.label}</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Chat list */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--text-primary)]">{t('dashboard.active_chats')}</h2>
            <Link href="/chat" className="text-xs text-[var(--color-brand)] hover:underline font-medium">
              + {t('chat.new_chat')}
            </Link>
          </div>

          {chats.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <BookOpen size={36} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)] mb-4">{t('dashboard.no_chats')}</p>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
              >
                {t('dashboard.start_learning')}
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {chats.map((chat) => {
                const pct = Math.round((chat.current_lesson_index / chat.total_lessons) * 100);
                return (
                  <li key={chat.id} className="flex items-center">
                    <Link
                      href={`/chat/${chat.id}`}
                      className="flex items-center gap-4 flex-1 px-5 py-4 hover:bg-[var(--border)] transition-colors group min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{chat.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-[var(--border)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {t('dashboard.lesson_of', {
                              current: chat.current_lesson_index + 1,
                              total: chat.total_lessons,
                            })}
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-[var(--text-muted)] group-hover:text-[var(--color-brand)] transition-colors flex-shrink-0"
                      />
                    </Link>
                    <Link
                      href={`/roadmap/${chat.id}`}
                      title="View roadmap"
                      className="flex-shrink-0 flex items-center justify-center w-9 h-9 mr-3 rounded-xl text-[var(--text-muted)] hover:text-[var(--color-brand)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <Map size={15} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
