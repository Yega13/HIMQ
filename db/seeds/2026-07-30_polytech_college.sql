-- ============================================================
-- SEED (not a schema migration): Polytechnic College programmes
-- Source: Assessment and Testing Center (atc.am) college admissions listing
-- Safe to re-run — every insert is guarded by NOT EXISTS.
--
-- ⚠️  THESE ROWS ARE SEEDED AS status='pending' ON PURPOSE.
--
-- The source listed programme names, durations and qualifications, but NOT
-- which grade each programme admits from (grade 9 vs grade 12). That single
-- field decides whether a student is told "eligible" or "not eligible", so
-- guessing it would produce exactly the failure this whole design exists to
-- prevent: a confident wrong answer that costs someone a year.
--
-- Leaving min_education NULL is not a safe default either — the gate would be
-- skipped and every applicant told "eligible". So these stay INVISIBLE to
-- students (RLS only exposes status='approved') until a human fills in
-- min_education and flips the status.
--
-- To publish a programme once you've confirmed its entry requirement:
--   UPDATE programs
--      SET min_education = 'grade_9',        -- or 'grade_12'
--          source_url    = '<where you confirmed it>',
--          verified_at   = now(),
--          status        = 'approved'
--    WHERE name_hy = 'Մեխատրոնիկա';
-- ============================================================

INSERT INTO universities (name, name_hy, short_name, city, website)
SELECT
  'Polytechnic College',
  'Պոլիտեխնիկի քոլեջ',
  'Polytech College',
  'Yerevan',
  'https://polytech.am'
WHERE NOT EXISTS (
  SELECT 1 FROM universities WHERE short_name = 'Polytech College'
);

INSERT INTO programs (
  university_id, name, name_hy, degree_level, admission_type,
  min_education, duration_months, qualification, required_exams,
  source_url, status
)
SELECT
  u.id, v.name, v.name_hy, 'college', 'certificate',
  NULL,                      -- ⚠️ unknown: grade_9 or grade_12. Must be verified.
  v.duration_months, v.qualification, '[]'::jsonb,
  'https://atc.am', 'pending'
FROM universities u
CROSS JOIN (VALUES
  ('Automotive Transport Maintenance and Repair',
   'Ավտոմոբիլային տրանսպորտի տեխնիկական սպասարկում և նորոգում', 48, 'տեխնիկ'),
  ('Communication Networks and Communication Systems',
   'Կապի ցանցեր և հաղորդակցման համակարգեր', 42, 'տեխնիկ'),
  ('Radio-Electronic Equipment Maintenance and Repair',
   'Ռադիոէլեկտրոնային տեխնիկայի տեխնիկական սպասարկում և նորոգում', 48, 'տեխնիկ'),
  ('Software for Computing Technology and Automated Systems',
   'Հաշվողական տեխնիկայի և ավտոմատացված համակարգերի ծրագրային ապահովում', 48, 'տեխնիկ ծրագրավորող'),
  ('Medical Equipment Installation, Maintenance and Repair',
   'Բժշկական տեխնիկայի տեղակայում, տեխնիկական սպասարկում և նորոգում', 48, 'տեխնիկ'),
  ('Computer Graphic Design',
   'Համակարգչային գեղարվեստական նախագծում', 36, 'վեբ-դիզայներ'),
  ('Postal Communication',
   'Փոստային կապ', 36, 'մասնագետ՝ փոստային կապի'),
  ('Electrical Equipment Installation and Operation in Industrial and Civil Buildings',
   'Արդյունաբերական և քաղաքացիական շենքերի էլեկտրական սարքավորումների տեղակայում, կարգավորում և շահագործում', 48, 'տեխնիկ'),
  ('Analytical Quality Control of Chemical Compounds',
   'Քիմիական միացությունների որակի անալիտիկ հսկում', 48, 'տեխնիկ'),
  ('Mechatronics',
   'Մեխատրոնիկա', 48, 'տեխնիկ-մեխատրոնիկ'),
  ('Electric Vehicle Maintenance and Repair',
   'Էլեկտրամոբիլային տրանսպորտի տեխնիկական սպասարկում և նորոգում', 48, 'տեխնիկ'),
  ('Multi-channel Telecommunication Systems',
   'Բազմուղի հեռահաղորդակցման համակարգեր', 41, 'տեխնիկ'),
  ('Aviation Instruments and Systems',
   'Ավիացիոն սարքեր և համալիրներ', 48, 'տեխնիկ'),
  ('Computer Graphics',
   'Համակարգչային գրաֆիկա', 36, 'դիզայներ՝ համակարգչային գրաֆիկայի'),
  ('Ferrous and Non-ferrous Metal Casting Production',
   'Սև և գունավոր մետաղների ձուլման արտադրություն', 48, 'տեխնիկ՝ մետաղների ձուլման գործընթացի')
) AS v(name, name_hy, duration_months, qualification)
WHERE u.short_name = 'Polytech College'
  AND NOT EXISTS (
    SELECT 1 FROM programs p
    WHERE p.university_id = u.id AND p.name_hy = v.name_hy
  );
