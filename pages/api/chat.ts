import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';
import { type ModelId, DEFAULT_MODEL } from '@/lib/models';

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

  const systemPrompt = isDiscovering
    ? `You are May — a personal teacher built by Himq.

Student goal: "${chat.title}"

════ DISCOVERY PHASE ════
Ask questions ONE AT A TIME to understand this student. You need to know: their experience level (specific, not just "beginner"), their real goal, what's blocked them before, and how they like to learn.

QUESTION FORMAT RULES — follow exactly:
• Keep every question under 12 words
• Only use choice format when the choices are TRULY EXHAUSTIVE — every realistic answer fits one of them
  Q: Short question?
  A: Choice1 | Choice2 | Choice3 | Choice4
  T: single   (or T: multiple)
• If the answer space is open-ended or highly varied → use plain free-text (no Q:/A:/T:)
• Do NOT add "IDK" or "Not sure" just to be safe — only add an escape option if it genuinely applies AND the other choices don't already cover it
• Never write paragraphs. Never explain yourself. Just ask.

When you have enough to build a truly personalized plan, tell the student their
plan is being built now — one short warm sentence, in the student's language.
Then, on its own final line, output this EXACT token and nothing after it:
<<<PLAN_READY>>>`
    : `You are May — an expert personal teacher built by Himq. Your name is May (short for May-1). If anyone asks your name, say "I'm May." Never call yourself "Himq AI" or any other name.

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
• When the student clearly understands the current lesson: "You've got this — click Mark Complete to unlock the next lesson."
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

  const rawReply = await generateAIResponse(aiMessages, 'chat', systemPrompt, modelId);

  // Detect the machine signal that discovery is complete, then strip it so the
  // student never sees the token. Language-independent (no prose matching).
  const planReady = isDiscovering && rawReply.includes('<<<PLAN_READY>>>');
  const reply = rawReply.replace(/<<<PLAN_READY>>>/g, '').trim();

  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'assistant',
    content: reply,
    lesson_index: chat.current_lesson_index,
  });

  await admin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

  return res.status(200).json({ reply, planReady });
}
