import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

// Valid event_type values per the events CHECK constraint in schema.sql.
const EVENT_TYPES = new Set([
  'competition', 'scholarship', 'course', 'webinar', 'internship',
  'grant', 'fellowship', 'meetup', 'seminar', 'summit',
]);

const MAX_TITLE = 200;
const MAX_TEXT = 4000;

// Any authenticated user can submit an event; it always lands as unapproved
// (is_approved = false) for admin review. Runs server-side with the admin
// client because the browser anon client is blocked by the owner-only RLS
// INSERT policy — and submissions must never be self-publishable.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { title, event_type, organizer, deadline, description, link } = req.body as {
    title?: string; event_type?: string; organizer?: string;
    deadline?: string | null; description?: string; link?: string | null;
  };

  if (!title?.trim() || !organizer?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title, organizer, and description are required.' });
  }
  if (!event_type || !EVENT_TYPES.has(event_type)) {
    return res.status(400).json({ error: 'Invalid event type.' });
  }
  if (title.length > MAX_TITLE || description.length > MAX_TEXT) {
    return res.status(400).json({ error: 'Title or description is too long.' });
  }

  const admin = getAdminClient();
  const { error } = await admin.from('events').insert({
    title: title.trim(),
    event_type,
    organizer: organizer.trim(),
    deadline: deadline || null,
    description: description.trim(),
    link: link?.trim() || null,
    is_approved: false,
  });

  if (error) {
    console.error('submit-event insert failed:', error);
    return res.status(500).json({ error: 'Failed to submit. Please try again.' });
  }

  return res.status(200).json({ ok: true });
}
