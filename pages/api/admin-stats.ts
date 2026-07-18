import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

// Same authorization as admin-events: a real session whose profile is_admin.
async function requireAdmin(req: NextApiRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const admin = getAdminClient();
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return null;
  return admin;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const weekAgoISO = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Head-only count queries in parallel.
  const [users, newUsers7d, activePaths, lessonsDone, lessonsToday, examPreps, pendingEvents] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoISO),
    admin.from('chats').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    admin.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', todayISO),
    admin.from('chats').select('id', { count: 'exact', head: true }).not('plan->>exam', 'is', null),
    admin.from('events').select('id', { count: 'exact', head: true }).eq('is_approved', false),
  ]);

  return res.status(200).json({
    users: users.count ?? 0,
    newUsers7d: newUsers7d.count ?? 0,
    activePaths: activePaths.count ?? 0,
    lessonsDone: lessonsDone.count ?? 0,
    lessonsToday: lessonsToday.count ?? 0,
    examPreps: examPreps.count ?? 0,
    pendingEvents: pendingEvents.count ?? 0,
  });
}
