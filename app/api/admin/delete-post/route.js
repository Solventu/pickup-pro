import { verifyAdmin, serviceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// POST /api/admin/delete-post  body: { postId }
// Deletes ANY post — admin moderation. The caller is verified as the admin
// server-side from their access token; a client-side admin flag is never trusted.
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

  const postId = typeof body?.postId === "string" ? body.postId.trim() : "";
  if (!postId) {
    return Response.json({ error: "Missing postId" }, { status: 400 });
  }

  // Prefer the service-role client (bypasses RLS, guaranteed). Fall back to the
  // admin's own verified, RLS-scoped client when no service key is configured.
  const svc = serviceClient();
  const db = svc || client;

  // Look up the author BEFORE deleting so we can notify them afterwards.
  const { data: postRow } = await db
    .from("athlete_posts")
    .select("user_id")
    .eq("id", postId)
    .maybeSingle();
  const authorId = postRow?.user_id || null;

  if (svc) {
    // Service role bypasses RLS, so clear children explicitly — this guarantees
    // cleanup even if ON DELETE CASCADE FKs aren't configured.
    await svc.from("post_likes").delete().eq("post_id", postId);
    await svc.from("post_comments").delete().eq("post_id", postId);
  }
  // (Without the service key, post_likes/post_comments are removed by the
  // ON DELETE CASCADE foreign keys in supabase-schema-fixes.sql.)

  const { error } = await db.from("athlete_posts").delete().eq("id", postId);
  if (error) {
    console.error("Admin delete-post failed:", postId, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Best-effort: tell the author their post was removed. Don't fail the delete
  // if this insert fails (e.g. the notifications table hasn't been created yet).
  if (authorId) {
    const { error: notifErr } = await db.from("notifications").insert({
      user_id: authorId,
      type: "post_deleted",
      message:
        "Una dintre postările tale a fost eliminată de administrator deoarece încalcă regulile comunității PickupPro.",
    });
    if (notifErr) {
      console.error("post_deleted notification insert failed:", notifErr.message);
    }
  }

  // Audit trail.
  console.log("Admin deleted post:", postId, "by:", user.id);
  return Response.json({ success: true });
}
