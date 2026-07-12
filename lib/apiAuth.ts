import type { NextApiRequest, NextApiResponse } from 'next';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Shared auth guard for API routes. Verifies the Bearer access token with
// Supabase and returns the authed user, or writes the appropriate 401 and
// returns null. Centralizing this (it was copy-pasted into every route) means
// the auth check can be hardened in exactly one place.
//
// Usage:
//   const user = await requireUser(req, res);
//   if (!user) return;
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<User | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

// Cap a free-text field before it is stored or sent to a paid AI model.
// Returns the trimmed string, or null if it is empty or over `max` chars —
// callers turn null into a 400. Prevents unbounded-token cost abuse.
export function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}
