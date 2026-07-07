import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

// A warm, localized transition message posted when a lesson is completed and the
// next one unlocks — so finishing a lesson (even quickly) welcomes the student
// into the next one instead of dropping them into the same silent thread.
function buildLessonIntro(lang: string, oneBasedIndex: number, title: string, description: string): string {
  const t = title.trim();
  const d = description.trim();
  if (lang === 'ru') {
    return `Отлично — урок пройден! 🎉\n\nУрок ${oneBasedIndex}: ${t}\n${d}\n\nНачнём, когда будешь готов — с чего хочешь начать?`;
  }
  if (lang === 'am') {
    return `Ապրե՛ս — դասն ավարտված է։ 🎉\n\nԴաս ${oneBasedIndex}՝ ${t}\n${d}\n\nՍկսե՛նք, երբ պատրաստ լինես — ինչո՞վ ես ուզում սկսել։`;
  }
  return `Nice — lesson complete! 🎉\n\nLesson ${oneBasedIndex}: ${t}\n${d}\n\nLet's begin whenever you're ready — what would you like to start with?`;
}

// Completes the caller's CURRENT lesson in a chat and grants XP/streak.
// All the work happens in the atomic complete_lesson() DB function (row-locked,
// single transaction) so concurrent/double-submit calls can't double-grant XP
// or skip lessons. XP/streak are protected columns writable only via the
// service-role client (see protect_profile_columns), so the browser can't grant
// itself XP.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { chatId } = req.body as { chatId?: string };
  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  const admin = getAdminClient();
  const { data, error } = await admin
    .rpc('complete_lesson', { p_user_id: user.id, p_chat_id: chatId });

  if (error) {
    console.error('complete_lesson RPC failed:', error);
    return res.status(500).json({ error: 'Failed to complete lesson' });
  }
  if (data?.error === 'not_found') return res.status(404).json({ error: 'Chat not found' });
  if (data?.error === 'no_lessons') return res.status(400).json({ error: 'No lessons to complete yet' });

  // On a genuine (non-duplicate) completion that unlocked a next lesson, post a
  // localized welcome for that lesson so the thread transitions instead of
  // sitting silent. Best-effort: never fail the completion over this.
  let intro = null;
  if (data && !data.alreadyCompleted && !data.isFinal && typeof data.nextIndex === 'number') {
    try {
      const { data: chatRow } = await admin
        .from('chats').select('plan').eq('id', chatId).single();
      const { data: nextLesson } = await admin
        .from('lessons').select('title, description').eq('chat_id', chatId).eq('lesson_index', data.nextIndex).single();
      if (nextLesson) {
        const lang = (chatRow?.plan?.lang as string) ?? 'en';
        const content = buildLessonIntro(lang, data.nextIndex + 1, nextLesson.title ?? '', nextLesson.description ?? '');
        const { data: msg } = await admin
          .from('messages')
          .insert({ chat_id: chatId, role: 'assistant', content, lesson_index: data.nextIndex })
          .select()
          .single();
        intro = msg ?? null;
      }
    } catch (e) {
      console.error('Lesson intro insert failed (non-fatal):', e);
    }
  }

  return res.status(200).json({ ...data, intro });
}
