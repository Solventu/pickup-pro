/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Heart, MessageCircle, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { enrichPosts } from "@/lib/posts";
import { timeAgo, emitFollowsChanged } from "@/lib/helpers";
import Avatar from "@/components/Avatar";
import { Reveal } from "@/components/Reveal";
import EditProfileModal from "@/components/EditProfileModal";
import PostModal from "@/components/PostModal";
import FollowListModal from "@/components/FollowListModal";
import AdminDeletePost from "@/components/AdminDeletePost";

export default function ProfilePage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const { user, refreshProfile, isAdmin } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [rel, setRel] = useState(null); // null | 'pending' | 'accepted'
  const [relBusy, setRelBusy] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [followModal, setFollowModal] = useState(null); // "followers" | "following"

  const isOwner = !!user && user.id === id;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) {
      setNotFound(true);
      setProfile(null);
      setLoading(false);
      return;
    }
    setProfile(data);

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", id)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", id)
        .eq("status", "accepted"),
    ]);
    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);

    if (user && user.id !== id) {
      const { data: relRow } = await supabase
        .from("follows")
        .select("status")
        .eq("follower_id", user.id)
        .eq("following_id", id)
        .maybeSingle();
      setRel(relRow?.status || null);
    } else {
      setRel(null);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const refreshCounts = useCallback(async () => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", id)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", id)
        .eq("status", "accepted"),
    ]);
    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);
  }, [id]);

  useEffect(() => {
    if (id) loadProfile();
  }, [loadProfile, id]);

  const canView =
    isOwner || (profile && !profile.is_private) || rel === "accepted";

  useEffect(() => {
    if (!profile || !canView) {
      setPosts([]);
      return;
    }
    let active = true;
    (async () => {
      setPostsLoading(true);
      const { data } = await supabase
        .from("athlete_posts")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      const enriched = await enrichPosts(data || [], user?.id);
      if (active) {
        setPosts(enriched);
        setPostsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile, canView, id, user?.id]);

  const doFollow = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (relBusy) return;
    setRelBusy(true);
    const prevRel = rel;
    const status = profile.is_private ? "pending" : "accepted";
    // Optimistic: update button + count immediately
    setRel(status);
    if (status === "accepted") setFollowerCount((c) => c + 1);

    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: id, status });

    if (error) {
      // revert
      setRel(prevRel);
      if (status === "accepted") setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      emitFollowsChanged();
    }
    setRelBusy(false);
  };

  const doUnfollow = async () => {
    if (!user || relBusy) return;
    setRelBusy(true);
    const prevRel = rel;
    const wasAccepted = rel === "accepted";
    // Optimistic: button -> Follow, drop follower count, and (for private
    // accounts) canView flips false so the posts effect hides them at once.
    setRel(null);
    if (wasAccepted) setFollowerCount((c) => Math.max(0, c - 1));

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", id)
      .select();

    if (error) {
      // revert
      setRel(prevRel);
      if (wasAccepted) setFollowerCount((c) => c + 1);
    } else {
      emitFollowsChanged();
    }
    setRelBusy(false);
  };

  const handleSaved = (updated) => {
    setProfile(updated);
    if (isOwner) refreshProfile();
  };

  // Remove a post from the grid (and close the modal if it was open). Used by
  // admin moderation on both the grid tiles and the post modal.
  const handlePostDeleted = (pid) => {
    setPosts((ps) => ps.filter((x) => x.id !== pid));
    setActivePost((cur) => (cur?.id === pid ? null : cur));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="skeleton h-40 rounded-2xl border border-line" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <p className="text-2xl font-bold">User not found</p>
        <p className="mt-2 text-sm text-muted">
          This athlete doesn’t exist or was removed.
        </p>
        <Link href="/feed" className="btn btn-outline mt-6">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Header */}
      <Reveal className="card relative flex flex-col gap-5 overflow-hidden p-6 sm:flex-row sm:items-center">
        {/* Soft accent glow behind the avatar */}
        <div
          className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl"
          aria-hidden
        />
        <Avatar
          username={profile.username}
          avatarUrl={profile.avatar_url}
          size={88}
          ring
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              @{profile.username || "unknown"}
            </h1>
            {profile.is_private && (
              <span className="badge badge-sport">
                <Lock size={11} aria-hidden /> Private
              </span>
            )}
          </div>

          {(profile.sport || profile.location) && (
            <p className="mono mt-1 text-xs text-muted">
              {[profile.sport, profile.location].filter(Boolean).join(" · ")}
            </p>
          )}

          {profile.bio && (
            <p className="mt-2 max-w-xl text-sm text-fg/90">{profile.bio}</p>
          )}

          <div className="mono mt-3.5 flex flex-wrap gap-2.5 text-sm">
            <button
              onClick={() => setFollowModal("followers")}
              className="rounded-lg border border-line px-3 py-1.5 transition-colors hover:border-accent/40"
            >
              <span className="font-medium text-fg">{followerCount}</span>{" "}
              <span className="text-muted">followers</span>
            </button>
            <button
              onClick={() => setFollowModal("following")}
              className="rounded-lg border border-line px-3 py-1.5 transition-colors hover:border-accent/40"
            >
              <span className="font-medium text-fg">{followingCount}</span>{" "}
              <span className="text-muted">following</span>
            </button>
          </div>
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isOwner ? (
            <button
              onClick={() => setEditOpen(true)}
              className="btn btn-outline"
            >
              Edit Profile
            </button>
          ) : !user ? (
            <Link href="/login" className="btn btn-primary">
              Follow
            </Link>
          ) : rel === "accepted" ? (
            <button
              onClick={doUnfollow}
              disabled={relBusy}
              className="btn btn-muted"
            >
              Following
              <Check size={15} aria-hidden />
            </button>
          ) : rel === "pending" ? (
            <button
              onClick={doUnfollow}
              disabled={relBusy}
              className="btn btn-muted"
            >
              Requested
            </button>
          ) : (
            <button
              onClick={doFollow}
              disabled={relBusy}
              className="btn btn-primary"
            >
              {profile.is_private ? "Request Follow" : "Follow"}
            </button>
          )}
        </div>
      </Reveal>

      {/* Posts */}
      <div className="mt-8">
        {canView && (
          <div className="mono mb-3 flex items-center gap-2.5 text-xs uppercase tracking-[0.2em] text-muted">
            <span className="h-px w-7 bg-accent/70" aria-hidden />
            Posts
          </div>
        )}
        {!canView ? (
          <div className="card flex flex-col items-center justify-center gap-3 p-16 text-center">
            <Lock size={36} className="text-muted" aria-hidden />
            <p className="text-lg font-medium">This account is private</p>
            <p className="text-sm text-muted">
              {rel === "pending"
                ? "Your follow request is pending approval."
                : "Follow this account to see their posts."}
            </p>
          </div>
        ) : postsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton aspect-square rounded-xl border border-line"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-2 p-16 text-center">
            <p className="text-lg font-medium">No posts yet</p>
            <p className="text-sm text-muted">
              {isOwner
                ? "Share your first post from the feed."
                : "This athlete hasn’t posted anything yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {posts.map((p) => (
              <Reveal key={p.id} y={12}>
                <ProfilePostTile
                  post={p}
                  isAdmin={isAdmin}
                  onClick={() => setActivePost(p)}
                  onDeleted={handlePostDeleted}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <PostModal
        post={activePost}
        open={!!activePost}
        currentUser={user}
        onClose={() => setActivePost(null)}
        onDeleted={handlePostDeleted}
      />

      <FollowListModal
        open={!!followModal}
        mode={followModal}
        profileId={id}
        canView={canView}
        currentUser={user}
        onClose={() => setFollowModal(null)}
        onChanged={refreshCounts}
      />

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSaved={handleSaved}
      />
    </div>
  );
}

