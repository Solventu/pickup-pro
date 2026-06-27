import Anthropic from "@anthropic-ai/sdk";
import { verifyUser } from "@/lib/supabaseServer";

// Uses the Anthropic API. Never cached.
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a content moderator for PickupPro, a sports platform for Timișoara, Romania. Analyze the following post and determine if it should be allowed or rejected.

REJECT the post if it contains:
- Profanity or insults in ANY language (Romanian, English, etc.)
- Hate speech, racism, discrimination
- Content completely unrelated to sports, fitness, or physical activity
- Spam or promotional content unrelated to sports events
- Threats or harassment

ALLOW the post if it:
- Is about sports, fitness, running, games, competitions
- Shares achievements, results, or sports moments
- Discusses sports events even casually
- Is a general greeting or community message related to sports

Respond with ONLY a JSON object:
{
  'allowed': true/false,
  'reason': 'brief explanation in Romanian if rejected'
}`;

// Tolerant parser: the model is asked for JSON but the example uses single
// quotes, so we accept single-quoted objects and fall back to regex. Anything
// we can't read as an explicit rejection is treated as ALLOWED (fail open).
function parseVerdict(raw) {
  const tryParse = (txt) => {
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  };

  const match = raw && raw.match(/\{[\s\S]*\}/);
  if (match) {
    const obj = tryParse(match[0]) || tryParse(match[0].replace(/'/g, '"'));
    if (obj && typeof obj.allowed === "boolean") {
      return {
        allowed: obj.allowed,
        reason: typeof obj.reason === "string" ? obj.reason : "",
      };
    }
  }

  const allowedMatch = raw && raw.match(/allowed["']?\s*:\s*(true|false)/i);
  if (allowedMatch) {
    const allowed = allowedMatch[1].toLowerCase() === "true";
    const reasonMatch = raw.match(/reason["']?\s*:\s*["']([^"']*)["']/i);
    return { allowed, reason: reasonMatch ? reasonMatch[1] : "" };
  }

  return { allowed: true, reason: "" }; // fail open
}

// POST /api/moderate-post  body: { content, sport }
// Returns { allowed: boolean, reason: string }. ALWAYS fails open (allowed:true)
// on any error so API hiccups never block legitimate posts.
export async function POST(req) {
  // Only logged-in users can reach the (paid) moderation endpoint. Posting UI is
  // already gated to authenticated users; this stops anonymous abuse of the API.
  const { user } = await verifyUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("moderate-post: missing ANTHROPIC_API_KEY, failing open");
    return Response.json({ allowed: true, reason: "" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ allowed: true, reason: "" });
  }

  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const sport = typeof body?.sport === "string" ? body.sport.trim() : "";

  // Nothing textual to moderate (e.g. image-only post) → allow.
  if (!content) {
    return Response.json({ allowed: true, reason: "" });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Sport tag: ${sport || "(none)"}\n\nPost content:\n${content}`,
        },
      ],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return Response.json(parseVerdict(raw));
  } catch (error) {
    console.error("moderate-post error (failing open):", error?.message || error);
    return Response.json({ allowed: true, reason: "" });
  }
}
