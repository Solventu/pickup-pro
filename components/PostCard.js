/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MoreHorizontal, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { timeAgo } from "@/lib/helpers";
import Avatar from "./Avatar";
import CommentThread from "./CommentThread";
import AdminDeletePost from "./AdminDeletePost";
import Modal from "./Modal";
import LikesModal from "./LikesModal";

function HeartIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "#22c55e" : "none"}
      stroke={filled ? "#22c55e" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export default function PostCard({
  post,
  currentUser,
  onDeleted,
  defaultShowComments = false,
  inModal = false,
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const menuRef = useRef(null);
  const followedLikers = post.liked_by_followed || [];

  const { isAdmin } = useAuth();
  const author = post.author || {};
  const isOwner = currentUser && currentUser.id === post.user_id;
  // Admins moderate via the trash control on every post; normal owners keep the
  // ⋯ self-delete menu.
  const showOwnerMenu = !isAdmin && isOwner;
  const authorHref = author.id ? `/athletes/${author.id}` : "#";

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const toggleLike = async () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) {
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: post.id, user_id: currentUser.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      }
    } catch {
      // revert optimistic update on failure
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    } finally {
      setLikeBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("athlete_posts")
      .delete()
      .eq("id", post.id);
    setDeleting(false);
    if (!error) {
      setConfirmOpen(false);
      onDeleted?.(post.id);
    } else {
      alert("Could not delete post: " + error.message);
    }
  };

  return (
    <article
      className={inModal ? "group flex flex-col" : "card group flex flex-col p-3"}
    >
      {/* Header */}
      <div className={`flex items-center gap-2.5 ${inModal ? "pr-9" : ""}`}>
        <Avatar
          username={author.username}
          avatarUrl={author.avatar_url}
          size={36}
          href={author.id ? authorHref : undefined}
        />
        {/* Username + sport badge + timestamp all on one line */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href={authorHref}
            className="truncate text-sm font-medium text-fg hover:text-accent"
          >
            @{author.username || "unknown"}
          </Link>
          {post.sport && (
            <span className="badge badge-sport shrink-0">{post.sport}</span>
          )}
          <span className="mono shrink-0 text-xs text-muted">
            · {timeAgo(post.created_at)}
          </span>
        </div>

        {showOwnerMenu && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Post options"
              className="rounded-md px-2 py-1 text-muted hover:text-fg"
            >
              <MoreHorizontal size={16} aria-hidden />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-card shadow-xl">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10"
                >
                  Delete post
                </button>
              </div>
            )}
          </div>
        )}

        {/* Admin moderation: trash on every card (revealed on hover). */}
        {isAdmin && !inModal && (
          <AdminDeletePost
            postId={post.id}
            onDeleted={onDeleted}
            variant="icon"
            className="shrink-0"
          />
        )}
      </div>

      {/* Title */}
      {post.title && (
        <h3 className="mt-2 text-sm font-medium text-fg">{post.title}</h3>
      )}

      {/* Body text */}
      {post.description && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-normal text-fg/90">
          {post.description}
        </p>
      )}

      {/* Photo — Instagram-style fixed crop, full width, no black bars */}
      {post.image_url && (
        <div className="mt-2 aspect-square w-full overflow-hidden rounded-lg border border-line bg-[#1a1b26]">
          <img
            src={post.image_url}
            alt={post.title || "post photo"}
            className="h-full w-full object-cover object-center"
          />
        </div>
      )}

      {/* Location — opens the pin (or place name) on Google Maps so anyone can
          find it. Coordinates are used when the author dropped a pin. */}
      {(post.location || (post.latitude != null && post.longitude != null)) && (
        <a
          href={
            post.latitude != null && post.longitude != null
              ? `https://www.google.com/maps/search/?api=1&query=${post.latitude},${post.longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  post.location
                )}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex w-fit items-center gap-1.5 text-xs text-muted transition-colors hover:text-accent"
        >
          <MapPin size={12} aria-hidden />
          <span className="underline-offset-2 hover:underline">
            {post.location || "View location on map"}
          </span>
        </a>
      )}

      {/* Event tag */}
      {post.event && (
        <Link
          href="/"
          className="badge badge-casual mt-2 w-fit hover:brightness-125"
        >
          <Calendar size={11} aria-hidden /> {post.event.title}
        </Link>
      )}

      {/* Actions — compact, flush left */}
      <div className="mt-2 flex items-center gap-4 border-t border-line pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLike}
            disabled={likeBusy}
            aria-label={liked ? "Unlike" : "Like"}
            className={`transition-colors ${
              liked ? "text-accent" : "text-muted hover:text-fg"
            }`}
          >
            <HeartIcon filled={liked} />
          </button>
          {/* The count opens the full list of who liked. */}
          <button
            onClick={() => likeCount > 0 && setLikesOpen(true)}
            disabled={likeCount === 0}
            className={`mono text-xs ${
              likeCount > 0
                ? "text-muted hover:text-fg hover:underline"
                : "text-muted"
            }`}
          >
            {likeCount}
          </button>
        </div>
        <button
          onClick={() => setShowComments((s) => !s)}
          className={`flex items-center gap-1 transition-colors ${
            showComments ? "text-fg" : "text-muted hover:text-fg"
          }`}
        >
          <CommentIcon />
          <span className="mono text-xs">{commentCount}</span>
        </button>
      </div>

      {/* "Liked by" — accounts you follow who liked this post. */}
      {followedLikers.length > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          Liked by{" "}
          {followedLikers.slice(0, 2).map((u, i) => (
            <span key={u.id}>
              {i > 0 && ", "}
              <Link
                href={`/athletes/${u.id}`}
                className="font-medium text-fg hover:text-accent"
              >
                @{u.username || "user"}
              </Link>
            </span>
          ))}
          {followedLikers.length > 2 && (
            <>
              {" "}
              and{" "}
              <button
                onClick={() => setLikesOpen(true)}
                className="font-medium text-fg hover:text-accent"
              >
                {followedLikers.length - 2} other
                {followedLikers.length - 2 === 1 ? "" : "s"}
              </button>
            </>
          )}
        </p>
      )}

      {showComments && (
        <CommentThread
          postId={post.id}
          currentUser={currentUser}
          onCountChange={(delta) => setCommentCount((c) => Math.max(0, c + delta))}
        />
      )}

      {/* Admin moderation in the post modal: full button below the comments. */}
      {inModal && isAdmin && (
        <AdminDeletePost postId={post.id} onDeleted={onDeleted} variant="button" />
      )}

      {/* Delete confirmation */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete post?"
      >
        <p className="text-sm text-muted">
          This will permanently remove your post. This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setConfirmOpen(false)}
            className="btn btn-muted"
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-danger"
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>

      {/* Who liked this post */}
      <LikesModal
        open={likesOpen}
        postId={post.id}
        onClose={() => setLikesOpen(false)}
      />
    </article>
  );
}
