import { createClient } from "@supabase/supabase-js";

// Normalize the project URL: supabase-js wants the bare origin
// (https://xxxx.supabase.co) and appends /rest/v1, /auth/v1, /storage/v1
// itself. Strip a trailing slash and an accidental /rest/v1 suffix.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envUrl = rawUrl
  ? rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "")
  : rawUrl;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// A real URL must start with http(s). The .env.local placeholder does not,
// so we fall back to a syntactically valid dummy URL to avoid createClient
// throwing at import time. The app boots and warns instead of crashing;
// queries will fail until real credentials are added.
const hasRealCreds = !!envUrl && /^https?:\/\//.test(envUrl) && !!envKey;

if (!hasRealCreds && typeof window !== "undefined") {
  console.warn(
    "[PickupPro] Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart `npm run dev`."
  );
}

const supabaseUrl = hasRealCreds ? envUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = hasRealCreds ? envKey : "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = hasRealCreds;
