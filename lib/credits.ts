// ── Credit meter ─────────────────────────────────────────────────────────────
// Monthly, cost-bounded usage budgets per subscription tier. A "credit" is a
// fixed slice of API cost (1 credit = $0.0005), so a tier's monthly cost is
// capped no matter which model runs. Each AI action deducts credits keyed to the
// model that actually runs (Gemini is cheap, May-1/Sonnet is premium).
//
// GATED by CREDIT_METER_ENABLED. When OFF (the demo default) every function here
// is a no-op that preserves today's behavior: the request's model is honored,
// nothing is deducted, and the existing DAILY_LIMIT caps stay in charge. Turn it
// ON only AFTER applying db/migrations/2026-07-18_credit_meter.sql and assigning
// tiers (profiles.tier). All the numbers below live in one place on purpose —
// tune budgets/costs here without touching the routes.
//
// This module is client-safe: the constants/pure functions can be imported by UI
// code; the async helpers take the server admin client as a parameter (the
// supabase import below is type-only, erased at build, so nothing server-side is
// bundled into the client).

import type { ModelId } from './models';
import type { getAdminClient } from './supabase';

type Admin = ReturnType<typeof getAdminClient>;

export const CREDIT_METER_ENABLED = process.env.CREDIT_METER_ENABLED === 'true';

export type Tier = 'free' | 'student' | 'pro' | 'max';

// Monthly credit budget per tier. 1 credit = $0.0005 API cost, so the right
// column is the worst-case monthly AI cost if a user drains their whole budget:
//   free 400 → $0.20 · student 4,000 → $2.00 · pro 15,000 → $7.50 · max 30,000 → $15.00
//
// ⚠️ TEMPORARY TESTING VALUES — shrunk so the "out of credits" wall hits in a few
// messages. REVERT to { free: 400, student: 4000, pro: 15000, max: 30000 } before
// real use. A paid budget of 160 = one plan (110) + ~2 Sonnet messages (20 each);
// free 15 = one Gemini plan (10) + ~5 Gemini messages.
export const TIER_BUDGET: Record<Tier, number> = {
  free: 15,
  student: 160,
  pro: 160,
  max: 160,
};

// Credit cost of one chat message, by the model that runs.
// may1 = Sonnet 5 (~$0.010/msg with prompt caching + the 12-msg history window
//        → ~20 credits). gemini = Gemini Flash (~$0.0005 → 1 credit).
export const MSG_COST: Record<ModelId, number> = { may1: 20, gemini: 1 };

// Credit cost of generating a full learning/exam plan (one large call).
export const PLAN_COST: Record<ModelId, number> = { may1: 110, gemini: 10 };

export function normalizeTier(v: unknown): Tier {
  return v === 'student' || v === 'pro' || v === 'max' ? v : 'free';
}

// Free tier is Gemini-only (grey May). Paid tiers unlock May-1 (Sonnet).
export function tierAllowsClaude(tier: Tier): boolean {
  return tier !== 'free';
}

// The model that will actually run. When the meter is on, a Gemini-only tier is
// forced to Gemini regardless of what was requested; otherwise the request wins.
// With the meter off (demo), the request is always honored.
export function effectiveModel(tier: Tier, requested: ModelId): ModelId {
  if (!CREDIT_METER_ENABLED) return requested;
  return tierAllowsClaude(tier) ? requested : 'gemini';
}

export interface CreditGate {
  enabled: boolean;   // is the meter active at all?
  allowed: boolean;   // may the caller proceed?
  used?: number;
  budget?: number;
  remaining?: number;
  error?: boolean;    // true when an infra failure made us fail closed
}

// Resolve the caller's tier. Skips the DB read entirely when the meter is off so
// the demo path stays a single query lighter.
export async function resolveTier(admin: Admin, userId: string): Promise<Tier> {
  if (!CREDIT_METER_ENABLED) return 'free';
  const { data } = await admin.from('profiles').select('tier').eq('id', userId).single();
  return normalizeTier((data as { tier?: unknown } | null)?.tier);
}

// Atomically check-and-deduct `credits` from this month's budget. Fails CLOSED on
// an infra error (credits are money — better to block than overspend); the caller
// only turns the meter on after the migration is applied, so that path is stable.
export async function consumeCredits(
  admin: Admin, userId: string, tier: Tier, credits: number,
): Promise<CreditGate> {
  if (!CREDIT_METER_ENABLED) return { enabled: false, allowed: true };
  const budget = TIER_BUDGET[tier];
  const { data, error } = await admin.rpc('consume_credits', {
    p_user_id: userId, p_credits: credits, p_budget: budget,
  });
  if (error) {
    console.error('consume_credits RPC failed:', error);
    return { enabled: true, allowed: false, error: true, budget };
  }
  const r = (data ?? {}) as { allowed?: boolean; used?: number; remaining?: number };
  return { enabled: true, allowed: !!r.allowed, used: r.used, budget, remaining: r.remaining };
}

// Read-only snapshot for the credits UI (no deduction).
export interface CreditStatus {
  enabled: boolean;
  tier: Tier;
  budget: number;
  used: number;
  remaining: number;
  geminiOnly: boolean;
}

export async function creditStatus(admin: Admin, userId: string, tier: Tier): Promise<CreditStatus> {
  const budget = TIER_BUDGET[tier];
  if (!CREDIT_METER_ENABLED) {
    return { enabled: false, tier, budget, used: 0, remaining: budget, geminiOnly: false };
  }
  const { data } = await admin.rpc('credit_status', { p_user_id: userId });
  const used = Number(data) || 0;
  return {
    enabled: true, tier, budget, used,
    remaining: Math.max(budget - used, 0),
    geminiOnly: !tierAllowsClaude(tier),
  };
}
