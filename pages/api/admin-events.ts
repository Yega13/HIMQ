import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

// Admin event moderation. Authorization is a real Supabase session whose
// profile has is_admin = true — NOT a shared password. Grant admin by setting
// profiles.is_admin = true for that user in the DB (only the service role can,
// per the protect_profile_columns trigger).
async function requireAdmin(req: NextApiRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return null;
  return admin;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('events')
      .select('*')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('admin-events GET failed:', error);
      return res.status(500).json({ error: 'Failed to load events' });
    }
    return res.status(200).json({ events: data });
  }

  if (req.method === 'PATCH') {
    const { id, approve } = req.body as { id?: string; approve?: boolean };
    if (!id || typeof approve !== 'boolean') {
      return res.status(400).json({ error: 'id and approve are required' });
    }
    const { error } = await admin.from('events').update({ is_approved: approve }).eq('id', id);
    if (error) {
      console.error('admin-events PATCH failed:', error);
      return res.status(500).json({ error: 'Failed to update event' });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body as { id?: string };
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await admin.from('events').delete().eq('id', id);
    if (error) {
      console.error('admin-events DELETE failed:', error);
      return res.status(500).json({ error: 'Failed to delete event' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
