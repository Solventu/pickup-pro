"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { emitFollowsChanged } from "@/lib/helpers";
import Avatar from "./Avatar";

export default function FollowListModal({
  open,
  onClose,
  mode, // "followers" | "following"
  profileId,
  canView,
  currentUser,
  onChanged,
}) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [confirmId, setConfirmId] = useState(null);

  const setBusy = (id, on) =>
    setBusyIds((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const title = mode === "followers" ? "Urmăritori" : "Urmărești";
  const emptyText =
    mode === "followers"
      ? "Niciun urmăritor încă"
      : "Nu urmărește pe nimeni încă";

  // "Remove follower" is only available in the followers list of your OWN profile
  const canRemove =
    mode === "followers" && !!currentUser && currentUser.id === profileId;

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Load the list when opened (and the viewer is allowed to see it)
  useEffect(() => {
    if (!open) return;
    if (!canView) {
      setRows([]);
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setConfirmId(null);
      // For "followers": rows where following_id = profile, take follower_id.
      // For "following": rows where follower_id = profile, take following_id.
      const matchCol = mode === "followers" ? "following_id" : "follower_id";
      const pickCol = mode === "followers" ? "follower_id" : "following_id";

      const { data: rels } = await supabase
        .from("follows")
        .select(pickCol)
        .eq(matchCol, profileId)
        .eq("status", "accepted");
      const ids = [...new Set((rels || []).map((r) => r[pickCol]).filter(Boolean))];

      if (!ids.length) {
        if (active) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,is_private")
        .in("id", ids);

      // The viewer's own relationship to each listed user
      const relMap = {};
      if (currentUser) {
        const { data: mine } = await supabase
          .from("follows")
          .select("following_id,status")
          .eq("follower_id", currentUser.id)
          .in("following_id", ids);
        (mine || []).forEach((m) => {
          relMap[m.following_id] = m.status;
        });
      }

      const list = (profs || []).map((p) => ({ ...p, rel: relMap[p.id] || null }));
      if (active) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, mode, profileId, canView, currentUser?.id]);

  const goTo = (id) => {
    onClose?.();
    router.push(`/athletes/${id}`);
  };

  const toggleFollow = async (row) => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (busyIds.has(row.id)) return;
    setBusy(row.id, true);
    const isFollowingOrPending = row.rel === "accepted" || row.rel === "pending";

    if (isFollowingOrPending) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, rel: null } : r))
      );
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", row.id)
        .select();
      if (error) {
        setRows((rs) =>
          rs.map((r) => (r.id === row.id ? { ...r, rel: row.rel } : r))
        );
      } else {
        onChanged?.();
        emitFollowsChanged();
      }
    } else {
      const status = row.is_private ? "pending" : "accepted";
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, rel: status } : r))
      );
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: currentUser.id, following_id: row.id, status });
      if (error) {
        setRows((rs) =>
          rs.map((r) => (r.id === row.id ? { ...r, rel: null } : r))
        );
      } else {
        onChanged?.();
        emitFollowsChanged();
      }
    }
    setBusy(row.id, false);
  };

  // Silently remove someone from MY followers (delete their follow of me).
  const removeFollower = async (row) => {
    if (busyIds.has(row.id)) return;
    setBusy(row.id, true);
    const snapshot = rows;
    // Optimistic: drop the row + refresh count immediately
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    setConfirmId(null);
    onChanged?.();
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", row.id)
      .eq("following_id", profileId)
      .select();
    if (error) {
      setRows(snapshot); // revert on failure
    }
    setBusy(row.id, false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h3 className="text-lg font-medium text-fg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted transition-colors hover:text-fg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="mono p-4 text-sm text-muted">Se încarcă…</p>
          ) : !canView ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <span className="text-3xl">🔒</span>
              <p className="text-sm text-muted">Acest cont este privat</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="mono p-6 text-center text-sm text-muted">{emptyText}</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => {
                const isSelf = currentUser && currentUser.id === row.id;
                const isFollowing = row.rel === "accepted";
                const isPending = row.rel === "pending";
                const confirming = confirmId === row.id;
                return (
                  <li
                    key={row.id}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/5"
                  >
                    {confirming ? (
                      <>
                        <Avatar
                          username={row.username}
                          avatarUrl={row.avatar_url}
                          size={40}
                        />
                        <span className="min-w-0 flex-1 text-sm text-fg">
                          Elimini @{row.username || "user"} din urmăritori?
                        </span>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={busyIds.has(row.id)}
                            className="btn btn-muted"
                          >
                            Anulează
                          </button>
                          <button
                            onClick={() => removeFollower(row)}
                            disabled={busyIds.has(row.id)}
                            className="btn btn-danger"
                          >
                            {busyIds.has(row.id) ? "…" : "Confirmă"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
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

                        {isSelf ? (
                          <span className="mono text-xs text-muted">Tu</span>
                        ) : (
                          <button
                            onClick={() => toggleFollow(row)}
                            disabled={busyIds.has(row.id)}
                            className={`btn ${
                              isFollowing
                                ? "btn-primary"
                                : isPending
                                ? "btn-muted"
                                : "btn-outline"
                            }`}
                          >
                            {busyIds.has(row.id)
                              ? "…"
                              : isFollowing
                              ? "Urmărești"
                              : isPending
                              ? "Solicitat"
                              : "Urmărește"}
                          </button>
                        )}

                        {canRemove && !isSelf && (
                          <button
                            onClick={() => setConfirmId(row.id)}
                            title="Elimină din urmăritori"
                            className="shrink-0 px-1.5 text-sm text-muted opacity-100 transition-opacity hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            Elimină
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
