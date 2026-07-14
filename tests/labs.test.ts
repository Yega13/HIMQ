import { describe, it, expect } from 'vitest';
import { matchLab, getLab } from '@/lib/labs';

describe('matchLab', () => {
  it('matches a live lab when the text contains one of its topics', () => {
    expect(matchLab('Understanding diodes and resistors')).toBe('circuits');
  });

  it('is case-insensitive', () => {
    expect(matchLab('BREADBOARD basics')).toBe('sandbox');
  });

  it('returns null when nothing matches', () => {
    expect(matchLab('French grammar')).toBeNull();
  });

  it('never returns a "soon" (not-live) lab', () => {
    // "gradient descent" belongs to the ML lab, which is status: 'soon'.
    expect(matchLab('gradient descent loss')).toBeNull();
  });

  it('handles empty/nullish input', () => {
    expect(matchLab('')).toBeNull();
    expect(matchLab(null)).toBeNull();
    expect(matchLab(undefined)).toBeNull();
  });
});

describe('getLab', () => {
  it('returns a lab by id', () => {
    expect(getLab('circuits')?.title).toBeTruthy();
  });

  it('returns undefined for an unknown id', () => {
    expect(getLab('nope')).toBeUndefined();
  });
});
