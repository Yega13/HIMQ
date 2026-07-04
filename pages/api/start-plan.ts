import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

// Called when the student approves their reviewed plan. Locks the plan
// (approved: true), marks the teaching phase start, and posts May's welcome
// message so the chat opens on a warm intro instead of an empty screen.
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
    .from('chats').select('*').eq('id', chatId).eq('user_id', user.id).single();
  if (chatErr || !chat) return res.status(404).json({ error: 'Chat not found' });
  if ((chat.total_lessons ?? 0) === 0) return res.status(400).json({ error: 'No plan to start' });

  // Idempotent: if already started, don't post another welcome. The client
  // loads existing messages on open, so return null here.
  if (chat.plan?.approved) {
    return res.status(200).json({ chat, welcome: null });
  }

  const { data: updatedChat, error: updateErr } = await admin
    .from('chats')
    .update({ plan: { ...chat.plan, approved: true, teaching_started_at: new Date().toISOString() } })
    .eq('id', chatId)
    .select()
    .single();
  if (updateErr) {
    console.error('start-plan update failed:', updateErr);
    return res.status(500).json({ error: 'Failed to start plan' });
  }

  const welcomeText = (chat.plan?.welcome as string | undefined)?.trim()
    || `Your personalized plan is ready — ${chat.total_lessons} lessons built around your goal. Open lesson 1 whenever you're ready and let's begin!`;
  const { data: welcomeMsg } = await admin
    .from('messages')
    .insert({ chat_id: chatId, role: 'assistant', content: welcomeText, lesson_index: 0 })
    .select()
    .single();

  return res.status(200).json({ chat: updatedChat, welcome: welcomeMsg ?? null });
}
