// Parses a discovery-phase Q:/A:/T: formatted message from May into a
// structured question the UI can render as answer buttons/choices, instead
// of the raw labeled text. Tolerant: the model sometimes puts Q:/A:/T: inline
// (no newlines), omits the T: line, or drops just the "Q:" label — especially
// in non-English replies. Never let a raw "Q:"/"A:"/"T:" marker leak into
// what the student reads.

// Strip stray markdown emphasis (** / *) — the discovery Q&A view is natural
// language (no code), so removing asterisks is safe and keeps them from
// showing up literally in questions/choices.
export const stripMd = (s: string) => s.replace(/\*+/g, '').trim();

export interface ParsedQuestion {
  preamble: string;
  text: string;
  choices: string[] | undefined;
  type: 'single' | 'multiple' | 'open' | 'text';
}

export function parseQuestion(content: string): ParsedQuestion {
  // Strict: the well-formed case, Q:/A:/T: all present.
  const strict = content.match(/^([\s\S]*?)Q:\s*([\s\S]+?)\s*A:\s*([\s\S]+?)(?:\s*T:\s*(single|multiple|open))?\s*$/i);
  if (strict) {
    const tRaw = strict[4]?.toLowerCase();
    return {
      preamble: stripMd(strict[1]),
      text: stripMd(strict[2]),
      choices: strict[3].split('|').map((c) => stripMd(c)).filter(Boolean),
      type: (tRaw === 'multiple' ? 'multiple' : tRaw === 'open' ? 'open' : 'single') as 'single' | 'multiple' | 'open',
    };
  }
  // Loose: the model sometimes drops just the "Q:" label while still writing
  // A:/T: — without this, the whole string (including the raw "A:"/"T:"
  // markers) falls through to the plain-text case below and leaks verbatim.
  // "A:" is still the required anchor, so this can't misfire on a genuinely
  // open-ended question that has no choices at all.
  const loose = content.match(/^([\s\S]+?)\s*A:\s*([\s\S]+?)(?:\s*T:\s*(single|multiple|open))?\s*$/i);
  if (loose) {
    const tRaw = loose[3]?.toLowerCase();
    return {
      preamble: '',
      text: stripMd(loose[1].replace(/^Q:\s*/i, '')),
      choices: loose[2].split('|').map((c) => stripMd(c)).filter(Boolean),
      type: (tRaw === 'multiple' ? 'multiple' : tRaw === 'open' ? 'open' : 'single') as 'single' | 'multiple' | 'open',
    };
  }
  return { preamble: '', text: stripMd(content.replace(/^Q:\s*/i, '')), choices: undefined, type: 'text' };
}
