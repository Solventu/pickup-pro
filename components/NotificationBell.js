"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { timeAgo } from "@/lib/helpers";
import Avatar from "./Avatar";

// The bell merges two notification sources:
//   1) follows table  -> follow requests / new followers (with Accept/Decline).
//      Read-state is tracked client-side (localStorage), keyed by follow-row id.
//   2) notifications table -> system messages (e.g. admin removed your post).
//      Read-state is the DB `is_read` column, so "seen" persists across reloads
//      and devices (this is what fixes notifications re-appearing as unread).
//
// Opening the panel marks everything read: follows into localStorage, and system
// rows via a single UPDATE ... SET is_read = true. The badge drops to 0 at once
// (optimistic) and stays 0 on the next load because the DB now agrees.

const seenKey = (uid) => `pickuppro_notif_seen_${uid}`;

function readSeen(uid) {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) || "[]"));
  } catch {
    return new Set();
  }
}
function writeSeen(uid, set) {
  try {
    localStorage.setItem(seenKey(uid), JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

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
  const [seen, setSeen] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const ref = useRef(null);

  const load = useCallback(async () => {
    if (!user) {
      setFollows([]);
      setSystem([]);
      return [];
    }
    const [followsRes, notifRes] = await Promise.all([
      supabase.from("follows").select("*").eq("following_id", user.id),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
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
    setFollows(enriched);
    setSystem(sys);
    return { follows: enriched, system: sys };
  }, [user?.id]);

  useEffect(() => {
    if (user) setSeen(readSeen(user.id));
    else setSeen(new Set());
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [user?.id, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // A notification is unread only if the DB says so AND we haven't locally marked
  // it seen. The localStorage `seen` fallback keeps the badge cleared across
  // reload/re-login on this browser even if the DB update is blocked by RLS.
  const unreadFollows = follows.filter((n) => !seen.has(n.id)).length;
  const unreadSystem = system.filter((n) => !n.is_read && !seen.has(n.id)).length;
  const unread = unreadFollows + unreadSystem;

  // Merge both sources, newest first.
  const items = [
    ...follows.map((f) => ({ key: `f:${f.id}`, kind: "follow", at: f.created_at, data: f })),
    ...system.map((s) => ({ key: `s:${s.id}`, kind: "system", at: s.created_at, data: s })),
  ].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));

  const togglePanel = async () => {
    const next = !open;
    setOpen(next);
    if (!next || !user) return;

    const { follows: ff, system: ss } = await load();

    // Mark BOTH sources seen in localStorage. This clears the badge immediately
    // and keeps it cleared across reload/re-login on this browser even if the DB
    // update below is blocked by RLS. (Follow + notification ids are distinct
    // UUIDs, so a single set is safe for both.)
    const ns = new Set(seen);
    ff.forEach((n) => ns.add(n.id));
    ss.forEach((n) => ns.add(n.id));
    setSeen(ns);
    writeSeen(user.id, ns);

    // Persist system read-state to the DB (source of truth across devices).
    setSystem((cur) => cur.map((n) => ({ ...n, is_read: true })));
    const { error: updErr } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
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
          <div className="border-b border-line px-4 py-3 text-sm font-medium text-fg">
            Notifications
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
                    unread={!seen.has(item.data.id)}
                    busy={busyId === item.data.id}
                    onAccept={accept}
                    onDecline={decline}
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  <SystemNotifRow
                    key={item.key}
                    n={item.data}
                    unread={!item.data.is_read && !seen.has(item.data.id)}
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
            @{actor.username || "someone"}
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

function SystemNotifRow({ n, unread }) {
  return (
    <div className="flex items-start gap-3 border-b border-line/60 px-4 py-3 last:border-b-0 hover:bg-white/5">
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
      <UnreadDot show={unread} />
    </div>
  );
}
