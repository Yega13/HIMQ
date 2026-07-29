-- ============================================================
-- College (միջին մասնագիտական) admission support — 2026-07-30 (safe to re-run)
-- Run AFTER 2026-07-30_universities.sql
--
-- Armenia runs two different admission systems and they are NOT the same shape:
--
--   UNIVERSITY (bachelor) — the applicant sits unified state exams and is
--     ranked competitively; the passing score is set each year by the applicant
--     pool. Modelled by program_cutoffs + unified exam scores.
--
--   COLLEGE (միջին մասնագիտական) — the applicant applies via
--     hayt-college.emis.am with their school certificate (կրթության վկայական).
--     No unified exams. Eligibility is about having finished the required grade,
--     and where a programme is oversubscribed, the certificate average ranks
--     applicants.
--
-- So a programme declares HOW it admits, and lib/eligibility.ts branches on it.
-- ============================================================

-- How this programme admits students.
--   'unified_exam' — ranked on unified state exam totals (universities)
--   'certificate'  — admitted on school certificate (colleges)
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS admission_type text NOT NULL DEFAULT 'unified_exam';

-- Minimum schooling a certificate programme requires: 'grade_9' | 'grade_12'.
-- NULL for unified_exam programmes.
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS min_education text;

-- College listings publish these and students compare on them.
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS duration_months int;

-- The qualification awarded, e.g. 'տեխնիկ', 'վեբ-դիզայներ', 'տեխնիկ ծրագրավորող'.
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS qualification text;

ALTER TABLE programs
  DROP CONSTRAINT IF EXISTS programs_admission_type_check;
ALTER TABLE programs
  ADD CONSTRAINT programs_admission_type_check
  CHECK (admission_type IN ('unified_exam', 'certificate'));

ALTER TABLE programs
  DROP CONSTRAINT IF EXISTS programs_min_education_check;
ALTER TABLE programs
  ADD CONSTRAINT programs_min_education_check
  CHECK (min_education IS NULL OR min_education IN ('grade_9', 'grade_12'));

CREATE INDEX IF NOT EXISTS idx_programs_admission_type ON programs(admission_type);

-- ── Student side ────────────────────────────────────────────
-- Certificate applicants have no unified exam scores, so student_scores can't
-- describe them. These live on the profile instead.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS education_level text;      -- 'grade_9' | 'grade_12'

-- School certificate average, on Armenia's 20-point scale.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS certificate_average numeric(4,2);

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_education_level_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_education_level_check
  CHECK (education_level IS NULL OR education_level IN ('grade_9', 'grade_12'));

-- NOTE on program_cutoffs for certificate programmes: cutoff_score still means
-- "the score that got in", but it is a CERTIFICATE AVERAGE rather than a
-- unified-exam total. Same column, same 20-point scale, different provenance —
-- which is why admission_type must be read alongside it.
