import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

const XP_PER_LESSON = 50;

// Yerevan-local YYYY-MM-DD, so streak day boundaries match the user base
// (and the daily_usage table, which also uses Asia/Yerevan).
function localDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Yerevan' });
}

// Completes the caller's CURRENT lesson in a chat and grants XP/streak
// server-side. XP and streak are protected columns (see the
// protect_profile_columns trigger) so they can ONLY be written here, via the
// service-role admin client — the browser can't grant itself XP anymore.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { chatId } = req.body as { chatId?: string };
  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  const admin = getAdminClient();

  // Verify ownership + read current state.
  const { data: chat, error: chatErr } = await admin
    .from('chats')
    .select('id, current_lesson_index, total_lessons')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();
  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });

  const currentIndex = chat.current_lesson_index ?? 0;
  const total = chat.total_lessons ?? 0;
  const nextIndex = currentIndex + 1;
  const isFinal = nextIndex >= total;

  // Idempotency guard: if the current lesson is already completed, don't
  // grant XP again (protects against double-clicks / retries).
  const { data: currentLesson } = await admin
    .from('lessons')
    .select('status')
    .eq('chat_id', chatId)
    .eq('lesson_index', currentIndex)
    .maybeSingle();

  if (currentLesson?.status === 'completed') {
    return res.status(200).json({ alreadyCompleted: true, nextIndex, isFinal, xpGained: 0 });
  }

  // Load profile for XP + streak computation.
  const { data: profile } = await admin
    .from('profiles')
    .select('xp, streak_days, last_active_date')
    .eq('id', user.id)
    .single();

  const today = localDate(0);
  const yesterday = localDate(-1);
  const lastActive = profile?.last_active_date as string | undefined;
  let newStreak = profile?.streak_days ?? 0;
  if (lastActive !== today) {
    newStreak = lastActive === yesterday ? newStreak + 1 : 1;
  }

  await Promise.all([
    admin.from('lessons')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('lesson_index', currentIndex),
    isFinal
      ? Promise.resolve()
      : admin.from('lessons').update({ status: 'active' }).eq('chat_id', chatId).eq('lesson_index', nextIndex),
    admin.from('chats')
      .update({ current_lesson_index: nextIndex, status: isFinal ? 'completed' : 'active' })
      .eq('id', chatId),
    admin.from('profiles')
      .update({ xp: (profile?.xp ?? 0) + XP_PER_LESSON, streak_days: newStreak, last_active_date: today })
      .eq('id', user.id),
  ]);

  return res.status(200).json({ nextIndex, isFinal, xpGained: XP_PER_LESSON, newStreak });
}
