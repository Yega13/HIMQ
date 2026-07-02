-- ============================================================
-- Atomic server RPCs — 2026-07-02  (safe to run more than once)
-- Fixes concurrency races in rate limiting and lesson completion by moving
-- the check-then-write into single, row-locked DB transactions.
-- Run AFTER 2026-07-02_security_fixes.sql. Only the service_role (our server
-- admin client) may call these; they are revoked from app users.
-- ============================================================

-- ------------------------------------------------------------
-- Atomic per-day message counter. Locks the day's row (FOR UPDATE) so
-- concurrent requests can't both read the same count and exceed the limit.
-- Returns { allowed: bool, count: int }.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_daily_message(p_user_id uuid, p_limit int)
RETURNS jsonb AS $$
DECLARE
  v_date date := (now() AT TIME ZONE 'Asia/Yerevan')::date;
  v_count int;
BEGIN
  INSERT INTO daily_usage (user_id, usage_date, message_count)
  VALUES (p_user_id, v_date, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT message_count INTO v_count
  FROM daily_usage
  WHERE user_id = p_user_id AND usage_date = v_date
  FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count);
  END IF;

  UPDATE daily_usage SET message_count = v_count + 1
  WHERE user_id = p_user_id AND usage_date = v_date;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Atomic lesson completion + XP/streak grant. Runs in one transaction with
-- row locks so double-submits can't double-grant XP or skip lessons.
-- Returns { alreadyCompleted | error | (nextIndex,isFinal,xpGained,newStreak) }.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_lesson(p_user_id uuid, p_chat_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_current    int;
  v_total      int;
  v_next       int;
  v_is_final   boolean;
  v_updated    int;
  v_xp         int;
  v_streak     int;
  v_last       date;
  v_today      date := (now() AT TIME ZONE 'Asia/Yerevan')::date;
  v_new_streak int;
BEGIN
  -- Lock the chat row and verify ownership in one step.
  SELECT current_lesson_index, total_lessons INTO v_current, v_total
  FROM chats WHERE id = p_chat_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- A discovery chat (no plan yet) has no lessons to complete.
  IF COALESCE(v_total, 0) = 0 THEN
    RETURN jsonb_build_object('error', 'no_lessons');
  END IF;

  v_next := v_current + 1;
  v_is_final := v_next >= v_total;

  -- Atomically claim the current lesson. 0 rows updated => it was already
  -- completed by a prior (possibly concurrent) call → no double grant.
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

  UPDATE chats
  SET current_lesson_index = v_next,
      status = CASE WHEN v_is_final THEN 'completed' ELSE 'active' END
  WHERE id = p_chat_id;

  -- Streak + XP (server-authoritative; profiles columns are trigger-protected).
  SELECT xp, streak_days, last_active_date INTO v_xp, v_streak, v_last
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_last IS DISTINCT FROM v_today THEN
    v_new_streak := CASE WHEN v_last = v_today - 1 THEN COALESCE(v_streak, 0) + 1 ELSE 1 END;
  ELSE
    v_new_streak := COALESCE(v_streak, 0);
  END IF;

  UPDATE profiles
  SET xp = COALESCE(v_xp, 0) + 50, streak_days = v_new_streak, last_active_date = v_today
  WHERE id = p_user_id;

  RETURN jsonb_build_object('nextIndex', v_next, 'isFinal', v_is_final,
                            'xpGained', 50, 'newStreak', v_new_streak);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only the server (service_role) may call these; block direct calls from app
-- users (authenticated / anon) via PostgREST.
REVOKE ALL ON FUNCTION consume_daily_message(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_lesson(uuid, uuid)       FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_daily_message(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION complete_lesson(uuid, uuid)       TO service_role;
