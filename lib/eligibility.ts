// ── Eligibility assessment ───────────────────────────────────────────────────
// Armenian university admission is COMPETITIVE: a program's passing score
// (անցողիկ միավոր) is set each year by that year's applicant pool and places,
// not fixed in advance. So we never claim a requirement — we compare the
// student's total against the HIGHEST cutoff of the last three years, because
// an honest forecast plans for a bad year rather than a lucky one.
//
// Deliberately pure and AI-free: this number is one a student plans their year
// around, so it must be deterministic, instant, free, and unit-testable.
// Do not route this through the model.

export type Verdict = 'safe' | 'likely' | 'reach' | 'unlikely' | 'no_data';

export interface RequiredExam {
  exam: string;       // matches an id in lib/exams.ts, e.g. 'unified-math'
  required: boolean;
}

export interface Cutoff {
  year: number;
  cutoff_score: number | string | null;  // numeric() arrives as a string from PG
}

export interface Assessment {
  verdict: Verdict;
  /** Points still needed. null when already at or above the reference. */
  gap: number | null;
  /** The cutoff compared against — the highest of the recent years used. */
  reference: number | null;
  yearsUsed: number[];
  /** Required exams the student hasn't entered a score for yet. */
  missingExams: string[];
  /** Sum of the student's scores across this program's required exams. */
  total: number;
}

/** How many recent years of cutoffs feed the forecast. */
const RECENT_YEARS = 3;

/** Armenia's unified-exam ceiling — a suggested target can never exceed it. */
const MAX_EXAM_SCORE = 20;

export function assess(
  studentScores: Record<string, number>,
  requiredExams: RequiredExam[],
  cutoffs: Cutoff[],
): Assessment {
  const required = requiredExams.filter((e) => e.required);

  const missingExams = required
    .filter((e) => typeof studentScores[e.exam] !== 'number')
    .map((e) => e.exam);

  // A missing score counts as zero rather than being skipped — otherwise a
  // student with one exam entered would look artificially competitive.
  const total = required.reduce(
    (sum, e) => sum + (typeof studentScores[e.exam] === 'number' ? studentScores[e.exam] : 0),
    0,
  );

  const usable = cutoffs
    .filter((c) => c.cutoff_score !== null && c.cutoff_score !== undefined)
    .map((c) => ({ year: c.year, score: Number(c.cutoff_score) }))
    .filter((c) => Number.isFinite(c.score))
    .sort((a, b) => b.year - a.year)
    .slice(0, RECENT_YEARS);

  if (usable.length === 0) {
    return { verdict: 'no_data', gap: null, reference: null, yearsUsed: [], missingExams, total };
  }

  const reference = Math.max(...usable.map((c) => c.score));
  const delta = total - reference;

  const verdict: Verdict =
    delta >= 1.5 ? 'safe'
    : delta >= 0 ? 'likely'
    : delta >= -2 ? 'reach'
    : 'unlikely';

  return {
    verdict,
    gap: delta >= 0 ? null : Math.round(Math.abs(delta) * 100) / 100,
    reference,
    yearsUsed: usable.map((c) => c.year),
    missingExams,
    total,
  };
}

export interface ExamGap {
  exam: string;
  current: number;
  /** Target to aim for in this exam, rounded to the nearest 0.5. */
  suggestedTarget: number;
}

/**
 * Split a total shortfall across the required exams so the UI can say WHICH
 * exam to work on. Weighted by headroom: gaining 3 points on a 10 is far more
 * achievable than on an 18, so the weaker exam absorbs more of the gap.
 */
export function gapByExam(
  studentScores: Record<string, number>,
  requiredExams: RequiredExam[],
  gap: number,
): ExamGap[] {
  const required = requiredExams.filter((e) => e.required);
  if (required.length === 0 || gap <= 0) return [];

  const scored = required.map((e) => ({
    exam: e.exam,
    current: typeof studentScores[e.exam] === 'number' ? studentScores[e.exam] : 0,
  }));

  const headroom = scored.map((s) => Math.max(0, MAX_EXAM_SCORE - s.current));
  const totalHeadroom = headroom.reduce((a, b) => a + b, 0);

  return scored.map((s, i) => {
    const share = totalHeadroom > 0
      ? (headroom[i] / totalHeadroom) * gap
      : gap / scored.length;
    // Round up to the next 0.5 — a target below the needed gain is useless.
    const target = Math.min(MAX_EXAM_SCORE, Math.ceil((s.current + share) * 2) / 2);
    return { exam: s.exam, current: s.current, suggestedTarget: target };
  });
}

/** Colour/label key for the UI. Kept here so the mapping lives with the logic. */
export const VERDICT_ORDER: Verdict[] = ['safe', 'likely', 'reach', 'unlikely', 'no_data'];
