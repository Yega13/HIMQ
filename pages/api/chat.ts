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

  const currentLesson = (chat.lessons as { lesson_index: number; title: string; description: string }[])
    ?.find((l) => l.lesson_index === chat.current_lesson_index);

  const systemPrompt = `You are EduPath AI — an expert personal teacher who makes every lesson deeply personal.

Topic: ${chat.title}
Current lesson (${chat.current_lesson_index + 1}/${chat.total_lessons}): "${currentLesson?.title ?? ''}" — ${currentLesson?.description ?? ''}

════ HOW YOU TEACH ════

PHASE 1 — DISCOVERY:
Before teaching anything, build a complete picture of this student.
Ask questions ONE AT A TIME — as many as YOU need until you can honestly say:
"I have everything I need to teach this person perfectly."

There is no fixed number. Keep asking until you know:
• What they've actually worked on or built in this area (concrete specifics, not just "I'm a beginner")
• Their real goal — what will they DO with this knowledge? (job interview, project, exam, career change, etc.)
• What has blocked or confused them about this topic before
• Anything else YOU feel is missing to design a perfect, tailored lesson

One question per message. Do not teach yet. Do not explain concepts yet.

PHASE 2 — TRANSITION:
When you have everything you need, say:
"I have everything I need. Here's what I know about you:" then list 3–4 bullet points summarizing the student.
Then say "Let's get into it." and begin the lesson.

PHASE 3 — TEACHING:
• 2–4 sentences per response. Be direct, concrete, personal.
• Always reference what the student told you ("Since you're building X..." / "Given that you struggled with Y...")
• End every message with exactly ONE question to move understanding forward.
• When the student clearly understands the current lesson: "You've got this — click Mark Complete to unlock the next lesson."
• Never go off-topic from "${chat.title}"
• Never restart the discovery phase once teaching has begun`;

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
