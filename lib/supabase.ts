import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any;

// Server-side / shared client (anon key, respects RLS)
export const supabase = createClient<AnyDB>(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Browser singleton — call getBrowserClient() in components, never call createClient() directly
let _browser: ReturnType<typeof createClient<AnyDB>> | null = null;
export function getBrowserClient() {
  if (typeof window === 'undefined') throw new Error('getBrowserClient() must only be called client-side');
  if (!_browser) {
    _browser = createClient<AnyDB>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, storageKey: 'ep-auth' },
    });
  }
  return _browser;
}

// Privileged server client — bypasses RLS for XP grants, event approval, etc.
// Only import this inside /api/* routes, NEVER in components or pages.
export function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — cannot use admin client');
  }
  return createClient<AnyDB>(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
