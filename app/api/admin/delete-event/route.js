import { verifyAdmin, serviceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// POST /api/admin/delete-event  body: { eventId }
// Deletes an event (and its participant rows) — admin only. Works without a
// service-role key: the `events_delete_admin` RLS policy lets the admin's own
// verified client delete events, and the ON DELETE CASCADE FK on
// event_participants clears the joins (both in supabase-rls.sql /
// supabase-schema-fixes.sql). The service-role client is used when available.
// The caller is re-verified as the admin server-side from their access token; a
// client-side admin flag is never trusted.
export async function POST(req) {
  const { isAdmin, user, client } = await verifyAdmin(req);
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) {
    return Response.json({ error: "Missing eventId" }, { status: 400 });
  }

  // Prefer the service-role client (bypasses RLS, guaranteed). Fall back to the
  // admin's own verified, RLS-scoped client when no service key is configured —
  // though without it the delete will fail since events have no DELETE policy.
  const svc = serviceClient();
  const db = svc || client;

  if (svc) {
    // Service role bypasses RLS — clear participants explicitly so the row goes
    // even if ON DELETE CASCADE isn't configured for event_participants.
    await svc.from("event_participants").delete().eq("event_id", eventId);
  }

  const { error } = await db.from("events").delete().eq("id", eventId);
  if (error) {
    console.error("Admin delete-event failed:", eventId, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  console.log("Admin deleted event:", eventId, "by:", user.id);
  return Response.json({ success: true });
}
