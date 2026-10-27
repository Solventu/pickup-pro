import { verifyUser, serviceClient, ownImagePrefix } from "@/lib/supabaseServer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { moderateText } from "@/lib/moderation";
import { cleanText, LIMITS } from "@/lib/sanitize";
import { SPORTS, POST_IMAGES_BUCKET } from "@/lib/constants";

export const dynamic = "force-dynamic";

const RATE_LIMIT_MSG = "You're posting too fast. Please wait a moment.";

function validCoord(value, limit) {
  const n = Number(value);
  return value != null && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

// POST /api/posts  body: { description, sport, eventId, imageUrl, location, latitude, longitude }
// Creates a post for the logged-in user. Moderation runs HERE, on the server,
// so it can't be skipped by calling Supabase directly from the browser (once
// the direct insert policy is removed — see supabase-security.sql).
export async function POST(req) {
  const { user, client } = await verifyUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !checkRateLimit("posts", getClientIp(req), { max: 10, windowMs: 60_000 }) ||
    !checkRateLimit("posts-user", user.id, { max: 5, windowMs: 60_000 })
  ) {
    return Response.json({ error: RATE_LIMIT_MSG }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const description = cleanText(body?.description, LIMITS.post);
  const sport = SPORTS.includes(body?.sport) ? body.sport : null;
  const location = cleanText(body?.location, LIMITS.location) || null;
  const latitude = validCoord(body?.latitude, 90);
  const longitude = validCoord(body?.longitude, 180);
  const hasCoords = latitude != null && longitude != null;

  // The image must be one this user uploaded to their own storage folder.
  let imageUrl = null;
  if (body?.imageUrl) {
    const prefix = ownImagePrefix(user.id, POST_IMAGES_BUCKET);
    if (
      typeof body.imageUrl !== "string" ||
      !body.imageUrl.startsWith(prefix) ||
      body.imageUrl.includes("..")
    ) {
      return Response.json({ error: "Invalid image." }, { status: 400 });
    }
    imageUrl = body.imageUrl;
  }

  if (!description && !imageUrl) {
    return Response.json({ error: "Write something or add a photo." }, { status: 400 });
  }

  const db = serviceClient() || client;

  // Only tag events that actually exist.
  let eventId = null;
  if (body?.eventId != null && body.eventId !== "") {
    const { data: ev } = await db
      .from("events")
      .select("id")
      .eq("id", String(body.eventId))
      .maybeSingle();
    if (!ev) {
      return Response.json({ error: "Unknown event." }, { status: 400 });
    }
    eventId = ev.id;
  }

  const verdict = await moderateText(description, sport);
  if (!verdict.allowed) {
    return Response.json(
      { error: `Your post couldn't be published: ${verdict.reason || "content not allowed."}` },
      { status: 422 }
    );
  }

  const { data, error } = await db
    .from("athlete_posts")
    .insert({
      user_id: user.id,
      description,
      sport,
      event_id: eventId,
      image_url: imageUrl,
      location,
      latitude: hasCoords ? latitude : null,
      longitude: hasCoords ? longitude : null,
    })
    .select()
    .single();

  if (error) {
    console.error("Create post failed:", user.id, error.message);
    return Response.json({ error: "Could not create post." }, { status: 500 });
  }
  return Response.json({ post: data });
}
