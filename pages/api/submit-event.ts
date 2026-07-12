import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/apiAuth';

// Valid event_type values per the events CHECK constraint in schema.sql.
const EVENT_TYPES = new Set([
  'competition', 'scholarship', 'course', 'webinar', 'internship',
  'grant', 'fellowship', 'meetup', 'seminar', 'summit',
]);

const MAX_TITLE = 200;
const MAX_TEXT = 4000;
const MAX_SHORT = 300;

// Any authenticated user can submit an event; it always lands as unapproved
// (is_approved = false) for admin review. Runs server-side with the admin
// client because the browser anon client is blocked by the owner-only RLS
// INSERT policy — and submissions must never be self-publishable.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

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
  if (title.length > MAX_TITLE || description.length > MAX_TEXT
      || organizer.length > MAX_SHORT || (link?.length ?? 0) > MAX_SHORT) {
    return res.status(400).json({ error: 'One or more fields are too long.' });
  }
  // Only allow real web links. Without this, a stored `javascript:` / `data:`
  // URI would render as a clickable anchor on the admin + public pages.
  if (link?.trim() && !/^https?:\/\//i.test(link.trim())) {
    return res.status(400).json({ error: 'Link must start with http:// or https://' });
  }
  // Validate the deadline is a real date before it hits a TIMESTAMPTZ column
  // (otherwise a bad string 500s instead of a clean 400).
  if (deadline && Number.isNaN(Date.parse(deadline))) {
    return res.status(400).json({ error: 'Invalid deadline date.' });
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
