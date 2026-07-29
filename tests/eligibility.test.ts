import { describe, it, expect } from 'vitest';
import {
  assess,
  gapByExam,
  type ProgramSpec,
  type RequiredExam,
} from '@/lib/eligibility';

// ── University (unified exam) fixtures ──────────────────────
const mathOnly: RequiredExam[] = [{ exam: 'unified-math', required: true }];
const mathAndPhysics: RequiredExam[] = [
  { exam: 'unified-math', required: true },
  { exam: 'unified-physics', required: true },
];

const uniProgram = (requiredExams: RequiredExam[]): ProgramSpec => ({
  admissionType: 'unified_exam',
  requiredExams,
});

// ── College (certificate) fixtures ──────────────────────────
const collegeAfter9: ProgramSpec = { admissionType: 'certificate', minEducation: 'grade_9' };
const collegeAfter12: ProgramSpec = { admissionType: 'certificate', minEducation: 'grade_12' };
const collegeNoGate: ProgramSpec = { admissionType: 'certificate', minEducation: null };

describe('assess — university (unified exam)', () => {
  it('returns no_data when there are no cutoffs at all', () => {
    const r = assess({ scores: { 'unified-math': 18 } }, uniProgram(mathOnly), []);
    expect(r.verdict).toBe('no_data');
    expect(r.admissionType).toBe('unified_exam');
    expect(r.reference).toBeNull();
  });

  it('compares against the HIGHEST of the recent years, not the average', () => {
    const r = assess({ scores: { 'unified-math': 16 } }, uniProgram(mathOnly), [
      { year: 2025, cutoff_score: 15.0 },
      { year: 2024, cutoff_score: 16.5 },
      { year: 2023, cutoff_score: 14.0 },
    ]);
    expect(r.reference).toBe(16.5);
    expect(r.verdict).toBe('reach');
    expect(r.gap).toBe(0.5);
  });

  it('ignores years older than the three most recent', () => {
    const r = assess({ scores: { 'unified-math': 16 } }, uniProgram(mathOnly), [
      { year: 2025, cutoff_score: 15 },
      { year: 2024, cutoff_score: 15 },
      { year: 2023, cutoff_score: 15 },
      { year: 2019, cutoff_score: 19 },
    ]);
    expect(r.reference).toBe(15);
    expect(r.yearsUsed).toEqual([2025, 2024, 2023]);
  });

  it('sorts unordered cutoff rows by year before slicing', () => {
    const r = assess({ scores: { 'unified-math': 16 } }, uniProgram(mathOnly), [
      { year: 2019, cutoff_score: 19 },
      { year: 2025, cutoff_score: 15 },
      { year: 2023, cutoff_score: 15 },
      { year: 2024, cutoff_score: 15 },
    ]);
    expect(r.yearsUsed).toEqual([2025, 2024, 2023]);
  });

  it('grades every verdict at its boundary', () => {
    const c = [{ year: 2025, cutoff_score: 15 }];
    expect(assess({ scores: { 'unified-math': 16.5 } }, uniProgram(mathOnly), c).verdict).toBe('safe');
    expect(assess({ scores: { 'unified-math': 15.0 } }, uniProgram(mathOnly), c).verdict).toBe('likely');
    expect(assess({ scores: { 'unified-math': 13.0 } }, uniProgram(mathOnly), c).verdict).toBe('reach');
    expect(assess({ scores: { 'unified-math': 12.9 } }, uniProgram(mathOnly), c).verdict).toBe('unlikely');
  });

  it('reports no gap when the student is at or above the reference', () => {
    const r = assess({ scores: { 'unified-math': 15 } }, uniProgram(mathOnly), [
      { year: 2025, cutoff_score: 15 },
    ]);
    expect(r.gap).toBeNull();
  });

  it('sums across every required exam', () => {
    const r = assess(
      { scores: { 'unified-math': 16, 'unified-physics': 14 } },
      uniProgram(mathAndPhysics),
      [{ year: 2025, cutoff_score: 28 }],
    );
    expect(r.total).toBe(30);
    expect(r.verdict).toBe('safe');
  });

  it('reports missing exams and counts them as zero', () => {
    const r = assess({ scores: { 'unified-math': 16 } }, uniProgram(mathAndPhysics), [
      { year: 2025, cutoff_score: 28 },
    ]);
    expect(r.missingExams).toEqual(['unified-physics']);
    expect(r.total).toBe(16);
    expect(r.verdict).toBe('unlikely');
  });

  it('ignores exams that are not required', () => {
    const r = assess(
      { scores: { 'unified-math': 16, 'unified-physics': 20 } },
      uniProgram([
        { exam: 'unified-math', required: true },
        { exam: 'unified-physics', required: false },
      ]),
      [{ year: 2025, cutoff_score: 15 }],
    );
    expect(r.total).toBe(16);
    expect(r.missingExams).toEqual([]);
  });

  it('skips years whose cutoff was never published', () => {
    const r = assess({ scores: { 'unified-math': 16 } }, uniProgram(mathOnly), [
      { year: 2025, cutoff_score: null },
      { year: 2024, cutoff_score: 15 },
    ]);
    expect(r.reference).toBe(15);
    expect(r.yearsUsed).toEqual([2024]);
  });

  it('accepts numeric() values arriving from Postgres as strings', () => {
    const r = assess({ scores: { 'unified-math': 16 } }, uniProgram(mathOnly), [
      { year: 2025, cutoff_score: '15.50' },
    ]);
    expect(r.reference).toBe(15.5);
    expect(r.verdict).toBe('likely');
  });

  it('rounds the gap to two decimals', () => {
    // 15 - 12.333 = 2.667, which must not surface as 2.6670000000000016.
    const r = assess({ scores: { 'unified-math': 12.333 } }, uniProgram(mathOnly), [
      { year: 2025, cutoff_score: 15 },
    ]);
    expect(r.gap).toBe(2.67);
  });

  it('treats an entirely absent scores object as all-zero', () => {
    const r = assess({}, uniProgram(mathOnly), [{ year: 2025, cutoff_score: 15 }]);
    expect(r.total).toBe(0);
    expect(r.missingExams).toEqual(['unified-math']);
    expect(r.verdict).toBe('unlikely');
  });
});

