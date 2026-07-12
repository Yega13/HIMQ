-- ============================================================
-- Per-day chat-creation limit — 2026-07-11 (safe to re-run)
-- Closes a cost-abuse hole: /api/create-chat makes a paid Sonnet "opening
-- question" call that was NOT counted against any limit, and the 10-active-chat
-- cap is bypassable by create→delete loops. This adds an atomic per-day
-- creation counter (separate from the message counter) on daily_usage.
-- Run AFTER 2026-07-02_security_fixes.sql (which creates daily_usage).
-- ============================================================

ALTER TABLE daily_usage ADD COLUMN IF NOT EXISTS chat_creates INTEGER DEFAULT 0;

-- Atomic check-and-increment, row-locked like consume_daily_message so
-- concurrent creates can't both slip past the cap.
CREATE OR REPLACE FUNCTION consume_chat_create(p_user_id uuid, p_limit int)
RETURNS jsonb AS $$
DECLARE
  v_date  date := (now() AT TIME ZONE 'Asia/Yerevan')::date;
  v_count int;
BEGIN
  INSERT INTO daily_usage (user_id, usage_date, chat_creates)
  VALUES (p_user_id, v_date, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT chat_creates INTO v_count
  FROM daily_usage
  WHERE user_id = p_user_id AND usage_date = v_date
  FOR UPDATE;

  IF COALESCE(v_count, 0) >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', COALESCE(v_count, 0));
  END IF;

  UPDATE daily_usage SET chat_creates = COALESCE(chat_creates, 0) + 1
  WHERE user_id = p_user_id AND usage_date = v_date;

  RETURN jsonb_build_object('allowed', true, 'count', COALESCE(v_count, 0) + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Server-only, like the other consume_* limiters.
REVOKE ALL ON FUNCTION consume_chat_create(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_chat_create(uuid, int) TO service_role;