function ProfilePostTile({ post, onClick, isAdmin, onDeleted }) {
  const tile = post.image_url ? (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-[#1a1b26] text-left"
    >
      <img
        src={post.image_url}
        alt={post.title || "post"}
        className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="mono flex gap-3 p-3 text-xs text-white">
          <span className="flex items-center gap-1">
            <Heart size={12} aria-hidden /> {post.like_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={12} aria-hidden /> {post.comment_count}
          </span>
        </div>
      </div>
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className="card card-hover flex aspect-square w-full flex-col justify-between p-4 text-left"
    >
      <div>
        {post.sport && <span className="badge badge-sport">{post.sport}</span>}
        <p className="mt-2 line-clamp-5 text-sm text-fg/90">
          {post.description}
        </p>
      </div>
      <div className="mono flex items-center justify-between text-xs text-muted">
        <span>{timeAgo(post.created_at)}</span>
        <span className="flex items-center gap-1.5">
          <Heart size={12} aria-hidden /> {post.like_count}
          <span className="opacity-50">·</span>
          <MessageCircle size={12} aria-hidden /> {post.comment_count}
        </span>
      </div>
    </button>
  );

  // `group` wrapper drives the hover effects + reveals the admin trash. The
  // trash is a sibling (not nested in the tile button) to keep valid markup.
  return (
    <div className="group relative">
      {tile}
      {isAdmin && (
        <AdminDeletePost
          postId={post.id}
          onDeleted={onDeleted}
          variant="icon"
          className="absolute right-2 top-2 z-10 bg-black/50 backdrop-blur"
        />
      )}
    </div>
  );
}
