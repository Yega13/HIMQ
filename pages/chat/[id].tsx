import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, Circle, Lock, ChevronLeft, BookOpen, Zap, Flame, ChevronDown } from 'lucide-react';
import { MODELS, DEFAULT_MODEL, type ModelId } from '@/lib/models';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient, IS_MOCK } from '@/lib/supabase';
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
  plan?: { teaching_started_at?: string; approved?: boolean; lang?: string; welcome?: string };
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
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  interface CelebrationData {
    lessonTitle: string;
    xpGained: number;
    newStreak: number;
    nextLesson: string | null;
    isFinal: boolean;
  }
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [sendError, setSendError] = useState('');
  const [completing, setCompleting] = useState(false);
  const completingRef = useRef(false);
  const [planFeedback, setPlanFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/auth');
  }, [user, userLoading, router]);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function parseQuestion(content: string) {
    // Tolerant parse: the AI sometimes puts Q:/A:/T: inline (no newlines) or
    // omits the T: line — especially in non-English. Accept any whitespace
    // between labels and treat T: as optional (default single). This keeps the
    // raw "Q:/A:" markers from ever leaking into the rendered message.
    const m = content.match(/^([\s\S]*?)Q:\s*([\s\S]+?)\s*A:\s*([\s\S]+?)(?:\s*T:\s*(single|multiple))?\s*$/i);
    if (m) return {
      preamble: m[1].trim(),
      text: m[2].trim(),
      choices: m[3].split('|').map((c) => c.trim()).filter(Boolean),
      type: (m[4]?.toLowerCase() === 'multiple' ? 'multiple' : 'single') as 'single' | 'multiple',
    };
    return { preamble: '', text: content.replace(/^Q:\s*/i, '').trim(), choices: undefined, type: 'text' as const };
  }

  const sendMessage = async (overrideMsg?: string) => {
    const userMsg = (overrideMsg ?? input).trim();
    if (!userMsg || sending || !user || !chat) return;

    if (!overrideMsg) setInput('');
    // Keep the chosen answer highlighted while May processes it; it's cleared
    // once the next question arrives (below).
    setSendError('');
    setSending(true);

    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      role: 'user',
      content: userMsg,
      created_at: new Date().toISOString(),
    }]);

    try {
      const supabase = getBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ chatId: id, message: userMsg, model: selectedModel }),
      });

      if (!res.ok) throw new Error('Failed to get response');
      const { reply, planReady } = await res.json();

      setMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      }]);
      // New question is now shown → clear the previous selection.
      setSelectedChoices([]);

      // Server signals (language-independent) that discovery is done → build plan
      if (lessons.length === 0 && planReady) {
        setGeneratingPlan(true);
        try {
          const planRes = await fetch('/api/generate-plan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify({ chatId: id }),
          });
          if (planRes.ok) {
            const { chat: updatedChat, lessons: newLessons } = await planRes.json();
            setChat(updatedChat);
            setLessons(newLessons);
            // Plan is now in REVIEW state — the review screen takes over until
            // the student approves it (startPlan) or asks for changes.
          }
        } finally {
          setGeneratingPlan(false);
        }
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(userMsg);
      setSendError(err instanceof Error ? err.message : 'Failed to send — please try again');
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

  // Student approves the reviewed plan → start learning (posts welcome message).
  const startPlan = async () => {
    if (starting || !id) return;
    setStarting(true);
    setReviewError('');
    try {
      const { data: { session } } = await getBrowserClient().auth.getSession();
      const res = await fetch('/api/start-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ chatId: id }),
      });
      if (!res.ok) { setReviewError(t('chat.review_error') as string); setStarting(false); return; }
      const { chat: updatedChat, welcome } = await res.json();
      setChat(updatedChat);
      if (welcome) setMessages((prev) => [...prev, welcome]);
    } finally {
      setStarting(false);
    }
  };

  // Student asked for changes during review → regenerate the plan with feedback.
  const regeneratePlan = async () => {
    const fb = planFeedback.trim();
    if (!fb || regenerating || !id) return;
    setRegenerating(true);
    setReviewError('');
    setGeneratingPlan(true); // reuse the full-screen "building plan" UI
    try {
      const { data: { session } } = await getBrowserClient().auth.getSession();
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ chatId: id, feedback: fb }),
      });
      if (res.ok) {
        const { chat: updatedChat, lessons: newLessons } = await res.json();
        setChat(updatedChat);
        setLessons(newLessons);
        setPlanFeedback('');
      } else {
        const data = await res.json().catch(() => ({}));
        setReviewError(data.error ?? (t('chat.review_error') as string));
      }
    } finally {
      setRegenerating(false);
      setGeneratingPlan(false);
    }
  };

  const completeLesson = async () => {
    // Synchronous ref guard: state updates are async, so two clicks in the same
    // tick could both pass a `completing` state check before the re-render
    // disables the button. The ref flips immediately.
    if (!chat || !user || completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);
    const currentIndex = chat.current_lesson_index;
    const nextIndex = currentIndex + 1;
    const isFinal = nextIndex >= chat.total_lessons;
    const completedLesson = lessons.find((l) => l.lesson_index === currentIndex);
    const nextLesson = lessons.find((l) => l.lesson_index === nextIndex) ?? null;

    let newStreak: number;
    let xpGained = 50;

    try {
      if (IS_MOCK) {
        // Mock mode has no server — grant XP client-side against the mock store.
        const supabase = getBrowserClient();
        const { data: profileData } = await supabase
          .from('profiles').select('xp, streak_days, last_active_date').eq('id', user.id).single();
        const today = new Date().toLocaleDateString('en-CA');
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
        const lastActive = profileData?.last_active_date as string | undefined;
        newStreak = profileData?.streak_days ?? 0;
        if (lastActive !== today) newStreak = lastActive === yesterday ? newStreak + 1 : 1;
        await Promise.all([
          supabase.from('lessons').update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('chat_id', id).eq('lesson_index', currentIndex),
          !isFinal
            ? supabase.from('lessons').update({ status: 'active' }).eq('chat_id', id).eq('lesson_index', nextIndex)
            : Promise.resolve(),
          supabase.from('chats')
            .update({ current_lesson_index: nextIndex, status: isFinal ? 'completed' : 'active' }).eq('id', id),
          supabase.from('profiles')
            .update({ xp: (profileData?.xp ?? 0) + 50, streak_days: newStreak, last_active_date: today }).eq('id', user.id),
        ]);
      } else {
        // Real mode: XP/streak are server-authoritative (browser can't write them).
        const { data: { session } } = await getBrowserClient().auth.getSession();
        const token = session?.access_token;
        if (!token) { setCompleting(false); return; }
        const res = await fetch('/api/complete-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ chatId: id }),
        });
        if (!res.ok) { setCompleting(false); return; }
        const data = await res.json();
        newStreak = data.newStreak ?? 0;
        xpGained = data.xpGained ?? 50;
        if (data.alreadyCompleted) {
          // Already granted earlier — just advance the UI without a celebration.
          setChat((prev) => prev ? { ...prev, current_lesson_index: nextIndex } : prev);
          setLessons((prev) => prev.map((l) => {
            if (l.lesson_index === currentIndex) return { ...l, status: 'completed' };
            if (l.lesson_index === nextIndex) return { ...l, status: 'active' };
            return l;
          }));
          setCompleting(false);
          return;
        }
      }

      setChat((prev) => prev ? { ...prev, current_lesson_index: nextIndex } : prev);
      setLessons((prev) => prev.map((l) => {
        if (l.lesson_index === currentIndex) return { ...l, status: 'completed' };
        if (l.lesson_index === nextIndex) return { ...l, status: 'active' };
        return l;
      }));

      setCelebration({
        lessonTitle: completedLesson?.title ?? 'Lesson',
        xpGained,
        newStreak: newStreak!,
        nextLesson: nextLesson?.title ?? null,
        isFinal,
      });
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
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

  const isDiscovering = lessons.length === 0;
  // A plan is "approved" once the student starts learning. Older chats (created
  // before the review flow) are grandfathered in via teaching_started_at.
  const planApproved = !!(chat?.plan?.approved || chat?.plan?.teaching_started_at);
  const isReviewing = !isDiscovering && !planApproved;
  const allDone = !isDiscovering && chat ? chat.current_lesson_index >= chat.total_lessons && chat.total_lessons > 0 : false;
  const teachingCutoff = chat?.plan?.teaching_started_at;
  const visibleMessages = teachingCutoff
    ? messages.filter((m) => m.created_at >= teachingCutoff)
    : messages;
  const rawQuestion = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const parsed = parseQuestion(rawQuestion);
  const answeredCount = messages.filter((m) => m.role === 'user').length;

  // ── Plan-generating full-screen state ──────────────────────────────────────
  if (generatingPlan) {
    return (
      <Layout fullscreen>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--bg-primary)]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center mx-auto mb-6">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('chat.building_title')}</h2>
            <p className="text-sm text-[var(--text-muted)]">{t('chat.building_sub')}</p>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── Discovery wizard ────────────────────────────────────────────────────────
  if (isDiscovering) {
    return (
      <Layout fullscreen>
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
          {/* Back link */}
          <div className="px-6 pt-5">
            <Link href="/chat" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ChevronLeft size={14} />
              {t('chat.back_to_chats')}
            </Link>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
            {/* May avatar + label */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center mx-auto mb-3 shadow-md">
                <span className="text-white text-xl font-extrabold">M</span>
              </div>
              <p className="text-xs font-semibold text-[var(--color-brand)] uppercase tracking-wider">May</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('chat.getting_to_know')} — {chat?.title}</p>
            </div>

            {/* Question card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={rawQuestion}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl px-8 py-7 mb-6 shadow-sm"
              >
                {parsed.preamble && (
                  <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{parsed.preamble}</p>
                )}
                <p className="text-[var(--text-primary)] text-base leading-relaxed font-semibold">
                  {parsed.text || '…'}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Answer area */}
            <div className="w-full max-w-lg">
              {parsed.choices ? (
                <>
                  {/* Single-select */}
                  {parsed.type === 'single' && (
                    <div className="grid grid-cols-1 gap-2 mb-4">
                      {parsed.choices.map((choice) => (
                        <button
                          key={choice}
                          onClick={() => setSelectedChoices([choice])}
                          disabled={sending}
                          className={cn(
                            'w-full px-5 py-3.5 rounded-2xl border text-sm font-medium text-left transition-all',
                            selectedChoices[0] === choice
                              ? 'border-[var(--color-brand)] bg-blue-50 dark:bg-blue-900/20 text-[var(--color-brand)]'
                              : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--color-brand)]'
                          )}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Multi-select */}
                  {parsed.type === 'multiple' && (
                    <div className="grid grid-cols-1 gap-2 mb-4">
                      {parsed.choices.map((choice) => {
                        const checked = selectedChoices.includes(choice);
                        return (
                          <button
                            key={choice}
                            onClick={() => setSelectedChoices((prev) =>
                              checked ? prev.filter((c) => c !== choice) : [...prev, choice]
                            )}
                            disabled={sending}
                            className={cn(
                              'w-full px-5 py-3.5 rounded-2xl border text-sm font-medium text-left flex items-center gap-3 transition-all',
                              checked
                                ? 'border-[var(--color-brand)] bg-blue-50 dark:bg-blue-900/20 text-[var(--color-brand)]'
                                : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--color-brand)]'
                            )}
                          >
                            <span className={cn(
                              'w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center',
                              checked ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-[var(--border)]'
                            )}>
                              {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                            </span>
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => sendMessage(selectedChoices.join(', '))}
                    disabled={selectedChoices.length === 0 || sending}
                    className="w-full py-3.5 rounded-2xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>{t('chat.continue')} <Send size={14} /></>}
                  </button>
                </>
              ) : (
                <>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Your answer…"
                    rows={3}
                    className="w-full px-5 py-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)] mb-3"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending}
                    className="w-full py-3.5 rounded-2xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>{t('chat.continue')} <Send size={14} /></>}
                  </button>
                </>
              )}
              {answeredCount > 0 && (
                <p className="text-center text-[11px] text-[var(--text-muted)] mt-3">
                  {t('chat.n_answered', { count: answeredCount })}
                </p>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Plan review screen ──────────────────────────────────────────────────────
  if (isReviewing) {
    return (
      <Layout fullscreen>
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
          <div className="px-6 pt-5">
            <Link href="/chat" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ChevronLeft size={14} />
              {t('chat.back_to_chats')}
            </Link>
          </div>

          <div className="flex-1 flex flex-col items-center px-4 py-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center mx-auto mb-3 shadow-md">
                <span className="text-white text-xl font-extrabold">M</span>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{chat?.title}</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1 max-w-md">
                {t('chat.review_intro', { count: lessons.length }) as string}
              </p>
            </div>

            <div className="w-full max-w-lg space-y-2 mb-6">
              {lessons.map((l, i) => (
                <div key={l.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{l.title}</p>
                      {l.description && <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{l.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="w-full max-w-lg">
              <button
                onClick={startPlan}
                disabled={starting}
                className="w-full py-3.5 rounded-2xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-4"
              >
                {starting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>{t('chat.start_learning')} <Send size={14} /></>}
              </button>

              {reviewError && (
                <p className="text-sm text-red-500 dark:text-red-400 text-center mb-4">{reviewError}</p>
              )}

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">{t('chat.review_changes_hint')}</p>
                <textarea
                  value={planFeedback}
                  onChange={(e) => setPlanFeedback(e.target.value)}
                  placeholder={t('chat.review_changes_placeholder') as string}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)] mb-3"
                />
                <button
                  onClick={regeneratePlan}
                  disabled={!planFeedback.trim() || regenerating}
                  className="w-full py-2.5 rounded-xl border border-[var(--border-strong)] text-[var(--text-primary)] text-sm font-medium hover:border-[var(--color-brand)] transition-colors disabled:opacity-50"
                >
                  {t('chat.review_update')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullscreen>
      {/* Celebration overlay */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setCelebration(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              {celebration.isFinal ? (
                <>
                  <div className="text-5xl mb-4">🏆</div>
                  <h2 className="text-2xl font-extrabold text-[var(--text-primary)] mb-1">Course Complete!</h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-6">You finished every lesson in this course. That&apos;s huge.</p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="text-xl font-extrabold text-[var(--text-primary)] mb-1">Lesson complete!</h2>
                  <p className="text-sm text-[var(--text-muted)] mb-6 line-clamp-2">{celebration.lessonTitle}</p>
                </>
              )}

              {/* XP + Streak badges */}
              <div className="flex justify-center gap-3 mb-6">
                <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-[var(--color-green)] px-4 py-2 rounded-xl font-bold text-sm">
                  <Zap size={15} />
                  +{celebration.xpGained} XP
                </div>
                {celebration.newStreak > 1 && (
                  <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-500 px-4 py-2 rounded-xl font-bold text-sm">
                    <Flame size={15} />
                    {celebration.newStreak} day streak
                  </div>
                )}
              </div>

              {!celebration.isFinal && celebration.nextLesson && (
                <p className="text-xs text-[var(--text-muted)] mb-5">
                  Next up: <span className="font-semibold text-[var(--text-primary)]">{celebration.nextLesson}</span>
                </p>
              )}

              <button
                onClick={() => {
                  setCelebration(null);
                  if (celebration.isFinal) router.push('/dashboard');
                }}
                className="w-full py-3 rounded-xl bg-[var(--color-brand)] text-white font-bold text-sm hover:opacity-90 transition-opacity"
              >
                {celebration.isFinal ? t('chat.back_to_dashboard') : t('chat.continue_learning')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>

        {/* Lesson Sidebar */}
        <aside className={cn(
          'flex-shrink-0 w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col',
          'fixed inset-y-0 left-0 z-40 md:static md:translate-x-0 transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="p-4 border-b border-[var(--border)]">
            <Link
              href="/chat"
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-3"
            >
              <ChevronLeft size={14} />
              {t('chat.back_to_chats')}
            </Link>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">{chat?.title}</h2>
            {lessons.length > 0 && (
              <>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t('chat.lesson_number', {
                    n: Math.min((chat?.current_lesson_index ?? 0) + 1, chat?.total_lessons ?? 5),
                    total: chat?.total_lessons ?? 5,
                  })}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                    style={{ width: `${Math.round(((chat?.current_lesson_index ?? 0) / (chat?.total_lessons ?? 5)) * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl transition-colors',
                  lesson.status === 'active'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : lesson.status === 'completed'
                    ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900'
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
                  <p className={cn(
                    'text-xs font-semibold',
                    lesson.status === 'completed' ? 'text-[var(--color-green)]' :
                    lesson.status === 'active' ? 'text-[var(--color-brand)]' :
                    'text-[var(--text-muted)]'
                  )}>
                    {lesson.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{lesson.description}</p>
                </div>
              </div>
            ))}
          </div>

          {!allDone && !isDiscovering && (
            <div className="p-3 border-t border-[var(--border)]">
              <button
                onClick={completeLesson}
                disabled={completing}
                className="w-full py-2.5 rounded-xl bg-[var(--color-green)] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <CheckCircle size={14} />
                {t('chat.complete_lesson')}
              </button>
            </div>
          )}
        </aside>

        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Chat */}
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
            <span className="text-[var(--text-muted)] text-xs ml-auto truncate max-w-[180px]">{chat?.title}</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {allDone && (
              <div className="max-w-sm mx-auto text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-[var(--color-green)]" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg mb-2">Course Complete!</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  You finished all {chat?.total_lessons} lessons. Great work!
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold"
                >
                  Back to Dashboard
                </Link>
              </div>
            )}

            {visibleMessages.map((msg) => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[76%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  {msg.role === 'assistant' && (
                    <p className="text-[11px] font-medium mb-1 text-[var(--color-brand)] flex items-center gap-1.5">
                      {t('chat.ai')}
                      <span className="text-[var(--text-muted)] font-normal">·</span>
                      <span className="text-[var(--text-muted)] font-normal">
                        {MODELS.find((m) => m.id === selectedModel)?.name}
                      </span>
                    </p>
                  )}
                  <div className={cn(
                    'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-[var(--color-brand)] text-white rounded-tr-sm'
                      : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm'
                  )}>
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
            <div className="px-4 pt-2 pb-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
              {/* Model selector */}
              <div className="max-w-3xl mx-auto mb-2 relative">
                {(() => {
                  const active = MODELS.find((m) => m.id === selectedModel)!;
                  return (
                    <>
                      <button
                        onClick={() => setModelMenuOpen((v) => !v)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
                          active.bg, active.color
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', active.dot)} />
                        {active.name}
                        <ChevronDown size={11} className={cn('transition-transform', modelMenuOpen && 'rotate-180')} />
                      </button>

                      <AnimatePresence>
                        {modelMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.96 }}
                            transition={{ duration: 0.12 }}
                            className="absolute bottom-full left-0 mb-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-10 min-w-[160px]"
                          >
                            {MODELS.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--border)] transition-colors',
                                  selectedModel === m.id && 'bg-[var(--border)]'
                                )}
                              >
                                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', m.dot)} />
                                <div>
                                  <p className={cn('text-xs font-bold', m.color)}>{m.name}</p>
                                  <p className="text-[10px] text-[var(--text-muted)]">{m.subtitle}</p>
                                </div>
                                {selectedModel === m.id && (
                                  <CheckCircle size={13} className={cn('ml-auto flex-shrink-0', m.color)} />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  );
                })()}
              </div>

              {sendError && (
                <p className="text-xs text-red-500 mb-2 max-w-3xl mx-auto">{sendError}</p>
              )}
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
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--color-brand)] text-white flex items-center justify-center hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-center text-[10px] text-[var(--text-muted)] mt-2 hidden md:block">
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
