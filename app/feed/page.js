"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { enrichPosts } from "@/lib/posts";
import { FOLLOWS_CHANGED } from "@/lib/helpers";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import PostCard from "@/components/PostCard";
import PostComposer from "@/components/PostComposer";
import { Reveal } from "@/components/Reveal";

export default function FeedPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("discover");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default logged-in users to their "following" feed
  useEffect(() => {
    setTab(user ? "following" : "discover");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "following") {
        if (!user) {
          setPosts([]);
          return;
        }
        // Strictly: only users I follow with status='accepted', never myself.
        const { data: fl } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .eq("status", "accepted");
        const followedSet = new Set(
          (fl || [])
            .map((f) => f.following_id)
            .filter((fid) => fid && fid !== user.id)
        );
        const ids = [...followedSet];
        if (!ids.length) {
          setPosts([]);
          return;
        }
        const { data } = await supabase
          .from("athlete_posts")
          .select("*")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
          .limit(50);
        // Belt-and-suspenders: never surface a post whose author isn't in the
        // accepted-follow set, and never the viewer's own posts.
        const followedPosts = (data || []).filter((p) =>
          followedSet.has(p.user_id)
        );
        setPosts(await enrichPosts(followedPosts, user.id));
      } else {
        // Descoperă: posts from ALL users, newest first, NO follow filter —
        // works for logged-out visitors too.
        const { data, error } = await supabase
          .from("athlete_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) {
          console.warn("[Discover] athlete_posts query failed:", error.message);
        }
        const enriched = await enrichPosts(data || [], user?.id);
        // Exclude only authors we KNOW are private. If a profile couldn't be
        // loaded (e.g. profiles RLS), still show the post so Discover isn't
        // silently empty — privacy is ultimately enforced server-side by RLS.
        setPosts(
          enriched.filter((p) => !p.author || p.author.is_private !== true)
        );
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch when follow relationships change anywhere in the app (e.g. the
  // navbar search or a profile's unfollow button) so the "following" tab never
  // keeps showing posts from someone you just unfollowed.
  useEffect(() => {
    const onFollowsChanged = () => load();
    window.addEventListener(FOLLOWS_CHANGED, onFollowsChanged);
    return () => window.removeEventListener(FOLLOWS_CHANGED, onFollowsChanged);
  }, [load]);

  const handleCreated = async (raw) => {
    const [enriched] = await enrichPosts([raw], user?.id);
    setPosts((p) => [enriched, ...p]);
  };
  const handleDeleted = (id) =>
    setPosts((p) => p.filter((x) => x.id !== id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Reveal>
        <div className="mono mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
          <span className="live-dot" aria-hidden />
          Community · Live
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Athlete Feed
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted sm:text-base">
          Posts from the global sports community — wins, callouts, and games.
        </p>
      </Reveal>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-line">
        <TabButton
          active={tab === "following"}
          onClick={() => setTab("following")}
        >
          Following
        </TabButton>
        <TabButton
          active={tab === "discover"}
          onClick={() => setTab("discover")}
        >
          Discover
        </TabButton>
      </div>

      {/* Composer */}
      {user ? (
        <div className="mt-6">
          <PostComposer
            currentUser={user}
            profile={profile}
            onCreated={handleCreated}
          />
        </div>
      ) : (
        <div className="card mt-6 flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">
            Log in to share your own posts.
          </p>
          <Link href="/login" className="btn btn-primary">
            Log in
          </Link>
        </div>
      )}

      {/* Posts */}
      <div className="mt-6 flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-28 rounded-[0.875rem] border border-line"
            />
          ))
        ) : tab === "following" && !user ? (
          <EmptyState
            title="Log in to see who you follow"
            body="Your following feed shows posts from athletes you follow."
          />
        ) : posts.length === 0 ? (
          tab === "following" ? (
            <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
              <p className="text-lg font-medium">
                You&apos;re not following anyone yet.
              </p>
              <button
                onClick={() => setTab("discover")}
                className="btn btn-outline"
              >
                Discover athletes
                <ArrowRight size={15} aria-hidden />
              </button>
            </div>
          ) : (
            <EmptyState
              title="No posts yet"
              body="Be the first to share something with the community."
            />
          )
        ) : (
          posts.map((p) => (
            <Reveal key={p.id} y={12}>
              <PostCard
                post={p}
                currentUser={user}
                onDeleted={handleDeleted}
              />
            </Reveal>
          ))
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? "text-fg" : "text-muted hover:text-fg"
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="feedTabIndicator"
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
    </button>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}
