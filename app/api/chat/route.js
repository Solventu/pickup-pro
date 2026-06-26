import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabaseClient";
import { verifyUser } from "@/lib/supabaseServer";

// Talks to the Anthropic API + Supabase. Runs on the edge runtime, required by
// Cloudflare Pages (@cloudflare/next-on-pages). Never statically cached.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const ERROR_REPLY = "Îmi pare rău, am întâmpinat o eroare. Încearcă din nou.";

const SYSTEM_PROMPT = `You are PickupPro Assistant, a sports event recommendation bot for Timișoara, Romania.
You have access to the current list of available sports events. When a user asks for recommendations, analyze their request and suggest the 2-3 most relevant events.

TONE:
- Never use emojis.
- Be concise and direct. Get straight to the point.
- No filler or pleasantries (e.g. "Sunt încântat să vă ajut!", "Ce întrebare grozavă!").
- No excessive punctuation or exclamation marks.
- Keep each recommendation to at most 3-4 sentences.
- Always respond in the same language the user writes in.

FORMAT for each recommended event, use this compact form:
[Event name] — [date], [time], [location].
[One sentence on why it matches the request].
[spots left] locuri disponibile.

If you recommend multiple events, separate them with a single blank line. Do not use numbered lists or bullet points.

If no events match the request, respond exactly with:
Nu am găsit evenimente care să corespundă criteriilor.
Verificați din nou în curând sau modificați filtrele.

At the very END of every reply, on its own final line, output a machine-readable tag listing the ids of the events you recommended, exactly like this and with nothing after it:
<<<EVENT_IDS: id1, id2>>>
If you recommended no specific events, output an empty tag: <<<EVENT_IDS: >>>
This tag is stripped before the user sees the message — never mention it.`;

// Future events (date >= today) with a live "players" count derived from
// event_participants — the events table has no players column.
async function loadFutureEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,sport,title,description,date,time,location,type,source_url,max_players,latitude,longitude"
    )
    .gte("date", today)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);

  const events = data || [];
  const ids = events.map((e) => e.id);
  const counts = {};
  if (ids.length) {
    const { data: parts } = await supabase
      .from("event_participants")
      .select("event_id")
      .in("event_id", ids);
    (parts || []).forEach((p) => {
      counts[p.event_id] = (counts[p.event_id] || 0) + 1;
    });
  }
  return events.map((e) => ({ ...e, players: counts[e.id] || 0 }));
}

// Compact view the model reasons over (coords are for the client map, not the model).
function eventForModel(e) {
  return {
    id: e.id,
    sport: e.sport,
    title: e.title,
    description: e.description,
    date: e.date,
    time: e.time,
    location: e.location,
    type: e.type,
    source_url: e.source_url,
    players: e.players,
    max_players: e.max_players,
    spots_left:
      e.max_players != null ? Math.max(0, e.max_players - e.players) : null,
  };
}

// ---- Simple in-memory per-IP rate limiter (10 requests / 60s) ----
// NOTE: in-memory state is per server instance and resets on redeploy. For
// multi-instance production, back this with a shared store (e.g. Upstash/Redis).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MSG = "Prea multe cereri. Încearcă din nou în un minut.";
const rateHits = new Map(); // ip -> { count, resetAt }

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// True if the request is allowed; false if the IP is over its quota. The counter
// resets 60s after the first request in a window.
function checkRateLimit(ip) {
  const now = Date.now();
  // Opportunistically drop expired entries so the map can't grow unbounded.
  if (rateHits.size > 5000) {
    for (const [key, entry] of rateHits) {
      if (now >= entry.resetAt) rateHits.delete(key);
    }
  }
  const entry = rateHits.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function POST(req) {
  // Rate limit before doing any work.
  if (!checkRateLimit(getClientIp(req))) {
    return Response.json({ reply: RATE_LIMIT_MSG }, { status: 429 });
  }

  // Require an authenticated user — the chatbot is a logged-in feature.
  const { user } = await verifyUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized", reply: ERROR_REPLY }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Chat API error: missing ANTHROPIC_API_KEY");
    return Response.json(
      { error: "Missing ANTHROPIC_API_KEY", reply: ERROR_REPLY },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ reply: ERROR_REPLY }, { status: 400 });
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body?.history) ? body.history : [];
  if (!message) {
    return Response.json({ reply: ERROR_REPLY }, { status: 400 });
  }

  // Load events on their own — a Supabase failure must not take down the whole
  // chat. If it fails we continue with no event context rather than 500.
  let events = [];
  try {
    events = await loadFutureEvents();
  } catch (dbErr) {
    console.error("Chat API: Supabase events fetch failed, continuing without events:", dbErr);
    events = [];
  }

  try {
    const byId = new Map(events.map((e) => [String(e.id), e]));

    // Keep the last 10 turns of context; only forward valid roles + content.
    const priorMessages = history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .slice(-10)
      .map((m) => ({ role: m.role, content: String(m.content) }));

    const system = `${SYSTEM_PROMPT}

AVAILABLE EVENTS (JSON):
${JSON.stringify(events.map(eventForModel))}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system,
      messages: [...priorMessages, { role: "user", content: message }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Pull the recommended-event ids out of the trailing tag, then strip it so
    // the user never sees it. Cards are built from our own DB rows (full data:
    // coords, spots, source_url) rather than trusting model output.
    const tag = raw.match(/<<<EVENT_IDS:([^>]*)>>>/i);
    let reply = raw.replace(/<<<EVENT_IDS:[^>]*>>>/i, "").trim();
    let recommended = [];
    if (tag) {
      recommended = tag[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .map((e) => ({
          id: e.id,
          sport: e.sport,
          title: e.title,
          date: e.date,
          time: e.time,
          location: e.location,
          type: e.type,
          source_url: e.source_url,
          players: e.players,
          max_players: e.max_players,
          latitude: e.latitude,
          longitude: e.longitude,
        }));
    }

    return Response.json({ reply: reply || ERROR_REPLY, events: recommended });
  } catch (error) {
    // Log the real cause server-side (status/type/stack stay in the logs), but
    // never leak internals to the client — return a generic reply only.
    console.error("Chat API error:", {
      message: error?.message || String(error),
      status: error?.status,
      type: error?.error?.type || error?.name,
      stack: error?.stack,
    });
    return Response.json({ reply: ERROR_REPLY }, { status: 500 });
  }
}
