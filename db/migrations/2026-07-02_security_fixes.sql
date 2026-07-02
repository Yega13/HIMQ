-- ============================================================
-- Security migration — 2026-07-02
-- Run this in the Supabase SQL editor (or via db:migrate) against
-- the live project. Safe to run more than once (idempotent).
-- ============================================================

-- Safety net: make sure the daily_usage table the rate limiter needs exists.
-- CREATE TABLE IF NOT EXISTS = only creates it if it's missing; does nothing
-- if it's already there.
CREATE TABLE IF NOT EXISTS daily_usage (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date    DATE        NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Yerevan')::DATE,
  message_count INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- C1: Stop users from escalating privileges / faking XP via the
-- self-update RLS policy. The "Users can update own profile"
-- policy (USING auth.uid() = id) lets a user update ANY column on
-- their own row, including is_admin, user_type, xp, streak_days.
-- A BEFORE UPDATE trigger rejects changes to those columns unless
-- the caller is the service_role (our server-side admin client).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_profile_columns()
RETURNS TRIGGER AS $$
DECLARE
  r text := COALESCE((SELECT auth.role()), '');
BEGIN
  -- Allow the server admin client (service_role) AND direct DB access
  -- (SQL editor / superuser, which has no JWT role → empty string).
  -- Only the app's client-facing roles (authenticated / anon) are blocked.
  IF r = '' OR r = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin        IS DISTINCT FROM OLD.is_admin
     OR NEW.user_type    IS DISTINCT FROM OLD.user_type
     OR NEW.xp           IS DISTINCT FROM OLD.xp
     OR NEW.streak_days  IS DISTINCT FROM OLD.streak_days
     OR NEW.last_active_date IS DISTINCT FROM OLD.last_active_date THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile columns (is_admin, user_type, xp, streak_days, last_active_date)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON profiles;
CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_columns();

-- ------------------------------------------------------------
-- H6 (defense): prevent duplicate lesson rows per chat so a
-- double-fired plan generation can't insert two lesson sets.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lessons_chat_index
  ON lessons(chat_id, lesson_index);

-- ------------------------------------------------------------
-- L3 (perf): indexes for user-scoped / hot lookups that were missing.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_daily_usage_user        ON daily_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_status       ON chats(user_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created   ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_xp             ON profiles(xp DESC);
