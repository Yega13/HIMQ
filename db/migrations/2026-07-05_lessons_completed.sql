-- ============================================================
-- Persistent lessons_completed counter — 2026-07-05 (safe to re-run)
-- profiles.lessons_completed is incremented server-side each time a lesson is
-- genuinely completed (via complete_lesson), so the dashboard/profile/leaderboard
-- show an accurate lifetime count instead of 0. Per-lesson status is already
-- saved on the lessons table, so re-entering a path shows completed lessons.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lessons_completed INT DEFAULT 0;

-- Backfill from lessons already marked completed.
UPDATE profiles p SET lessons_completed = COALESCE((
  SELECT count(*) FROM lessons l
  JOIN chats c ON c.id = l.chat_id
  WHERE c.user_id = p.id AND l.status = 'completed'
), 0);

-- Protect lessons_completed from client tampering (only service_role / direct DB).
CREATE OR REPLACE FUNCTION protect_profile_columns()
RETURNS TRIGGER AS $$
DECLARE
  r text := COALESCE((SELECT auth.role()), '');
BEGIN
  IF r = '' OR r = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_admin        IS DISTINCT FROM OLD.is_admin
     OR NEW.user_type    IS DISTINCT FROM OLD.user_type
     OR NEW.xp           IS DISTINCT FROM OLD.xp
     OR NEW.streak_days  IS DISTINCT FROM OLD.streak_days
     OR NEW.last_active_date  IS DISTINCT FROM OLD.last_active_date
     OR NEW.lessons_completed IS DISTINCT FROM OLD.lessons_completed THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile columns';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- complete_lesson now also increments lessons_completed on a real completion.
CREATE OR REPLACE FUNCTION complete_lesson(p_user_id uuid, p_chat_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_current int; v_total int; v_next int; v_is_final boolean; v_updated int;
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
  SET xp = COALESCE(v_xp, 0) + 50,
      streak_days = v_new_streak,
      last_active_date = v_today,
      lessons_completed = COALESCE(lessons_completed, 0) + 1
  WHERE id = p_user_id;

  RETURN jsonb_build_object('nextIndex', v_next, 'isFinal', v_is_final,
                            'xpGained', 50, 'newStreak', v_new_streak);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
