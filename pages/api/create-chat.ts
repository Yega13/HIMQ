import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { goal } = req.body as { goal?: string };
  if (!goal?.trim()) return res.status(400).json({ error: 'goal is required' });

  // Generate ONLY the opening discovery question — no plan yet.
  // The plan is generated after the AI finishes the discovery conversation.
  const openingSystemPrompt = `You are EduPath AI — a sharp, warm personal teacher. 2–3 sentences max.`;
  const openingUserMessage = `A student wants to learn: "${goal}".

Write your very first message:
1. One sentence: introduce yourself as EduPath AI, say you need to understand them first so you can build a plan that truly fits them.
2. Ask your first diagnostic question: what have they actually worked on, built, or studied related to "${goal}"? Not skill level — real specifics (tools, projects, attempts, even failures).
Total: 2–3 sentences. Do NOT start teaching.`;

  let openingMessage: string;
  try {
    openingMessage = await generateAIResponse(
      [{ role: 'user', content: openingUserMessage }],
      'chat',
      openingSystemPrompt
    );
  } catch {
    openingMessage = `Hey, I'm EduPath AI — before I build your learning plan, I want to understand you so it actually fits. What have you worked on or tried related to "${goal}" before? Give me specifics: tools, projects, concepts, even things that didn't click.`;
  }

  const admin = getAdminClient();

  // Create chat — no lessons yet (discovery phase tracked by total_lessons: 0)
  // status stays 'active' to avoid schema constraints; discovery state = total_lessons === 0
  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .insert({
      user_id: user.id,
      title: goal.trim(),
      chat_type: 'learning',
      plan: { discovering: true },
      total_lessons: 0,
      current_lesson_index: 0,
      status: 'active',
    })
    .select()
    .single();

  if (chatErr || !chat) {
    console.error('Chat insert failed:', chatErr);
    return res.status(500).json({ error: 'Failed to create chat' });
  }

  // Insert opening message
  const { error: msgErr } = await admin.from('messages').insert({
    chat_id: chat.id,
    role: 'assistant',
    content: openingMessage,
    lesson_index: 0,
  });
  if (msgErr) console.error('Opening message insert failed:', msgErr);

  return res.status(200).json({ chatId: chat.id });
}
