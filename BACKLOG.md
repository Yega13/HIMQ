# EduPath Backlog

## UX Polish
- [x] Profile page: after saving, sync `full_name` to Supabase `user_metadata` — DONE Day 4
- [x] Auth page: after sign-in, if there's a `?next=` param in URL, redirect there — DONE Day 4
- [ ] Add skeleton loaders to: profile page, opportunities list, leaderboard
- [x] Mobile: bottom nav active state highlight — DONE Day 5

## Content
- [ ] Replace picsum.photos placeholder image in hero with a real photo of Armenian students
- [ ] Add a proper About / Pitch page (linked from "Beta — Free during SSS Demo" badge)
- [ ] Add more events to the `events` table (currently only 8 seed rows)
- [x] Armenian translations for leaderboard page — DONE Day 6

## Features
- [x] Streak system: increment `streak_days` when user completes a lesson on a new calendar day — DONE Day 4
- [x] Owner: let event organizers submit events (`/owner/submit-event`) — DONE Day 4
- [x] Admin panel: approve/reject submitted events (`/admin`) — DONE Day 4
- [x] Roadmap page (`/roadmap/[chatId]`): visual timeline of lessons — DONE Day 4
- [x] Rate limiting on `/api/chat` — 50 msg/day — DONE Day 4
- [ ] Rate limiting on `/api/create-chat` (plan generation)
- [ ] Error monitoring (Sentry or similar)
- [ ] Email confirmation flow for sign-up (UX guidance after account creation)

## Infrastructure
- [ ] Run migration for rate limiting + streaks:
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_date date;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_messages_used integer DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_message_date date;
  ```
- [ ] Add INSERT RLS policy on `events` table for authenticated users (needed for owner submit-event)
- [ ] Add `ADMIN_PASSWORD` to Vercel env vars (defaults to `edupath2026` — change it!)
