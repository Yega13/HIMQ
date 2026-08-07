import { describe, it, expect } from 'vitest';
import { parseQuestion } from '@/lib/parseQuestion';

describe('parseQuestion', () => {
  it('parses the well-formed Q:/A:/T: case', () => {
    const out = parseQuestion("Q: What's your main goal?\nA: Get a job | Build a project | Pass an exam\nT: single");
    expect(out).toEqual({
      preamble: '',
      text: "What's your main goal?",
      choices: ['Get a job', 'Build a project', 'Pass an exam'],
      type: 'single',
    });
  });

  it('extracts a warm-intro preamble before Q:', () => {
    const out = parseQuestion(
      "Hi! I'm May, your personal teacher.\n\nQ: What would you like to learn about?\nA: Suggestion1 | Suggestion2\nT: open",
    );
    expect(out.preamble).toBe("Hi! I'm May, your personal teacher.");
    expect(out.text).toBe('What would you like to learn about?');
    expect(out.type).toBe('open');
  });

  it('defaults to "single" when T: is omitted', () => {
    const out = parseQuestion('Q: Pick one?\nA: X | Y');
    expect(out.type).toBe('single');
  });

  it('parses inline Q:/A:/T: with no newlines', () => {
    const out = parseQuestion('Q: Short one? A: X | Y | Z T: multiple');
    expect(out.choices).toEqual(['X', 'Y', 'Z']);
    expect(out.type).toBe('multiple');
  });

  // The actual production bug: the model wrote A:/T: correctly but dropped
  // the "Q:" label entirely. Before the loose fallback, this whole string —
  // including the raw "A:"/"T:" markers — leaked verbatim into the chat.
  it('tolerates a missing "Q:" label when A:/T: are still present', () => {
    const out = parseQuestion(
      'Have you played piano before, or starting from zero? A: Complete beginner | Know a little (some chords/notes) | Can play a bit, want more songs T: single',
    );
    expect(out.text).toBe('Have you played piano before, or starting from zero?');
    expect(out.choices).toEqual([
      'Complete beginner',
      'Know a little (some chords/notes)',
      'Can play a bit, want more songs',
    ]);
    expect(out.type).toBe('single');
    // The raw labels must never survive into the parsed question/choices.
    expect(out.text).not.toContain('A:');
    expect(out.choices?.some((c) => c.includes('T:'))).toBe(false);
  });

  it('falls back to plain text when there are no choices at all (fully open)', () => {
    const out = parseQuestion('What made you interested in this?');
    expect(out).toEqual({
      preamble: '',
      text: 'What made you interested in this?',
      choices: undefined,
      type: 'text',
    });
  });

  it('strips stray markdown asterisks from question and choices', () => {
    const out = parseQuestion('Q: **Bold** question?\nA: *Choice one* | Choice two\nT: single');
    expect(out.text).toBe('Bold question?');
    expect(out.choices).toEqual(['Choice one', 'Choice two']);
  });
});
