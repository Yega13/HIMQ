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

if (typeof window !== 'undefined') {
  throw new Error('lib/externalResources.ts must not be imported client-side');
}

import type { Resource } from './resources';
import { matchTrustedChannel } from './trustedChannels';

const WIKI_LANG: Record<string, string> = { en: 'en', ru: 'ru', am: 'hy' };
const YT_RELEVANCE_LANG: Record<string, string> = { en: 'en', ru: 'ru', am: 'hy' };

// One search call returns the top-matching article's URL and (when the
// article has one) its lead image — both real, both verified to exist by the
// fact the API just returned them.
async function fetchWikipedia(query: string, lang: string, idPrefix: string): Promise<Resource[]> {
  const wikiLang = WIKI_LANG[lang] ?? 'en';
  const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages%7Cinfo&inprop=url&piprop=thumbnail&pithumbsize=500&format=json&origin=*`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; fullurl?: string; thumbnail?: { source?: string } }> };
    };
    const page = data.query?.pages ? Object.values(data.query.pages)[0] : null;
    if (!page?.fullurl || !page.title) return [];
    const out: Resource[] = [
      { id: `wiki-${idPrefix}`, title: page.title, type: 'link', url: page.fullurl, keywords: [] },
    ];
    if (page.thumbnail?.source) {
      out.push({ id: `wikiimg-${idPrefix}`, title: page.title, type: 'image', url: page.thumbnail.source, keywords: [] });
    }
    return out;
  } catch {
    return []; // network hiccup / timeout — resources are a nice-to-have, never block teaching
  }
}

async function youtubeSearch(
  apiKey: string, query: string, relevanceLanguage: string, channelId?: string,
): Promise<{ videoId: string; title: string } | null> {
  const channelParam = channelId ? `&channelId=${channelId}` : '';
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&safeSearch=strict&relevanceLanguage=${relevanceLanguage}${channelParam}&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { id?: { videoId?: string }; snippet?: { title?: string } }[] };
  const item = data.items?.[0];
  const videoId = item?.id?.videoId;
  if (!videoId || !item?.snippet?.title) return null;
  return { videoId, title: item.snippet.title };
}

async function fetchYouTube(query: string, lang: string, idPrefix: string): Promise<Resource | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null; // feature simply stays off until a key is configured
  const relevanceLanguage = YT_RELEVANCE_LANG[lang] ?? 'en';
  try {
    // Prefer a hand-vetted channel when the topic clearly matches one — a
    // known-good creator beats whatever ranks top in an open search. Falls
    // back to the open search when nothing trusted fits (or that channel has
    // nothing on this specific topic).
    const trusted = matchTrustedChannel(query, lang);
    const hit = trusted
      ? (await youtubeSearch(apiKey, query, relevanceLanguage, trusted.channelId))
        ?? (await youtubeSearch(apiKey, query, relevanceLanguage))
      : await youtubeSearch(apiKey, query, relevanceLanguage);
    if (!hit) return null;
    return { id: `yt-${idPrefix}`, title: hit.title, type: 'video', url: `https://www.youtube.com/watch?v=${hit.videoId}`, keywords: [] };
  } catch {
    return null;
  }
}

// `idPrefix` should be the lesson's own row id — guarantees these IDs never
// collide with the static curated list or another lesson's fetched set.
export async function fetchLessonResources(topic: string, lang: string, idPrefix: string): Promise<Resource[]> {
  const [wiki, yt] = await Promise.all([
    fetchWikipedia(topic, lang, idPrefix),
    fetchYouTube(topic, lang, idPrefix),
  ]);
  return yt ? [...wiki, yt] : wiki;
}
