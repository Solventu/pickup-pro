import { verifyUser } from "@/lib/supabaseServer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { moderateText, MAX_MODERATED_CHARS } from "@/lib/moderation";

// Uses the Anthropic API. Never cached.
export const dynamic = "force-dynamic";

// POST /api/moderate-post  body: { content, sport }
// Returns { allowed: boolean, reason: string }. A quick pre-check for the UI;
// the authoritative check runs again inside /api/posts when the post is saved.
export async function POST(req) {
  // Only logged-in users can reach the (paid) moderation endpoint.
  const { user } = await verifyUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Throttle per IP and per account so nobody can burn API credits.
  if (
    !checkRateLimit("moderate-post", getClientIp(req), { max: 10, windowMs: 60_000 }) ||
    !checkRateLimit("moderate-post-user", user.id, { max: 10, windowMs: 60_000 })
  ) {
    return Response.json(
      { allowed: false, reason: "You're posting too fast. Please wait a moment." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ allowed: false, reason: "Invalid request." }, { status: 400 });
  }

  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const sport = typeof body?.sport === "string" ? body.sport.trim() : "";
  if (content.length > MAX_MODERATED_CHARS) {
    return Response.json({ allowed: false, reason: "Post is too long." }, { status: 400 });
  }

  return Response.json(await moderateText(content, sport));
}