describe('assess — college (certificate)', () => {
  it('blocks a grade-9 leaver from a programme that admits from grade 12', () => {
    const r = assess({ educationLevel: 'grade_9' }, collegeAfter12, []);
    expect(r.verdict).toBe('not_eligible');
    expect(r.admissionType).toBe('certificate');
    expect(r.blockedReason).toBeTruthy();
  });

  it('lets a grade-12 leaver into a programme that admits from grade 9', () => {
    const r = assess({ educationLevel: 'grade_12' }, collegeAfter9, []);
    expect(r.verdict).toBe('eligible');
  });

  it('asks for the education level when it is unknown', () => {
    const r = assess({}, collegeAfter9, []);
    expect(r.verdict).toBe('no_data');
    expect(r.blockedReason).toBeTruthy();
  });

  it('skips the gate when the programme sets no minimum education', () => {
    const r = assess({}, collegeNoGate, []);
    expect(r.verdict).toBe('eligible');
  });

  it('is eligible when the gate passes and nothing is oversubscribed', () => {
    const r = assess({ educationLevel: 'grade_9', certificateAverage: 12 }, collegeAfter9, []);
    expect(r.verdict).toBe('eligible');
    expect(r.reference).toBeNull();
  });

  it('asks for a certificate average only when the programme is competitive', () => {
    const r = assess({ educationLevel: 'grade_9' }, collegeAfter9, [
      { year: 2025, cutoff_score: 14 },
    ]);
    expect(r.verdict).toBe('no_data');
    expect(r.reference).toBe(14);
    expect(r.blockedReason).toBeTruthy();
  });

  it('ranks a competitive programme on the certificate average', () => {
    const cutoffs = [{ year: 2025, cutoff_score: 14 }];
    expect(
      assess({ educationLevel: 'grade_9', certificateAverage: 16 }, collegeAfter9, cutoffs).verdict,
    ).toBe('safe');
    expect(
      assess({ educationLevel: 'grade_9', certificateAverage: 14 }, collegeAfter9, cutoffs).verdict,
    ).toBe('likely');
    expect(
      assess({ educationLevel: 'grade_9', certificateAverage: 12.5 }, collegeAfter9, cutoffs).verdict,
    ).toBe('reach');
    expect(
      assess({ educationLevel: 'grade_9', certificateAverage: 10 }, collegeAfter9, cutoffs).verdict,
    ).toBe('unlikely');
  });

  it('reports the shortfall against the certificate cutoff', () => {
    const r = assess({ educationLevel: 'grade_9', certificateAverage: 12 }, collegeAfter9, [
      { year: 2025, cutoff_score: 14.5 },
    ]);
    expect(r.gap).toBe(2.5);
    expect(r.total).toBe(12);
  });

  it('never reports missing exams for a certificate programme', () => {
    const r = assess({ educationLevel: 'grade_12' }, collegeAfter12, []);
    expect(r.missingExams).toEqual([]);
  });

  it('fails the gate even when the certificate average is excellent', () => {
    const r = assess({ educationLevel: 'grade_9', certificateAverage: 20 }, collegeAfter12, [
      { year: 2025, cutoff_score: 10 },
    ]);
    expect(r.verdict).toBe('not_eligible');
  });
});

describe('gapByExam', () => {
  it('weights the shortfall toward the exam with more headroom', () => {
    const out = gapByExam({ 'unified-math': 10, 'unified-physics': 18 }, mathAndPhysics, 4);
    const math = out.find((o) => o.exam === 'unified-math')!;
    const phys = out.find((o) => o.exam === 'unified-physics')!;
    expect(math.suggestedTarget - math.current).toBeGreaterThan(phys.suggestedTarget - phys.current);
  });

  it('never suggests a target above the 20-point ceiling', () => {
    const out = gapByExam({ 'unified-math': 19.5 }, mathOnly, 3);
    expect(out[0].suggestedTarget).toBeLessThanOrEqual(20);
  });

  it('rounds targets to the nearest half point', () => {
    const out = gapByExam({ 'unified-math': 12 }, mathOnly, 2.1);
    expect(out[0].suggestedTarget * 2).toBe(Math.round(out[0].suggestedTarget * 2));
  });

  it('returns nothing when there is no gap to close', () => {
    expect(gapByExam({ 'unified-math': 18 }, mathOnly, 0)).toEqual([]);
    expect(gapByExam({ 'unified-math': 18 }, mathOnly, -1)).toEqual([]);
  });

  it('treats a missing score as zero rather than dropping the exam', () => {
    const out = gapByExam({}, mathOnly, 5);
    expect(out).toHaveLength(1);
    expect(out[0].current).toBe(0);
    expect(out[0].suggestedTarget).toBeGreaterThan(0);
  });

  it('splits evenly when no exam has headroom left', () => {
    const out = gapByExam({ 'unified-math': 20, 'unified-physics': 20 }, mathAndPhysics, 4);
    expect(out).toHaveLength(2);
    for (const o of out) expect(o.suggestedTarget).toBe(20);
  });
});
