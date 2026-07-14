import { describe, it, expect } from 'vitest';
import { cn, truncate, languageName } from '@/lib/utils';

describe('languageName', () => {
  it('maps app locales to AI-prompt language names', () => {
    expect(languageName('am')).toContain('Armenian');
    expect(languageName('ru')).toContain('Russian');
    expect(languageName('en')).toBe('English');
    expect(languageName(undefined)).toBe('English');
    expect(languageName(null)).toBe('English');
    expect(languageName('zz')).toBe('English'); // unknown -> English
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  it('truncates and adds an ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello…');
  });
});

describe('cn', () => {
  it('merges conditional classes', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
  it('dedupes conflicting tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
