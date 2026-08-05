import { useEffect, useState } from 'react';
import { useUser } from './useUser';
import { getBrowserClient } from '@/lib/supabase';

interface CreditStatusResponse { enabled: boolean; geminiOnly: boolean; }

// Practice Labs are gated to paid tiers once the credit meter is live. While
// CREDIT_METER_ENABLED is off (today), /api/credits returns { enabled: false }
// and every tier is treated as allowed — matches today's behavior everywhere
// else in the app. Fails OPEN on a network error: a transient blip shouldn't
// lock a paying user out of a page they're entitled to.
//
// signedIn is exposed separately from allowed so the page can show "sign in"
// instead of "upgrade" — an anonymous visitor isn't on the wrong tier, they're
// not on any tier. Previously an anonymous visitor fell through to `allowed`'s
// default of true (the effect returned early on `!user` without ever setting
// it) — full access to a paid feature with no account at all.
export function useLabsAccess() {
  const { user, loading: userLoading } = useUser();
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { setAllowed(false); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await getBrowserClient().auth.getSession();
        const token = session?.access_token;
        // No token yet (session still hydrating) — not a real failure, just
        // not ready to check; leave `allowed` alone and stop the spinner.
        if (!token) { if (!cancelled) setLoading(false); return; }
        const res = await fetch('/api/credits', { headers: { Authorization: `Bearer ${token}` } });
        // A non-ok response (expired token, server error) is a real signal,
        // not a blip — don't grant access on a guess.
        if (!res.ok) { if (!cancelled) setAllowed(false); return; }
        const status = (await res.json()) as CreditStatusResponse;
        if (!cancelled) setAllowed(!status.enabled || !status.geminiOnly);
      } catch {
        // Thrown (offline, DNS, etc.) — a genuine transient blip, not a
        // definitive answer either way; don't lock out a paying user over it.
        if (!cancelled) setAllowed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, userLoading]);

  return { allowed, signedIn: !!user, loading: userLoading || loading };
}
