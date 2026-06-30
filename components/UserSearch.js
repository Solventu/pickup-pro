"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { escapeLike, emitFollowsChanged } from "@/lib/helpers";
import Avatar from "./Avatar";

function SearchIcon() {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FollowButton({ row, busy, onClick }) {
  const accepted = row.rel === "accepted";
  const pending = row.rel === "pending";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`btn shrink-0 ${
        accepted ? "btn-primary" : pending ? "btn-muted" : "btn-outline"
      }`}
    >
      {busy ? "…" : accepted ? "Following" : pending ? "Requested" : "Follow"}
    </button>
  );
}

export default function UserSearch() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Close on scroll — the dropdown is anchored to the sticky navbar, so left
    // open it would otherwise float fixed at the top of the screen.
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  // Debounced, case-insensitive partial-match search by username
  useEffect(() => {
    const term = q.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      let query = supabase
        .from("profiles")
        .select("id,username,avatar_url,is_private")
        .ilike("username", `%${escapeLike(term)}%`)
        .order("username", { ascending: true })
        .limit(15);
      if (user) query = query.neq("id", user.id); // exclude self
      const { data } = await query;
      const list = data || [];

      // Resolve the current user's relationship to each result
      const relMap = {};
      if (user && list.length) {
        const ids = list.map((p) => p.id);
        const { data: rels } = await supabase
          .from("follows")
          .select("following_id,status")
          .eq("follower_id", user.id)
          .in("following_id", ids);
        (rels || []).forEach((r) => {
          relMap[r.following_id] = r.status;
        });
      }
      setResults(list.map((p) => ({ ...p, rel: relMap[p.id] || null })));
      setLoading(false);
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [q, user?.id]);

  const goTo = (id) => {
    setOpen(false);
    setQ("");
    router.push(`/athletes/${id}`);
  };

  // Same follow logic used across the app: insert (pending if target private,
  // else accepted) to follow; delete to unfollow / cancel a request.
  const toggleFollow = async (row) => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (busyId) return;
    setBusyId(row.id);
    const isFollowingOrPending = row.rel === "accepted" || row.rel === "pending";

    if (isFollowingOrPending) {
      setResults((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, rel: null } : r))
      );
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", row.id)
        .select();
      if (error)
        setResults((rs) =>
          rs.map((r) => (r.id === row.id ? { ...r, rel: row.rel } : r))
        );
      else emitFollowsChanged();
    } else {
      const status = row.is_private ? "pending" : "accepted";
      setResults((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, rel: status } : r))
      );
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: row.id, status });
      if (error)
        setResults((rs) =>
          rs.map((r) => (r.id === row.id ? { ...r, rel: null } : r))
        );
      else emitFollowsChanged();
    }
    setBusyId(null);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Search users"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:text-fg"
      >
        <SearchIcon />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
          <div className="border-b border-line p-3">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search athletes by username…"
              className="field-input"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <p className="mono p-4 text-sm text-muted">Searching…</p>
            ) : !q.trim() ? (
              <p className="mono p-4 text-sm text-muted">
                Type a username to find athletes.
              </p>
            ) : results.length === 0 ? (
              <p className="mono p-4 text-sm text-muted">No users found</p>
            ) : (
              results.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5"
                >
                  <button
                    onClick={() => goTo(row.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar
                      username={row.username}
                      avatarUrl={row.avatar_url}
                      size={40}
                    />
                    <span className="truncate font-medium text-fg">
                      @{row.username || "unknown"}
                    </span>
                  </button>
                  <FollowButton
                    row={row}
                    busy={busyId === row.id}
                    onClick={() => toggleFollow(row)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
