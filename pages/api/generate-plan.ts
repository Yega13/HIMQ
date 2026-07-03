import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai';
import { languageName } from '@/lib/utils';

// Plan generation is a large Sonnet call; the default 10s (Vercel Hobby) would
// 504 mid-generation.
export const config = { maxDuration: 60 };

interface LessonItem { index: number; title: string; description: string; }
interface LessonPlan { chat_title: string; welcome?: string; lessons: LessonItem[]; }

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
  if ((chat.total_lessons ?? 0) > 0) return res.status(400).json({ error: 'Plan already generated' });

  // Load full conversation
  const { data: messages } = await admin
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  const conversation = (messages ?? [])
    .map((m: { role: string; content: string }) =>
      `[${m.role === 'assistant' ? 'Himq AI' : 'Student'}]: ${m.content}`
    )
    .join('\n\n');

  const language = languageName(chat.plan?.lang);
  const planSystemPrompt = `You are an expert curriculum designer. Return ONLY valid JSON — no markdown, no explanation. All human-readable text (chat_title, lesson titles and descriptions) MUST be written in ${language}.`;
  const planUserMessage = `A student just completed a discovery conversation with Himq AI.
Based on everything revealed in this conversation, create their PERSONALIZED learning plan.
Write chat_title, every lesson title, and every description in ${language}.

STUDENT'S ORIGINAL GOAL: "${chat.title}"

FULL DISCOVERY CONVERSATION:
---
${conversation}
---

Build a deeply personalized plan. The #1 rule: use the FEWEST lessons possible
while still teaching EVERYTHING the student needs to reach their goal. Never pad.
- Find the balance: as short as possible, as complete as necessary. If the goal
  can be achieved in 3 lessons, use 3. Only add a lesson if the goal genuinely
  can't be reached without it. Hard range: 3–8 lessons.
- Skip fundamentals they clearly already know (from the discovery conversation)
- Each lesson must earn its place — one meaningful, distinct step toward the goal.
  Merge overlapping topics rather than splitting them across lessons.
- Each lesson title must be SPECIFIC to this student — reference their background,
  goal, confusion points
- Directly address their confusion points and knowledge gaps
- Completing the plan MUST fully achieve their real stated goal — leave no gap
- Titles should read like: "Understanding X through the lens of Y" not generic "Introduction to X"

Return ONLY this JSON:
{
  "chat_title": "specific descriptive title for this student's exact path",
  "welcome": "2-3 warm sentences (in ${language}) welcoming the student to their new path: acknowledge their goal, say you built this plan for them, and invite them to start lesson 1. Speak as May, directly to the student.",
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
    // If a concurrent call already inserted this chat's lessons, the
    // UNIQUE(chat_id, lesson_index) constraint rejects the duplicate. Treat
    // that as success and return whatever is already there.
    const { data: existing } = await admin
      .from('lessons').select('*').eq('chat_id', chatId).order('lesson_index');
    if (existing && existing.length > 0) {
      const { data: existingChat } = await admin.from('chats').select('*').eq('id', chatId).single();
      return res.status(200).json({ chat: existingChat, lessons: existing });
    }
    console.error('Lessons insert failed:', lessonsErr);
    return res.status(500).json({ error: 'Failed to save lessons' });
  }

  // Update chat with plan and activate
  const { data: updatedChat, error: updateErr } = await admin
    .from('chats')
    .update({
      title: plan.chat_title,
      plan: { ...plan, lang: chat.plan?.lang ?? null, teaching_started_at: new Date().toISOString() },
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

  // Insert May's welcome message as the first message of the teaching phase, so
  // the student lands on a warm intro instead of an empty chat. It's stored
  // after teaching_started_at so it shows in the teaching view (and on reload).
  const welcomeText = plan.welcome?.trim()
    || `Your personalized plan is ready — ${plan.lessons.length} lessons built around your goal. Open lesson 1 whenever you're ready and let's begin!`;
  const { data: welcomeMsg } = await admin
    .from('messages')
    .insert({ chat_id: chatId, role: 'assistant', content: welcomeText, lesson_index: 0 })
    .select()
    .single();

  return res.status(200).json({ chat: updatedChat, lessons: lessons ?? [], welcome: welcomeMsg ?? null });
}
