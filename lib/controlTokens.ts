// Control tokens the teaching model emits on its final line to signal state
// changes to the server. They must NEVER reach the student — not the full token,
// and not a partial prefix that flashes mid-stream before it completes.

export const PLAN_READY = '<<<PLAN_READY>>>';
export const LESSON_MASTERED = '<<<LESSON_MASTERED>>>';

const TOKEN_RE = /<<<PLAN_READY>>>|<<<LESSON_MASTERED>>>/g;

/** Remove all complete control tokens from the text. */
export function stripControlTokens(text: string): string {
  return text.replace(TOKEN_RE, '');
}

/**
 * Given the raw text accumulated so far during streaming, return the prefix that
 * is safe to show the student: complete tokens removed, and any in-progress
 * token (or a trailing `<` / `<<` that could still grow into `<<<`) held back
 * until it resolves.
 */
export function visibleSoFar(full: string): string {
  let s = stripControlTokens(full);
  const open = s.lastIndexOf('<<<');
  if (open !== -1 && !s.slice(open).includes('>>>')) {
    // an in-progress token has started but not closed → hold everything from it
    s = s.slice(0, open);
  } else {
    // a trailing '<' or '<<' might be the start of the next token → hold it back
    const m = s.match(/<{1,2}$/);
    if (m) s = s.slice(0, s.length - m[0].length);
  }
  return s;
}

/**
 * Final-pass interpretation of a completed reply: which signals fired and the
 * clean, token-free text to persist/show. `isDiscovering` gates which signal is
 * meaningful (PLAN_READY ends discovery; LESSON_MASTERED only applies while
 * teaching).
 */
export function interpretReply(raw: string, isDiscovering: boolean): {
  reply: string;
  planReady: boolean;
  lessonMastered: boolean;
} {
  return {
    reply: stripControlTokens(raw).trim(),
    planReady: isDiscovering && raw.includes(PLAN_READY),
    lessonMastered: !isDiscovering && raw.includes(LESSON_MASTERED),
  };
}
