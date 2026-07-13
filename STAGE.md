# HIMQ — Stage & Pitch Reference

> **Living document.** Every time we ship a feature, add it here. This is the single source of truth for what HIMQ *is* and what we can talk about on stage.
> Last updated: 2026-07-13

---

## 1. One-liner

**HIMQ is a bilingual AI learning platform for Armenian students that builds a personalized learning path for any goal — and connects what you learn to real Armenian scholarships, competitions, and internships.**

Live at **himqai.com**. Languages: **English · Русский · Հայերen**.

---

## 2. The problem we solve

- Students don't know **what** to learn or in **what order** to reach a goal.
- Generic online courses aren't personalized — they don't adapt to what you already know.
- Real local opportunities (Armenian scholarships, competitions, internships) are **scattered and hard to find**.
- Nothing connects the two: you learn a skill in one place and hunt for where to use it in another.

**HIMQ unifies both halves: learn the skill → find the opportunity to use it.**

---

## 3. Who it's for

- **Students** — teens & young adults in Armenia, studying in EN / RU / AM.
- **Owners / organizations** — post real opportunities (moderated before they go public).

---

## 4. Core product — the AI tutor "May"

**May (May-1)** is the personal tutor. The full flow:

1. **Discovery** — May asks smart questions **one at a time** (with tappable answer choices) to learn your level, goal, blockers, and how you like to learn.
2. **Personalized plan** — builds a **3–8 lesson** path, each lesson **difficulty-rated (1–5)**, with a one-line "why this lesson is in *your* plan."
3. **Review** — you approve the plan or ask for changes (regenerates with your feedback).
4. **Teaching** — Socratic, 2–4 sentences per turn, **one question at a time**, references what you told it, never dumps walls of text.
5. **Mastery & completion** — May detects when you've genuinely mastered a lesson, unlocks the next, and awards XP.

**What makes it feel great on stage:**
- **Responses stream in live**, word by word — it feels alive, not a loading spinner.
- **Truly personalized** — references your background, skips what you already know.
- **Teaches in your language** — full EN / RU / AM.

---

## 5. Gamification (retention)

- **XP scaled by difficulty** — a hard lesson (5) is worth 100 XP, an easy one (1) is 20. Server-authoritative — **impossible to cheat**.
- **Daily streaks.**
- **Leaderboard** — all-time / **weekly / monthly** (real per-period XP), with **tiers**: Bronze → Silver → Gold → Platinum → Diamond.
- **"Why this plan"** micro-explanations keep learners motivated.

---

## 6. Practice Labs

Interactive, hands-on **sandboxes** embedded in learning (e.g. a **circuit lab** with flowing wires, a live meter, and a bench). Learning by *doing*, not just reading — and matched into relevant lessons.

---

## 7. The opportunities half

- Real Armenian **scholarships, competitions, internships, courses, grants, fellowships, meetups** — in one browsable, filterable place.
- **Owners submit** opportunities → **admin-moderated** before they're public (nothing self-publishes).
- Students can **save** opportunities.
- **The loop (live):** every learning path's **roadmap** and its **"Course Complete!"** screen surface **real opportunities matched to that skill** — "you learned X → here are Armenian opportunities for X." Honest empty state when nothing matches.

---

## 8. "Try it" — no signup

On the landing page, anyone can **type a goal and watch May build a real plan live** — no account. An **animated timeline** lights up step-by-step as the plan generates. Then: "Sign up to save this path." Lets a judge *feel* the product in 10 seconds.

---

## 9. Sign-in

- **Email + password** (with email confirmation).
- **Continue with Google** (one-click OAuth).

---

## 10. Under the hood (for technical judges)

- **Stack:** Next.js 14 (pages router) · Supabase (Postgres) · Anthropic Claude + Google Gemini · Vercel · custom domain.
- **Streaming AI** over Server-Sent Events.
- **Smart model routing** to balance cost & quality: Claude **Sonnet** for plans/opening & Armenian/Russian chat, **Haiku** for English chat (~3× cheaper), **Gemini** as automatic fallback. Plus **prompt caching**.
- **Security (genuinely strong for a first startup):**
  - Row-Level Security on every table.
  - **Atomic, row-locked database functions** for XP grants & rate limits — no race conditions, no double-grants.
  - **Server-authoritative XP** + a column-protection trigger — the browser literally cannot grant itself XP or admin.
  - Server-side admin authorization (real `is_admin`, not a shared password).
  - Input validation & length caps; no secrets in the repo.
- **Cost controls:** daily message limits, per-day chat-creation caps, **IP-rate-limited** public "try it" that **fails closed**, and the model routing above.
- **Performance:** self-hosted fonts (no render-blocking), code-splitting, memoization, pre-paint theme (no flash).
- **Fully trilingual** (EN / RU / AM) UI + AI.

---

## 11. Business model

- **Free during the demo** (generous daily limits).
- **Post-launch:** metered/tiered pricing (see the in-app **Pricing** page). Owners/organizations can pay to feature opportunities.

---

## 12. Why HIMQ wins (differentiators)

1. **Learn + opportunities in ONE place** — the loop nobody else closes.
2. **A real personalized tutor** (discovery → adaptive plan), not another generic course catalog.
3. **Built for Armenia** — local opportunities, Armenian language, local context.
4. **Gamified** for retention, not just a one-time tool.

---

## 13. Suggested demo flow (stage script)

1. **Land on himqai.com** → in "Try it," type a goal → watch the plan build live (no signup). *Hook.*
2. **Sign in with Google** (one click).
3. **Start a real path** → show discovery → the personalized plan → a teaching turn streaming in → complete a lesson → **XP + streak pop**.
4. **Leaderboard** → tiers, weekly ranking.
5. **Opportunities** → browse, then **the loop**: "you learned X → here are real Armenian opportunities for X."
6. **Practice Lab** → the interactive sandbox. *Wow closer.*

---

## 14. Numbers / facts to have ready

- Languages: **3** (EN / RU / AM).
- Lesson plan size: **3–8**, difficulty-calibrated per student.
- Opportunity types: competitions, scholarships, courses, webinars, internships, grants, fellowships, meetups, seminars, summits.
- XP curve: 20 / 35 / 50 / 70 / 100 by difficulty.
- Tiers: Bronze / Silver / Gold / Platinum / Diamond.

---

## 15. Changelog (append every feature)

- **2026-07-13** — Live streaming AI chat; real weekly/monthly leaderboard; Google OAuth; logged-out "try it" with animated timeline; security + performance hardening pass; landing-page redesign.
- **2026-07-13 (later)** — Lessons ↔ opportunities loop live (roadmap + course-complete); honest try-it CTA & opportunity empty states; Labs page "decode" (EncryptedText) header amplifying its terminal identity.
- **2026-07-13 (later 2)** — Animated desktop account menu (avatar morphs into name/email + Profile + Sign out); opportunity matcher ignores year-numbers to cut false matches.
- **2026-07-13 (later 3)** — Pricing cards get a theme-aware cursor-following spotlight glow (CardSpotlight).
- *(add new entries here as we ship)*
