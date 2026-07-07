import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';
import { type ModelId, DEFAULT_MODEL } from '@/lib/models';
import { languageName } from '@/lib/utils';

export const config = { maxDuration: 60 };

const DAILY_LIMIT = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { chatId, message, model } = req.body as { chatId?: string; message?: string; model?: ModelId };
  if (!chatId || !message?.trim()) {
    return res.status(400).json({ error: 'chatId and message are required' });
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
Ask questions ONE AT A TIME to understand this student. You need to know: their experience level (specific, not just "beginner"), their real goal, what's blocked them before, and how they like to learn.

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
• NEVER add a catch-all choice like "Other", "Другое", "Այլ", "IDK", or "Not sure" — the text box already covers that. Use T: open instead when a freeform answer is likely.
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
You know this student well from your discovery conversation — make every response personal.
• 2–4 sentences per response. Direct, concrete, no fluff.
• Reference what they told you during discovery ("Since you're building X..." / "Given you've worked with Y...")
• End every message with exactly ONE focused question to advance their understanding.
• Never introduce more than one new concept per message.
• If they seem lost, go one level simpler — never push through confusion.
• Stay strictly on topic: "${chat.title}"
• When the student has GENUINELY mastered everything in THIS lesson, tell them warmly in one sentence that they're ready to move on, then output this EXACT token on its own final line and nothing after it: <<<LESSON_MASTERED>>>. Only when truly mastered — never after an ordinary answer, and at most once.
• Never restart the discovery phase.`;

  const aiMessages = [
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message.trim() },
  ];

  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'user',
    content: message.trim(),
    lesson_index: chat.current_lesson_index,
  });

  const rawReply = await generateAIResponse(aiMessages, 'chat', systemPrompt, modelId, chat.plan?.lang);

  // Detect the machine signals (language-independent), then strip them so the
  // student never sees the tokens. PLAN_READY ends discovery; LESSON_MASTERED
  // nudges the student to mark the current teaching lesson complete.
  const planReady = isDiscovering && rawReply.includes('<<<PLAN_READY>>>');
  const lessonMastered = !isDiscovering && rawReply.includes('<<<LESSON_MASTERED>>>');
  const reply = rawReply
    .replace(/<<<PLAN_READY>>>/g, '')
    .replace(/<<<LESSON_MASTERED>>>/g, '')
    .trim();

  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'assistant',
    content: reply,
    lesson_index: chat.current_lesson_index,
  });

  await admin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

  return res.status(200).json({ reply, planReady, lessonMastered });
}
