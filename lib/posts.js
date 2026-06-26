import { supabase } from "./supabaseClient";

// Enrich a list of athlete_posts with author profile, event tag, and
// like / comment counts. We stitch manually (separate queries + client join)
// instead of relying on PostgREST FK embeds, since the FK names linking
// these tables to `profiles` are not known for this backend.
export async function enrichPosts(posts, currentUserId) {
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const userIds = [...new Set(posts.map((p) => p.user_id).filter(Boolean))];
  const eventIds = [...new Set(posts.map((p) => p.event_id).filter(Boolean))];

  const [profilesRes, likesRes, commentsRes, eventsRes] = await Promise.all([
    userIds.length
      ? supabase
          .from("profiles")
          .select("id,username,avatar_url,is_private")
          .in("id", userIds)
      : Promise.resolve({ data: [] }),
    supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
    eventIds.length
      ? supabase.from("events").select("id,title,sport").in("id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profiles = {};
  (profilesRes.data || []).forEach((p) => (profiles[p.id] = p));
  const events = {};
  (eventsRes.data || []).forEach((e) => (events[e.id] = e));

  const likeCount = {};
  const likedByMe = {};
  (likesRes.data || []).forEach((l) => {
    likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1;
    if (currentUserId && l.user_id === currentUserId) likedByMe[l.post_id] = true;
  });

  const commentCount = {};
  (commentsRes.data || []).forEach((c) => {
    commentCount[c.post_id] = (commentCount[c.post_id] || 0) + 1;
  });

  return posts.map((p) => ({
    ...p,
    author: profiles[p.user_id] || null,
    event: p.event_id ? events[p.event_id] || null : null,
    like_count: likeCount[p.id] || 0,
    liked: !!likedByMe[p.id],
    comment_count: commentCount[p.id] || 0,
  }));
}

// Fetch profiles for a set of comment authors and attach them.
export async function enrichComments(comments) {
  if (!comments || comments.length === 0) return [];
  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))];
  const { data } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", userIds)
    : { data: [] };
  const profiles = {};
  (data || []).forEach((p) => (profiles[p.id] = p));
  return comments.map((c) => ({ ...c, author: profiles[c.user_id] || null }));
}

// ----- Admin moderation -----
// Delete any post as the admin. The /api/admin/delete-post route re-verifies the
// caller is the admin server-side; here we just forward the caller's Supabase
// access token so it can. A client-side admin flag is never trusted for the
// actual deletion.
export async function deletePostAsAdmin(postId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch("/api/admin/delete-post", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ postId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Nu am putut șterge postarea.");
  }
  return res.json();
}
