import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';

interface LessonItem {
  index: number;
  title: string;
  description: string;
}

interface LessonPlan {
  chat_title: string;
  lessons: LessonItem[];
}

function parsePlan(raw: string): LessonPlan {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const parsed = JSON.parse(cleaned) as LessonPlan;
  if (!parsed.chat_title || !Array.isArray(parsed.lessons) || parsed.lessons.length < 1) {
    throw new Error('Invalid plan structure');
  }
  return parsed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Authenticate user via Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { goal, skillLevel } = req.body as { goal?: string; skillLevel?: string };
  if (!goal?.trim()) return res.status(400).json({ error: 'goal is required' });

  const level = skillLevel ?? 'beginner';

  // Step 1: Generate lesson plan with Claude Sonnet
  const planSystemPrompt = `You are an expert curriculum designer. Return ONLY valid JSON — no markdown, no explanation.`;
  const planUserMessage = `Create a 5-lesson learning plan for someone who wants to learn: "${goal}". Their level is: ${level}.

Return this exact JSON structure:
{
  "chat_title": "concise title for this learning session",
  "lessons": [
    {"index": 0, "title": "Lesson title", "description": "One sentence: what the student will learn."},
    {"index": 1, "title": "...", "description": "..."},
    {"index": 2, "title": "...", "description": "..."},
    {"index": 3, "title": "...", "description": "..."},
    {"index": 4, "title": "...", "description": "..."}
  ]
}`;

  let plan: LessonPlan;
  try {
    const rawPlan = await generateAIResponse(
      [{ role: 'user', content: planUserMessage }],
      'plan',
      planSystemPrompt
    );
    plan = parsePlan(rawPlan);
  } catch (err) {
    console.error('Plan generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate learning plan' });
  }

  // Step 2: Generate opening message for lesson 1
  const openingSystemPrompt = `You are EduPath AI — a sharp, warm, and direct personal teacher. 2–3 sentences max.`;
  const openingUserMessage = `A student is starting a learning path on: "${goal}".

Write your very first message. Rules:
1. One short sentence: introduce yourself as EduPath AI and say you want to understand them before teaching so the lessons are truly personal.
2. Ask your first diagnostic question: what have they actually worked on, built, or studied related to "${goal}" before? Not "what's your level" — ask for real specifics (tools, projects, concepts, attempts that failed).
Do NOT start teaching. Total: 2–3 sentences.`;

  let openingMessage: string;
  try {
    openingMessage = await generateAIResponse(
      [{ role: 'user', content: openingUserMessage }],
      'chat',
      openingSystemPrompt
    );
  } catch {
    openingMessage = `Hey, I'm EduPath AI — before we start, I want to understand you so these lessons actually fit. What have you worked on or tried related to "${goal}" before? Give me specifics: tools, projects, concepts — even failed attempts count.`;
  }

  // Step 3: Save to DB using admin client (bypasses RLS for the insert)
  const admin = getAdminClient();

  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .insert({
      user_id: user.id,
      title: plan.chat_title,
      chat_type: 'learning',
      plan,
      total_lessons: plan.lessons.length,
      current_lesson_index: 0,
      status: 'active',
    })
    .select()
    .single();

  if (chatErr || !chat) {
    console.error('Chat insert failed:', chatErr);
    return res.status(500).json({ error: 'Failed to save chat' });
  }

  // Insert lessons
  const { error: lessonsErr } = await admin.from('lessons').insert(
    plan.lessons.map((l) => ({
      chat_id: chat.id,
      lesson_index: l.index,
      title: l.title,
      description: l.description,
      status: l.index === 0 ? 'active' : 'locked',
    }))
  );
  if (lessonsErr) console.error('Lessons insert failed:', lessonsErr);

  // Insert AI opening message
  const { error: msgErr } = await admin.from('messages').insert({
    chat_id: chat.id,
    role: 'assistant',
    content: openingMessage,
    lesson_index: 0,
  });
  if (msgErr) console.error('Opening message insert failed:', msgErr);

  return res.status(200).json({ chatId: chat.id });
}
