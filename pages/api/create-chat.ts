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

  // May teaches in the language the student has selected in the app (the navbar
  // language, sent as `lang`). No DB column / migration involved — pick a
  // language on the site and new paths follow it. Falls back to English.
  const chatLang = lang ?? 'en';
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
  const openingSystemPrompt = `You are May — a warm, sharp personal teacher built by Himq, starting a short discovery conversation to build the student a personalized learning plan.

Rules that never bend:
- Write EVERYTHING the student reads (the question and every answer choice) in ${language}, fluent and grammatically correct. Silently re-read and fix any awkward or mistranslated phrasing before you reply.
- Keep only the "Q:", "A:", "T:" labels in English; never put any other English word in the question or choices.
- NEVER silently narrow a broad goal into one specific sub-topic. If the goal could mean several different things, your first job is to ask which one they mean — not to guess.`;
  const openingUserMessage = `The student typed this as what they want to learn: "${goal}".

Write your opening message in ${language}, in two parts:
1. ONE short, warm sentence: introduce yourself as May and say you'll ask a couple of quick questions to build the right plan.
2. Then exactly ONE question, formatted per the FORMAT block below.

FIRST decide — silently, do NOT write this reasoning — how clear "${goal}" is:

• AMBIGUOUS — it is a single word, very broad, or a term that honestly maps to several genuinely different learning directions. (Example: "cinematograph" could mean making films, the craft of cinematography, film history, or early film-camera technology — four different paths.)
  → Your question MUST clarify WHICH of those the student means. Make the choices the 2–4 most likely distinct interpretations — each a real, different learning path. Do NOT assume one for them. Do NOT ask what they already know yet; pin down the goal first.

• SPECIFIC — it already names one clear skill or topic with a single obvious direction. (Example: "React hooks", "conversational French for travel".)
  → Skip clarifying. Ask the single most useful first question to start personalizing — usually their concrete objective, current level, or the context they'll use it in — whichever will shape the plan most.

FORMAT — put Q:, A:, and T: EACH on its own line, and ALWAYS include the T: line:
Q: <the question, in ${language}, under 12 words>
A: <choice 1> | <choice 2> | <choice 3> | <choice 4>
T: single

Question rules:
- Max 4 choices, each a short phrase in ${language}. Choices must be clearly distinct, never overlapping.
- If the honest answer is open-ended (no clean set of options fits), DROP the A: and T: lines and instead ask one plain question in ${language} — the student can always type their own answer.
- Never output any English words inside the question text or the choices.`;

  let openingMessage: string;
  try {
    openingMessage = await generateAIResponse(
      [{ role: 'user', content: openingUserMessage }],
      'chat',
      openingSystemPrompt,
      'may1',
      chatLang
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
