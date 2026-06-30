"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { timeAgo } from "@/lib/helpers";
import Avatar from "./Avatar";

// The bell merges two notification sources:
//   1) follows table  -> follow requests / new followers (with Accept/Decline).
//   2) notifications table -> system messages (e.g. admin removed your post).
//
// Read-state is persisted entirely in the DATABASE so it holds across devices
// and sessions:
//   - profiles.notifications_seen_at — the moment the user last opened the bell.
//     The unread badge counts only follows + system rows created AFTER it. This
//     is what covers follow notifications, which have no is_read column.
//   - notifications.is_read — flipped to true on open so individual system rows
//     also read as seen anywhere they're queried.
//
// Opening the panel writes both (notifications_seen_at = now, is_read = true).
// The badge drops to 0 at once (optimistic) and stays 0 on the next load — from
// any device — because the DB now agrees. No localStorage is involved.

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [follows, setFollows] = useState([]); // follow-based notifications
  const [system, setSystem] = useState([]); // notifications-table rows
  const [seenAt, setSeenAt] = useState(null); // profiles.notifications_seen_at
  const [busyId, setBusyId] = useState(null);
  const ref = useRef(null);

  const load = useCallback(async () => {
    if (!user) {
      setFollows([]);
      setSystem([]);
      setSeenAt(null);
      return { follows: [], system: [] };
    }
    const [followsRes, notifRes, profRes] = await Promise.all([
      supabase.from("follows").select("*").eq("following_id", user.id),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      // notifications_seen_at may not exist until supabase-rls.sql is applied;
      // on error data is null → seenAt stays null (everything reads as unread,
      // which is safe) rather than crashing the bell.
      supabase
        .from("profiles")
        .select("notifications_seen_at")
        .eq("id", user.id)
        .single(),
    ]);

    const list = followsRes.data || [];
    const actorIds = [...new Set(list.map((r) => r.follower_id).filter(Boolean))];
    const pmap = {};
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", actorIds);
      (profs || []).forEach((p) => (pmap[p.id] = p));
    }
    const enriched = list.map((r) => ({ ...r, actor: pmap[r.follower_id] || null }));
    const sys = notifRes.data || []; // table may not exist yet → null → []
    const seenVal = profRes.data?.notifications_seen_at || null;
    setFollows(enriched);
    setSystem(sys);
    setSeenAt(seenVal);
    return { follows: enriched, system: sys, seenAt: seenVal };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [user?.id, load]);

  // Keep the latest load() in a ref so the realtime effect below can call it
  // without listing `load` as a dependency — otherwise the channel would tear
  // down and re-subscribe whenever load changes.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Realtime: bump the badge the instant a system notification is inserted for
  // this user, without waiting for the 45s poll.
  //
  // The channel topic is made unique per subscription. supabase.channel() hands
  // back an existing channel when one with the same topic is still registered;
  // in React StrictMode (and on any re-subscribe) the cleanup's removeChannel is
  // async, so a fixed topic could return a channel that has already subscribed —
  // and adding `.on("postgres_changes")` to it then throws "cannot add callbacks
  // after subscribe()". A unique topic guarantees a fresh channel every time.
  useEffect(() => {
    if (!user) return;
    const topic = `notifications:${user.id}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    // Close on scroll — the panel is anchored to the sticky navbar, so leaving it
    // open would otherwise float fixed at the top of the screen.
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  // Unread is decided purely from the DB. Follows count as unread when they
  // arrived after the last bell-open (notifications_seen_at); system rows count
  // when their is_read is still false. Both persist across devices/sessions.
  const seenMs = seenAt ? Date.parse(seenAt) : 0;
  const isFollowUnread = (n) => !seenAt || Date.parse(n.created_at || 0) > seenMs;
  // Ignore malformed system rows with no message text — they render as an empty
  // notification, which looks broken.
  const visibleSystem = system.filter((n) => n.message && n.message.trim());
  // Pending follow requests always show (they need Accept/Decline); informational
  // "started following you" rows clear once seen / after "Clear all" advances the
  // seen marker — so the list doesn't pile up forever.
  const visibleFollows = follows.filter(
    (f) => f.status === "pending" || isFollowUnread(f)
  );
  const unreadFollows = follows.filter(isFollowUnread).length;
  const unreadSystem = visibleSystem.filter((n) => !n.is_read).length;
  const unread = unreadFollows + unreadSystem;

  // Merge both sources, newest first.
  const items = [
    ...visibleFollows.map((f) => ({ key: `f:${f.id}`, kind: "follow", at: f.created_at, data: f })),
    ...visibleSystem.map((s) => ({ key: `s:${s.id}`, kind: "system", at: s.created_at, data: s })),
  ].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));

  const togglePanel = async () => {
    const next = !open;
    setOpen(next);
    if (!next || !user) return;

    await load();

    // Optimistically clear the badge: advance the local "seen" mark to now and
    // flip system rows read. The DB writes below make it stick across devices.
    const now = new Date().toISOString();
    setSeenAt(now);
    setSystem((cur) => cur.map((n) => ({ ...n, is_read: true })));

    // Source of truth: persist both read-markers to the DB.
    const [{ error: seenErr }, { error: updErr }] = await Promise.all([
      supabase
        .from("profiles")
        .update({ notifications_seen_at: now })
        .eq("id", user.id),
      supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
    ]);
    if (seenErr) {
      console.warn(
        "[notifications] could not persist notifications_seen_at — apply the " +
          "notifications_seen_at column from supabase-rls.sql:",
        seenErr.message
      );
    }
    if (updErr) {
      console.warn(
        "[notifications] mark-as-read rejected — add the " +
          "users_update_own_notifications UPDATE policy from supabase-rls.sql:",
        updErr.message
      );
    }
  };

  const accept = async (n) => {
    setBusyId(n.id);
    const { error } = await supabase
      .from("follows")
      .update({ status: "accepted" })
      .eq("id", n.id);
    if (!error)
      setFollows((ns) =>
        ns.map((x) => (x.id === n.id ? { ...x, status: "accepted" } : x))
      );
    setBusyId(null);
  };

  const decline = async (n) => {
    setBusyId(n.id);
    const { error } = await supabase.from("follows").delete().eq("id", n.id);
    if (!error) setFollows((ns) => ns.filter((x) => x.id !== n.id));
    setBusyId(null);
  };

  // Dismiss a single system notification — deletes the row (needs the
  // users_delete_own_notifications RLS policy). Optimistic: drop it immediately.
  const dismissSystem = async (n) => {
    setSystem((cur) => cur.filter((x) => x.id !== n.id));
    const { error } = await supabase.from("notifications").delete().eq("id", n.id);
    if (error) {
      console.warn(
        "[notifications] delete rejected — add the users_delete_own_notifications " +
          "DELETE policy from supabase-rls.sql:",
        error.message
      );
    }
  };

  // Clear everything: delete all system rows and advance the seen marker so
  // informational follow rows drop out too. Pending requests intentionally stay.
  const clearAll = async () => {
    if (!user) return;
    const ids = visibleSystem.map((n) => n.id);
    const now = new Date().toISOString();
    setSystem([]);
    setSeenAt(now);
    await Promise.all([
      ids.length
        ? supabase.from("notifications").delete().in("id", ids)
        : Promise.resolve(),
      supabase
        .from("profiles")
        .update({ notifications_seen_at: now })
        .eq("id", user.id),
    ]);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={togglePanel}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:text-fg"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-medium text-fg">Notifications</span>
            {items.length > 0 && (
              <button
                onClick={clearAll}
                className="mono text-xs text-muted transition-colors hover:text-fg"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="mono p-6 text-center text-sm text-muted">
                No notifications yet
              </p>
            ) : (
              items.map((item) =>
                item.kind === "follow" ? (
                  <FollowNotifRow
                    key={item.key}
                    n={item.data}
                    unread={isFollowUnread(item.data)}
                    busy={busyId === item.data.id}
                    onAccept={accept}
                    onDecline={decline}
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  <SystemNotifRow
                    key={item.key}
                    n={item.data}
                    unread={!item.data.is_read}
                    onDismiss={dismissSystem}
                  />
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Small dot marking an unread row.
function UnreadDot({ show }) {
  if (!show) return null;
  return (
    <span
      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
      aria-label="unread"
    />
  );
}

function FollowNotifRow({ n, unread, busy, onAccept, onDecline, onNavigate }) {
  const actor = n.actor || {};
  const href = actor.id ? `/athletes/${actor.id}` : "#";
  const isPending = n.status === "pending";

  return (
    <div className="flex items-start gap-3 border-b border-line/60 px-4 py-3 last:border-b-0 hover:bg-white/5">
      <Avatar
        username={actor.username}
        avatarUrl={actor.avatar_url}
        size={40}
        href={actor.id ? href : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-fg">
          <Link
            href={href}
            onClick={onNavigate}
            className="font-medium hover:text-accent"
          >
            {actor.username || "someone"}
          </Link>{" "}
          <span className="text-muted">
            {isPending ? "requested to follow you" : "started following you"}
          </span>
        </p>
        {n.created_at && (
          <span className="mono text-xs text-muted">{timeAgo(n.created_at)}</span>
        )}
        {isPending && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onAccept(n)}
              disabled={busy}
              className="btn btn-primary"
            >
              {busy ? "…" : "Accept"}
            </button>
            <button
              onClick={() => onDecline(n)}
              disabled={busy}
              className="btn btn-muted"
            >
              Decline
            </button>
          </div>
        )}
      </div>
      <UnreadDot show={unread} />
    </div>
  );
}

function SystemNotifRow({ n, unread, onDismiss }) {
  return (
    <div className="group flex items-start gap-3 border-b border-line/60 px-4 py-3 last:border-b-0 hover:bg-white/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-fg">{n.message}</p>
        {n.created_at && (
          <span className="mono text-xs text-muted">{timeAgo(n.created_at)}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <UnreadDot show={unread} />
        <button
          onClick={() => onDismiss?.(n)}
          aria-label="Dismiss"
          className="text-muted opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
