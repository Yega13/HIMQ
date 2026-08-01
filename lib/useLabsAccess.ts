import { useEffect, useState } from 'react';
import { useUser } from './useUser';

interface CreditStatusResponse { enabled: boolean; geminiOnly: boolean; }

// Practice Labs are gated to paid tiers once the credit meter is live. While
// CREDIT_METER_ENABLED is off (today), /api/credits returns { enabled: false }
// and every tier is treated as allowed — matches today's behavior everywhere
// else in the app. Fails OPEN on a network error: a transient blip shouldn't
// lock a paying user out of a page they're entitled to.
export function useLabsAccess() {
  const { user, loading: userLoading } = useUser();
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { setLoading(false); return; }

    let cancelled = false;
    fetch('/api/credits')
      .then((r) => r.json())
      .then((status: CreditStatusResponse) => {
        if (!cancelled) setAllowed(!status.enabled || !status.geminiOnly);
      })
      .catch(() => { if (!cancelled) setAllowed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [user, userLoading]);

  return { allowed, loading: userLoading || loading };
}
