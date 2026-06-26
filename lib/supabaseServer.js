// Server-only Supabase helpers for API routes. Do NOT import this from client
// components — it reads server-side env (ADMIN_UID, optional service-role key).
import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_URL = rawUrl
  ? rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "")
  : rawUrl;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const ADMIN_UID = process.env.ADMIN_UID?.trim();

const noPersist = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

// Read "Authorization: Bearer <token>" off an incoming request.
export function getBearerToken(req) {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Anon client carrying the caller's JWT — used both to validate the token and to
// run RLS-scoped queries AS that user.
function userClient(token) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    ...noPersist,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Service-role client that bypasses RLS. Returns null when no key is configured.
export function serviceClient() {
  if (!SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, noPersist);
}

// Validate the request's bearer token and return the authenticated user (or
// null). Use this to gate routes that any logged-in user may call. getUser()
// cryptographically verifies the JWT with Supabase before we trust it.
export async function verifyUser(req) {
  const token = getBearerToken(req);
  if (!token) return { user: null, token: null, client: null };
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { user: null, token, client: null };
  return { user: data.user, token, client };
}

// Validate the request's bearer token server-side and report whether the
// authenticated user is the admin. Never trusts any client-sent flag: getUser()
// cryptographically verifies the JWT with Supabase before we compare the id.
export async function verifyAdmin(req) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, isAdmin: false, user: null, token: null, client: null };
  }
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, isAdmin: false, user: null, token, client: null };
  }
  const user = data.user;
  const isAdmin = !!ADMIN_UID && user.id === ADMIN_UID;
  return { ok: true, isAdmin, user, token, client };
}
