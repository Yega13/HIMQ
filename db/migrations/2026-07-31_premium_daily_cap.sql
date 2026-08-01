-- ============================================================
-- Premium (Sonnet) daily message cap — 2026-07-31 (safe to re-run)
-- Caps premium messages per day, independent of the monthly credit pool, so
-- a user can't burn a whole month's credits on Sonnet in under a week.
-- Matches the "N premium messages a day" figures on the pricing page.
-- Shares the daily_usage row consume_daily_message already writes, so this
-- is one extra column, not a second table.
-- Enforcement lives behind CREDIT_METER_ENABLED in the app (lib/credits.ts);
-- applying this migration is inert until the flag is on.
-- Run AFTER 2026-07-02b_atomic_rpcs.sql (daily_usage exists).
-- ============================================================

ALTER TABLE daily_usage ADD COLUMN IF NOT EXISTS premium_count integer NOT NULL DEFAULT 0;

-- Atomic per-day premium counter. Same row-locked (FOR UPDATE) shape as
-- consume_daily_message, just counting a different column so a premium
-- message's daily cap and the plain daily message cap don't share a budget.
CREATE OR REPLACE FUNCTION consume_premium_message(p_user_id uuid, p_limit int)
RETURNS jsonb AS $$
DECLARE
  v_date  date := (now() AT TIME ZONE 'Asia/Yerevan')::date;
  v_count int;
BEGIN
  INSERT INTO daily_usage (user_id, usage_date, message_count, premium_count)
  VALUES (p_user_id, v_date, 0, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT premium_count INTO v_count
  FROM daily_usage
  WHERE user_id = p_user_id AND usage_date = v_date
  FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count);
  END IF;

  UPDATE daily_usage SET premium_count = v_count + 1
  WHERE user_id = p_user_id AND usage_date = v_date;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Server-only, like the other consume_* limiters.
REVOKE ALL ON FUNCTION consume_premium_message(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_premium_message(uuid, int) TO service_role;
