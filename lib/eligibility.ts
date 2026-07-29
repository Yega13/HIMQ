// ── Eligibility assessment ───────────────────────────────────────────────────
// Armenia runs TWO different admission systems, and conflating them produces
// wrong answers:
//
//   UNIVERSITY (bachelor) — the applicant sits unified state exams and is ranked
//     competitively. The passing score (անցողիկ միավոր) is set each year by that
//     year's applicant pool and places, so we never claim a fixed requirement:
//     we forecast against the HIGHEST cutoff of the last three years, because an
//     honest forecast plans for a bad year rather than a lucky one.
//
//   COLLEGE (միջին մասնագիտական) — the applicant applies with their school
//     certificate (կրթության վկայական) via hayt-college.emis.am. No unified
//     exams. Eligibility is first a hard gate (did you finish the required
//     grade?) and only then, where a programme is oversubscribed, a ranking on
//     certificate average.
//
// Deliberately pure and AI-free: these are numbers a student plans their year
// around, so they must be deterministic, instant, free and unit-testable.
// Do not route this through the model.

export type AdmissionType = 'unified_exam' | 'certificate';

export type EducationLevel = 'grade_9' | 'grade_12';

export type Verdict =
  | 'safe'          // comfortably above the recent cutoff
  | 'likely'        // at or just above it
  | 'reach'         // within ~2 points below
  | 'unlikely'      // well below
  | 'eligible'      // certificate programme: gate met, no competition data
  | 'not_eligible'  // a hard requirement is not met at all
  | 'no_data';      // we have no cutoff history to judge against

export interface RequiredExam {
  exam: string;       // matches an id in lib/exams.ts, e.g. 'unified-math'
  required: boolean;
}

export interface Cutoff {
  year: number;
  /** numeric() arrives from Postgres as a string. */
  cutoff_score: number | string | null;
}

export interface ProgramSpec {
  admissionType: AdmissionType;
  /** unified_exam programmes only. */
  requiredExams?: RequiredExam[];
  /** certificate programmes only — the schooling the applicant must have finished. */
  minEducation?: EducationLevel | null;
}

export interface StudentProfile {
  /** Unified exam scores, keyed by exam id. */
  scores?: Record<string, number>;
  /** Highest schooling finished — drives certificate-programme eligibility. */
  educationLevel?: EducationLevel | null;
  /** School certificate average on the 20-point scale. */
  certificateAverage?: number | null;
}

export interface Assessment {
  verdict: Verdict;
  admissionType: AdmissionType;
  /** Points still needed. null when already at/above, or not applicable. */
  gap: number | null;
  /** The cutoff compared against — highest of the recent years used. */
  reference: number | null;
  yearsUsed: number[];
  /** Required exams the student hasn't entered a score for (unified_exam only). */
  missingExams: string[];
  /** The student's comparable figure: exam total, or certificate average. */
  total: number;
  /** Plain-language reason when the verdict is not_eligible. */
  blockedReason?: string;
}

/** How many recent years of cutoffs feed the forecast. */
const RECENT_YEARS = 3;

/** Armenia's unified-exam and certificate ceiling. */
const MAX_SCORE = 20;

/** grade_12 satisfies a grade_9 requirement, but not the reverse. */
const EDUCATION_RANK: Record<EducationLevel, number> = { grade_9: 1, grade_12: 2 };

/** Recent, usable cutoffs — newest first, unpublished years dropped. */
function recentCutoffs(cutoffs: Cutoff[]): { year: number; score: number }[] {
  return cutoffs
    .filter((c) => c.cutoff_score !== null && c.cutoff_score !== undefined)
    .map((c) => ({ year: c.year, score: Number(c.cutoff_score) }))
    .filter((c) => Number.isFinite(c.score))
    .sort((a, b) => b.year - a.year)
    .slice(0, RECENT_YEARS);
}

function gradeVerdict(delta: number): Verdict {
  return delta >= 1.5 ? 'safe'
    : delta >= 0 ? 'likely'
    : delta >= -2 ? 'reach'
    : 'unlikely';
}

export function assess(
  student: StudentProfile,
  program: ProgramSpec,
  cutoffs: Cutoff[],
): Assessment {
  return program.admissionType === 'certificate'
    ? assessCertificate(student, program, cutoffs)
    : assessUnifiedExam(student, program, cutoffs);
}

