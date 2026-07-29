import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

// Public catalogue of approved programmes, with each one's cutoff history.
//
// Reads with the anon client on purpose: the RLS policy only exposes
// status='approved', so an unverified programme can never leak to a student
// through this route — the database enforces it, not this handler.
//
// No auth required. Browsing universities is public; only the student's own
// scores and targets are private.

export interface ProgramRow {
  id: string;
  name: string;
  name_hy: string;
  faculty: string | null;
  degree_level: string;
  admission_type: 'unified_exam' | 'certificate';
  min_education: 'grade_9' | 'grade_12' | null;
  duration_months: number | null;
  qualification: string | null;
  required_exams: { exam: string; required: boolean }[];
  tuition_amd: number | null;
  places_free: number | null;
  places_paid: number | null;
  source_url: string | null;
  verified_at: string | null;
  university: {
    id: string;
    name: string;
    name_hy: string;
    short_name: string | null;
    city: string;
  } | null;
  cutoffs: { year: number; cutoff_score: string | number | null }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data, error } = await supabase
    .from('programs')
    .select(`
      id, name, name_hy, faculty, degree_level, admission_type,
      min_education, duration_months, qualification, required_exams,
      tuition_amd, places_free, places_paid, source_url, verified_at,
      university:universities ( id, name, name_hy, short_name, city ),
      cutoffs:program_cutoffs ( year, cutoff_score )
    `)
    .eq('status', 'approved')
    .order('name');

  if (error) {
    console.error('[programs] query failed:', error);
    return res.status(500).json({ error: 'Could not load programmes' });
  }

  // Newest cutoff first so the client never has to re-sort. assess() sorts
  // defensively anyway, but an ordered payload keeps the UI simple.
  const programs = (data ?? []).map((p) => ({
    ...p,
    cutoffs: [...((p as { cutoffs?: { year: number }[] }).cutoffs ?? [])]
      .sort((a, b) => b.year - a.year),
  }));

  // Cache at the edge: the catalogue changes when an admin approves something,
  // not per request. Stale-while-revalidate keeps it instant for students.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json({ programs });
}
