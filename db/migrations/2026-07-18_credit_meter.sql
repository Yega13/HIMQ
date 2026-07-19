-- ============================================================
-- Credit meter — 2026-07-18 (safe to re-run)
-- Monthly, cost-bounded usage budgets per subscription tier. A credit = $0.0005
-- of API cost; each AI action deducts credits keyed to the model that runs, so a
-- tier's monthly cost is capped regardless of model mix. Enforcement lives in the
-- app behind CREDIT_METER_ENABLED (lib/credits.ts) — this migration only provides
-- the storage + atomic accounting. Applying it is inert until the flag is on.
-- Run AFTER 2026-07-02_security_fixes.sql (daily_usage/profiles exist).
-- ============================================================

-- 1. Subscription tier on the profile. Default 'free'; paid tiers set by the
--    founder (Supabase SQL) for now, later by the Polar.sh webhook.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free';

-- 2. Per-user, per-month credit ledger. One row per (user, calendar month); a new
--    month starts fresh simply because no row exists yet for that period. Isolated
--    from profiles so the protect_profile_columns trigger never interferes with
--    high-frequency credit writes.
CREATE TABLE IF NOT EXISTS monthly_credits (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period       date NOT NULL,                 -- first day of the month (Yerevan)
  credits_used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period)
);

-- Data firewall: RLS on, no policies. Only service_role (the server admin client)
-- can touch it; anon/authenticated clients get nothing. The app reads/writes it
-- exclusively through the SECURITY DEFINER functions below or the admin client.
ALTER TABLE monthly_credits ENABLE ROW LEVEL SECURITY;

-- 3. Atomic check-and-deduct. Row-locked (FOR UPDATE) like the other consume_*
--    limiters so concurrent requests can't both read the same balance and overspend.
--    Budget is passed in by the app (tier→budget policy lives in lib/credits.ts),
--    keeping this function generic.
CREATE OR REPLACE FUNCTION consume_credits(p_user_id uuid, p_credits int, p_budget int)
RETURNS jsonb AS $$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'Asia/Yerevan'))::date;
  v_used   int;
BEGIN
  INSERT INTO monthly_credits (user_id, period, credits_used)
  VALUES (p_user_id, v_period, 0)
  ON CONFLICT (user_id, period) DO NOTHING;

  SELECT credits_used INTO v_used
  FROM monthly_credits
  WHERE user_id = p_user_id AND period = v_period
  FOR UPDATE;

  IF COALESCE(v_used, 0) + p_credits > p_budget THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', COALESCE(v_used, 0),
      'budget', p_budget,
      'remaining', GREATEST(p_budget - COALESCE(v_used, 0), 0)
    );
  END IF;

  UPDATE monthly_credits
  SET credits_used = COALESCE(credits_used, 0) + p_credits
  WHERE user_id = p_user_id AND period = v_period;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', COALESCE(v_used, 0) + p_credits,
    'budget', p_budget,
    'remaining', p_budget - (COALESCE(v_used, 0) + p_credits)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Read-only balance for the credits UI (no lock, no deduction). Returns the
--    credits used this month; the app derives remaining = budget - used.
CREATE OR REPLACE FUNCTION credit_status(p_user_id uuid)
RETURNS int AS $$
  SELECT COALESCE((
    SELECT credits_used FROM monthly_credits
    WHERE user_id = p_user_id
      AND period = date_trunc('month', (now() AT TIME ZONE 'Asia/Yerevan'))::date
  ), 0);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Server-only, like the other consume_* limiters.
REVOKE ALL ON FUNCTION consume_credits(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_credits(uuid, int, int) TO service_role;
REVOKE ALL ON FUNCTION credit_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION credit_status(uuid) TO service_role;
