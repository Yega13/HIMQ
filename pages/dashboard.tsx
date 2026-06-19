import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  Zap,
  Flame,
  BookOpenCheck,
  Layers,
  Award,
  Target,
  ArrowRight,
  Map as MapIcon,
  Plus,
  Play,
  Code,
  Languages,
  Calculator,
  Briefcase,
  Palette,
  GraduationCap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';

interface Profile {
  xp: number;
  streak_days: number;
  full_name: string | null;
  goal: string | null;
}

interface Chat {
  id: string;
  title: string;
  current_lesson_index: number;
  total_lessons: number;
  updated_at: string;
}

type IconType = typeof Zap;

// XP needed per reward (discount) milestone — placeholder, easy to tune later.
const REWARD_STEP = 1000;

const QUICK_SUBJECTS: { key: string; Icon: typeof Zap; iconBg: string; iconColor: string }[] = [
  { key: 'home.subj_programming', Icon: Code, iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-[var(--color-brand)]' },
  { key: 'home.subj_languages', Icon: Languages, iconBg: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-[var(--color-green)]' },
  { key: 'home.subj_sciences', Icon: Calculator, iconBg: 'bg-violet-50 dark:bg-violet-900/20', iconColor: 'text-violet-500' },
  { key: 'home.subj_business', Icon: Briefcase, iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-500' },
  { key: 'home.subj_design', Icon: Palette, iconBg: 'bg-rose-50 dark:bg-rose-900/20', iconColor: 'text-rose-500' },
  { key: 'home.subj_exams', Icon: GraduationCap, iconBg: 'bg-teal-50 dark:bg-teal-900/20', iconColor: 'text-teal-500' },
];

function pct(current: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

export default function Dashboard() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
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
        supabase.from('profiles').select('xp, streak_days, full_name, goal').eq('id', user!.id).single(),
        supabase
          .from('chats')
          .select('id, title, current_lesson_index, total_lessons, updated_at')
          .eq('user_id', user!.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(12),
      ]);

      setProfile((profileData as Profile) ?? { xp: 0, streak_days: 0, full_name: null, goal: null });
      setChats((chatsData ?? []) as Chat[]);
      setDataLoading(false);
    }

    load();
  }, [user]);

  if (userLoading || dataLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="h-8 w-56 rounded-xl bg-[var(--border)] animate-pulse mb-2" />
          <div className="h-4 w-80 rounded-lg bg-[var(--border)] animate-pulse mb-8" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                <div className="w-9 h-9 rounded-xl bg-[var(--border)] animate-pulse mb-4" />
                <div className="h-3 w-20 rounded bg-[var(--border)] animate-pulse mb-2" />
                <div className="h-7 w-16 rounded-lg bg-[var(--border)] animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-48 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
            <div className="h-48 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
          </div>
        </div>
      </Layout>
    );
  }

  const firstName =
    profile?.full_name?.split(' ')[0] ?? user?.user_metadata?.full_name?.split(' ')[0] ?? '';

  const xp = profile?.xp ?? 0;
  const streakDays = profile?.streak_days ?? 0;
  const lessonsCompleted = chats.reduce((sum, c) => sum + (c.current_lesson_index ?? 0), 0);

  // Reward progress toward next discount milestone
  const nextMilestone = Math.max(REWARD_STEP, Math.ceil((xp + 1) / REWARD_STEP) * REWARD_STEP);
  const xpToNext = nextMilestone - xp;
  const rewardPct = Math.min(100, Math.round(((xp % REWARD_STEP) / REWARD_STEP) * 100));

  const stats: { label: string; value: string | number; Icon: IconType; iconBg: string; iconColor: string }[] = [
    { label: t('dashboard.xp_total'), value: xp, Icon: Zap, iconBg: 'bg-[var(--color-brand-soft)]', iconColor: 'text-[var(--color-brand)]' },
    { label: t('dashboard.streak'), value: streakDays, Icon: Flame, iconBg: 'bg-orange-50 dark:bg-orange-900/20', iconColor: 'text-orange-500' },
    { label: t('dashboard.lessons_done'), value: lessonsCompleted, Icon: BookOpenCheck, iconBg: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-[var(--color-green)]' },
    { label: t('dashboard.sessions'), value: chats.length, Icon: Layers, iconBg: 'bg-violet-50 dark:bg-violet-900/20', iconColor: 'text-violet-500' },
  ];

  const featured = chats[0];
  const rest = chats.slice(1);

  return (
    <Layout>
      <Head><title>Dashboard — EduPath</title></Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8"
        >
          <div>
            {firstName && (
              <p className="text-sm font-medium text-[var(--color-brand)] mb-1">
                {t('dashboard.welcome_back', { name: firstName })}
              </p>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mb-1.5">
              {t('dashboard.title')}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] max-w-xl">{t('dashboard.subtitle')}</p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors shadow-[var(--shadow-md)] shrink-0"
          >
            <Plus size={18} />
            {t('dashboard.new_path')}
          </Link>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{s.label}</p>
                <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${s.iconBg}`}>
                  <s.Icon size={18} className={s.iconColor} />
                </span>
              </div>
              <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Continue learning */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('dashboard.continue_title')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{t('dashboard.continue_subtitle')}</p>
              </div>
            </div>

            {chats.length === 0 ? (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-6 py-12 text-center shadow-[var(--shadow-sm)]">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)] mb-4">
                  <BookOpenCheck size={26} />
                </span>
                <h3 className="font-bold text-[var(--text-primary)] mb-1.5">{t('dashboard.no_chats')}</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-6">{t('dashboard.no_chats_desc')}</p>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
                >
                  {t('dashboard.start_learning')}
                  <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Featured active session */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-2xl border border-[var(--color-brand)]/30 bg-[var(--bg-card)] p-6 shadow-[var(--shadow-md)]"
                >
                  <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[var(--color-brand)]/5" />
                  <div className="relative">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand)] mb-3">
                      <Play size={12} /> {t('dashboard.continue')}
                    </span>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 truncate">{featured.title}</h3>

                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {t('dashboard.lesson_of', {
                            current: featured.current_lesson_index + 1,
                            total: featured.total_lessons,
                          })}
                        </span>
                        <span className="text-xs font-bold text-[var(--color-brand)]">
                          {pct(featured.current_lesson_index, featured.total_lessons)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                          style={{ width: `${pct(featured.current_lesson_index, featured.total_lessons)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/chat/${featured.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors"
                      >
                        {t('dashboard.continue')}
                        <ArrowRight size={16} />
                      </Link>
                      <Link
                        href={`/roadmap/${featured.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-strong)] text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
                      >
                        <MapIcon size={15} />
                        {t('dashboard.roadmap')}
                      </Link>
                    </div>
                  </div>
                </motion.div>

                {/* Other sessions */}
                {rest.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {rest.map((chat, i) => (
                      <motion.div
                        key={chat.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + i * 0.05 }}
                        className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-md)] transition-all"
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <Link href={`/chat/${chat.id}`} className="font-semibold text-sm text-[var(--text-primary)] line-clamp-2 hover:text-[var(--color-brand)] transition-colors">
                            {chat.title}
                          </Link>
                          <Link
                            href={`/roadmap/${chat.id}`}
                            title={t('dashboard.roadmap') as string}
                            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] transition-colors"
                          >
                            <MapIcon size={15} />
                          </Link>
                        </div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {t('dashboard.lesson_of', {
                              current: chat.current_lesson_index + 1,
                              total: chat.total_lessons,
                            })}
                          </span>
                          <span className="text-[11px] font-bold text-[var(--color-brand)]">
                            {pct(chat.current_lesson_index, chat.total_lessons)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--color-brand)]"
                            style={{ width: `${pct(chat.current_lesson_index, chat.total_lessons)}%` }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick start a new path */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]"
            >
              <h3 className="font-bold text-[var(--text-primary)]">{t('dashboard.quick_start_title')}</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{t('dashboard.quick_start_subtitle')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {QUICK_SUBJECTS.map((s) => (
                  <Link
                    key={s.key}
                    href="/chat"
                    className="group flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-3 hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-sm)] transition-all"
                  >
                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${s.iconBg} shrink-0 group-hover:scale-105 transition-transform`}>
                      <s.Icon size={16} className={s.iconColor} />
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{t(s.key)}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Rewards */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-gold)]/15 text-[var(--color-gold)]">
                  <Award size={16} />
                </span>
                <h3 className="font-bold text-[var(--text-primary)]">{t('dashboard.rewards_title')}</h3>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mb-3">
                {xp} <span className="text-sm font-semibold text-[var(--text-muted)]">XP</span>
              </p>
              <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden mb-2">
                <div className="h-full rounded-full bg-[var(--color-gold)] transition-all" style={{ width: `${rewardPct}%` }} />
              </div>
              <p className="text-xs font-medium text-[var(--text-primary)] mb-1">
                {t('dashboard.rewards_to_next', { xp: xpToNext })}
              </p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('dashboard.rewards_caption')}</p>
            </motion.div>

            {/* Streak */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-500">
                  <Flame size={16} />
                </span>
                <h3 className="font-bold text-[var(--text-primary)]">{t('dashboard.streak_title')}</h3>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mb-1">{streakDays}</p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {streakDays > 0 ? t('dashboard.streak_nudge') : t('dashboard.streak_start')}
              </p>
            </motion.div>

            {/* Goal */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    <Target size={16} />
                  </span>
                  <h3 className="font-bold text-[var(--text-primary)]">{t('dashboard.goal_title')}</h3>
                </div>
                <Link href="/profile" className="text-xs font-medium text-[var(--color-brand)] hover:underline">
                  {t('dashboard.goal_edit')}
                </Link>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {profile?.goal || <span className="italic text-[var(--text-muted)]">{t('dashboard.goal_empty')}</span>}
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
