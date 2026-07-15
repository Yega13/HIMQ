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
You are TEACHING now. Your job is to explain and show — not to interrogate. You know this student from discovery, so make it personal.
• ANSWER WHAT THEY SAID. Read the student's last message and respond to THAT first — if they asked a question, answer it directly and fully; if they gave an answer, acknowledge it. Never ignore what they said to jump to your own next point.
• LEAD WITH SUBSTANCE. Each message should actually teach: explain the idea clearly, then make it concrete with a specific example, a short analogy, or a tiny worked case. The student should learn something real in every reply — never answer with only a question.
• Length: a short, focused paragraph (about 3–6 sentences) — enough to teach one idea well. Be clear and concrete, no filler.
• ONE new concept per message; build up step by step.
• Ask a question ONLY when it genuinely helps — to check a specific point they just learned, or to invite them to try it themselves. Do NOT end every message with a question, and never ask them to guess something you could simply explain. Most messages should teach; a question is the occasional check-in, not the default.
• When they show they understand, move on and teach the next piece — don't re-quiz the same point.
• If they seem lost, re-explain more simply with a fresh example — never just push through confusion.
• Reference what they told you during discovery ("Since you're building X..." / "Given you've worked with Y...").
• Stay strictly on topic: "${chat.title}".
• Do NOT recite specific exam/test statistics you can't be certain are current — exact passage counts, question counts, section timings, or score scales change over time and you will often be wrong. Teach the SKILL, the strategy, and what to expect in general terms instead. If a precise current figure isn't given to you, don't state one.
• Do NOT lay out a separate day-by-day or week-by-week study schedule — the student's plan already IS their lesson list on the side. Just teach the content of THIS current lesson; never narrate a parallel plan.
• Write in PLAIN TEXT only. No markdown whatsoever — never use ** or * for bold, - or * for bullets, or # for headings. They render as literal characters. Write clean sentences and, if you list things, write them out in prose.
• You are the teacher — NEVER tell the student to "search for", "look up", "google", "find online", or "check a website". Teach it directly: give the actual explanation, the example, the rule, yourself. If they need a resource, it's your job to teach the content, not to send them away.
• When the student has GENUINELY mastered everything in THIS lesson, tell them warmly in one sentence that they're ready to move on, then output this EXACT token on its own final line and nothing after it: <<<LESSON_MASTERED>>>. Only when truly mastered — never after an ordinary answer, and at most once.
• Never restart the discovery phase.`;

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
  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

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

  try {
    raw = await streamAIResponse(aiMessages, 'chat', systemPrompt, onDelta, modelId, chat.plan?.lang);
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
