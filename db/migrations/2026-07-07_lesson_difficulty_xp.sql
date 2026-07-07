-- ============================================================
-- Difficulty-scaled XP — 2026-07-07 (safe to re-run)
-- Each lesson now carries a difficulty (1 easy … 5 hard) that May sets when it
-- builds the plan, calibrated to the student. complete_lesson grants XP scaled
-- to that difficulty instead of a flat 50, so a hard lesson is worth more than
-- an easy one. Center (difficulty 3) = 50 XP, matching the old flat value.
-- Run AFTER 2026-07-05_lessons_completed.sql.
-- ============================================================

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS difficulty smallint DEFAULT 3;

-- Keep difficulty in the sane 1..5 band (guarded so re-runs don't error).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_difficulty_range'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_difficulty_range CHECK (difficulty BETWEEN 1 AND 5);
  END IF;
END $$;

-- complete_lesson: grant XP by the completed lesson's difficulty.
-- 1→20  2→35  3→50  4→70  5→100  (unknown/null → 50).
CREATE OR REPLACE FUNCTION complete_lesson(p_user_id uuid, p_chat_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_current int; v_total int; v_next int; v_is_final boolean; v_updated int;
  v_diff int; v_gain int;
  v_xp int; v_streak int; v_last date;
  v_today date := (now() AT TIME ZONE 'Asia/Yerevan')::date;
  v_new_streak int;
BEGIN
  SELECT current_lesson_index, total_lessons INTO v_current, v_total
  FROM chats WHERE id = p_chat_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF COALESCE(v_total, 0) = 0 THEN RETURN jsonb_build_object('error', 'no_lessons'); END IF;

  v_next := v_current + 1;
  v_is_final := v_next >= v_total;

  UPDATE lessons SET status = 'completed', completed_at = now()
  WHERE chat_id = p_chat_id AND lesson_index = v_current AND status <> 'completed';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('alreadyCompleted', true, 'nextIndex', v_next,
                              'isFinal', v_is_final, 'xpGained', 0);
  END IF;

  -- XP for the lesson just completed, scaled to its difficulty.
  SELECT difficulty INTO v_diff
  FROM lessons WHERE chat_id = p_chat_id AND lesson_index = v_current;
  v_gain := CASE COALESCE(v_diff, 3)
              WHEN 1 THEN 20 WHEN 2 THEN 35 WHEN 3 THEN 50
              WHEN 4 THEN 70 WHEN 5 THEN 100 ELSE 50 END;

  IF NOT v_is_final THEN
    UPDATE lessons SET status = 'active'
    WHERE chat_id = p_chat_id AND lesson_index = v_next AND status = 'locked';
  END IF;

  UPDATE chats SET current_lesson_index = v_next,
      status = CASE WHEN v_is_final THEN 'completed' ELSE 'active' END
  WHERE id = p_chat_id;

  SELECT xp, streak_days, last_active_date INTO v_xp, v_streak, v_last
  FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_last IS DISTINCT FROM v_today THEN
    v_new_streak := CASE WHEN v_last = v_today - 1 THEN COALESCE(v_streak, 0) + 1 ELSE 1 END;
  ELSE
    v_new_streak := COALESCE(v_streak, 0);
  END IF;

  UPDATE profiles
  SET xp = COALESCE(v_xp, 0) + v_gain,
      streak_days = v_new_streak,
      last_active_date = v_today,
      lessons_completed = COALESCE(lessons_completed, 0) + 1
  WHERE id = p_user_id;

  RETURN jsonb_build_object('nextIndex', v_next, 'isFinal', v_is_final,
                            'xpGained', v_gain, 'newStreak', v_new_streak);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (grants unchanged — complete_lesson is already restricted to service_role)
