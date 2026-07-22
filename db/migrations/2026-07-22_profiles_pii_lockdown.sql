-- ============================================================
-- Profiles PII lockdown — 2026-07-22 (safe to re-run)
-- profiles currently has a wide-open SELECT policy (USING (true)), so any
-- logged-in user can read every other user's full_name, bio, goal,
-- preferred_language, tier, is_admin, etc. via the anon/authenticated client.
-- The leaderboard is the only legitimate public-read use case, and it only
-- ever needs id/full_name/xp/streak_days/lessons_completed for ALL users
-- plus a total headcount — never bio/goal/tier/is_admin for a stranger.
--
-- Fix: replace the permissive SELECT policy with an owner-only one, and add
-- two SECURITY DEFINER functions (same pattern as leaderboard_period below)
-- that expose just the safe leaderboard columns to anon/authenticated,
-- bypassing RLS the same way leaderboard_period already does.
-- ============================================================

-- Drop whatever SELECT policy currently exists on profiles, whatever it's
-- named — we don't have its exact CREATE POLICY statement in this repo
-- since it predates the migrations folder.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- All-time top-50 + total learner count, for leaderboard.tsx's SSR anon client.
CREATE OR REPLACE FUNCTION public_leaderboard_alltime(p_limit int DEFAULT 50)
RETURNS TABLE (
  id                uuid,
  full_name         text,
  xp                int,
  streak_days       int,
  lessons_completed int
) AS $$
  SELECT id, full_name, xp, streak_days, lessons_completed
  FROM profiles
  ORDER BY xp DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public_learner_count()
RETURNS bigint AS $$
  SELECT count(*) FROM profiles;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public_leaderboard_alltime(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_learner_count() TO anon, authenticated;

-- profile.tsx's "1 + count of users with more XP than me" rank query also
-- scans every row's xp, not just the caller's own — same treatment.
CREATE OR REPLACE FUNCTION public_rank_by_xp(p_xp int)
RETURNS bigint AS $$
  SELECT count(*) FROM profiles WHERE xp > p_xp;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public_rank_by_xp(int) TO anon, authenticated;
