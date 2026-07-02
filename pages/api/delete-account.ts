import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

// Permanently deletes the signed-in user's account.
//
// Deleting the auth user cascades to profiles (profiles.id REFERENCES
// auth.users(id) ON DELETE CASCADE) and from there to chats, messages,
// saved events, xp, etc. — so this one call removes all of the user's data.
//
// Requires the service-role key (getAdminClient), which is why this must live
// in an API route and can never run in the browser.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  // Verify the caller with their own access token so a user can only ever
  // delete their own account.
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('delete-account failed:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }

  return res.status(200).json({ ok: true });
}
