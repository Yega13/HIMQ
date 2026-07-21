// ── Resource library (SERVER-ONLY) ──────────────────────────────────────────
// A curated, hand-verified set of real learning resources (YouTube videos,
// diagrams) that May can surface mid-lesson when one would genuinely help. This
// is a competitive moat — NEVER import it into client code. May is given only a
// small matched subset per lesson and shares them by tag ([[res:ID]]); the
// client only ever sees the specific resources she surfaces (resolved into
// [[media]] blocks), never this full list.
//
// Every URL here has been verified live (YouTube oembed / HTTP 200). May can only
// share these exact IDs, so she can never hallucinate a dead or wrong link.

if (typeof window !== 'undefined') {
  throw new Error('lib/resources.ts must not be imported client-side');
}

export type ResourceType = 'video' | 'image' | 'link';

export interface Resource {
  id: string;
  title: string;
  type: ResourceType;
  url: string;
  keywords: string[]; // lowercased terms; matched as whole words against lesson text
}

export const RESOURCES: Resource[] = [
  // ── Programming / web ──
  { id: 'python-intro', title: 'Python for Beginners — Full Course (freeCodeCamp)', type: 'video',
    url: 'https://www.youtube.com/watch?v=rfscVS0vtbw', keywords: ['python'] },
  { id: 'javascript-intro', title: 'JavaScript for Beginners (Programming with Mosh)', type: 'video',
    url: 'https://www.youtube.com/watch?v=W6NZfCO5SIk', keywords: ['javascript', 'js'] },
  { id: 'html-css', title: 'HTML & CSS Full Course (Bro Code)', type: 'video',
    url: 'https://www.youtube.com/watch?v=HGTJBPNC-Gw', keywords: ['html', 'css', 'web design', 'webpage', 'website'] },
  { id: 'react-intro', title: "React Beginner's Tutorial (freeCodeCamp)", type: 'video',
    url: 'https://www.youtube.com/watch?v=bMknfKXIFA8', keywords: ['react', 'jsx', 'components'] },
  { id: 'sql-intro', title: 'SQL Full Course for Beginners (freeCodeCamp)', type: 'video',
    url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY', keywords: ['sql', 'database', 'databases', 'query', 'queries'] },
  { id: 'git-github', title: 'Git & GitHub Crash Course (freeCodeCamp)', type: 'video',
    url: 'https://www.youtube.com/watch?v=RGOj5yH7evk', keywords: ['git', 'github', 'version control', 'commit', 'repository'] },
  // ── CS / ML ──
  { id: 'neural-networks', title: 'But what is a neural network? (3Blue1Brown)', type: 'video',
    url: 'https://www.youtube.com/watch?v=aircAruvnKk', keywords: ['neural network', 'neural networks', 'deep learning', 'machine learning', 'perceptron'] },
  // ── Math ──
  { id: 'algebra-basics', title: 'What Is Algebra? (Math Antics)', type: 'video',
    url: 'https://www.youtube.com/watch?v=NybHckSEQBI', keywords: ['algebra', 'equation', 'equations', 'variable', 'variables'] },
  { id: 'calculus-intro', title: 'The Essence of Calculus (3Blue1Brown)', type: 'video',
    url: 'https://www.youtube.com/watch?v=WUvTyaaNkzM', keywords: ['calculus', 'derivative', 'derivatives', 'integral', 'integrals', 'limit', 'limits'] },
  { id: 'linear-algebra', title: 'Vectors — Essence of Linear Algebra (3Blue1Brown)', type: 'video',
    url: 'https://www.youtube.com/watch?v=fNk_zzaMoSs', keywords: ['linear algebra', 'vector', 'vectors', 'matrix', 'matrices'] },
  { id: 'geometry-intro', title: 'Introduction to Geometry (The Organic Chemistry Tutor)', type: 'video',
    url: 'https://www.youtube.com/watch?v=302eJ3TzJQU', keywords: ['geometry', 'triangle', 'triangles', 'angle', 'angles', 'polygon'] },
  { id: 'functions-intro', title: 'What Is a Function? (Khan Academy)', type: 'video',
    url: 'https://www.youtube.com/watch?v=kvGsIo1TmsM', keywords: ['function', 'functions', 'graphing', 'domain', 'range'] },
  { id: 'statistics-intro', title: 'Statistics — Full Course (freeCodeCamp)', type: 'video',
    url: 'https://www.youtube.com/watch?v=xxpc-HPKN28', keywords: ['statistics', 'probability', 'mean', 'median', 'standard deviation', 'distribution'] },
  // ── Science ──
  { id: 'physics-intro', title: 'Physics — Basic Introduction (The Organic Chemistry Tutor)', type: 'video',
    url: 'https://www.youtube.com/watch?v=b1t41Q3xRM8', keywords: ['physics', 'force', 'motion', 'velocity', 'acceleration', 'energy'] },
  // ── Study skills ──
  { id: 'pomodoro', title: 'The Pomodoro Technique — Study Smarter (Med School Insiders)', type: 'video',
    url: 'https://www.youtube.com/watch?v=mNBmG24djoY', keywords: ['pomodoro', 'procrastination', 'focus', 'productivity', 'time management'] },

  // ── Diagrams (images) ──
  { id: 'coordinate-plane', title: 'The Cartesian coordinate plane', type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Cartesian-coordinate-system.svg/500px-Cartesian-coordinate-system.svg.png',
    keywords: ['coordinate', 'coordinates', 'cartesian', 'x-axis', 'y-axis', 'quadrant', 'plot'] },
  { id: 'pythagorean', title: 'The Pythagorean theorem', type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Pythagorean.svg/500px-Pythagorean.svg.png',
    keywords: ['pythagorean', 'pythagoras', 'hypotenuse', 'right triangle'] },
  { id: 'unit-circle', title: 'The unit circle', type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Unit_circle_angles_color.svg/500px-Unit_circle_angles_color.svg.png',
    keywords: ['unit circle', 'trigonometry', 'sine', 'cosine', 'tangent', 'radian', 'radians'] },
];

// Match up to `limit` resources whose keywords appear (as whole words) in the
// lesson text. Deterministic, no AI — works for EN topics; harmless for AM/RU
// (just returns nothing, so no resources are offered).
export function matchResources(text: string, limit = 3): Resource[] {
  const hay = ` ${text.toLowerCase()} `;
  const hit = (kw: string) =>
    new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(hay);

  return RESOURCES
    .map((r) => ({ r, score: r.keywords.reduce((n, kw) => n + (hit(kw) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

// Resolve `[[res:ID]]` tags a reply may contain into inline `[[media]]{json}[[/media]]`
// blocks the client renders as embeds. Unknown IDs are dropped (May can only ever
// reference the curated set, so this also guards against any stray invention).
const RES_TOKEN_RE = /\[\[res:([a-z0-9-]+)\]\]/gi;

export function resolveResourceTokens(text: string): string {
  return text.replace(RES_TOKEN_RE, (_, id: string) => {
    const r = RESOURCES.find((x) => x.id === id.toLowerCase());
    if (!r) return '';
    const payload = JSON.stringify({ type: r.type, url: r.url, title: r.title });
    return `\n[[media]]${payload}[[/media]]\n`;
  });
}
