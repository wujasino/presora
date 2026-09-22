import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { StorageClient } from '@supabase/storage-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

// Hand-assembled from the same sub-packages @supabase/supabase-js's own
// createClient() wires together internally (auth-js's AuthClient is used
// completely unmodified — supabase-js's own "SupabaseAuthClient" is a
// zero-override subclass of it), MINUS @supabase/realtime-js. This app
// never calls supabase.channel()/.removeChannel() or subscribes to
// postgres_changes (checked: zero references anywhere in src/) — but
// createClient() always constructs a RealtimeClient regardless of whether
// it's used, unconditionally shipping its WebSocket/Phoenix-protocol code
// (~26 KB gzip) to every visitor of every page, since the Navbar's session
// check pulls this module in even on pages with no login form in sight.
// storage-js's own StorageClient doc comment calls this exact pattern out
// as the supported way to use it "for bundle-sensitive environments".
//
// Only .auth, .from() and .storage are used anywhere in this codebase
// (verified via grep) — no .rpc(), .schema() or .functions — so that's all
// this exposes. If a future feature needs realtime, rpc, or functions,
// either add the specific sub-package needed or switch back to
// @supabase/supabase-js's createClient().
const baseUrl = new URL(supabaseUrl.trim().endsWith('/') ? supabaseUrl.trim() : `${supabaseUrl.trim()}/`);
const authUrl = new URL('auth/v1', baseUrl).href;
const restUrl = new URL('rest/v1', baseUrl).href;
const storageUrl = new URL('storage/v1', baseUrl).href;
// Matches createClient()'s default storageKey exactly (project-ref-scoped),
// so an existing session saved by the previous supabase-js client is still
// read correctly after this change — nobody gets silently signed out.
const storageKey = `sb-${baseUrl.hostname.split('.')[0]}-auth-token`;

const auth = new AuthClient({
  url: authUrl,
  headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
  storageKey,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'implicit',
});

// Restore the persisted session once before auth-dependent routes render.
export const initialSession = auth.getSession();

// Same fetchWithAuth logic supabase-js uses for its rest/storage clients:
// attach the current session's access token if there is one, otherwise
// fall back to the anon key — so RLS still sees the signed-in user on every
// request exactly as before.
const fetchWithAuth: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession();
  const accessToken = data.session?.access_token ?? supabaseAnonKey;
  const headers = new Headers(init?.headers);
  if (!headers.has('apikey')) headers.set('apikey', supabaseAnonKey);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers });
};

const rest = new PostgrestClient(restUrl, { schema: 'public', fetch: fetchWithAuth });
const storage = new StorageClient(storageUrl, {}, fetchWithAuth);

// Explicit even though these match the client's own defaults — spelled out
// so "why do I get logged out" is never blamed on this file again: the
// session (incl. refresh token) is persisted in localStorage and silently
// refreshed in the background for as long as Supabase's own refresh-token
// lifetime allows (a project-level Auth setting, not something this app
// controls). The "Remember me" checkbox on Login.tsx is unrelated — it only
// pre-fills the email field and tweaks landing-page copy for returning
// visitors, it has never affected how long a session lasts.
export const supabase = {
  auth,
  from: rest.from.bind(rest),
  storage,
};
