// A small allowlist of specific creators verified (by hand) to be genuinely
// good teaching sources — used to bias the live YouTube lookup in
// externalResources.ts toward channels we actually trust before ever falling
// back to an open web-wide search. Channel IDs resolved once via YouTube's
// channels.list API (cheap, 1 unit/call) from the @handles reviewed 2026-08-06.
//
// `lang`, when set, means: only prefer this channel for a lesson taught in
// that language (mainly the Russian-language programming/football channels —
// not assumed relevant to Armenian-language lessons just because Russian is
// regionally common; revisit if that assumption is wrong).
export interface TrustedChannel {
  channelId: string;
  label: string;
  lang?: 'en' | 'ru';
  keywords: string[]; // lowercased, matched as whole words against the lesson title
}

export const TRUSTED_CHANNELS: TrustedChannel[] = [
  {
    channelId: 'UCYO_jab_esuFRV4b17AJtAw', label: '3Blue1Brown',
    keywords: ['math', 'calculus', 'algebra', 'geometry', 'trigonometry', 'linear algebra', 'probability', 'statistics', 'neural network', 'neural networks'],
  },
  {
    channelId: 'UCQHsMwcGoH1ygyi-pJs5Z8A', label: 'Frame of Essence',
    keywords: ['physics', 'algorithm', 'algorithms', 'computer science', 'computer', 'computing'],
  },
  {
    channelId: 'UCtLKO1Cb2GVNrbU7Fi0pM0w', label: '#SimpleCode', lang: 'ru',
    keywords: ['программирование', 'программист', 'python', 'javascript', 'java', 'c++', 'html', 'css', 'sql'],
  },
  {
    channelId: 'UCCXF68Da_ndcmvv_9OG75Cw', label: 'itProger', lang: 'ru',
    keywords: ['программирование', 'программист', 'веб-разработка', 'python', 'javascript', 'java', 'html', 'css', 'sql'],
  },
  {
    channelId: 'UCcQ_8FlqN6gduCR2dHHbexg', label: 'Nacho Pozo',
    keywords: ['piano'],
  },
  {
    channelId: 'UCIjyqJXAr_G420gKaYwN0ug', label: 'TutorialsByHugo',
    keywords: ['piano'],
  },
  {
    channelId: 'UCj31PEVBMTnLvVOCSQGpbog', label: 'Amosdoll Music',
    keywords: ['piano'],
  },
  {
    channelId: 'UCLBFjkqJM3HqQh_d2cO4Q5A', label: 'Anton Maltcev', lang: 'ru',
    keywords: ['football', 'soccer', 'футбол'],
  },
];

export function matchTrustedChannel(topic: string, lang: string): TrustedChannel | null {
  const hay = ` ${topic.toLowerCase()} `;
  const hit = (kw: string) =>
    new RegExp(`(^|[^\\p{L}0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}0-9]|$)`, 'iu').test(hay);
  return TRUSTED_CHANNELS.find((c) => (!c.lang || c.lang === lang) && c.keywords.some(hit)) ?? null;
}
