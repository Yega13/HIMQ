import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';

interface LessonItem { index: number; title: string; description: string; }
interface LessonPlan { chat_title: string; lessons: LessonItem[]; }

function parsePlan(raw: string): LessonPlan {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned) as LessonPlan;
  if (!parsed.chat_title || !Array.isArray(parsed.lessons) || parsed.lessons.length < 1) {
    throw new Error('Invalid plan structure');
  }
  return parsed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { chatId } = req.body as { chatId?: string };
  if (!chatId) return res.status(400).json({ error: 'chatId required' });

  const admin = getAdminClient();

  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });
  if (chat.status !== 'discovering') return res.status(400).json({ error: 'Plan already generated' });

  // Load full conversation
  const { data: messages } = await admin
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  const conversation = (messages ?? [])
    .map((m: { role: string; content: string }) =>
      `[${m.role === 'assistant' ? 'EduPath AI' : 'Student'}]: ${m.content}`
    )
    .join('\n\n');

  const planSystemPrompt = `You are an expert curriculum designer. Return ONLY valid JSON — no markdown, no explanation.`;
  const planUserMessage = `A student just completed a discovery conversation with EduPath AI.
Based on everything revealed in this conversation, create their PERSONALIZED learning plan.

STUDENT'S ORIGINAL GOAL: "${chat.title}"

FULL DISCOVERY CONVERSATION:
---
${conversation}
---

Build a deeply personalized plan:
- Choose the right number of lessons (5–10) based on complexity and this student's specific needs
- Each lesson title must be SPECIFIC to this student — reference their background, goal, confusion points
- Skip fundamentals they clearly already know
- Directly address their confusion points and knowledge gaps
- Make sure completing the plan achieves their real stated goal
- Titles should read like: "Understanding X through the lens of Y" not generic "Introduction to X"

Return ONLY this JSON:
{
  "chat_title": "specific descriptive title for this student's exact path",
  "lessons": [
    {"index": 0, "title": "highly specific lesson title", "description": "one sentence: what this student will specifically be able to DO after this lesson"},
    ...
  ]
}`;

  let plan: LessonPlan;
  try {
    const raw = await generateAIResponse(
      [{ role: 'user', content: planUserMessage }],
      'plan',
      planSystemPrompt
    );
    plan = parsePlan(raw);
  } catch (err) {
    console.error('Plan generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate plan' });
  }

  // Insert lessons
  const { error: lessonsErr } = await admin.from('lessons').insert(
    plan.lessons.map((l) => ({
      chat_id: chatId,
      lesson_index: l.index,
      title: l.title,
      description: l.description,
      status: l.index === 0 ? 'active' : 'locked',
    }))
  );
  if (lessonsErr) {
    console.error('Lessons insert failed:', lessonsErr);
    return res.status(500).json({ error: 'Failed to save lessons' });
  }

  // Update chat with plan and activate
  const { data: updatedChat, error: updateErr } = await admin
    .from('chats')
    .update({
      title: plan.chat_title,
      plan,
      total_lessons: plan.lessons.length,
      current_lesson_index: 0,
      status: 'active',
    })
    .eq('id', chatId)
    .select()
    .single();

  if (updateErr) {
    console.error('Chat update failed:', updateErr);
    return res.status(500).json({ error: 'Failed to update chat' });
  }

  // Fetch the newly inserted lessons
  const { data: lessons } = await admin
    .from('lessons')
    .select('*')
    .eq('chat_id', chatId)
    .order('lesson_index');

  return res.status(200).json({ chat: updatedChat, lessons: lessons ?? [] });
}
