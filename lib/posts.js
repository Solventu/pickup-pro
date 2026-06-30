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

  // "Liked by people you follow": for each post, the accepted-follow accounts
  // (excluding yourself) who liked it, with their profile for display.
  const likedByFollowed = {};
  if (currentUserId) {
    const { data: fl } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .eq("status", "accepted");
    const followedSet = new Set(
      (fl || []).map((f) => f.following_id).filter((fid) => fid && fid !== currentUserId)
    );
    if (followedSet.size) {
      // Likers we follow, per post + the set of their ids to resolve to profiles.
      const followedLikerIds = new Set();
      const perPost = {};
      (likesRes.data || []).forEach((l) => {
        if (followedSet.has(l.user_id)) {
          (perPost[l.post_id] ||= []).push(l.user_id);
          followedLikerIds.add(l.user_id);
        }
      });
      const likerProfiles = {};
      if (followedLikerIds.size) {
        const { data: lp } = await supabase
          .from("profiles")
          .select("id,username,avatar_url")
          .in("id", [...followedLikerIds]);
        (lp || []).forEach((p) => (likerProfiles[p.id] = p));
      }
      Object.entries(perPost).forEach(([postId, ids]) => {
        likedByFollowed[postId] = ids
          .map((uid) => likerProfiles[uid])
          .filter(Boolean);
      });
    }
  }

  return posts.map((p) => ({
    ...p,
    author: profiles[p.user_id] || null,
    event: p.event_id ? events[p.event_id] || null : null,
    like_count: likeCount[p.id] || 0,
    liked: !!likedByMe[p.id],
    comment_count: commentCount[p.id] || 0,
    liked_by_followed: likedByFollowed[p.id] || [],
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
