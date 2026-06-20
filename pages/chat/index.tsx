import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  Map as MapIcon,
  Code,
  Languages,
  Calculator,
  Briefcase,
  Palette,
  GraduationCap,
  Target,
  BrainCircuit,
} from 'lucide-react';

import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient, IS_MOCK } from '@/lib/supabase';
import { buildLessonPlan } from '@/lib/mockClient';
import { cn } from '@/lib/utils';

interface ActiveChat {
  id: string;
  title: string;
  current_lesson_index: number;
  total_lessons: number;
  updated_at: string;
}

const CATEGORIES = [
  { id: 'programming', key: 'home.subj_programming', icon: Code, color: 'text-[var(--color-brand)]', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'languages', key: 'home.subj_languages', icon: Languages, color: 'text-[var(--color-green)]', bg: 'bg-green-50 dark:bg-green-900/20' },
  { id: 'sciences', key: 'home.subj_sciences', icon: Calculator, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  { id: 'business', key: 'home.subj_business', icon: Briefcase, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { id: 'design', key: 'home.subj_design', icon: Palette, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  { id: 'exams', key: 'home.subj_exams', icon: GraduationCap, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  { id: 'other', key: 'home.subj_other', icon: Sparkles, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
];

const SUGGESTIONS: Record<string, string[]> = {
  programming: ['Python for beginners', 'Web development with React', 'Data structures & algorithms'],
  languages: ['Conversational English', 'IELTS preparation', 'Spanish from scratch'],
  sciences: ['Calculus fundamentals', 'High-school physics', 'Intro to chemistry'],
  business: ['Digital marketing basics', 'Startup fundamentals', 'Personal finance'],
  design: ['UI/UX design basics', 'Figma from zero', 'Creative writing'],
  exams: ['SAT math', 'IELTS speaking', 'University entrance prep'],
  other: [],
};

const POPULAR = ['Python for beginners', 'IELTS preparation', 'Digital marketing basics', 'UI/UX design basics', 'Public speaking', 'Excel mastery'];

const SKILLS = ['beginner', 'intermediate', 'advanced'];

const HOW = [
  { icon: Target, titleKey: 'home.ai_step1_title' },
  { icon: BrainCircuit, titleKey: 'home.ai_step2_title' },
  { icon: Sparkles, titleKey: 'home.ai_step3_title' },
];

function lessonTotal(c: ActiveChat): number {
  return c.total_lessons && c.total_lessons > 0 ? c.total_lessons : 5;
}

export default function ChatIndex() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading } = useUser();

  const [goal, setGoal] = useState('');
  const [skillLevel, setSkillLevel] = useState('beginner');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getBrowserClient()
      .from('chats')
      .select('id, title, current_lesson_index, total_lessons, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setActiveChats((data ?? []) as ActiveChat[]);
        setChatsLoaded(true);
      });
  }, [user]);

  const resetForm = () => {
    setGoal('');
    setActiveCategory(null);
    setError('');
  };

  const handleDelete = async (chatId: string) => {
    if (confirmDeleteId !== chatId) {
      setConfirmDeleteId(chatId);
      return;
    }
    setDeleting(true);
    try {
      if (IS_MOCK) {
        const supabase = getBrowserClient();
        await supabase.from('messages').delete().eq('chat_id', chatId);
        await supabase.from('lessons').delete().eq('chat_id', chatId);
        await supabase.from('chats').delete().eq('id', chatId);
      } else {
        const { data: { session } } = await getBrowserClient().auth.getSession();
        await fetch('/api/delete-chat', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({ chatId }),
        });
      }
      setActiveChats((prev) => prev.filter((c) => c.id !== chatId));
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || !user) return;
    setBuilding(true);
    setError('');

    try {
      const supabase = getBrowserClient();

      // Local mock mode: build the plan client-side (no AI backend).
      if (IS_MOCK) {
        const chatId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
        const lessons = buildLessonPlan(chatId, goal.trim());
        await supabase.from('chats').insert({
          id: chatId,
          user_id: user.id,
          title: goal.trim(),
          chat_type: 'learning',
          plan: { discovering: false },
          skill_level: skillLevel,
          total_lessons: lessons.length,
          current_lesson_index: 0,
          status: 'active',
          updated_at: new Date().toISOString(),
        });
        await supabase.from('lessons').insert(lessons);
        await supabase.from('messages').insert({
          chat_id: chatId,
          role: 'assistant',
          content: `Hi! I'm May, your personal teacher. I've put together a 5-lesson plan for "${goal.trim()}" — open the first lesson whenever you're ready.`,
          lesson_index: 0,
        });
        await router.push(`/chat/${chatId}`);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/create-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ goal: goal.trim(), skill_level: skillLevel }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to create chat');
      }

      const { chatId } = await res.json();
      await router.push(`/chat/${chatId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBuilding(false);
    }
  };

  if (loading || !chatsLoaded) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const suggestions = activeCategory ? SUGGESTIONS[activeCategory] ?? [] : POPULAR;
  const suggestionsLabel = activeCategory && suggestions.length > 0 ? t('learn.suggestions_label') : t('learn.popular_label');

  return (
    <Layout>
      <Head><title>Learn — Himq</title></Head>
      <div
        className="max-w-6xl mx-auto px-4 py-8"
        onClick={() => setConfirmDeleteId(null)}
      >
        <div className="grid lg:grid-cols-[340px_1fr] gap-6">
          {/* ── Sidebar: your paths ─────────────────────────── */}
          <aside className="order-2 lg:order-1">
            <div className="lg:sticky lg:top-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('learn.paths_title')}
                </h2>
                <span className="text-xs font-semibold text-[var(--text-muted)]">{activeChats.length}</span>
              </div>

              <button
                onClick={resetForm}
                className="w-full mb-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:brightness-110 transition shadow-[var(--shadow-sm)]"
              >
                <Plus size={16} />
                {t('learn.new_path')}
              </button>

              {activeChats.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{t('learn.no_paths')}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t('learn.no_paths_desc')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeChats.map((chat) => {
                    const total = lessonTotal(chat);
                    const pctVal = Math.min(100, Math.round((chat.current_lesson_index / total) * 100));
                    return (
                      <div
                        key={chat.id}
                        className="group rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden hover:border-[var(--color-brand)] transition-colors shadow-[var(--shadow-sm)]"
                      >
                        <Link href={`/chat/${chat.id}`} className="block px-3.5 py-3">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate mb-2">{chat.title}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                              <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${pctVal}%` }} />
                            </div>
                            <span className="text-[10px] font-semibold text-[var(--text-secondary)] shrink-0">
                              {t('learn.lesson_short', { current: chat.current_lesson_index + 1, total })}
                            </span>
                          </div>
                        </Link>
                        <div className="flex items-center gap-3 border-t border-[var(--border)] px-3.5 py-1.5">
                          <Link
                            href={`/roadmap/${chat.id}`}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors"
                          >
                            <MapIcon size={11} />
                            {t('learn.roadmap')}
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(chat.id); }}
                            disabled={deleting && confirmDeleteId === chat.id}
                            className={cn(
                              'ml-auto inline-flex items-center gap-1 text-[10px] font-medium transition-colors px-2 py-0.5 rounded-md',
                              confirmDeleteId === chat.id
                                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                                : 'text-[var(--text-muted)] hover:text-red-500'
                            )}
                          >
                            <Trash2 size={11} />
                            {confirmDeleteId === chat.id ? t('learn.confirm') : t('learn.delete')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* ── Main: create a path ─────────────────────────── */}
          <main className="order-1 lg:order-2">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mb-2 tracking-tight">
                {t('learn.title')}
              </h1>
              <p className="text-[var(--text-secondary)]">{t('learn.subtitle')}</p>
            </motion.div>

            {/* Category selection */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6"
            >
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                {t('learn.category_label')}
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const isActive = activeCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCategory(isActive ? null : c.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all',
                        isActive
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                          : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--color-brand)]'
                      )}
                    >
                      <span className={cn('flex items-center justify-center w-6 h-6 rounded-md', c.bg, c.color)}>
                        <c.icon size={14} />
                      </span>
                      {t(c.key)}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            <form onSubmit={handleSubmit}>
              {/* Goal input */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] focus-within:border-[var(--color-brand)] focus-within:shadow-[var(--shadow-md)] transition-all px-5 pt-5 pb-4 mb-4"
              >
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  {t('learn.goal_label')}
                </label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={t('chat.goal_placeholder') as string}
                  rows={3}
                  className="w-full bg-transparent text-[var(--text-primary)] text-base leading-relaxed resize-none focus:outline-none placeholder-[var(--text-muted)] pt-1"
                />

                {/* Skill level */}
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    {t('learn.skill_label')}
                  </label>
                  <div className="flex gap-2">
                    {SKILLS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSkillLevel(s)}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-xs font-semibold border transition-all',
                          skillLevel === s
                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]'
                        )}
                      >
                        {t(`common.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Suggestions / popular */}
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mb-5"
                >
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                    {suggestionsLabel}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setGoal(s)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--color-green)] hover:text-[var(--color-green)] transition-colors"
                      >
                        <Sparkles size={13} className="text-[var(--color-green)]" />
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}

              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                type="submit"
                disabled={building || !goal.trim()}
                className="w-full py-3.5 rounded-xl bg-[var(--color-green)] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[var(--shadow-md)]"
              >
                {building ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('learn.building')}
                  </>
                ) : (
                  <>
                    {t('learn.build')}
                    <ArrowRight size={16} />
                  </>
                )}
              </motion.button>
            </form>

            {/* How it works — dedicated section */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="mt-16"
            >
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-6 sm:p-8 shadow-[var(--shadow-sm)]">
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-6">{t('learn.how_title')}</h2>
                <div className="grid sm:grid-cols-3 gap-7 sm:gap-8">
                  {HOW.map((h, i) => (
                    <div key={h.titleKey} className="flex items-start gap-4">
                      <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-brand)] text-white shrink-0 shadow-[var(--shadow-sm)]">
                        <h.icon size={22} />
                      </span>
                      <div className="pt-0.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand)] mb-1">
                          {t('learn.step')} {i + 1}
                        </p>
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{t(h.titleKey)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </main>
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
