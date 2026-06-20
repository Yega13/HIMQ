/* Client-side "save for later" for opportunities.
   Stored in localStorage so it works without a backend table — the saved
   list is shown on the profile page. Per-browser, which is fine for an MVP. */

export interface SavedEvent {
  id: string;
  title: string;
  event_type: string;
  organizer: string;
  deadline: string | null;
  link: string | null;
  is_online: boolean;
  location: string | null;
}

const KEY = 'ep_saved_events';

export function getSavedEvents(): SavedEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedEvent[]) : [];
  } catch {
    return [];
  }
}

export function isEventSaved(id: string): boolean {
  return getSavedEvents().some((e) => e.id === id);
}

function write(list: SavedEvent[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list));
  // Let other mounted components (e.g. profile) know it changed.
  window.dispatchEvent(new Event('ep-saved-events-changed'));
}

export function removeSavedEvent(id: string) {
  write(getSavedEvents().filter((e) => e.id !== id));
}

// Returns the new saved state (true = now saved, false = now removed).
export function toggleSavedEvent(event: SavedEvent): boolean {
  const list = getSavedEvents();
  if (list.some((e) => e.id === event.id)) {
    write(list.filter((e) => e.id !== event.id));
    return false;
  }
  write([event, ...list]);
  return true;
}

/* ── Likes (lightweight favorite, stored as ids) ──────────────────────── */
const LIKES_KEY = 'ep_liked_events';

export function getLikedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// Returns the new liked state (true = now liked, false = unliked).
export function toggleLike(id: string): boolean {
  const list = getLikedIds();
  const liked = !list.includes(id);
  const next = liked ? [id, ...list] : list.filter((x) => x !== id);
  if (typeof window !== 'undefined') localStorage.setItem(LIKES_KEY, JSON.stringify(next));
  return liked;
}
