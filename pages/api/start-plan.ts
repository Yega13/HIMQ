import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/apiAuth';
import { fetchLessonResources } from '@/lib/externalResources';

// Called when the student approves their reviewed plan. Locks the plan
// (approved: true), marks the teaching phase start, and posts May's welcome
// message so the chat opens on a warm intro instead of an empty screen.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const { chatId } = req.body as { chatId?: string };
  if (!chatId) return res.status(400).json({ error: 'chatId required' });

  const admin = getAdminClient();

  const { data: chat, error: chatErr } = await admin
    .from('chats').select('*').eq('id', chatId).eq('user_id', user.id).single();
  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });
  if ((chat.total_lessons ?? 0) === 0) return res.status(400).json({ error: 'No plan to start' });

  // Idempotent: if already started, don't post another welcome. The client
  // loads existing messages on open, so return null here.
  if (chat.plan?.approved) {
    return res.status(200).json({ chat, welcome: null });
  }

  // Insert the welcome message FIRST, then anchor teaching_started_at to the
  // welcome's own DB created_at. This keeps the teaching-view cutoff
  // (created_at >= teaching_started_at) on a single Postgres clock, so the
  // welcome (and later messages) are never filtered out by app/DB clock skew.
  // Independent of the lesson-0 lookup below it, so they run concurrently.
  const welcomeText = (chat.plan?.welcome as string | undefined)?.trim()
    || `Your personalized plan is ready — ${chat.total_lessons} lessons built around your goal. Open lesson 1 whenever you're ready and let's begin!`;
  const [{ data: welcomeMsg }, { data: firstLesson }] = await Promise.all([
    admin.from('messages')
      .insert({ chat_id: chatId, role: 'assistant', content: welcomeText, lesson_index: 0 })
      .select()
      .single(),
    admin.from('lessons').select('id, title').eq('chat_id', chatId).eq('lesson_index', 0).single(),
  ]);

  const startedAt = (welcomeMsg?.created_at as string | undefined) ?? new Date().toISOString();

  // The chat-approval update below doesn't depend on the resource prefetch
  // (only on `startedAt`, already known), so they also run concurrently
  // instead of making the response wait on an external API call. Prefetch is
  // best-effort either way — chat.ts still fetches lazily on the first
  // message if this didn't run or failed.
  const [{ data: updatedChat, error: updateErr }] = await Promise.all([
    admin.from('chats')
      .update({ plan: { ...chat.plan, approved: true, teaching_started_at: startedAt } })
      .eq('id', chatId)
      .select()
      .single(),
    firstLesson
      ? fetchLessonResources(firstLesson.title, chat.plan?.lang ?? 'en', firstLesson.id)
        .then((resources) => admin.from('lessons').update({ resources }).eq('id', firstLesson.id))
        .catch((e) => console.error('Lesson 0 resource prefetch failed (non-fatal):', e))
      : Promise.resolve(),
  ]);
  if (updateErr) {
    console.error('start-plan update failed:', updateErr);
    return res.status(500).json({ error: 'Failed to start plan' });
  }

  return res.status(200).json({ chat: updatedChat, welcome: welcomeMsg ?? null });
}
