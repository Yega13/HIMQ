-- ============================================================
-- Profile banner image — 2026-07-22 (safe to re-run)
-- Lets users replace the flat gradient banner on their profile page with
-- their own photo, same data-URI-in-column pattern as the existing avatar_url.
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url text;
