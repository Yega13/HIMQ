import { describe, it, expect } from 'vitest';
import { matchResources, resolveResourceTokens, type Resource } from '@/lib/resources';
import { matchTrustedChannel } from '@/lib/trustedChannels';

describe('matchResources', () => {
  it('matches a curated resource by whole-word keyword', () => {
    const hits = matchResources('Learning Python basics for beginners');
    expect(hits.some((r) => r.id === 'python-intro')).toBe(true);
  });

  it('does not match a substring inside a longer word', () => {
    // "sql" must not match inside "visually" or similar — whole-word only.
    const hits = matchResources('a visually appealing design');
    expect(hits.some((r) => r.id === 'sql-intro')).toBe(false);
  });

  it('returns nothing for unrelated text', () => {
    expect(matchResources('the history of medieval pottery')).toEqual([]);
  });

  it('respects the limit', () => {
    // Broad text likely to hit several curated keywords at once.
    const hits = matchResources('python javascript html css sql git', 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

describe('resolveResourceTokens', () => {
  it('resolves a known static ID into a [[media]] block', () => {
    const out = resolveResourceTokens('Check this out:\n[[res:python-intro]]\nHope it helps.');
    expect(out).toContain('[[media]]');
    expect(out).toContain('"type":"video"');
    expect(out).not.toContain('[[res:python-intro]]');
  });

  it('drops an unknown ID silently (never invented, never leaked)', () => {
    const out = resolveResourceTokens('See [[res:totally-made-up-id]] here.');
    expect(out).not.toContain('[[media]]');
    expect(out).not.toContain('[[res:');
  });

  it('resolves an ID from `extra` (the per-lesson live-fetched pool)', () => {
    const extra: Resource[] = [
      { id: 'wiki-abc123', title: 'Test Article', type: 'link', url: 'https://en.wikipedia.org/wiki/Test', keywords: [] },
    ];
    const out = resolveResourceTokens('Here: [[res:wiki-abc123]]', extra);
    expect(out).toContain('[[media]]');
    expect(out).toContain('Test Article');
  });

  it('does not resolve an `extra` ID when extra is omitted', () => {
    const out = resolveResourceTokens('Here: [[res:wiki-abc123]]');
    expect(out).not.toContain('[[media]]');
  });

  it('is case-insensitive on the ID', () => {
    const out = resolveResourceTokens('[[res:PYTHON-INTRO]]');
    expect(out).toContain('[[media]]');
  });

  it('strips [[ and ]] from a resource title before it enters the wire payload', () => {
    // A title containing our own control markers (however unlikely from a
    // real API) must not be able to prematurely close a [[media]] block and
    // corrupt parsing of a later, real embed in the same reply.
    const extra: Resource[] = [
      { id: 'weird-title', title: 'Look at this [[/media]] trick', type: 'link', url: 'https://example.com', keywords: [] },
    ];
    const out = resolveResourceTokens('[[res:weird-title]]', extra);
    const payloadMatch = out.match(/\[\[media\]\](.*)\[\[\/media\]\]/);
    expect(payloadMatch).not.toBeNull();
    const parsed = JSON.parse(payloadMatch![1]) as { title: string };
    expect(parsed.title).toBe('Look at this /media trick');
  });
});

describe('matchTrustedChannel', () => {
  it('matches an English math topic to 3Blue1Brown', () => {
    const c = matchTrustedChannel('Understanding linear algebra basics', 'en');
    expect(c?.label).toBe('3Blue1Brown');
  });

  it('matches a Russian programming topic to a Russian-language channel', () => {
    const c = matchTrustedChannel('Изучаем python программирование', 'ru');
    expect(c && ['#SimpleCode', 'itProger'].includes(c.label)).toBe(true);
  });

  it('does NOT match a Russian-only channel for an Armenian-language lesson', () => {
    // Same football keyword, but lang scoping should exclude the ru-only channel.
    const c = matchTrustedChannel('football training basics', 'am');
    expect(c).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(matchTrustedChannel('medieval european history', 'en')).toBeNull();
  });

  it('does not match a keyword that is only a substring of a longer word', () => {
    // "css" is a real keyword (Russian channels) — must not fire just
    // because it appears inside an unrelated longer word.
    expect(matchTrustedChannel('xcssx is not a real topic', 'ru')).toBeNull();
  });
});
