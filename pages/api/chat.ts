import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser, boundedText } from '@/lib/apiAuth';
import { streamAIResponse } from '@/lib/ai';
import { visibleSoFar, interpretReply } from '@/lib/controlTokens';
import { type ModelId, DEFAULT_MODEL } from '@/lib/models';
import { languageName } from '@/lib/utils';

export const config = { maxDuration: 60 };

const DAILY_LIMIT = 50;
const MAX_MESSAGE = 8000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const { chatId, message, model } = req.body as { chatId?: string; message?: string; model?: ModelId };
  const trimmedMessage = boundedText(message, MAX_MESSAGE);
  if (!chatId || !trimmedMessage) {
    return res.status(400).json({ error: 'chatId and a message under 8000 characters are required' });
  }
  const modelId: ModelId = model ?? DEFAULT_MODEL;

  const admin = getAdminClient();

  // Atomic rate limit: a single row-locked DB function does the check-and-
  // increment, so concurrent requests can't both read the same count and blow
  // past the limit. Fails closed (503) if the limiter can't run.
  const { data: usage, error: usageErr } = await admin
    .rpc('consume_daily_message', { p_user_id: user.id, p_limit: DAILY_LIMIT });
  if (usageErr) {
    console.error('Rate-limit RPC failed:', usageErr);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }
  if (!usage?.allowed) {
    return res.status(429).json({
      error: `You've reached today's limit of ${DAILY_LIMIT} messages. Come back tomorrow!`,
    });
  }

  // Verify chat ownership
  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .select('*, lessons(*)')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });

  // Load the LAST 20 messages (newest first, then restore chronological order)
  // so the model always sees the most recent context in long chats.
  const { data: recent } = await admin
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(20);
  const history = (recent ?? []).reverse();

  const isDiscovering = (chat.total_lessons ?? 0) === 0;
  const currentLesson = isDiscovering
    ? null
    : (chat.lessons as { lesson_index: number; title: string; description: string }[])
        ?.find((l) => l.lesson_index === chat.current_lesson_index);

  const language = languageName(chat.plan?.lang);

  const systemPrompt = isDiscovering
    ? `You are May — a personal teacher built by Himq.

Always write every message — questions and answer choices — to the student in ${language}. Write fluent, grammatically correct ${language}; silently re-read and fix any awkward or mistranslated phrasing before replying.

Student goal: "${chat.title}"

════ DISCOVERY PHASE ════
Ask questions ONE AT A TIME to quickly understand this student — then build their plan. Keep it SHORT: 2–3 questions is ideal, 4 is the hard maximum (you can see how many you've already asked in the history — count them). What matters most is their real, specific goal and their current level. Ask about blockers or how they like to learn ONLY if it's quick and would genuinely change the plan. The MOMENT you can build a useful personalized plan, stop asking and build it — a fast path to a good plan beats a long interrogation. Each question must be sharp and clearly relevant; never ask a vague or filler question.

QUESTION FORMAT RULES — follow exactly:
• Keep every question under 12 words
• Pick ONE of three shapes per question:
  1) EXHAUSTIVE choices — every realistic answer fits one option (e.g. time ranges, yes/no levels). The student will NOT need to type.
     Q: Short question?
     A: Choice1 | Choice2 | Choice3 | Choice4
     T: single        (or T: multiple)
  2) SUGGESTIONS + free answer — the student may well have a different answer than your options; your options are just quick picks and a text box appears automatically.
     Q: Short question?
     A: Suggestion1 | Suggestion2 | Suggestion3
     T: open
  3) FULLY open — no good options → plain free-text question (no Q:/A:/T:)
• Use EXHAUSTIVE (T: single / multiple) ONLY when the options genuinely cover EVERY student. If someone could realistically answer "I haven't taken it yet", "I'm not sure", or would want to give their OWN number/level (e.g. a current exam score, an exact level, or specifics) — the options are NOT exhaustive, so use T: open so a text box appears alongside your suggestions. When in doubt, prefer T: open.
• Questions about a current score/level/experience almost always need T: open — never trap a student in score buckets they can't honestly pick.
• NEVER add a catch-all choice like "Other", "Другое", "Այլ", "IDK", or "Not sure" — the text box (T: open) already covers that.
• PLAIN TEXT only — no markdown in the question OR the choices. Never use ** or * (they show as literal asterisks).
• Never write paragraphs. Never explain yourself. Just ask.

When you have enough to build a truly personalized plan, tell the student their
plan is being built now — one short warm sentence, in the student's language.
Then, on its own final line, output this EXACT token and nothing after it:
<<<PLAN_READY>>>`
    : `You are May — an expert personal teacher built by Himq. Your name is May (short for May-1). If anyone asks your name, say "I'm May." Never call yourself "Himq AI" or any other name.

Always write every message to the student in ${language}. Write fluent, grammatically correct ${language}; silently re-read and fix any awkward or mistranslated phrasing before replying.

Topic: ${chat.title}
Current lesson (${chat.current_lesson_index + 1}/${chat.total_lessons}): "${currentLesson?.title ?? ''}" — ${currentLesson?.description ?? ''}

════ TEACHING PHASE ════
You are TEACHING now — a warm, sharp personal tutor, not a lecturer and not a quizmaster. You know this student from discovery, so make it personal.

HOW TO TEACH:
• ANSWER WHAT THEY SAID first. Read their last message and respond to THAT — if they asked something, answer it fully; if they attempted something, react to their attempt. Never ignore what they said to jump to your own next point.
• GIVE REAL FEEDBACK — this matters most. When the student answers or tries something: FIRST name what they got right, then pinpoint the EXACT mistake or misconception and fix it — explain WHY it's wrong in plain words (ideally show how they likely arrived at their answer), not just that it is. A wrong answer is your BEST teaching moment: never gloss over it, and never just say "not quite" and re-explain the right way without addressing THEIR specific error.
• CONCRETE FIRST. Open with a real example, situation, or analogy — THEN give the general rule. Never start with a dry definition.
• USE SIMPLE, PLAIN WORDS. Explain so a smart 12-year-old could follow — short sentences, everyday language. Define any unavoidable technical term instantly. Clear beats clever; never sound like a textbook.
• ONE idea per message, built on the last. A short focused paragraph (about 3–6 sentences), no filler.
• LET THEM LEARN FREELY. Mostly, just teach well — the student should feel free, not quizzed. Only OCCASIONALLY, when a concept genuinely lands better by doing, INVITE them to try a quick example or explain it back ("want to try one?"). NEVER demand practice every message; they're free to just keep learning. Do not turn teaching into constant "now you do it."
• If they seem lost, re-explain the SAME idea a different, simpler way with a fresh example — never just repeat yourself or push through confusion.
• When they clearly get it, move on to the next piece — don't re-quiz what they've already shown they know.
• Reference what they told you during discovery ("Since you're aiming for X..." / "Given you struggle with Y...").

NEVER:
• Never recite specific exam/test statistics you can't be certain are current (passage/question counts, timings, score scales change) — teach the skill and strategy instead; if you don't have a precise current figure, don't state one.
• Never lay out a separate day-by-day or week-by-week study schedule — the lesson list already IS the plan; just teach THIS lesson.
• Never tell the student to "search for", "look up", "google", or "find online" anything — you are the teacher; teach it directly.
• Never use markdown — plain text only, no ** or * (they render as literal characters).
• Never restart the discovery phase.

Stay strictly on topic: "${chat.title}".
When the student has GENUINELY mastered everything in THIS lesson, tell them warmly they seem ready, invite any last questions, and point them to the button: "If you don't have any more questions about this, I think you're ready — click 'Mark complete' to continue your roadmap." (They may not have noticed it.) Then output this EXACT token on its own final line and nothing after it: <<<LESSON_MASTERED>>>. Only when truly mastered — never after an ordinary answer, and at most once.`;

  const aiMessages = [
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: trimmedMessage },
  ];

  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'user',
    content: trimmedMessage,
    lesson_index: chat.current_lesson_index,
  });

  // ── Stream the reply (Server-Sent Events) ────────────────────────────────
  // All the fail-able checks (auth, rate limit, ownership) are already done
  // above and returned normal JSON errors. From here we commit to a 200 SSE
  // stream: `data: {"delta":"…"}` events as text arrives, then a final
  // `data: {"done":true, reply, planReady, lessonMastered}` event.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (obj: unknown) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    // Force the chunk out past any buffering layer so tokens appear live
    // instead of all at once at the end.
    (res as unknown as { flush?: () => void }).flush?.();
  };

  // The model emits control tokens (<<<PLAN_READY>>> / <<<LESSON_MASTERED>>>) on
  // its final line. `visibleSoFar` returns the safe-to-show prefix — complete
  // tokens removed and any in-progress prefix held back — so they never leak.
  let raw = '';
  let sentLen = 0;
  const onDelta = (text: string) => {
    raw += text;
    const vis = visibleSoFar(raw);
    if (vis.length > sentLen) {
      send({ delta: vis.slice(sentLen) });
      sentLen = vis.length;
    }
  };

  // Model routing: English chat normally uses Haiku (cheap), but Haiku botches
  // the structured discovery Q/A/T format and isn't careful enough for exam
  // prep. Route DISCOVERY and EXAM chats to Sonnet (via the 'opening' role,
  // which selects Sonnet regardless of language). General English teaching
  // stays on Haiku to keep costs down.
  const aiRole = (isDiscovering || chat.plan?.exam) ? 'opening' : 'chat';

  try {
    raw = await streamAIResponse(aiMessages, aiRole, systemPrompt, onDelta, modelId, chat.plan?.lang);
  } catch (err) {
    console.error('Chat stream failed:', err);
  }

  const { reply, planReady, lessonMastered } = interpretReply(raw, isDiscovering);

  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'assistant',
    content: reply,
    lesson_index: chat.current_lesson_index,
  });
  await admin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

  // Final event carries the canonical (trimmed, token-free) reply so the client
  // can reconcile the streamed text exactly with what was persisted.
  send({ done: true, reply, planReady, lessonMastered });
  res.end();
}
