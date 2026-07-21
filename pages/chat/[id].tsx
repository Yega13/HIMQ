import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, Circle, Lock, ChevronLeft, BookOpen, Zap, Flame, ChevronDown, Sparkles } from 'lucide-react';
import { MODELS, DEFAULT_MODEL, type ModelId } from '@/lib/models';
import Layout from '@/components/Layout';
import RelatedOpportunities from '@/components/RelatedOpportunities';
import { PlanBuildingScreen } from '@/components/PlanBuildingScreen';
import { MicButton } from '@/components/MicButton';
import { MediaEmbed } from '@/components/MediaEmbed';
import { useUser } from '@/lib/useUser';
import { getBrowserClient, IS_MOCK } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { matchLab } from '@/lib/labs';

interface Lesson {
  id: string;
  lesson_index: number;
  title: string;
  description: string;
  difficulty?: number;
  status: 'locked' | 'active' | 'completed';
}

// XP per lesson difficulty (1..5). MUST match the mapping in complete_lesson()
// (db/migrations/2026-07-07_lesson_difficulty_xp.sql). The server is always
// authoritative for the real grant; this is for display + mock mode only.
const XP_BY_DIFFICULTY = [20, 35, 50, 70, 100];
function xpForDifficulty(d?: number): number {
  const n = d && d >= 1 && d <= 5 ? Math.round(d) : 3;
  return XP_BY_DIFFICULTY[n - 1];
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
  plan?: {
    teaching_started_at?: string; approved?: boolean; lang?: string; welcome?: string;
    lessons?: { index: number; title?: string; why?: string; difficulty?: number }[];
  };
}

// Pure parser (module scope so it's stable across renders / usable in useMemo).
// Tolerant: the AI sometimes puts Q:/A:/T: inline (no newlines) or omits the
// T: line — especially in non-English. Accept any whitespace between labels and
// treat T: as optional (default single). Keeps raw "Q:/A:" markers from ever
// leaking into the rendered message.
// Strip stray markdown emphasis (** / *) — the discovery Q&A view is natural
// language (no code), so removing asterisks is safe and keeps them from showing
// up literally in questions/choices.
const stripMd = (s: string) => s.replace(/\*+/g, '').trim();

// Render an assistant message, turning any resolved [[media]]{json}[[/media]]
// blocks (a video / image / link May surfaced) into real embeds. Plain text is
// rendered as-is (the bubble is whitespace-pre-wrap).
function renderMessageContent(content: string) {
  const parts = content.split(/(\[\[media\]\][\s\S]*?\[\[\/media\]\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[\[media\]\]([\s\S]*)\[\[\/media\]\]$/);
    if (m) {
      try {
        const d = JSON.parse(m[1]) as { type: string; url: string; title?: string };
        return <MediaEmbed key={i} type={d.type} url={d.url} title={d.title} />;
      } catch { return null; }
    }
    // Defensive: strip any stray resource tag that slipped through unresolved.
    const text = part.replace(/\[\[res:[a-z0-9-]+\]\]/gi, '');
    return text ? <span key={i}>{text}</span> : null;
  });
}

