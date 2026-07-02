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

  // Rate limiting via the daily_usage table (UNIQUE(user_id, usage_date)).
  // Day boundary is Asia/Yerevan to match the table default and the user base.
  const usageDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Yerevan' });
  const { data: usage, error: usageErr } = await admin
    .from('daily_usage')
    .select('message_count')
    .eq('user_id', user.id)
    .eq('usage_date', usageDate)
    .maybeSingle();

  if (usageErr) {
    // Do NOT silently allow unlimited usage — fail closed so a broken limiter
    // is loud, not a silent cost leak.
    console.error('Rate-limit lookup failed:', usageErr);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }

  const used = usage?.message_count ?? 0;
  if (used >= DAILY_LIMIT) {
    return res.status(429).json({
      error: `You've reached today's limit of ${DAILY_LIMIT} messages. Come back tomorrow!`,
    });
  }

  const { error: incErr } = await admin
    .from('daily_usage')
    .upsert(
      { user_id: user.id, usage_date: usageDate, message_count: used + 1 },
      { onConflict: 'user_id,usage_date' },
    );
  if (incErr) {
    console.error('Rate-limit increment failed:', incErr);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }

  // Verify chat ownership
  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .select('*, lessons(*)')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });

  // Load message history (last 20)
  const { data: history } = await admin
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(20);

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

When you have enough to build a truly personalized plan, say EXACTLY:
"I have everything I need."
Then: "Your personalized plan is being built now — one moment."`
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

  const reply = await generateAIResponse(aiMessages, 'chat', systemPrompt, modelId);

  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'assistant',
    content: reply,
    lesson_index: chat.current_lesson_index,
  });

  await admin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

  return res.status(200).json({ reply });
}
