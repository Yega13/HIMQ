import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/apiAuth';
import { resolveTier, creditStatus } from '@/lib/credits';

// Read-only credit snapshot for the logged-in user, powering the credits UI.
// When the meter is off (demo), returns { enabled: false } and the UI stays hidden.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const admin = getAdminClient();
  const tier = await resolveTier(admin, user.id);
  const status = await creditStatus(admin, user.id, tier);
  return res.status(200).json(status);
}
