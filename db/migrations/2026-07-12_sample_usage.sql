-- ============================================================
-- Anonymous "try it" sample-plan limiter — 2026-07-12 (safe to re-run)
-- The logged-out landing "try it" makes a real (paid) AI call with NO account,
-- so it must be rate-limited by IP or it's an open cost hole. This is an atomic
-- per-IP-per-day counter, mirroring consume_daily_message. IPs are stored
-- HASHED (the API route hashes before calling this) — never raw.
-- ============================================================

CREATE TABLE IF NOT EXISTS sample_usage (
  ip_hash    text NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Yerevan')::date,
  count      int  NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, usage_date)
);
-- RLS on with no policies → only the service_role (server) can read/write it.
ALTER TABLE sample_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION consume_sample(p_ip text, p_limit int)
RETURNS jsonb AS $$
DECLARE
  v_date  date := (now() AT TIME ZONE 'Asia/Yerevan')::date;
  v_count int;
BEGIN
  INSERT INTO sample_usage (ip_hash, usage_date, count)
  VALUES (p_ip, v_date, 0)
  ON CONFLICT (ip_hash, usage_date) DO NOTHING;

  SELECT count INTO v_count
  FROM sample_usage
  WHERE ip_hash = p_ip AND usage_date = v_date
  FOR UPDATE;

  IF COALESCE(v_count, 0) >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', COALESCE(v_count, 0));
  END IF;

  UPDATE sample_usage SET count = COALESCE(count, 0) + 1
  WHERE ip_hash = p_ip AND usage_date = v_date;

  RETURN jsonb_build_object('allowed', true, 'count', COALESCE(v_count, 0) + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION consume_sample(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_sample(text, int) TO service_role;
