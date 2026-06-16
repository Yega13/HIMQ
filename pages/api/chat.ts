import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { chatId, message } = req.body as { chatId?: string; message?: string };
  if (!chatId || !message?.trim()) {
    return res.status(400).json({ error: 'chatId and message are required' });
  }

  const admin = getAdminClient();

  // Load chat (verify ownership)
  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .select('*, lessons(*)')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });

  // Load message history (last 20 to stay within token budget)
  const { data: history } = await admin
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(20);

  const currentLesson = (chat.lessons as { lesson_index: number; title: string; description: string }[])
    ?.find((l) => l.lesson_index === chat.current_lesson_index);

  const systemPrompt = `You are EduPath AI, an enthusiastic and encouraging personal teacher.

Topic: ${chat.title}
Current lesson (${chat.current_lesson_index + 1} of ${chat.total_lessons}): ${currentLesson?.title ?? ''} — ${currentLesson?.description ?? ''}

Rules:
- Be concise: 2-4 sentences per response.
- End every response with exactly one question to check understanding or guide the student forward.
- Be warm, encouraging, and direct.
- Stay on topic. Do not discuss anything outside "${chat.title}".
- When the student clearly understands the current lesson, briefly congratulate them and tell them to click "Mark Complete" to unlock the next lesson.`;

  const aiMessages = [
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message.trim() },
  ];

  // Save user message
  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'user',
    content: message.trim(),
    lesson_index: chat.current_lesson_index,
  });

  // Generate AI reply
  const reply = await generateAIResponse(aiMessages, 'chat', systemPrompt);

  // Save AI reply
  await admin.from('messages').insert({
    chat_id: chatId,
    role: 'assistant',
    content: reply,
    lesson_index: chat.current_lesson_index,
  });

  // Update chat updated_at
  await admin.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

  return res.status(200).json({ reply });
}
