import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/apiAuth';
import { generateAIResponse } from '@/lib/ai';
import { resolveTier, consumeCredits, PLAN_COST } from '@/lib/credits';
import { languageName } from '@/lib/utils';

// Plan generation is a large Sonnet call; the default 10s (Vercel Hobby) would
// 504 mid-generation.
export const config = { maxDuration: 60 };

const MAX_FEEDBACK = 2000;

interface LessonItem { index: number; title: string; description: string; difficulty?: number; why?: string; }
interface LessonPlan { chat_title: string; welcome?: string; lessons: LessonItem[]; }

// Clamp May's difficulty to the 1..5 the DB constraint allows; default 3.
function clampDifficulty(d: unknown): number {
  const n = Math.round(Number(d));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

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

  const user = await requireUser(req, res);
  if (!user) return;

  const { chatId, feedback } = req.body as { chatId?: string; feedback?: string };
  if (!chatId) return res.status(400).json({ error: 'chatId required' });
  if (typeof feedback === 'string' && feedback.length > MAX_FEEDBACK) {
    return res.status(400).json({ error: 'Feedback is too long (max 2000 characters).' });
  }

  const admin = getAdminClient();

  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });
  // Once the student has started learning, the plan is locked. Before that, this
  // route can be re-called to regenerate with feedback. (teaching_started_at
  // covers older chats created before the approved flag existed.)
  if (chat.plan?.approved || chat.plan?.teaching_started_at) {
    return res.status(400).json({ error: 'Plan already started' });
  }

  // Rate-limit plan REGENERATIONS to 5/day. The first plan (total_lessons still
  // 0) is free; any subsequent call — with or without feedback — means a plan
  // already exists, so it's a regeneration and counts against the cap. (Gating
  // on `feedback` alone was bypassable by re-calling with no feedback.)
  if ((chat.total_lessons ?? 0) > 0) {
    const { data: quota, error: quotaErr } = await admin
      .rpc('consume_plan_update', { p_user_id: user.id, p_limit: 5 });
    if (quotaErr) {
      console.error('Plan-update rate-limit RPC failed:', quotaErr);
      return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    }
    if (!quota?.allowed) {
      return res.status(429).json({ error: "You've reached today's limit of 5 plan updates. Try again tomorrow." });
    }
  }

  // Credit meter (no-op unless CREDIT_METER_ENABLED). Plan generation is quality-
  // critical and low-volume (once per path), so it ALWAYS uses the smart model
  // regardless of tier — free plans on Gemini came out glitchy, especially in
  // Armenian. Only ongoing teaching respects a free tier's Gemini-only rule.
  const tier = await resolveTier(admin, user.id);
  const planModel = 'may1' as const;
  const planGate = await consumeCredits(admin, user.id, tier, PLAN_COST[planModel]);
  if (planGate.enabled && !planGate.allowed) {
    return res.status(429).json({
      error: planGate.error
        ? 'Service temporarily unavailable. Please try again.'
        : "You've used all your credits this month. Upgrade your plan or come back next month.",
    });
  }

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

  // ── Exam prep: a comprehensive plan sized to the study time available ──
  // Budget in STUDY HOURS (weeks-until-exam × weekly hours), calibrated for a
  // slow learner (~5h/lesson) so even a weak student finishes in time. Capped at
  // 32 lessons so generation fits the serverless time limit.
  const isExam = !!chat.plan?.exam;
  const HOURS_NUM: Record<string, number> = { u5: 3, '5_10': 7, '10_15': 12, '15p': 18 };
  let lessonTarget = 0;
  if (isExam) {
    const hoursPerWeek = HOURS_NUM[(chat.plan?.hoursId as string) ?? ''] ?? 7;
    const examDateStr = chat.plan?.examDate as string | undefined;
    let weeks = 10; // default when no date given
    if (examDateStr) {
      const days = Math.max(3, Math.ceil((new Date(examDateStr).getTime() - Date.now()) / 86_400_000));
      weeks = Math.max(1, days / 7);
    }
    const usableHours = weeks * hoursPerWeek * 0.85; // 15% buffer for review/slippage
    lessonTarget = Math.min(32, Math.max(6, Math.round(usableHours / 5)));
  }

  // If the student asked for changes during plan review, show May the previous
  // plan and their requested changes so it revises rather than starts over.
  const prevLessons = Array.isArray(chat.plan?.lessons)
    ? (chat.plan.lessons as { index: number; title: string }[])
        .map((l) => `${l.index + 1}. ${l.title}`).join('\n')
    : '';
  const feedbackBlock = feedback?.trim()
    ? `\n\nYOU ALREADY PROPOSED THIS PLAN:\n${prevLessons}\n\nThe student reviewed it and asked for these changes — apply them precisely while STILL fully covering the goal:\n"${feedback.trim()}"\n`
    : '';

  const planSystemPrompt = `You are an expert curriculum designer. Return ONLY valid JSON — no markdown, no explanation. All human-readable text (chat_title, lesson titles and descriptions) MUST be written in ${language}.`;
  const planUserMessage = isExam
    ? `You are an expert exam-prep curriculum designer. Build this student's COMPLETE study plan for a standardized exam. Write chat_title, every lesson title, and every description in ${language}.

STUDENT'S GOAL: "${chat.title}"

THEIR INTAKE (level, target score, exam date, weekly study hours, weakest sections, how they learn best):
---
${conversation}
---
${feedbackBlock}
Create a COMPREHENSIVE plan of EXACTLY ${lessonTarget} lessons — hit this number closely (±2). It was calculated from their exam date and weekly study hours, so it fits the time they actually have.

Rules:
- This is real exam prep with a deadline: cover EVERYTHING on the test this student needs, thoroughly. Comprehensiveness matters MORE than brevity — do NOT minimize the count.
- Calibrate for a student who learns SLOWLY and needs things spelled out. Assume little prior knowledge unless their intake clearly shows otherwise. If a weaker student would pass with this plan, a stronger one certainly will.
- Make each lesson GRANULAR and SPECIFIC — ONE focused subtopic, never a broad chapter. Good: "Algebra: extraneous solutions and dividing polynomials". Bad: "Algebra".
- Sequence as a real progression: core foundations first, then each exam section's skills in small steps, then advanced/tricky cases, then FULL timed practice tests, then targeted review of their weak spots. No forward references.
- Put EXTRA lessons on the sections they named as weakest.
- If you cover all the necessary content before ${lessonTarget} lessons, fill the rest with (a) more full-length timed practice tests and (b) review/strengthening of fundamentals. Never pad with fluff — but a serious exam plan always has room for more practice, so use the time.
- The LAST few lessons MUST be full-length, timed practice under real exam conditions.

For EACH lesson also set:
- "difficulty": integer 1–5 (1 = easy/review, 3 = solid new step, 5 = genuinely challenging). Use the whole range.
- "why": ONE short sentence (in ${language}) tied to their goal or weak areas, under 18 words, speaking to "you".

Keep titles and descriptions to ONE concise line each — you have many lessons to produce.

Return ONLY this JSON:
{
  "chat_title": "specific title for this exam path",
  "welcome": "2-3 warm sentences (in ${language}) as May: acknowledge their exam and target, say you built this plan for them, invite them to start lesson 1.",
  "lessons": [
    {"index": 0, "title": "specific lesson title", "description": "one line: what they'll be able to DO after this", "difficulty": 2, "why": "one short reason in ${language}"}
  ]
}`
    : `A student just completed a discovery conversation with Himq AI.
Based on everything revealed in this conversation, create their PERSONALIZED learning plan.
Write chat_title, every lesson title, and every description in ${language}.

STUDENT'S ORIGINAL GOAL: "${chat.title}"

FULL DISCOVERY CONVERSATION:
---
${conversation}
---
${feedbackBlock}
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
- ORDER matters: sequence the lessons as a real progression where each one builds on the previous (prerequisites first) and sets up the next — no forward references, no jumping ahead of what they've learned
- Aim the plan at a concrete outcome: by the final lesson the student should be able to DO the real thing they came for, not just "know about" it
- Titles should read like: "Understanding X through the lens of Y" not generic "Introduction to X"

For EACH lesson also set:
- "difficulty": an integer 1–5 rating how hard THIS lesson is FOR THIS STUDENT, calibrated to the level they revealed in the discovery conversation (1 = easy/review for them, 3 = a solid new step, 5 = genuinely challenging). Use the whole range across the plan — don't make every lesson a 3.
- "why": ONE short sentence (in ${language}) explaining why this lesson is in THEIR plan, referencing something concrete they said or their goal. Speak to the student ("you"). Keep it under 18 words.

Return ONLY this JSON:
{
  "chat_title": "specific descriptive title for this student's exact path",
  "welcome": "2-3 warm sentences (in ${language}) welcoming the student to their new path: acknowledge their goal, say you built this plan for them, and invite them to start lesson 1. Speak as May, directly to the student.",
  "lessons": [
    {"index": 0, "title": "highly specific lesson title", "description": "one sentence: what this student will specifically be able to DO after this lesson", "difficulty": 2, "why": "one short reason, in ${language}, tied to what they told you"},
    ...
  ]
}`;

  let plan: LessonPlan;
  try {
    const raw = await generateAIResponse(
      [{ role: 'user', content: planUserMessage }],
      'plan',
      planSystemPrompt,
      planModel,
    );
    plan = parsePlan(raw);
  } catch (err) {
    console.error('Plan generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate plan' });
  }

  // Clear any previous (unapproved) lessons — this route can regenerate on
  // feedback, and the lesson count may change.
  await admin.from('lessons').delete().eq('chat_id', chatId);

  // Insert lessons
  const { error: lessonsErr } = await admin.from('lessons').insert(
    plan.lessons.map((l) => ({
      chat_id: chatId,
      lesson_index: l.index,
      title: l.title,
      description: l.description,
      difficulty: clampDifficulty(l.difficulty),
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

  // Save the plan in REVIEW state (approved: false). The student reviews it and
  // either starts learning (via /api/start-plan) or asks for changes (which
  // calls this route again with feedback). No teaching message yet.
  const { data: updatedChat, error: updateErr } = await admin
    .from('chats')
    .update({
      title: plan.chat_title,
      plan: { ...plan, lang: chat.plan?.lang ?? null, exam: chat.plan?.exam ?? null, approved: false },
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
