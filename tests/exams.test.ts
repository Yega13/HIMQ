import { describe, it, expect } from 'vitest';
import { EXAMS, getExam, examGoal } from '@/lib/exams';

describe('exam registry', () => {
  it('has unique ids and non-empty sections', () => {
    const ids = EXAMS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EXAMS) expect(e.sections.length).toBeGreaterThan(0);
  });

  it('getExam finds by id and returns undefined otherwise', () => {
    expect(getExam('ielts')?.name).toBe('IELTS');
    expect(getExam('nope')).toBeUndefined();
  });
});

describe('examGoal', () => {
  const ielts = getExam('ielts')!;

  it('includes target and date when provided', () => {
    const goal = examGoal(ielts, '7.0', '2026-08-20');
    expect(goal).toContain('IELTS prep');
    expect(goal).toContain('target 7.0');
    expect(goal).toContain('2026-08-20');
    expect(goal).toContain('Listening');
  });

  it('omits target/date when blank but keeps sections', () => {
    const goal = examGoal(ielts, '', '');
    expect(goal).toContain('IELTS prep');
    expect(goal).not.toContain('target');
    expect(goal).not.toContain('by ');
    expect(goal).toContain('sections:');
  });

  it('stays within the create-chat 500-char cap', () => {
    for (const e of EXAMS) {
      expect(examGoal(e, '999', '2026-12-31').length).toBeLessThanOrEqual(500);
    }
  });
});
