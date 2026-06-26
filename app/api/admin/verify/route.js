import { verifyAdmin } from "@/lib/supabaseServer";

// Reads the Authorization header + talks to Supabase auth. Runs on the edge
// runtime (required by Cloudflare Pages) and is never cached.
export const runtime = "edge";
export const dynamic = "force-dynamic";

// GET /api/admin/verify — returns { isAdmin } for the caller, verified entirely
// server-side from their access token. Used by the client only to decide which
// admin UI to show; the actual admin actions are re-verified on their own routes.
export async function GET(req) {
  const { isAdmin } = await verifyAdmin(req);
  return Response.json({ isAdmin });
}
