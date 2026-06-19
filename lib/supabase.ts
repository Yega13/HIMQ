import { createClient } from '@supabase/supabase-js';
import { createMockClient } from './mockClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// When no real Supabase project is configured (missing or placeholder env
// vars), fall back to a local mock backend so sign-up / sign-in and the
// signed-in UI work for local development without any server.
export const IS_MOCK = !supabaseUrl || supabaseUrl.includes('placeholder');

if (IS_MOCK && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[EduPath] Using local mock backend (no real Supabase configured). Accounts are stored in your browser.');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any;
type Client = ReturnType<typeof createClient<AnyDB>>;

// The mock is cast to the real client type so all existing typed usages
// (auth callbacks, query results) keep their types unchanged.
const asClient = (c: unknown): Client => c as Client;

// Server-side / shared client (anon key, respects RLS)
export const supabase: Client = IS_MOCK
  ? asClient(createMockClient())
  : createClient<AnyDB>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

// Browser singleton — call getBrowserClient() in components, never call createClient() directly
let _browser: Client | null = null;
export function getBrowserClient(): Client {
  if (typeof window === 'undefined') throw new Error('getBrowserClient() must only be called client-side');
  if (IS_MOCK) return asClient(createMockClient());
  if (!_browser) {
    _browser = createClient<AnyDB>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, storageKey: 'ep-auth' },
    });
  }
  return _browser;
}

// Privileged server client — bypasses RLS for XP grants, event approval, etc.
// Only import this inside /api/* routes, NEVER in components or pages.
export function getAdminClient(): Client {
  if (IS_MOCK) return asClient(createMockClient());
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — cannot use admin client');
  }
  return createClient<AnyDB>(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
