-- ============================================================
-- Plan-update rate limit — 2026-07-04 (safe to re-run)
-- Limits "Update plan" (feedback regeneration) to N per day per user, so it
-- can't be spammed (each regeneration is a full paid AI call).
-- ============================================================

ALTER TABLE daily_usage ADD COLUMN IF NOT EXISTS plan_updates INT DEFAULT 0;

CREATE OR REPLACE FUNCTION consume_plan_update(p_user_id uuid, p_limit int)
RETURNS jsonb AS $$
DECLARE
  v_date date := (now() AT TIME ZONE 'Asia/Yerevan')::date;
  v_count int;
BEGIN
  INSERT INTO daily_usage (user_id, usage_date, plan_updates)
  VALUES (p_user_id, v_date, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT plan_updates INTO v_count
  FROM daily_usage WHERE user_id = p_user_id AND usage_date = v_date FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count);
  END IF;

  UPDATE daily_usage SET plan_updates = v_count + 1
  WHERE user_id = p_user_id AND usage_date = v_date;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION consume_plan_update(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_plan_update(uuid, int) TO service_role;
