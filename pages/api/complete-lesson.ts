import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/apiAuth';
import { fetchLessonResources } from '@/lib/externalResources';

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

  const user = await requireUser(req, res);
  if (!user) return;

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
  // sitting silent, and prefetch its teaching resources now — during the
  // completion celebration screen (already an expected pause) — instead of on
  // the student's first message in it. Both best-effort: never fail the
  // completion over either, and chat.ts still fetches resources lazily on
  // first message if the prefetch here didn't run or failed.
  let intro = null;
  if (data && !data.alreadyCompleted && !data.isFinal && typeof data.nextIndex === 'number') {
    // Independent of each other — run concurrently instead of as two
    // sequential round trips.
    const [{ data: chatRow }, { data: nextLesson }] = await Promise.all([
      admin.from('chats').select('plan').eq('id', chatId).single(),
      admin.from('lessons').select('id, title, description').eq('chat_id', chatId).eq('lesson_index', data.nextIndex).single(),
    ]);
    const lang = (chatRow?.plan?.lang as string) ?? 'en';

    if (nextLesson) {
      // Also independent — the intro message doesn't need resources and the
      // resource fetch (external API calls, the slow part) doesn't need the
      // intro. allSettled (not all) so a failure in one doesn't skip the
      // other; both are best-effort exactly as before, just concurrent now.
      const [introResult, resourceResult] = await Promise.allSettled([
        (async () => {
          const content = buildLessonIntro(lang, data.nextIndex + 1, nextLesson.title ?? '', nextLesson.description ?? '');
          const { data: msg } = await admin
            .from('messages')
            .insert({ chat_id: chatId, role: 'assistant', content, lesson_index: data.nextIndex })
            .select()
            .single();
          return msg ?? null;
        })(),
        (async () => {
          const resources = await fetchLessonResources(nextLesson.title, lang, nextLesson.id);
          await admin.from('lessons').update({ resources }).eq('id', nextLesson.id);
        })(),
      ]);
      if (introResult.status === 'fulfilled') intro = introResult.value;
      else console.error('Lesson intro insert failed (non-fatal):', introResult.reason);
      if (resourceResult.status === 'rejected') {
        console.error('Next-lesson resource prefetch failed (non-fatal):', resourceResult.reason);
      }
    }
  }

  return res.status(200).json({ ...data, intro });
}
