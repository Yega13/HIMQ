import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Head from 'next/head';
import { Sparkles, ArrowRight, BookOpen, Map, ChevronDown, Trash2 } from 'lucide-react';
 

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

export default function ChatIndex() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading } = useUser();

  const [goal, setGoal]         = useState('');
  const [building, setBuilding] = useState(false);
  const [error, setError]       = useState('');
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [showNewPath, setShowNewPath] = useState(false);
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
      .limit(5)
      .then(({ data }) => {
        setActiveChats((data ?? []) as ActiveChat[]);
        setChatsLoaded(true);
        if (!data || data.length === 0) setShowNewPath(true);
      });
  }, [user]);

  const handleDelete = async (chatId: string) => {
    if (confirmDeleteId !== chatId) { setConfirmDeleteId(chatId); return; }
    setDeleting(true);
    try {
      const { data: { session } } = await getBrowserClient().auth.getSession();
      await fetch('/api/delete-chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ chatId }),
      });
      setActiveChats((prev) => {
        const next = prev.filter((c) => c.id !== chatId);
        if (next.length === 0) setShowNewPath(true);
        return next;
      });
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

      // In local mock mode there is no AI backend — build a plan client-side
      // so the learning path is created with proper lessons immediately.
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
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ goal: goal.trim() }),
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

  return (
    <Layout>
      <Head><title>Learn — EduPath</title></Head>
      <div className="max-w-lg mx-auto px-4 py-10" onClick={() => setConfirmDeleteId(null)}>

        {/* Active chats section */}
        {activeChats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-[var(--color-brand)]" />
              Continue Learning
            </h2>
            <div className="space-y-2">
              {activeChats.map((chat) => {
                const pct = Math.round((chat.current_lesson_index / chat.total_lessons) * 100);
                return (
                  <div
                    key={chat.id}
                    className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden"
                  >
                    <Link
                      href={`/chat/${chat.id}`}
                      className="flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--border)] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{chat.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 max-w-[100px] h-1.5 rounded-full bg-[var(--border)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            Lesson {chat.current_lesson_index + 1}/{chat.total_lessons}
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={15}
                        className="text-[var(--text-muted)] group-hover:text-[var(--color-brand)] flex-shrink-0 transition-colors"
                      />
                    </Link>
                    <div className="border-t border-[var(--border)] px-4 py-2 flex items-center gap-3">
                      <Link
                        href={`/roadmap/${chat.id}`}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors"
                      >
                        <Map size={11} />
                        View roadmap
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
                        {confirmDeleteId === chat.id ? 'Confirm?' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* New path CTA card */}
        {activeChats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
            <button
              onClick={() => setShowNewPath((v) => !v)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-[var(--color-brand)] hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} className="text-[var(--color-brand)]" />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-[var(--color-brand)] text-sm">Start a new learning path</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">AI builds a 5-lesson course on any topic in seconds</p>
              </div>
              <ChevronDown
                size={18}
                className={cn('text-[var(--color-brand)] transition-transform flex-shrink-0', showNewPath && 'rotate-180')}
              />
            </button>
          </motion.div>
        )}

        {/* New path form */}
        {showNewPath && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-3">
                <Sparkles size={24} className="text-[var(--color-brand)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                {t('chat.goal_label')}
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                AI builds a 5-lesson plan and starts teaching you immediately.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t('chat.goal_placeholder') as string}
                required
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
              />

              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={building || !goal.trim()}
                className="w-full py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {building ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('chat.building_plan')}
                  </>
                ) : (
                  <>
                    {t('chat.build_plan')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
