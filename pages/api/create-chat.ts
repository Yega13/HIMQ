import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser, boundedText } from '@/lib/apiAuth';
import { generateAIResponse } from '@/lib/ai';
import { languageName } from '@/lib/utils';

// Involves an AI call to write the opening question — give it headroom over the
// 10s Vercel Hobby default.
export const config = { maxDuration: 60 };

const MAX_GOAL = 500;
// Generous daily cap on NEW topics — real users have a 10-active-chat cap
// anyway; this only stops create→delete loops from burning unmetered Sonnet.
const DAILY_CREATE_LIMIT = 20;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const { goal, lang } = req.body as { goal?: string; lang?: string };
  const trimmedGoal = boundedText(goal, MAX_GOAL);
  if (!trimmedGoal) return res.status(400).json({ error: 'A goal under 500 characters is required' });

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

  // Atomic per-day creation cap (counts every create, so create→delete loops
  // can't dodge it). Best-effort: this is cost protection, not security, so if
  // the limiter can't run (migration not yet applied, or mock backend) we log
  // and allow rather than block chat creation. Only an explicit `allowed:false`
  // rejects.
  const { data: createQuota, error: createQuotaErr } = await admin
    .rpc('consume_chat_create', { p_user_id: user.id, p_limit: DAILY_CREATE_LIMIT });
  if (createQuotaErr) {
    console.error('Chat-create limiter unavailable, allowing:', createQuotaErr);
  } else if (createQuota && createQuota.allowed === false) {
    return res.status(429).json({ error: "You've reached today's limit for starting new topics. Try again tomorrow." });
  }

  // Generate ONLY the opening discovery question — no plan yet.
  // The plan is generated after the AI finishes the discovery conversation.
  const openingSystemPrompt = `You are May — a warm, sharp personal teacher built by Himq, starting a short discovery conversation to build the student a personalized learning plan.

Rules that never bend:
- Write EVERYTHING the student reads (the question and every answer choice) in ${language}, fluent and grammatically correct. Silently re-read and fix any awkward or mistranslated phrasing before you reply.
- Keep only the "Q:", "A:", "T:" labels in English; never put any other English word in the question or choices.
- NEVER silently narrow a broad goal into one specific sub-topic. If the goal could mean several different things, your first job is to ask which one they mean — not to guess.`;
  const openingUserMessage = `The student typed this as what they want to learn: "${trimmedGoal}".

Write your opening message in ${language}, in two parts:
1. ONE short, warm sentence: introduce yourself as May and say you'll ask a couple of quick questions to build the right plan.
2. Then exactly ONE question, formatted per the FORMAT block below.

FIRST decide — silently, do NOT write this reasoning — how clear "${trimmedGoal}" is:

• AMBIGUOUS — it is a single word, very broad, or a term that honestly maps to several genuinely different learning directions. (Example: "cinematograph" could mean making films, the craft of cinematography, film history, or early film-camera technology — four different paths.)
  → Your question MUST clarify WHICH of those the student means. Make the choices the 2–4 most likely distinct interpretations — each a real, different learning path. Do NOT assume one for them. Do NOT ask what they already know yet; pin down the goal first.

• SPECIFIC — it already names one clear skill or topic with a single obvious direction. (Example: "React hooks", "conversational French for travel".)
  → Skip clarifying. Ask the single most useful first question to start personalizing — usually their concrete objective, current level, or the context they'll use it in — whichever will shape the plan most.

FORMAT — put Q:, A:, and T: EACH on its own line, and ALWAYS include the T: line:
Q: <the question, in ${language}, under 12 words>
A: <choice 1> | <choice 2> | <choice 3> | <choice 4>
T: single

Pick the T: value by how complete the choices are:
- "single" / "multiple" — the choices are EXHAUSTIVE (every realistic answer fits one, INCLUDING someone with no experience). The student won't need to type.
- "open" — the choices are just SUGGESTIONS and the student may have a different answer; a text box appears automatically.
- If the question asks their current score / level / experience, or they could realistically answer "I haven't taken it" or "I'm not sure", the choices are NOT exhaustive → use T: open so they can type. Never trap them in score buckets they can't honestly pick.
- If no clean options fit at all, DROP the A: and T: lines and ask one plain question in ${language}.

Question rules:
- Max 4 choices, each a short phrase in ${language}. Choices must be clearly distinct, never overlapping.
- NEVER add a catch-all choice like "Other", "Другое", "Այլ", "IDK" — the text box already covers that; use T: open instead when a freeform answer is likely.
- Never output any English words inside the question text or the choices (keep only the Q:/A:/T: labels in English).`;

  let openingMessage: string;
  try {
    openingMessage = await generateAIResponse(
      [{ role: 'user', content: openingUserMessage }],
      'opening',
      openingSystemPrompt,
      'may1',
      chatLang
    );
  } catch {
    openingMessage = `Hi! I'm May, your personal teacher. Quick questions first so I can build the right plan for you.\n\nQ: What's your main goal with ${trimmedGoal}?\nA: Get a job | Build a project | Pass an exam | Just exploring\nT: single`;
  }

  // Create chat — no lessons yet (discovery phase tracked by total_lessons: 0)
  // status stays 'active' to avoid schema constraints; discovery state = total_lessons === 0
  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .insert({
      user_id: user.id,
      title: trimmedGoal,
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
