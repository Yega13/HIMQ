import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Zap, Flame, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'next-i18next';
import Layout from '@/components/Layout';
import { supabase, getBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Entry {
  id: string;
  full_name: string | null;
  xp: number;
  streak_days: number;
}

export default function Leaderboard({ profiles }: { profiles: Entry[] }) {
  const { t } = useTranslation('common');
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getBrowserClient().auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const authLoading = currentUserId === undefined;

  const top3 = profiles.slice(0, 3);

  return (
    <Layout>
      <Head><title>{t('leaderboard.title')} — Himq</title></Head>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy size={24} className="text-yellow-500" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('leaderboard.title')}</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-8">{t('leaderboard.subtitle')}</p>

        {/* Podium */}
        {top3.length >= 1 && (
          <div className="flex items-end justify-center gap-3 mb-8">
            {/* 2nd */}
            {top3[1] && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-1 bg-slate-50 dark:bg-slate-800/30 border border-[var(--border)] rounded-2xl p-4 text-center"
              >
                <div className="text-2xl mb-1">🥈</div>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {top3[1].full_name ?? t('leaderboard.anonymous')}
                </p>
                <p className="text-lg font-extrabold text-slate-500">{top3[1].xp} XP</p>
              </motion.div>
            )}
            {/* 1st */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-2xl p-5 text-center"
            >
              <div className="text-3xl mb-1">🥇</div>
              <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                {top3[0].full_name ?? t('leaderboard.anonymous')}
              </p>
              <p className="text-xl font-extrabold text-yellow-600">{top3[0].xp} XP</p>
            </motion.div>
            {/* 3rd */}
            {top3[2] && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 bg-amber-50 dark:bg-amber-900/20 border border-[var(--border)] rounded-2xl p-4 text-center"
              >
                <div className="text-2xl mb-1">🥉</div>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {top3[2].full_name ?? t('leaderboard.anonymous')}
                </p>
                <p className="text-lg font-extrabold text-amber-600">{top3[2].xp} XP</p>
              </motion.div>
            )}
          </div>
        )}

        {/* Full list */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          {authLoading ? (
            <ul className="divide-y divide-[var(--border)]">
              {Array.from({ length: Math.min(profiles.length || 5, 8) }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                  <div className="w-6 h-4 bg-[var(--border)] rounded flex-shrink-0" />
                  <div className="w-8 h-8 rounded-xl bg-[var(--border)] flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-[var(--border)] rounded w-32" />
                    <div className="h-2.5 bg-[var(--border)] rounded w-20" />
                  </div>
                  <div className="w-12 h-4 bg-[var(--border)] rounded flex-shrink-0" />
                </li>
              ))}
            </ul>
          ) : profiles.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Trophy size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">{t('leaderboard.empty')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {profiles.map((entry, i) => {
                const isMe = entry.id === currentUserId;
                return (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className={cn(
                      'flex items-center gap-4 px-5 py-3.5',
                      isMe && 'bg-blue-50 dark:bg-blue-900/10'
                    )}
                  >
                    <span className={cn(
                      'text-sm font-bold w-6 text-center flex-shrink-0',
                      i === 0 ? 'text-yellow-500' :
                      i === 1 ? 'text-slate-400' :
                      i === 2 ? 'text-amber-600' :
                      'text-[var(--text-muted)]'
                    )}>
                      {i + 1}
                    </span>

                    <div className="w-8 h-8 rounded-xl bg-[var(--color-brand)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(entry.full_name ?? 'A')[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {entry.full_name ?? t('leaderboard.anonymous')}
                        {isMe && (
                          <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-[var(--color-brand)] font-semibold px-1.5 py-0.5 rounded-full">
                            {t('leaderboard.you')}
                          </span>
                        )}
                      </p>
                      {entry.streak_days > 0 && (
                        <p className="text-[11px] text-orange-500 flex items-center gap-0.5 mt-0.5">
                          <Flame size={10} />
                          {entry.streak_days} {t('leaderboard.day_streak')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[var(--color-green)] font-bold text-sm flex-shrink-0">
                      <Zap size={14} />
                      {entry.xp}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, xp, streak_days')
    .order('xp', { ascending: false })
    .limit(50);

  return {
    props: {
      profiles: profiles ?? [],
      ...(await serverSideTranslations(locale ?? 'am', ['common'])),
    },
  };
};
