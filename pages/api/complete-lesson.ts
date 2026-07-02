import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

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

  return res.status(200).json(data);
}
