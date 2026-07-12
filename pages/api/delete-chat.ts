import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/apiAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const { chatId } = req.body as { chatId?: string };
  if (!chatId) return res.status(400).json({ error: 'chatId required' });

  const admin = getAdminClient();

  // Verify ownership before deleting
  const { data: chat } = await admin.from('chats').select('id').eq('id', chatId).eq('user_id', user.id).single();
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  await admin.from('messages').delete().eq('chat_id', chatId);
  await admin.from('lessons').delete().eq('chat_id', chatId);
  const { error } = await admin.from('chats').delete().eq('id', chatId);

  if (error) return res.status(500).json({ error: 'Failed to delete' });
  return res.status(200).json({ ok: true });
}
