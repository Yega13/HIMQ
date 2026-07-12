-- ============================================================
-- Period leaderboards — 2026-07-10 (safe to re-run)
-- The weekly / monthly leaderboard tabs were fake: the app fetched the
-- all-time top 50 and re-sorted THOSE rows, so a genuine weekly leader outside
-- the all-time top 50 could never appear, and the values were always 0.
--
-- This computes real per-period XP from lessons actually completed in the
-- window (lessons.completed_at), scaled by the same difficulty→XP curve as
-- complete_lesson (1→20 2→35 3→50 4→70 5→100). Returns the period's top 50,
-- along with each user's all-time profile fields for display.
-- ============================================================

-- Speeds up the completed_at range scan the aggregation does.
CREATE INDEX IF NOT EXISTS idx_lessons_completed_at
  ON lessons(completed_at) WHERE status = 'completed';

CREATE OR REPLACE FUNCTION leaderboard_period(p_since timestamptz)
RETURNS TABLE (
  id                uuid,
  full_name         text,
  xp                int,
  streak_days       int,
  lessons_completed int,
  period_xp         bigint
) AS $$
  SELECT
    p.id,
    p.full_name,
    p.xp,
    p.streak_days,
    p.lessons_completed,
    COALESCE(SUM(
      CASE COALESCE(l.difficulty, 3)
        WHEN 1 THEN 20 WHEN 2 THEN 35 WHEN 3 THEN 50
        WHEN 4 THEN 70 WHEN 5 THEN 100 ELSE 50
      END
    ), 0)::bigint AS period_xp
  FROM profiles p
  JOIN chats   c ON c.user_id = p.id
  JOIN lessons l ON l.chat_id = c.id
  WHERE l.status = 'completed'
    AND l.completed_at >= p_since
  GROUP BY p.id, p.full_name, p.xp, p.streak_days, p.lessons_completed
  ORDER BY period_xp DESC
  LIMIT 50;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Public leaderboard data — readable by the anon SSR client (same visibility as
-- the existing "Anyone can view profiles" policy).
GRANT EXECUTE ON FUNCTION leaderboard_period(timestamptz) TO anon, authenticated;
