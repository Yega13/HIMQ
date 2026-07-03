-- ============================================================
-- Allow 'ru' as a preferred_language — 2026-07-03 (safe to re-run)
-- The original CHECK only allowed ('am','en'), so a user picking Russian
-- couldn't have it saved (the update silently failed the constraint).
-- ============================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('am', 'en', 'ru'));
