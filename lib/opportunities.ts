// Match a learning path/topic to relevant opportunities (events). Events carry
// no category tags, so we score by keyword overlap between the topic text and
// each event's title + description. Deterministic, no AI, works with EN/RU/AM.

export interface MatchableEvent {
  title: string;
  description?: string | null;
  upvote_count?: number | null;
}

// Words too generic to carry signal (English). RU/AM topics still match on
// their content words; this just trims obvious noise.
const STOP = new Set([
  'learn', 'learning', 'study', 'course', 'courses', 'path', 'plan', 'basics',
  'basic', 'intro', 'introduction', 'beginner', 'beginners', 'advanced',
  'the', 'and', 'for', 'with', 'your', 'you', 'how', 'what', 'from', 'into',
  'get', 'want', 'need', 'this', 'that', 'about', 'using', 'use', 'make',
  'build', 'building', 'become', 'first', 'best', 'good', 'more', 'help',
]);

export function keywords(topic: string): string[] {
  // Keep letters/digits across Latin, Cyrillic (RU) and Armenian; drop the rest.
  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿԱ-֏\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  return Array.from(new Set(words));
}

// Returns the top `limit` events whose title/description overlaps the topic's
// keywords, best match first. Empty if nothing meaningfully matches.
export function matchOpportunities<T extends MatchableEvent>(
  topic: string,
  events: T[],
  limit = 3,
): T[] {
  const kws = keywords(topic);
  if (kws.length === 0) return [];

  return events
    .map((e) => {
      const hay = `${e.title} ${e.description ?? ''}`.toLowerCase();
      let score = 0;
      for (const kw of kws) if (hay.includes(kw)) score += 1;
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.e.upvote_count ?? 0) - (a.e.upvote_count ?? 0))
    .slice(0, limit)
    .map((x) => x.e);
}
