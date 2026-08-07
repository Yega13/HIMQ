import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/apiAuth';

// Lets a student undo their last discovery answer and re-see the question
// before it, so a wrong or regretted answer isn't locked in for the rest of
// the conversation. Deletes the two most recent messages — the current
// question and their last answer to it — leaving the PRIOR question as the
// new "current" one. Pure DB cleanup, no AI call involved, so it costs
// nothing. Only valid during discovery (no plan yet) and only when there's
// a prior answer to return to (can't go back past the very first question).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const { chatId } = req.body as { chatId?: string };
  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  const admin = getAdminClient();
  const { data: chat, error: chatErr } = await admin
    .from('chats').select('id, total_lessons').eq('id', chatId).eq('user_id', user.id).single();
  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });
  if ((chat.total_lessons ?? 0) > 0) {
    return res.status(400).json({ error: 'Discovery is already finished for this path.' });
  }

  const { data: recent, error: recentErr } = await admin
    .from('messages')
    .select('id, role')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(2);
  if (recentErr) {
    console.error('discovery-back fetch failed:', recentErr);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }
  if (!recent || recent.length < 2 || recent[0].role !== 'assistant' || recent[1].role !== 'user') {
    return res.status(400).json({ error: "There's nothing to go back to yet." });
  }

  const { error: delErr } = await admin
    .from('messages').delete().in('id', [recent[0].id, recent[1].id]);
  if (delErr) {
    console.error('discovery-back delete failed:', delErr);
    return res.status(500).json({ error: 'Could not go back. Please try again.' });
  }

  return res.status(200).json({ ok: true });
}
