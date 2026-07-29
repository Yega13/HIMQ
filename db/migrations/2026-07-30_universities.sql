-- ============================================================
-- Armenian university admissions — 2026-07-30 (safe to re-run)
--
-- Armenian admission is COMPETITIVE: a program's passing score
-- (անցողիկ միավոր) is set each year by that year's applicant pool and the
-- number of places, not fixed in advance. So this schema stores HISTORICAL
-- CUTOFFS per program per year — never a static "requirement" — and
-- eligibility is computed as a probability against recent years
-- (see lib/eligibility.ts). Publishing a fixed cutoff would be wrong data,
-- and wrong data here costs a student a year of their life.
--
-- Writes to universities / programs / program_cutoffs have NO policy, so only
-- the service-role admin client can perform them — same shape as the existing
-- events moderation flow.
-- ============================================================

CREATE TABLE IF NOT EXISTS universities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  name_hy     text NOT NULL,          -- students search in Armenian
  short_name  text,                   -- "NPUA" / "Պոլիտեխնիկ"
  city        text NOT NULL,
  website     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id  uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name           text NOT NULL,
  name_hy        text NOT NULL,
  faculty        text,
  degree_level   text NOT NULL DEFAULT 'bachelor',
  -- [{"exam":"unified-math","required":true}, …] — exam ids match lib/exams.ts
  required_exams jsonb NOT NULL DEFAULT '[]'::jsonb,
  tuition_amd    int,
  places_free    int,
  places_paid    int,
  source_url     text,                -- provenance for every claim we make
  verified_at    timestamptz,         -- when a human last confirmed it
  status         text NOT NULL DEFAULT 'pending',   -- pending | approved
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- The asset: one row per program per year. This is what compounds.
CREATE TABLE IF NOT EXISTS program_cutoffs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  year         int NOT NULL,
  cutoff_score numeric(4,2),          -- NULL when that year wasn't published
  places       int,
  applicants   int,
  source_url   text,
  UNIQUE (program_id, year)
);

CREATE INDEX IF NOT EXISTS idx_programs_university ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_status     ON programs(status);
CREATE INDEX IF NOT EXISTS idx_cutoffs_program     ON program_cutoffs(program_id, year DESC);

-- A student's shortlist of target programs.
CREATE TABLE IF NOT EXISTS student_targets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);

-- Predicted or actual unified-exam scores. exam_id matches lib/exams.ts.
CREATE TABLE IF NOT EXISTS student_scores (
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_id    text NOT NULL,
  score      numeric(4,2) NOT NULL,
  is_actual  boolean NOT NULL DEFAULT false,   -- false = the student's estimate
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exam_id)
);

-- ── Row-level security ──────────────────────────────────────
ALTER TABLE universities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_scores  ENABLE ROW LEVEL SECURITY;

-- The catalogue is public, but only APPROVED programs are ever visible —
-- an unverified program must never reach a student.
DROP POLICY IF EXISTS universities_public_read ON universities;
CREATE POLICY universities_public_read ON universities
  FOR SELECT USING (true);

DROP POLICY IF EXISTS programs_public_read ON programs;
CREATE POLICY programs_public_read ON programs
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS cutoffs_public_read ON program_cutoffs;
CREATE POLICY cutoffs_public_read ON program_cutoffs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_cutoffs.program_id AND p.status = 'approved'
    )
  );

-- A student's targets and scores are their own, full stop.
DROP POLICY IF EXISTS targets_own ON student_targets;
CREATE POLICY targets_own ON student_targets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS scores_own ON student_scores;
CREATE POLICY scores_own ON student_scores
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
