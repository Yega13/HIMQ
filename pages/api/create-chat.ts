import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';
import { languageName } from '@/lib/utils';

// Involves an AI call to write the opening question — give it headroom over the
// 10s Vercel Hobby default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { goal, lang } = req.body as { goal?: string; lang?: string };
  if (!goal?.trim()) return res.status(400).json({ error: 'goal is required' });

  const admin = getAdminClient();

  // May teaches in the language the student is browsing the site in when they
  // start the path (most intuitive), falling back to their saved preference.
  const { data: prof } = await admin
    .from('profiles').select('preferred_language').eq('id', user.id).single();
  const chatLang = lang ?? prof?.preferred_language ?? 'en';
  const language = languageName(chatLang);

  // Enforce 10-active-chat limit
  const { count } = await admin
    .from('chats')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('chat_type', 'learning')
    .eq('status', 'active');

  if ((count ?? 0) >= 10) {
    return res.status(429).json({ error: 'You have 10 active chats. Complete or delete one before starting a new topic.' });
  }

  // Generate ONLY the opening discovery question — no plan yet.
  // The plan is generated after the AI finishes the discovery conversation.
  const openingSystemPrompt = `You are May — a personal teacher built by Himq. Be brief and warm. Always write to the student in ${language} — the question text and every answer choice must be in ${language}.`;
  const openingUserMessage = `A student wants to learn: "${goal}".

Write your opening message in ${language}. Keep it SHORT:
- 1 warm sentence introducing yourself as May and saying you'll ask a few quick questions to build the right plan.
- Then ask their main goal with "${goal}".

Format the question using this EXACT structure. Keep the "Q:", "A:", "T:" labels in English, but write the question text and EVERY answer choice in ${language}:
Q: <short question, in ${language}>
A: <choice 1 in ${language}> | <choice 2 in ${language}> | <choice 3 in ${language}> | <choice 4 in ${language}>
T: single

Adapt the choices to fit "${goal}" specifically. Max 4 choices. Keep the question under 12 words. Only use choice format if the options are truly exhaustive — if the answer is open-ended, use a plain text question instead (no Q:/A:/T:). Do NOT output any English words in the question or choices.`;

  let openingMessage: string;
  try {
    openingMessage = await generateAIResponse(
      [{ role: 'user', content: openingUserMessage }],
      'chat',
      openingSystemPrompt
    );
  } catch {
    openingMessage = `Hi! I'm May, your personal teacher. Quick questions first so I can build the right plan for you.\n\nQ: What's your main goal with ${goal}?\nA: Get a job | Build a project | Pass an exam | Just exploring\nT: single`;
  }

  // Create chat — no lessons yet (discovery phase tracked by total_lessons: 0)
  // status stays 'active' to avoid schema constraints; discovery state = total_lessons === 0
  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .insert({
      user_id: user.id,
      title: goal.trim(),
      chat_type: 'learning',
      plan: { discovering: true, lang: chatLang },
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