function parseQuestion(content: string) {
  const m = content.match(/^([\s\S]*?)Q:\s*([\s\S]+?)\s*A:\s*([\s\S]+?)(?:\s*T:\s*(single|multiple|open))?\s*$/i);
  if (m) {
    const tRaw = m[4]?.toLowerCase();
    return {
      preamble: stripMd(m[1]),
      text: stripMd(m[2]),
      choices: m[3].split('|').map((c) => stripMd(c)).filter(Boolean),
      type: (tRaw === 'multiple' ? 'multiple' : tRaw === 'open' ? 'open' : 'single') as 'single' | 'multiple' | 'open',
    };
  }
  return { preamble: '', text: stripMd(content.replace(/^Q:\s*/i, '')), choices: undefined, type: 'text' as const };
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
  // Credit-meter snapshot (null until loaded). enabled:false in the demo → the
  // whole credits UI stays hidden and the picker behaves exactly as before.
  const [credits, setCredits] = useState<{
    enabled: boolean; tier: string; used: number; budget: number; remaining: number; geminiOnly: boolean;
  } | null>(null);

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
  // Id of the assistant message currently being streamed in (null when idle).
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const completingRef = useRef(false);
  // May sets this when it judges the current lesson mastered → nudge the
  // "Mark Complete" button. Reset on completion (new lesson starts fresh).
  const [readyToComplete, setReadyToComplete] = useState(false);
  const [planFeedback, setPlanFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Only auto-scroll to the newest message when the user is already near the
  // bottom — so scrolling up to re-read isn't yanked back down mid-stream.
  const stickRef  = useRef(true);

  // Refresh the credit-meter snapshot. Best-effort — failures leave the UI
  // unchanged. If the tier is Gemini-only, force the model picker to Gemini.
  // Called on mount and after every message so the "credits left" pill stays live.
  const refreshCredits = useCallback(async () => {
    try {
      const { data: { session } } = await getBrowserClient().auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/credits', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setCredits(data);
      if (data?.enabled && data?.geminiOnly) setSelectedModel('gemini');
    } catch { /* credits UI is best-effort */ }
  }, []);

  useEffect(() => { refreshCredits(); }, [refreshCredits]);

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
    // Instant jump to bottom (not smooth) — during streaming, overlapping smooth
    // animations are what caused the scroll to glitch/fight the user.
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

    // Once the assistant reply starts streaming in, a later failure must NOT
    // roll back the user's message (the server already processed it).
    let streamStarted = false;

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

      // Errors (auth / rate limit / ownership) come back as normal JSON before
      // the stream starts.
      if (!res.ok || !res.body) {
        let msg = 'Failed to get response';
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }

      // Consume the SSE stream, appending text deltas to a single assistant
      // message that grows live.
      let aiId: string | null = null;
      const ensureMsg = () => {
        if (aiId) return;
        aiId = `ai-${Date.now()}`;
        streamStarted = true;
        setMessages((prev) => [...prev, {
          id: aiId!, role: 'assistant', content: '', created_at: new Date().toISOString(),
        }]);
        setStreamingId(aiId);
      };

      let planReady = false;
      let lessonMastered = false;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: { delta?: string; done?: boolean; reply?: string; planReady?: boolean; lessonMastered?: boolean };
          try { evt = JSON.parse(payload); } catch { continue; }

          if (typeof evt.delta === 'string' && evt.delta) {
            ensureMsg();
            const d = evt.delta;   // capture: `evt` is reused by the next loop iteration
            const mid = aiId;
            setMessages((prev) => prev.map((m) => m.id === mid ? { ...m, content: m.content + d } : m));
          }
          if (evt.done) {
            planReady = !!evt.planReady;
            lessonMastered = !!evt.lessonMastered;
            // Reconcile with the canonical persisted reply (fixes any stray
            // whitespace/token artifacts from the live stream).
            if (typeof evt.reply === 'string') {
              ensureMsg();
              const finalReply = evt.reply;
              setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: finalReply } : m));
            }
          }
        }
      }
      setStreamingId(null);

      // New question is now shown → clear the previous selection and any typed answer.
      setSelectedChoices([]);
      setInput('');
      // May judged the current teaching lesson mastered → nudge Mark Complete.
      if (lessonMastered) setReadyToComplete(true);

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
      // Only roll back if the reply never started streaming. If it did, the
      // server already processed the turn — keep both messages; a reload
      // reconciles with what was persisted.
      if (!streamStarted) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        // Only a plain free-text send owns `input`; restore it so the student can
        // retry. For a choice/combined send, `selectedChoices` (and any typed text
        // in `input`) are left intact for retry — restoring the *combined* string
        // here would double-count the choice on the next Continue click.
        if (!overrideMsg) setInput(userMsg);
      }
      setSendError(err instanceof Error ? err.message : 'Failed to send — please try again');
    } finally {
      setStreamingId(null);
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
    // Default/mock XP scales with the completed lesson's difficulty; real mode
    // overwrites this with the server-authoritative value from the RPC.
    let xpGained = xpForDifficulty(completedLesson?.difficulty);
    let introMsg: Message | null = null;

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
            .update({ xp: (profileData?.xp ?? 0) + xpGained, streak_days: newStreak, last_active_date: today }).eq('id', user.id),
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
        introMsg = data.intro ?? null;
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
      // New lesson starts clean; drop the mastery nudge and show May's welcome.
      setReadyToComplete(false);
      if (introMsg) setMessages((prev) => [...prev, introMsg as Message]);

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

  // Derived message views — memoized (and kept above every early return, per
  // rules-of-hooks) so a keystroke in the input doesn't re-filter/re-parse the
  // whole message list each render.
  const teachingCutoff = chat?.plan?.teaching_started_at;
  const visibleMessages = useMemo(
    () => (teachingCutoff ? messages.filter((m) => m.created_at >= teachingCutoff) : messages),
    [messages, teachingCutoff],
  );
  const rawQuestion = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '',
    [messages],
  );
  const parsed = useMemo(() => parseQuestion(rawQuestion), [rawQuestion]);
  const answeredCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);

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
  // If the topic/current lesson matches a live Practice Lab, offer it in-lesson.
  const currentLesson = lessons.find((l) => l.lesson_index === chat?.current_lesson_index);
  const practiceLabId = (!isDiscovering && planApproved)
    ? matchLab(`${chat?.title ?? ''} ${currentLesson?.title ?? ''}`)
    : null;
  // ── Plan-generating full-screen state ──────────────────────────────────────
  if (generatingPlan) {
    // Rotating fun-facts screen (shared with the exam flow) so the ~30-50s plan
    // build isn't a dead spinner. Discovery keeps its own heading.
    return <PlanBuildingScreen titleKey="chat.building_title" />;
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
                  {/* Single-select — also the picker for 'open' (suggestions) */}
                  {(parsed.type === 'single' || parsed.type === 'open') && (
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
                  {/* Free-text box ONLY for 'open' questions, where the choices are
                      just suggestions and the student may have their own answer.
                      Exhaustive single/multiple questions don't get an input. */}
                  {parsed.type === 'open' && (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 h-px bg-[var(--border)]" />
                        <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{t('chat.or_type_own')}</span>
                        <div className="flex-1 h-px bg-[var(--border)]" />
                      </div>
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const combined = [...selectedChoices, input.trim()].filter(Boolean).join(', ');
                            if (combined) sendMessage(combined);
                          }
                        }}
                        placeholder={t('chat.type_your_answer') ?? ''}
                        disabled={sending}
                        className="w-full px-5 py-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)] mb-4"
                      />
                    </>
                  )}
                  <button
                    onClick={() => sendMessage(
                      parsed.type === 'open'
                        ? [...selectedChoices, input.trim()].filter(Boolean).join(', ')
                        : selectedChoices.join(', ')
                    )}
                    disabled={
                      (parsed.type === 'open'
                        ? (selectedChoices.length === 0 && !input.trim())
                        : selectedChoices.length === 0) || sending
                    }
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
              {lessons.map((l, i) => {
                // Match the rationale by lesson index, not array position, in case
                // the plan JSON ever comes back out of order.
                const why = chat?.plan?.lessons?.find((pl) => pl.index === l.lesson_index)?.why;
                const n = l.difficulty && l.difficulty >= 1 && l.difficulty <= 5 ? l.difficulty : 3;
                const xp = xpForDifficulty(n);
                const dLabel = t(n <= 2 ? 'chat.diff_easy' : n === 3 ? 'chat.diff_medium' : 'chat.diff_hard');
                return (
                  <div key={l.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{l.title}</p>
                          <span className="flex-shrink-0 text-[10px] font-medium text-[var(--text-muted)] whitespace-nowrap mt-0.5">{dLabel} · +{xp} XP</span>
                        </div>
                        {l.description && <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{l.description}</p>}
                        {why && (
                          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 flex items-start gap-1 leading-relaxed">
                            <Sparkles size={11} className="flex-shrink-0 mt-0.5 text-[var(--color-brand)] opacity-70" />
                            <span className="italic">{why}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              {practiceLabId && (
                <Link
                  href={`/labs/${practiceLabId}`}
                  className="w-full mb-2 py-2.5 rounded-xl border border-[var(--color-brand)] text-[var(--color-brand)] text-xs font-semibold hover:bg-[var(--color-brand)]/10 transition-colors flex items-center justify-center gap-1.5"
                >
                  🧪 {t('chat.practice_in_lab')}
                </Link>
              )}
              {readyToComplete && (
                <p className="text-[11px] text-[var(--color-green)] font-medium text-center mb-2">{t('chat.ready_hint')}</p>
              )}
              <button
                onClick={completeLesson}
                disabled={completing}
                className={cn(
                  'w-full py-2.5 rounded-xl bg-[var(--color-green)] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-60',
                  readyToComplete && 'ring-2 ring-[var(--color-green)] ring-offset-2 ring-offset-[var(--bg-primary)]'
                )}
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
          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            }}
            className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
          >
            {allDone && (
              <div className="max-w-md mx-auto py-10">
                <div className="text-center">
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
                {chat && (
                  <RelatedOpportunities
                    topic={`${chat.title} ${lessons.map((l) => l.title).join(' ')}`}
                    className="mt-10"
                  />
                )}
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
                    {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
                  </div>
                </div>
              </div>
            ))}

            {sending && !streamingId && (
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
              <div className="max-w-3xl mx-auto mb-2 relative flex items-center justify-between gap-2">
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
                            {MODELS.map((m) => {
                              // Gemini-only tiers can't pick May-1 — show it locked.
                              const locked = !!credits?.enabled && credits.geminiOnly && m.id === 'may1';
                              return (
                              <button
                                key={m.id}
                                onClick={() => { if (locked) return; setSelectedModel(m.id); setModelMenuOpen(false); }}
                                disabled={locked}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                                  locked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--border)]',
                                  selectedModel === m.id && !locked && 'bg-[var(--border)]'
                                )}
                              >
                                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', m.dot)} />
                                <div>
                                  <p className={cn('text-xs font-bold', m.color)}>{m.name}</p>
                                  <p className="text-[10px] text-[var(--text-muted)]">{locked ? 'Upgrade to unlock' : m.subtitle}</p>
                                </div>
                                {locked ? (
                                  <Lock size={12} className="ml-auto flex-shrink-0 text-[var(--text-muted)]" />
                                ) : selectedModel === m.id && (
                                  <CheckCircle size={13} className={cn('ml-auto flex-shrink-0', m.color)} />
                                )}
                              </button>
                              );
                            })}
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
                <MicButton
                  lang={router.locale}
                  getText={() => input}
                  onTranscript={(text) => setInput(text)}
                  disabled={sending}
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
