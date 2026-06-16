import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Send, CheckCircle, Circle, Lock, ChevronLeft, BookOpen } from 'lucide-react';
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Chat {
  id: string;
  title: string;
  current_lesson_index: number;
  total_lessons: number;
  status: string;
  plan: {
    chat_title: string;
    lessons: { index: number; title: string; description: string }[];
  };
}

export default function ChatDetail({ id }: { id: string }) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [chat, setChat]         = useState<Chat | null>(null);
  const [lessons, setLessons]   = useState<Lesson[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Auth guard
  useEffect(() => {
    if (!userLoading && !user) router.replace('/auth');
  }, [user, userLoading, router]);

  // Load chat data
  useEffect(() => {
    if (!user || !id) return;

    async function load() {
      const supabase = getBrowserClient();

      const [{ data: chatData }, { data: lessonsData }, { data: messagesData }] = await Promise.all([
        supabase.from('chats').select('*').eq('id', id).eq('user_id', user!.id).single(),
        supabase.from('lessons').select('*').eq('chat_id', id).order('lesson_index'),
        supabase.from('messages').select('*').eq('chat_id', id).order('created_at'),
      ]);

      if (!chatData) { router.replace('/chat'); return; }

      setChat(chatData as Chat);
      setLessons((lessonsData ?? []) as Lesson[]);
      setMessages((messagesData ?? []) as Message[]);
      setPageLoading(false);
    }

    load();
  }, [user, id, router]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !user || !chat) return;

    const userMsg = input.trim();
    setInput('');
    setSending(true);

    const tempUserMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: userMsg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const supabase = getBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ chatId: id, message: userMsg }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const { reply } = await res.json();

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInput(userMsg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const completeLesson = async () => {
    if (!chat || !user) return;
    const supabase = getBrowserClient();
    const nextIndex = chat.current_lesson_index + 1;

    await Promise.all([
      supabase.from('lessons')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('chat_id', id)
        .eq('lesson_index', chat.current_lesson_index),
      nextIndex < chat.total_lessons
        ? supabase.from('lessons').update({ status: 'active' }).eq('chat_id', id).eq('lesson_index', nextIndex)
        : Promise.resolve(),
      supabase.from('chats')
        .update({ current_lesson_index: nextIndex, status: nextIndex >= chat.total_lessons ? 'completed' : 'active' })
        .eq('id', id),
    ]);

    setChat((prev) => prev ? { ...prev, current_lesson_index: nextIndex } : prev);
    setLessons((prev) => prev.map((l) => {
      if (l.lesson_index === chat.current_lesson_index) return { ...l, status: 'completed' };
      if (l.lesson_index === nextIndex) return { ...l, status: 'active' };
      return l;
    }));
  };

  if (userLoading || pageLoading) {
    return (
      <Layout fullscreen>
        <div className="flex items-center justify-center h-screen">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const currentLesson = lessons[chat?.current_lesson_index ?? 0];
  const allDone = chat ? chat.current_lesson_index >= chat.total_lessons : false;

  return (
    <Layout fullscreen>
      <div className="flex h-screen overflow-hidden">

        {/* ── Lesson Sidebar ─────────────────────────────── */}
        <aside
          className={cn(
            'flex-shrink-0 w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col transition-transform duration-300',
            'fixed inset-y-0 left-0 z-40 md:static md:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="p-4 border-b border-[var(--border)]">
            <Link
              href="/chat"
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-3"
            >
              <ChevronLeft size={14} />
              {t('chat.back_to_chats')}
            </Link>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">
              {chat?.title}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('chat.lesson_number', {
                n: Math.min((chat?.current_lesson_index ?? 0) + 1, chat?.total_lessons ?? 5),
                total: chat?.total_lessons ?? 5,
              })}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl transition-colors',
                  lesson.status === 'active'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : lesson.status === 'completed'
                    ? 'opacity-70'
                    : 'opacity-40'
                )}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {lesson.status === 'completed' ? (
                    <CheckCircle size={16} className="text-[var(--color-green)]" />
                  ) : lesson.status === 'active' ? (
                    <Circle size={16} className="text-[var(--color-brand)]" />
                  ) : (
                    <Lock size={16} className="text-[var(--text-muted)]" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{lesson.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{lesson.description}</p>
                </div>
              </div>
            ))}
          </div>

          {!allDone && currentLesson && (
            <div className="p-3 border-t border-[var(--border)]">
              <button
                onClick={completeLesson}
                className="w-full py-2.5 rounded-xl bg-[var(--color-green)] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={14} />
                {t('chat.complete_lesson')}
              </button>
            </div>
          )}
        </aside>

        {/* Sidebar overlay on mobile */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Main Chat Area ─────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 h-full">

          {/* Mobile top bar */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 text-sm text-[var(--color-brand)] font-medium"
            >
              <BookOpen size={16} />
              {t('chat.lesson_plan')}
            </button>
            <span className="text-[var(--text-muted)] text-xs ml-auto">
              {chat?.title}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {allDone && (
              <div className="max-w-sm mx-auto text-center py-8">
                <div className="text-4xl mb-3">🎓</div>
                <h3 className="font-bold text-[var(--text-primary)] mb-1">Course Complete!</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  You finished all {chat?.total_lessons} lessons. Great work!
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div className={cn('max-w-[75%] space-y-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <p className={cn(
                    'text-[11px] font-medium',
                    msg.role === 'user' ? 'text-right text-[var(--text-muted)]' : 'text-[var(--color-brand)]'
                  )}>
                    {msg.role === 'user' ? t('chat.you') : t('chat.ai')}
                  </p>
                  <div
                    className={cn(
                      'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-[var(--color-brand)] text-white rounded-tr-sm'
                        : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!allDone && (
            <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.placeholder') as string}
                  rows={1}
                  className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)] max-h-32 overflow-y-auto"
                  style={{ minHeight: '44px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--color-brand)] text-white flex items-center justify-center hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, params }) => ({
  props: {
    id: params?.id ?? '',
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