// ── University path: unified exam totals vs. competitive cutoffs ─────────────
function assessUnifiedExam(
  student: StudentProfile,
  program: ProgramSpec,
  cutoffs: Cutoff[],
): Assessment {
  const scores = student.scores ?? {};
  const required = (program.requiredExams ?? []).filter((e) => e.required);

  const missingExams = required
    .filter((e) => typeof scores[e.exam] !== 'number')
    .map((e) => e.exam);

  // A missing score counts as zero rather than being skipped — otherwise a
  // student with one exam entered would look artificially competitive.
  const total = required.reduce(
    (sum, e) => sum + (typeof scores[e.exam] === 'number' ? scores[e.exam] : 0),
    0,
  );

  const usable = recentCutoffs(cutoffs);
  if (usable.length === 0) {
    return {
      verdict: 'no_data', admissionType: 'unified_exam',
      gap: null, reference: null, yearsUsed: [], missingExams, total,
    };
  }

  const reference = Math.max(...usable.map((c) => c.score));
  const delta = total - reference;

  return {
    verdict: gradeVerdict(delta),
    admissionType: 'unified_exam',
    gap: delta >= 0 ? null : Math.round(Math.abs(delta) * 100) / 100,
    reference,
    yearsUsed: usable.map((c) => c.year),
    missingExams,
    total,
  };
}

// ── College path: education gate first, then ranking if oversubscribed ───────
function assessCertificate(
  student: StudentProfile,
  program: ProgramSpec,
  cutoffs: Cutoff[],
): Assessment {
  const total = typeof student.certificateAverage === 'number' ? student.certificateAverage : 0;
  const base = {
    admissionType: 'certificate' as const,
    missingExams: [] as string[],
    total,
  };

  // Hard gate: the applicant must have finished the required schooling. This is
  // pass/fail, not a ranking — no certificate average rescues a missing grade.
  const needed = program.minEducation;
  if (needed) {
    if (!student.educationLevel) {
      return {
        ...base, verdict: 'no_data', gap: null, reference: null, yearsUsed: [],
        blockedReason: 'We need to know which grade you finished to check this programme.',
      };
    }
    if (EDUCATION_RANK[student.educationLevel] < EDUCATION_RANK[needed]) {
      return {
        ...base, verdict: 'not_eligible', gap: null, reference: null, yearsUsed: [],
        blockedReason: needed === 'grade_12'
          ? 'This programme admits from grade 12; you have finished grade 9.'
          : 'This programme requires finishing grade 9 first.',
      };
    }
  }

  // Gate passed. Rank only where the programme has published cutoffs — most
  // colleges admit everyone eligible, so no cutoffs means eligible, not unknown.
  const usable = recentCutoffs(cutoffs);
  if (usable.length === 0) {
    return { ...base, verdict: 'eligible', gap: null, reference: null, yearsUsed: [] };
  }

  // Oversubscribed programme: we can only rank with a certificate average.
  if (typeof student.certificateAverage !== 'number') {
    return {
      ...base, verdict: 'no_data',
      gap: null,
      reference: Math.max(...usable.map((c) => c.score)),
      yearsUsed: usable.map((c) => c.year),
      blockedReason: 'This programme is competitive — add your certificate average to see where you stand.',
    };
  }

  const reference = Math.max(...usable.map((c) => c.score));
  const delta = student.certificateAverage - reference;

  return {
    ...base,
    verdict: gradeVerdict(delta),
    gap: delta >= 0 ? null : Math.round(Math.abs(delta) * 100) / 100,
    reference,
    yearsUsed: usable.map((c) => c.year),
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
 *
 * Unified-exam programmes only — a certificate average isn't studied for
 * exam-by-exam, so there is nothing to split.
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

  const headroom = scored.map((s) => Math.max(0, MAX_SCORE - s.current));
  const totalHeadroom = headroom.reduce((a, b) => a + b, 0);

  return scored.map((s, i) => {
    const share = totalHeadroom > 0
      ? (headroom[i] / totalHeadroom) * gap
      : gap / scored.length;
    // Round up to the next 0.5 — a target below the needed gain is useless.
    const target = Math.min(MAX_SCORE, Math.ceil((s.current + share) * 2) / 2);
    return { exam: s.exam, current: s.current, suggestedTarget: target };
  });
}

/** Display order for grouping results in the UI, best outcome first. */
export const VERDICT_ORDER: Verdict[] = [
  'safe', 'likely', 'eligible', 'reach', 'unlikely', 'not_eligible', 'no_data',
];
