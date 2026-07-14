import { describe, it, expect } from 'vitest';
import { visibleSoFar, stripControlTokens, interpretReply } from '@/lib/controlTokens';

describe('stripControlTokens', () => {
  it('removes both token types, anywhere, repeatedly', () => {
    expect(stripControlTokens('a<<<PLAN_READY>>>b<<<LESSON_MASTERED>>>c')).toBe('abc');
  });
  it('leaves normal text untouched', () => {
    expect(stripControlTokens('just teaching text')).toBe('just teaching text');
  });
});

describe('visibleSoFar', () => {
  it('returns plain text unchanged', () => {
    expect(visibleSoFar('Photosynthesis converts light to energy.')).toBe(
      'Photosynthesis converts light to energy.',
    );
  });

  it('strips a completed token at the end', () => {
    expect(visibleSoFar('You mastered it!\n\n<<<LESSON_MASTERED>>>')).toBe('You mastered it!\n\n');
  });

  it('holds back an in-progress token', () => {
    expect(visibleSoFar('Ready to build.\n\n<<<PLAN_RE')).toBe('Ready to build.\n\n');
    expect(visibleSoFar('done <<<')).toBe('done ');
  });

  it('holds back a trailing "<" or "<<" that could grow into a token', () => {
    expect(visibleSoFar('almost<')).toBe('almost');
    expect(visibleSoFar('almost<<')).toBe('almost');
  });

  it('keeps a lone "<" that is not at the very end', () => {
    expect(visibleSoFar('if a < b then')).toBe('if a < b then');
  });
});

describe('streaming simulation (the real safety guarantee)', () => {
  // Mirrors the API route: accumulate raw, emit only the new visible prefix.
  const simulate = (full: string) => {
    let raw = '';
    let sent = '';
    let sentLen = 0;
    for (const ch of full) {
      raw += ch;
      const vis = visibleSoFar(raw);
      if (vis.length > sentLen) {
        sent += vis.slice(sentLen);
        sentLen = vis.length;
      }
    }
    return sent;
  };

  it('never leaks a LESSON_MASTERED token when streamed char by char', () => {
    const full = 'Great work — you clearly understand recursion now.\n\n<<<LESSON_MASTERED>>>';
    const sent = simulate(full);
    expect(sent).not.toContain('<');
    expect(sent).toBe('Great work — you clearly understand recursion now.\n\n');
  });

  it('never leaks a PLAN_READY token when streamed char by char', () => {
    const full = "Perfect, I've got what I need.<<<PLAN_READY>>>";
    const sent = simulate(full);
    expect(sent).not.toContain('<');
    expect(sent).toBe("Perfect, I've got what I need.");
  });

  it('streams a token-free reply in full', () => {
    const full = 'Let us start with variables — a box that holds a value.';
    expect(simulate(full)).toBe(full);
  });
});

describe('interpretReply', () => {
  it('detects PLAN_READY only while discovering', () => {
    expect(interpretReply('all set<<<PLAN_READY>>>', true)).toEqual({
      reply: 'all set',
      planReady: true,
      lessonMastered: false,
    });
    expect(interpretReply('all set<<<PLAN_READY>>>', false).planReady).toBe(false);
  });

  it('detects LESSON_MASTERED only while teaching', () => {
    expect(interpretReply('nice<<<LESSON_MASTERED>>>', false)).toEqual({
      reply: 'nice',
      planReady: false,
      lessonMastered: true,
    });
    expect(interpretReply('nice<<<LESSON_MASTERED>>>', true).lessonMastered).toBe(false);
  });

  it('trims and returns clean text with no signals', () => {
    expect(interpretReply('  just teaching  ', false)).toEqual({
      reply: 'just teaching',
      planReady: false,
      lessonMastered: false,
    });
  });
});
