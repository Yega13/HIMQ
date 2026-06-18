import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';

const DAILY_LIMIT = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { chatId, message } = req.body as { chatId?: string; message?: string };
  if (!chatId || !message?.trim()) {
    return res.status(400).json({ error: 'chatId and message are required' });
  }

  const admin = getAdminClient();

  // Rate limiting — graceful if columns not yet migrated
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('daily_messages_used, last_message_date')
      .eq('id', user.id)
      .single();

    if (profile && 'daily_messages_used' in profile) {
      const today = new Date().toISOString().split('T')[0];
      const isNewDay = profile.last_message_date !== today;
      const used = isNewDay ? 0 : (profile.daily_messages_used ?? 0);

      if (used >= DAILY_LIMIT) {
        return res.status(429).json({
          error: `You've reached today's limit of ${DAILY_LIMIT} messages. Come back tomorrow!`,
        });
      }

      await admin
        .from('profiles')
        .update({
          daily_messages_used: used + 1,
          last_message_date: today,
        })
        .eq('id', user.id);
    }
  } catch {
    // columns not migrated yet — skip rate limiting
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

  const isDiscovering = chat.status === 'discovering';
  const currentLesson = isDiscovering
    ? null
    : (chat.lessons as { lesson_index: number; title: string; description: string }[])
        ?.find((l) => l.lesson_index === chat.current_lesson_index);

  const systemPrompt = isDiscovering
    ? `You are EduPath AI — an expert personal teacher who deeply personalizes every learning plan.

Student's stated goal: "${chat.title}"

════ DISCOVERY PHASE ════
Your job right now: understand this student deeply enough to build a PERFECT, personalized learning plan.
Ask questions ONE AT A TIME — as many as YOU decide are necessary.

You need to know (at minimum):
• What they've actually done, built, or studied in this area (concrete specifics — not just "beginner/advanced")
• Their real goal — what will they DO with this knowledge after the course?
• What has confused or blocked them before about this topic
• How they prefer to learn (challenge-first, explanation-first, example-driven, etc.)
• Anything else YOU feel you're missing to design a perfect plan for this specific person

One question per message. Do not start teaching. Do not explain concepts.

When you have everything you need, say EXACTLY:
"I have everything I need."
Then list what you've learned about them in 3–5 bullet points.
Then say: "Your personalized plan is being built now — one moment."

Do not say "I have everything I need" until you are genuinely confident you can build a plan that is far better than a generic one.`
    : `You are EduPath AI — an expert personal teacher who makes every lesson deeply personal.

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

  const reply = await generateAIResponse(aiMessages, 'chat', systemPrompt);

  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'assistant',
    content: reply,
    lesson_index: chat.current_lesson_index,
  });

  await admin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

  return res.status(200).json({ reply });
}
