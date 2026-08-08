// ── Live resource lookup (SERVER-ONLY) ──────────────────────────────────────
// Real-time, per-lesson resource discovery to back up the small hand-curated
// list in resources.ts, which only ever covers a fixed set of English CS/math
// topics. Same safety contract: May can only ever reference an ID that came
// back from a real API call, never one she invented — these results are just
// discovered on demand instead of typed in by hand, so coverage isn't capped
// at whatever's been manually added, and it works in Armenian/Russian too.
//
// Called ONCE per lesson (the caller persists the result on lessons.resources
// and only calls this when that column is still null) — never per message.
// Fetches a small POOL per lesson, not just one item: a lesson that runs long
// (a lot of visual/hands-on topics do) needs more than one video to draw on
// as it goes, and the caller (chat.ts) is responsible for not re-offering
// something already shown. YouTube's search.list costs the same 100 units
// per call regardless of maxResults up to the requested limit, so asking for
// several results instead of one is free variety, not extra quota spend.

if (typeof window !== 'undefined') {
  throw new Error('lib/externalResources.ts must not be imported client-side');
}

import type { Resource } from './resources';
import { matchTrustedChannel } from './trustedChannels';

const WIKI_LANG: Record<string, string> = { en: 'en', ru: 'ru', am: 'hy' };
const YT_RELEVANCE_LANG: Record<string, string> = { en: 'en', ru: 'ru', am: 'hy' };
const POOL_SIZE = 4;

// Up to POOL_SIZE articles' URLs and (when they have one) lead images — all
// real, all verified to exist by the fact the API just returned them.
async function fetchWikipedia(query: string, lang: string, idPrefix: string): Promise<Resource[]> {
  const wikiLang = WIKI_LANG[lang] ?? 'en';
  const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${POOL_SIZE}&prop=pageimages%7Cinfo&inprop=url&piprop=thumbnail&pithumbsize=500&format=json&origin=*`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { index?: number; title?: string; fullurl?: string; thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages ? Object.values(data.query.pages) : [];
    // Object key order isn't guaranteed to match search relevance — each
    // page carries its own rank in `index`, so sort by that explicitly.
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const out: Resource[] = [];
    pages.forEach((page, i) => {
      if (!page.fullurl || !page.title) return;
      out.push({ id: `wiki-${i}-${idPrefix}`, title: page.title, type: 'link', url: page.fullurl, keywords: [] });
      if (page.thumbnail?.source) {
        out.push({ id: `wikiimg-${i}-${idPrefix}`, title: page.title, type: 'image', url: page.thumbnail.source, keywords: [] });
      }
    });
    return out;
  } catch {
    return []; // network hiccup / timeout — resources are a nice-to-have, never block teaching
  }
}

async function youtubeSearch(
  apiKey: string, query: string, relevanceLanguage: string, channelId?: string,
): Promise<{ videoId: string; title: string }[]> {
  const channelParam = channelId ? `&channelId=${channelId}` : '';
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${POOL_SIZE}&safeSearch=strict&relevanceLanguage=${relevanceLanguage}${channelParam}&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: { id?: { videoId?: string }; snippet?: { title?: string } }[] };
  return (data.items ?? [])
    .map((item) => ({ videoId: item.id?.videoId, title: item.snippet?.title }))
    .filter((v): v is { videoId: string; title: string } => !!v.videoId && !!v.title);
}

async function fetchYouTube(query: string, lang: string, idPrefix: string): Promise<Resource[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return []; // feature simply stays off until a key is configured
  const relevanceLanguage = YT_RELEVANCE_LANG[lang] ?? 'en';
  try {
    // Prefer a hand-vetted channel when the topic clearly matches one — a
    // known-good creator beats whatever ranks top in an open search. Falls
    // back to the open search when nothing trusted fits (or that channel has
    // nothing on this specific topic).
    const trusted = matchTrustedChannel(query, lang);
    let hits = trusted ? await youtubeSearch(apiKey, query, relevanceLanguage, trusted.channelId) : [];
    if (hits.length === 0) hits = await youtubeSearch(apiKey, query, relevanceLanguage);
    return hits.map((h, i) => ({
      id: `yt-${i}-${idPrefix}`, title: h.title, type: 'video' as const,
      url: `https://www.youtube.com/watch?v=${h.videoId}`, keywords: [],
    }));
  } catch {
    return [];
  }
}

// `idPrefix` should be the lesson's own row id — guarantees these IDs never
// collide with the static curated list or another lesson's fetched set.
export async function fetchLessonResources(topic: string, lang: string, idPrefix: string): Promise<Resource[]> {
  const [wiki, yt] = await Promise.all([
    fetchWikipedia(topic, lang, idPrefix),
    fetchYouTube(topic, lang, idPrefix),
  ]);
  return [...wiki, ...yt];
}
