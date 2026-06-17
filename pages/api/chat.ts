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

  const userMessageCount = (history ?? []).filter((m: { role: string }) => m.role === 'user').length;

  let phaseBlock: string;
  if (userMessageCount < 3) {
    const nextQuestion =
      userMessageCount === 0
        ? `Ask them to describe their actual hands-on experience with "${chat.title}" — not just a skill label, but what they've specifically worked on or built before.`
        : userMessageCount === 1
        ? `Ask what their real goal is for learning this: preparing for a job interview, building a specific project, passing an exam, or pure curiosity?`
        : `Ask what they find most confusing or intimidating about "${chat.title}" — what have they tried that didn't click?`;

    phaseBlock = `
═══ DISCOVERY PHASE (${userMessageCount + 1}/3) ═══
You are learning about this specific student before teaching them.
Your ONLY job this message: ask the following ONE question (nothing else, no explanations yet):
${nextQuestion}

Be warm and brief. After all 3 answers, say "Perfect — I know exactly how to help you. Let's get into ${currentLesson?.title ?? 'it'}!" then start teaching.`;
  } else {
    phaseBlock = `
═══ TEACHING PHASE ═══
You know this student from your earlier questions — make teaching personal and relevant to what they told you.
• 2–4 sentences per response.
• End every response with exactly ONE focused question to guide their understanding.
• Stay strictly on topic: "${chat.title}".
• When the student clearly understands the current lesson: "Excellent! Click Mark Complete to unlock the next lesson."`;
  }

  const systemPrompt = `You are EduPath AI — an expert, warm, and direct personal teacher.

Topic: ${chat.title}
Current lesson (${chat.current_lesson_index + 1}/${chat.total_lessons}): "${currentLesson?.title ?? ''}" — ${currentLesson?.description ?? ''}
${phaseBlock}`;

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
